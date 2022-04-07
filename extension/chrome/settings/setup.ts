/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Url } from '../../js/common/core/common.js';
import { ApiErr } from '../../js/common/api/shared/api-error.js';
import { Assert } from '../../js/common/assert.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Key, KeyInfoWithIdentity, KeyUtil } from '../../js/common/core/crypto/key.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Google } from '../../js/common/api/email-provider/gmail/google.js';
import { KeyImportUi } from '../../js/common/ui/key-import-ui.js';
import { Lang } from '../../js/common/lang.js';
import { opgp } from '../../js/common/core/crypto/pgp/openpgpjs-custom.js';
import { OrgRules } from '../../js/common/org-rules.js';
import { Settings } from '../../js/common/settings.js';
import { SetupCreateKeyModule } from './setup/setup-create-key.js';
import { SetupImportKeyModule } from './setup/setup-import-key.js';
import { SetupRecoverKeyModule } from './setup/setup-recover-key.js';
import { SetupRenderModule } from './setup/setup-render.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { initPassphraseToggle } from '../../js/common/ui/passphrase-ui.js';
import { PubLookup } from '../../js/common/api/pub-lookup.js';
import { Scopes, AcctStoreDict, AcctStore } from '../../js/common/platform/store/acct-store.js';
import { KeyStore, KeyStoreUtil } from '../../js/common/platform/store/key-store.js';
import { PassphraseStore } from '../../js/common/platform/store/passphrase-store.js';
import { ContactStore } from '../../js/common/platform/store/contact-store.js';
import { KeyManager } from '../../js/common/api/key-server/key-manager.js';
import { SetupWithEmailKeyManagerModule } from './setup/setup-key-manager-autogen.js';
import { shouldPassPhraseBeHidden } from '../../js/common/ui/passphrase-ui.js';
import Swal from 'sweetalert2';

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
  public readonly idToken: string | undefined; // only needed for initial setup, not for add_key or 'finalize'

  public readonly keyImportUi = new KeyImportUi({ checkEncryption: true });
  public readonly gmail: Gmail;
  public readonly setupRecoverKey: SetupRecoverKeyModule;
  public readonly setupCreateKey: SetupCreateKeyModule;
  public readonly setupImportKey: SetupImportKeyModule;
  public readonly setupRender: SetupRenderModule;
  public readonly setupWithEmailKeyManager: SetupWithEmailKeyManagerModule;

  public tabId!: string;
  public scopes!: Scopes;
  public storage!: AcctStoreDict;
  public orgRules!: OrgRules;
  public pubLookup!: PubLookup;
  public keyManager: KeyManager | undefined; // not set if no url in org rules

  public fetchedKeyBackups: KeyInfoWithIdentity[] = [];
  public fetchedKeyBackupsUniqueLongids: string[] = [];
  public importedKeysUniqueLongids: string[] = [];
  public mathingPassphrases: string[] = [];
  public submitKeyForAddrs: string[];

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'action', 'idToken', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['add_key', 'finalize', undefined]) as 'add_key' | 'finalize' | undefined;
    if (this.action === 'add_key') {
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    } else {
      this.idToken = Assert.urlParamRequire.string(uncheckedUrlParams, 'idToken');
    }
    if (this.acctEmail) {
      BrowserMsg.send.bg.updateUninstallUrl();
    } else {
      window.location.href = 'index.htm';
    }
    this.submitKeyForAddrs = [];
    this.keyImportUi.initPrvImportSrcForm(this.acctEmail, this.parentTabId, this.submitKeyForAddrs); // for step_2b_manual_enter, if user chooses so
    this.keyImportUi.onBadPassphrase = () => $('#step_2b_manual_enter .input_passphrase').val('').focus();
    this.keyImportUi.renderPassPhraseStrengthValidationInput($('#step_2a_manual_create .input_password'), $('#step_2a_manual_create .action_proceed_private'));
    this.keyImportUi.renderPassPhraseStrengthValidationInput($('#step_2_ekm_choose_pass_phrase .input_password'), $('#step_2_ekm_choose_pass_phrase .action_proceed_private'));
    this.gmail = new Gmail(this.acctEmail);
    // modules
    this.setupRecoverKey = new SetupRecoverKeyModule(this);
    this.setupCreateKey = new SetupCreateKeyModule(this);
    this.setupImportKey = new SetupImportKeyModule(this);
    this.setupRender = new SetupRenderModule(this);
    this.setupWithEmailKeyManager = new SetupWithEmailKeyManagerModule(this);
  }

  public isFesUsed = () => Boolean(this.storage.fesUrl);

  public render = async () => {
    await initPassphraseToggle(['step_2b_manual_enter_passphrase'], 'hide');
    await initPassphraseToggle([
      'step_2a_manual_create_input_password', 'step_2a_manual_create_input_password2',
      'step_2_ekm_input_password', 'step_2_ekm_input_password2',
      'recovery_password']);
    this.storage = await AcctStore.get(this.acctEmail, ['setup_done', 'email_provider', 'fesUrl']);
    this.scopes = await AcctStore.getScopes(this.acctEmail);
    this.storage.email_provider = this.storage.email_provider || 'gmail';
    this.orgRules = await OrgRules.newInstance(this.acctEmail);
    if (this.orgRules.shouldHideArmorMeta() && typeof opgp !== 'undefined') {
      opgp.config.show_comment = false;
      opgp.config.show_version = false;
    }
    this.pubLookup = new PubLookup(this.orgRules);
    if (this.orgRules.usesKeyManager() && this.idToken) {
      this.keyManager = new KeyManager(this.orgRules.getKeyManagerUrlForPrivateKeys()!);
    }
    if (!this.orgRules.canCreateKeys()) {
      const forbidden = `${Lang.setup.creatingKeysNotAllowedPleaseImport} <a href="${Xss.escape(window.location.href)}">Back</a>`;
      Xss.sanitizeRender('#step_2a_manual_create, #step_2_easy_generating', `<div class="aligncenter"><div class="line">${forbidden}</div></div>`);
      $('#button-go-back').remove(); // back button would allow users to choose other options (eg create - not allowed)
    }
    if (this.orgRules.mustSubmitToAttester() || !this.orgRules.canSubmitPubToAttester()) {
      $('.remove_if_pubkey_submitting_not_user_configurable').remove();
    }
    if (this.orgRules.forbidStoringPassPhrase()) {
      $('.input_passphrase_save').prop('checked', false);
    } else {
      $('.input_passphrase_save_label').removeClass('hidden');
      if (this.orgRules.rememberPassPhraseByDefault()) {
        $('.input_passphrase_save').prop('checked', true);
      }
    }
    if (this.orgRules.getEnforcedKeygenAlgo()) {
      $('.key_type').val(this.orgRules.getEnforcedKeygenAlgo()!).prop('disabled', true);
    }
    if (!this.orgRules.canBackupKeys()) {
      $('.input_backup_inbox').prop('checked', false).prop('disabled', true);
      $('.remove_if_backup_not_allowed').remove();
    }
    this.tabId = await BrowserMsg.requiredTabId();
    await this.setupRender.renderInitial();
  };

  public setHandlers = () => {
    BrowserMsg.addListener('close_page', async () => { Swal.close(); });
    BrowserMsg.addListener('notification_show', async ({ notification }: Bm.NotificationShow) => { await Ui.modal.info(notification); });
    BrowserMsg.listen(this.tabId);
    $('.action_send').attr('href', Google.webmailUrl(this.acctEmail));
    $('.action_show_help').click(this.setHandler(async () => await Settings.renderSubPage(this.acctEmail, this.tabId!, '/chrome/settings/modules/help.htm')));
    $('#button-go-back').off().click(this.setHandler(() => this.actionBackHandler()));
    $('#step_2_ekm_choose_pass_phrase .action_proceed_private').click(this.setHandlerPrevent('double', () => this.setupWithEmailKeyManager.continueEkmSetupHandler()));
    $('#step_2_recovery .action_recover_account').click(this.setHandlerPrevent('double', () => this.setupRecoverKey.actionRecoverAccountHandler()));
    $('#step_4_more_to_recover .action_recover_remaining').click(this.setHandler(() => this.setupRecoverKey.actionRecoverRemainingKeysHandler()));
    $('#lost_pass_phrase').click(this.setHandler(() => this.showLostPassPhraseModal()));
    $('.action_account_settings').click(this.setHandler(() => { window.location.href = Url.create('index.htm', { acctEmail: this.acctEmail }); }));
    $('.input_submit_key').click(this.setHandler(el => this.actionSubmitPublicKeyToggleHandler(el)));
    $('#step_0_found_key .action_manual_create_key, #step_1_easy_or_manual .action_manual_create_key').click(this.setHandler(() => this.setupRender.displayBlock('step_2a_manual_create')));
    $('#step_0_found_key .action_manual_enter_key, #step_1_easy_or_manual .action_manual_enter_key').click(this.setHandler(() => this.setupRender.displayBlock('step_2b_manual_enter')));
    $('#step_2b_manual_enter .action_add_private_key').click(this.setHandler(el => this.setupImportKey.actionImportPrivateKeyHandle(el)));
    $('#step_2a_manual_create .action_proceed_private').click(this.setHandlerPrevent('double', () => this.setupCreateKey.actionCreateKeyHandler()));
    $('#step_2a_manual_create .action_show_advanced_create_settings').click(this.setHandler(el => this.setupCreateKey.actionShowAdvancedSettingsHandle(el)));
    $('#step_4_close .action_close').click(this.setHandler(() => this.actionCloseHandler())); // only rendered if action=add_key which means parentTabId was used
    $('#step_2a_manual_create .input_password').on('keydown', this.setEnterHandlerThatClicks('#step_2a_manual_create .action_proceed_private'));
    $('#step_2a_manual_create.input_password2').on('keydown', this.setEnterHandlerThatClicks('#step_2a_manual_create .action_proceed_private'));
    $('#step_2_ekm_choose_pass_phrase .input_password').on('keydown', this.setEnterHandlerThatClicks('#step_2_ekm_choose_pass_phrase .action_proceed_private'));
    $('#step_2_ekm_choose_pass_phrase .input_password2').on('keydown', this.setEnterHandlerThatClicks('#step_2_ekm_choose_pass_phrase .action_proceed_private'));
    $("#recovery_password").on('keydown', this.setEnterHandlerThatClicks('#step_2_recovery .action_recover_account'));
  };

  public actionBackHandler = () => {
    $('h1').text('Set Up FlowCrypt');
    this.setupRender.displayBlock('step_1_easy_or_manual');
  };

  public showLostPassPhraseModal = () => {
    Ui.modal.info(`
        <div style="text-align: initial">
          <p><strong>Do you have at least one working device where you can
          still read your encrypted email?</strong></p>
          <p><strong>If yes:</strong> open the working device and go to
          <code>FlowCrypt Settings</code> > <code>Security</code> >
          <code>Change Pass Phrase</code>.<br>
          It will let you change it without knowing the previous one.
          When done, <a href="#" class="reload_page">reload this page</a>
          and use the new pass phrase.
          <p><strong>If no:</strong> unfortunately, you will not be able to
          read previously encrypted emails regardless of what you do.
          You can <a href="#" class="action_skip_recovery">skip recovery
          and create a new key instead</a>.
          Your previous encrypted emails will remain unreadable.
        </div>
      `, true).catch(Catch.reportErr);
    $('.action_skip_recovery').click(this.setHandler(() => this.setupRecoverKey.actionSkipRecoveryHandler()));
    $('.reload_page').click(this.setHandler(() => window.location.reload()));
  };

  public actionSubmitPublicKeyToggleHandler = (target: HTMLElement) => {
    // will be hidden / ignored / forced true when rules.mustSubmitToAttester() === true (for certain orgs)
    const inputSubmitAll = $(target).closest('.manual').find('.input_submit_all').first();
    if ($(target).prop('checked')) {
      if (inputSubmitAll.closest('div.line').css('visibility') === 'visible') {
        $('.input_email_alias').prop({ disabled: false });
      }
    } else {
      $('.input_email_alias').prop({ checked: false });
      $('.input_email_alias').prop({ disabled: true });
    }
  };

  public actionCloseHandler = () => {
    if (this.parentTabId) {
      BrowserMsg.send.redirect(this.parentTabId, { location: Url.create('index.htm', { acctEmail: this.acctEmail, advanced: true }) });
    } else {
      Catch.report('setup.ts missing parentTabId');
    }
  };

  public submitPublicKeys = async (
    { submit_main, submit_all }: { submit_main: boolean, submit_all: boolean }
  ): Promise<void> => {
    const mostUsefulPrv = KeyStoreUtil.chooseMostUseful(
      await KeyStoreUtil.parse(await KeyStore.getRequired(this.acctEmail)),
      'ONLY-FULLY-USABLE'
    );
    try {
      await this.submitPublicKeyIfNeeded(mostUsefulPrv?.keyInfo.public, { submit_main, submit_all });
    } catch (e) {
      return await Settings.promptToRetry(
        e,
        Lang.setup.failedToSubmitToAttester,
        () => this.submitPublicKeys({ submit_main, submit_all }),
        Lang.general.contactIfNeedAssistance(this.isFesUsed())
      );
    }
  };

  public finalizeSetup = async (): Promise<void> => {
    await AcctStore.set(this.acctEmail, { setup_date: Date.now(), setup_done: true, cryptup_enabled: true });
  };

  public saveKeysAndPassPhrase = async (prvs: Key[], options: SetupOptions) => {
    for (const prv of prvs) {
      await KeyStore.add(this.acctEmail, prv);
      await PassphraseStore.set((options.passphrase_save && !this.orgRules.forbidStoringPassPhrase()) ? 'local' : 'session',
        this.acctEmail, { longid: KeyUtil.getPrimaryLongid(prv) }, options.passphrase);
    }
    const { sendAs } = await AcctStore.get(this.acctEmail, ['sendAs']);
    const myOwnEmailsAddrs: string[] = [this.acctEmail].concat(Object.keys(sendAs!));
    const { full_name: name } = await AcctStore.get(this.acctEmail, ['full_name']);
    for (const email of myOwnEmailsAddrs) {
      await ContactStore.update(undefined, email, { name, pubkey: KeyUtil.armor(await KeyUtil.asPublicKey(prvs[0])) });
    }
  };

  public shouldSubmitPubkey = (checkboxSelector: string) => {
    if (this.orgRules.mustSubmitToAttester() && !this.orgRules.canSubmitPubToAttester()) {
      throw new Error('Organisation rules are misconfigured: ENFORCE_ATTESTER_SUBMIT not compatible with NO_ATTESTER_SUBMIT');
    }
    if (!this.orgRules.canSubmitPubToAttester()) {
      return false;
    }
    if (this.orgRules.mustSubmitToAttester()) {
      return true;
    }
    return Boolean($(checkboxSelector).prop('checked'));
  };

  public isCreatePrivateFormInputCorrect = async (section: string): Promise<boolean> => {
    const password1 = $(`#${section} .input_password`);
    const password2 = $(`#${section} .input_password2`);
    if (!password1.val()) {
      await Ui.modal.warning('Pass phrase is needed to protect your private email. Please enter a pass phrase.');
      password1.focus();
      return false;
    }
    if ($(`#${section} .action_proceed_private`).hasClass('gray')) {
      await Ui.modal.warning('Pass phrase is not strong enough. Please make it stronger, by adding a few words.');
      password1.focus();
      return false;
    }
    if (password1.val() !== password2.val()) {
      await Ui.modal.warning('The pass phrases do not match. Please try again.');
      password2.val('').focus();
      return false;
    }
    let notePp = String(password1.val());
    if (await shouldPassPhraseBeHidden()) {
      notePp = notePp.substring(0, 2) + notePp.substring(2, notePp.length - 2).replace(/[^ ]/g, '*') + notePp.substring(notePp.length - 2, notePp.length);
    }
    if (!this.orgRules.usesKeyManager()) {
      const paperPassPhraseStickyNote = `
        <div style="font-size: 1.2em">
          Please write down your pass phrase and store it in safe place or even two.
          It is needed in order to access your FlowCrypt account.
        </div>
        <div class="passphrase-sticky-note">${notePp}</div>
      `;
      return await Ui.modal.confirmWithCheckbox('Yes, I wrote it down', paperPassPhraseStickyNote);
    }
    return true;
  };

  /**
   * empty pubkey means key not usable
   */
  private submitPublicKeyIfNeeded = async (
    armoredPubkey: string | undefined,
    options: { submit_main: boolean, submit_all: boolean }
  ) => {
    if (!options.submit_main) {
      return;
    }
    if (!this.orgRules.canSubmitPubToAttester()) {
      if (!this.orgRules.usesKeyManager) { // users who use EKM get their setup automated - no need to inform them of this
        // other users chose this manually - let them know it's not allowed
        await Ui.modal.error('Not submitting public key to Attester - disabled for your org');
      }
      return;
    }
    if (!armoredPubkey) {
      await Ui.modal.warning('Public key not usable - not sumbitting to Attester');
      return;
    }
    const pub = await KeyUtil.parse(armoredPubkey);
    if (pub.usableForEncryption) {
      this.pubLookup.attester.testWelcome(this.acctEmail, armoredPubkey).catch(ApiErr.reportIfSignificant);
    }
    let addresses;
    if (this.submitKeyForAddrs.length && options.submit_all) {
      addresses = [...this.submitKeyForAddrs];
    } else {
      addresses = [this.acctEmail];
    }
    await this.submitPubkeys(addresses, armoredPubkey);
  };

  private submitPubkeys = async (addresses: string[], pubkey: string) => {
    if (this.orgRules.useLegacyAttesterSubmit()) {
      // this will generally ignore errors if conflicting key already exists, except for certain orgs
      await this.pubLookup.attester.initialLegacySubmit(this.acctEmail, pubkey);
    } else {
      // this will actually replace the submitted public key if there was a conflict, better ux
      await this.pubLookup.attester.submitPrimaryEmailPubkey(this.acctEmail, pubkey, this.idToken!);
    }
    const aliases = addresses.filter(a => a !== this.acctEmail);
    if (aliases.length) {
      await Promise.all(aliases.map(a => this.pubLookup.attester.initialLegacySubmit(a, pubkey)));
    }
  };

}

View.run(SetupView);
