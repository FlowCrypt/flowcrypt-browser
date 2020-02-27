/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Url } from '../../js/common/core/common.js';
import { ApiErr } from '../../js/common/api/error/api-error.js';
import { Assert } from '../../js/common/assert.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Contact, KeyInfo } from '../../js/common/core/pgp-key.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Google } from '../../js/common/api/google.js';
import { KeyImportUi } from '../../js/common/ui/key-import-ui.js';
import { Lang } from '../../js/common/lang.js';
import { PgpKey } from '../../js/common/core/pgp-key.js';
import { Rules } from '../../js/common/rules.js';
import { Settings } from '../../js/common/settings.js';
import { SetupCreateKeyModule } from './setup/setup-create-key.js';
import { SetupImportKeyModule } from './setup/setup-import-key.js';
import { SetupRecoverKeyModule } from './setup/setup-recover-key.js';
import { SetupRenderModule } from './setup/setup-render.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { initPassphraseToggle } from '../../js/common/ui/passphrase-ui.js';
import { Keyserver } from '../../js/common/api/keyserver.js';
import { Scopes, AcctStoreDict, AcctStore } from '../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { PassphraseStore } from '../../js/common/platform/store/passphrase-store.js';
import { ContactStore } from '../../js/common/platform/store/contact-store.js';
import { KeyManager } from '../../js/common/api/key-manager.js';
import { SetupKeyManagerAutogenModule } from './setup/setup-key-manager-autogen.js';

export interface SetupOptions {
  passphrase: string;
  passphrase_save: boolean;
  submit_main: boolean;
  submit_all: boolean;
  recovered?: boolean;
}

export class SetupView extends View {

  public readonly acctEmail: string;
  public readonly parentTabId: string | undefined;
  public readonly action: 'add_key' | 'finalize' | undefined;
  public readonly idToken: string;

  public readonly keyImportUi = new KeyImportUi({ checkEncryption: true });
  public readonly gmail: Gmail;
  public readonly setupRecoverKey: SetupRecoverKeyModule;
  public readonly setupCreateKey: SetupCreateKeyModule;
  public readonly setupImportKey: SetupImportKeyModule;
  public readonly setupRender: SetupRenderModule;
  public readonly setupKeyManagerAutogen: SetupKeyManagerAutogenModule;

  public tabId!: string;
  public scopes!: Scopes;
  public storage!: AcctStoreDict;
  public rules!: Rules;
  public keyserver!: Keyserver;
  public keyManager: KeyManager | undefined; // not set if no url in org rules

  public acctEmailAttesterLongid: string | undefined;
  public fetchedKeyBackups: KeyInfo[] = [];
  public fetchedKeyBackupsUniqueLongids: string[] = [];
  public importedKeysUniqueLongids: string[] = [];
  public mathingPassphrases: string[] = [];
  public submitKeyForAddrs: string[];

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'action', 'idToken', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.idToken = Assert.urlParamRequire.string(uncheckedUrlParams, 'idToken');
    this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['add_key', 'finalize', undefined]) as 'add_key' | 'finalize' | undefined;
    if (this.action === 'add_key') {
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    }
    if (this.acctEmail) {
      BrowserMsg.send.bg.updateUninstallUrl();
    } else {
      window.location.href = 'index.htm';
    }
    this.submitKeyForAddrs = [this.acctEmail];
    this.keyImportUi.initPrvImportSrcForm(this.acctEmail, this.parentTabId); // for step_2b_manual_enter, if user chooses so
    this.keyImportUi.onBadPassphrase = () => $('#step_2b_manual_enter .input_passphrase').val('').focus();
    this.keyImportUi.renderPassPhraseStrengthValidationInput($('.input_password'), $('.action_create_private'));
    this.gmail = new Gmail(this.acctEmail);
    // modules
    this.setupRecoverKey = new SetupRecoverKeyModule(this);
    this.setupCreateKey = new SetupCreateKeyModule(this);
    this.setupImportKey = new SetupImportKeyModule(this);
    this.setupRender = new SetupRenderModule(this);
    this.setupKeyManagerAutogen = new SetupKeyManagerAutogenModule(this);
  }

  public render = async () => {
    await initPassphraseToggle(['step_2b_manual_enter_passphrase'], 'hide');
    await initPassphraseToggle(['step_2a_manual_create_input_password', 'step_2a_manual_create_input_password2', 'recovery_pasword']);
    this.storage = await AcctStore.get(this.acctEmail, ['setup_done', 'email_provider']);
    this.scopes = await AcctStore.getScopes(this.acctEmail);
    this.storage.email_provider = this.storage.email_provider || 'gmail';
    this.rules = await Rules.newInstance(this.acctEmail);
    this.keyserver = new Keyserver(this.rules);
    if (this.rules.getPrivateKeyManagerUrl()) {
      this.keyManager = new KeyManager(this.rules.getPrivateKeyManagerUrl()!, this.idToken);
    }
    if (!this.rules.canCreateKeys()) {
      const forbidden = `${Lang.setup.creatingKeysNotAllowedPleaseImport} <a href="${Xss.escape(window.location.href)}">Back</a>`;
      Xss.sanitizeRender('#step_2a_manual_create, #step_2_easy_generating', `<div class="aligncenter"><div class="line">${forbidden}</div></div>`);
      $('.back').remove(); // back button would allow users to choose other options (eg create - not allowed)
    }
    if (this.rules.mustSubmitToAttester() || !this.rules.canSubmitPubToAttester()) {
      $('.remove_if_pubkey_submitting_not_user_configurable').remove();
    }
    if (this.rules.rememberPassPhraseByDefault()) {
      $('#step_2a_manual_create .input_passphrase_save').prop('checked', true);
      $('#step_2b_manual_enter .input_passphrase_save').prop('checked', true);
    }
    this.tabId = await BrowserMsg.requiredTabId();
    await this.setupRender.renderInitial();
  }

  public setHandlers = () => {
    BrowserMsg.addListener('close_page', async () => { $('.featherlight-close').click(); });
    BrowserMsg.addListener('notification_show', async ({ notification }: Bm.NotificationShow) => { await Ui.modal.info(notification); });
    BrowserMsg.listen(this.tabId);
    $('.action_send').attr('href', Google.webmailUrl(this.acctEmail));
    $('.action_show_help').click(this.setHandler(() => Settings.renderSubPage(this.acctEmail, this.tabId!, '/chrome/settings/modules/help.htm')));
    $('.back').off().click(this.setHandler(() => this.actionBackHandler()));
    $('#step_2_recovery .action_recover_account').click(this.setHandlerPrevent('double', () => this.setupRecoverKey.actionRecoverAccountHandler()));
    $('#step_4_more_to_recover .action_recover_remaining').click(this.setHandler(() => this.setupRecoverKey.actionRecoverRemainingKeysHandler()));
    $('.action_skip_recovery').click(this.setHandler(() => this.setupRecoverKey.actionSkipRecoveryHandler()));
    $('.action_account_settings').click(this.setHandler(() => { window.location.href = Url.create('index.htm', { acctEmail: this.acctEmail }); }));
    const authDeniedPage = '/chrome/settings/modules/auth_denied.htm';
    $('.action_go_auth_denied').click(this.setHandler(() => { window.location.href = Url.create('index.htm', { acctEmail: this.acctEmail, page: authDeniedPage }); }));
    $('.input_submit_key').click(this.setHandler(el => this.actionSubmitPublicKeyToggleHandler(el)));
    $('#step_0_found_key .action_manual_create_key, #step_1_easy_or_manual .action_manual_create_key').click(this.setHandler(() => this.setupRender.displayBlock('step_2a_manual_create')));
    $('#step_0_found_key .action_manual_enter_key, #step_1_easy_or_manual .action_manual_enter_key').click(this.setHandler(() => this.setupRender.displayBlock('step_2b_manual_enter')));
    $('#step_2b_manual_enter .action_add_private_key').click(this.setHandler(el => this.setupImportKey.actionImportPrivateKeyHandle(el)));
    $('#step_2a_manual_create .action_create_private').click(this.setHandlerPrevent('double', () => this.setupCreateKey.actionCreateKeyHandler()));
    $('#step_2a_manual_create .action_show_advanced_create_settings').click(this.setHandler(el => this.setupCreateKey.actionShowAdvancedSettingsHandle(el)));
    $('#step_4_close .action_close').click(this.setHandler(() => this.actionCloseHandler())); // only rendered if action=add_key which means parentTabId was used
    $('.input_password').on('keydown', this.setEnterHandlerThatClicks('#step_2a_manual_create .action_create_private'));
    $('.input_password2').on('keydown', this.setEnterHandlerThatClicks('#step_2a_manual_create .action_create_private'));
    $("#recovery_pasword").on('keydown', this.setEnterHandlerThatClicks('#step_2_recovery .action_recover_account'));
  }

  public actionBackHandler = () => {
    $('h1').text('Set Up');
    this.setupRender.displayBlock('step_1_easy_or_manual');
  }

  public actionSubmitPublicKeyToggleHandler = (target: HTMLElement) => {
    // will be hidden / ignored / forced true when rules.mustSubmitToAttester() === true (for certain orgs)
    const inputSubmitAll = $(target).closest('.manual').find('.input_submit_all').first();
    if ($(target).prop('checked')) {
      if (inputSubmitAll.closest('div.line').css('visibility') === 'visible') {
        inputSubmitAll.prop({ checked: true, disabled: false });
      }
    } else {
      inputSubmitAll.prop({ checked: false, disabled: true });
    }
  }

  public actionCloseHandler = () => {
    if (this.parentTabId) {
      BrowserMsg.send.redirect(this.parentTabId, { location: Url.create('index.htm', { acctEmail: this.acctEmail, advanced: true }) });
    } else {
      Catch.report('setup.ts missing parentTabId');
    }
  }

  public preFinalizeSetup = async (options: SetupOptions): Promise<void> => {
    await AcctStore.set(this.acctEmail, { tmp_submit_main: options.submit_main, tmp_submit_all: options.submit_all });
  }

  public finalizeSetup = async ({ submit_main, submit_all }: { submit_main: boolean, submit_all: boolean }): Promise<void> => {
    const [primaryKi] = await KeyStore.get(this.acctEmail, ['primary']);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    try {
      await this.submitPublicKeyIfNeeded(primaryKi.public, { submit_main, submit_all });
    } catch (e) {
      return await Settings.promptToRetry('REQUIRED', e, Lang.setup.failedToSubmitToAttester, () => this.finalizeSetup({ submit_main, submit_all }));
    }
    await AcctStore.set(this.acctEmail, { setup_date: Date.now(), setup_done: true, cryptup_enabled: true });
    await AcctStore.remove(this.acctEmail, ['tmp_submit_main', 'tmp_submit_all']);
  }

  public saveKeys = async (prvs: OpenPGP.key.Key[], options: SetupOptions) => {
    for (const prv of prvs) {
      const longid = await PgpKey.longid(prv);
      if (!longid) {
        await Ui.modal.error('Cannot save keys to storage because at least one of them is not valid.');
        return;
      }
      await KeyStore.add(this.acctEmail, prv.armor());
      await PassphraseStore.set(options.passphrase_save ? 'local' : 'session', this.acctEmail, longid, options.passphrase);
    }
    const myOwnEmailAddrsAsContacts: Contact[] = [];
    const { full_name: name } = await AcctStore.get(this.acctEmail, ['full_name']);
    for (const email of this.submitKeyForAddrs) {
      myOwnEmailAddrsAsContacts.push(await ContactStore.obj({
        email,
        name,
        client: 'cryptup',
        pubkey: prvs[0].toPublic().armor(),
        lastUse: Date.now(),
        lastSig: await PgpKey.lastSig(prvs[0].toPublic())
      }));
    }
    await ContactStore.save(undefined, myOwnEmailAddrsAsContacts);
  }

  public shouldSubmitPubkey = (checkboxSelector: string) => {
    if (this.rules.mustSubmitToAttester() && !this.rules.canSubmitPubToAttester()) {
      throw new Error('Organisation rules are misconfigured: ENFORCE_ATTESTER_SUBMIT not compatible with NO_ATTESTER_SUBMIT');
    }
    if (!this.rules.canSubmitPubToAttester()) {
      return false;
    }
    if (this.rules.mustSubmitToAttester()) {
      return true;
    }
    return Boolean($(checkboxSelector).prop('checked'));
  }

  private submitPublicKeyIfNeeded = async (armoredPubkey: string, options: { submit_main: boolean, submit_all: boolean }) => {
    if (!options.submit_main) {
      return;
    }
    if (!this.rules.canSubmitPubToAttester()) {
      await Ui.modal.error('Not submitting public key to Attester - disabled for your org');
      return;
    }
    this.keyserver.attester.testWelcome(this.acctEmail, armoredPubkey).catch(ApiErr.reportIfSignificant);
    let addresses;
    if (this.submitKeyForAddrs.length && options.submit_all) {
      addresses = [...this.submitKeyForAddrs];
    } else {
      addresses = [this.acctEmail];
    }
    if (this.acctEmailAttesterLongid && this.acctEmailAttesterLongid !== await PgpKey.longid(armoredPubkey)) {
      // already submitted another pubkey for this email
      // todo - offer user to fix it up
      return;
    }
    await this.submitPubkeys(addresses, armoredPubkey);
  }

  private submitPubkeys = async (addresses: string[], pubkey: string) => {
    await this.keyserver.attester.initialLegacySubmit(this.acctEmail, pubkey);
    const aliases = addresses.filter(a => a !== this.acctEmail);
    if (aliases.length) {
      await Promise.all(aliases.map(a => this.keyserver.attester.initialLegacySubmit(a, pubkey)));
    }
  }

}

View.run(SetupView);
