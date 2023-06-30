/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { asyncSome, Url } from '../../js/common/core/common.js';
import { ApiErr } from '../../js/common/api/shared/api-error.js';
import { Assert } from '../../js/common/assert.js';
import { Catch, CompanyLdapKeyMismatchError } from '../../js/common/platform/catch.js';
import { Key, KeyInfoWithIdentity, KeyUtil } from '../../js/common/core/crypto/key.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Google } from '../../js/common/api/email-provider/gmail/google.js';
import { KeyImportUi } from '../../js/common/ui/key-import-ui.js';
import { Lang } from '../../js/common/lang.js';
import { opgp } from '../../js/common/core/crypto/pgp/openpgpjs-custom.js';
import { ClientConfiguration } from '../../js/common/client-configuration.js';
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
import { AcctStoreDict, AcctStore } from '../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { KeyStoreUtil } from '../../js/common/core/crypto/key-store-util.js';
import { KeyManager } from '../../js/common/api/key-server/key-manager.js';
import { SetupWithEmailKeyManagerModule } from './setup/setup-key-manager-autogen.js';
import { shouldPassPhraseBeHidden } from '../../js/common/ui/passphrase-ui.js';
import Swal from 'sweetalert2';
import { BackupUi } from '../../js/common/ui/backup-ui/backup-ui.js';
import { InMemoryStoreKeys } from '../../js/common/core/const.js';
import { InMemoryStore } from '../../js/common/platform/store/in-memory-store.js';

/* eslint-disable @typescript-eslint/naming-convention */
export interface PassphraseOptions {
  passphrase: string;
  passphrase_save: boolean;
}

export interface SetupOptions extends PassphraseOptions {
  submit_main: boolean;
  submit_all: boolean;
  recovered?: boolean;
}
/* eslint-enable @typescript-eslint/naming-convention */

export class SetupView extends View {
  public readonly acctEmail: string;
  public readonly parentTabId: string | undefined;
  public readonly action: 'add_key' | 'update_from_ekm' | undefined;
  public readonly idToken: string | undefined; // only needed for initial setup, not for add_key

  public readonly keyImportUi = new KeyImportUi({ checkEncryption: true });
  public readonly gmail: Gmail;
  public readonly setupRecoverKey: SetupRecoverKeyModule;
  public readonly setupCreateKey: SetupCreateKeyModule;
  public readonly setupImportKey: SetupImportKeyModule;
  public readonly setupRender: SetupRenderModule;
  public readonly setupWithEmailKeyManager: SetupWithEmailKeyManagerModule;
  public readonly backupUi: BackupUi;

  public tabId!: string;
  public storage!: AcctStoreDict;
  public clientConfiguration!: ClientConfiguration;
  public pubLookup!: PubLookup;
  public keyManager: KeyManager | undefined; // not set if no url in org rules

  public fetchedKeyBackups: KeyInfoWithIdentity[] = [];
  public fetchedKeyBackupsUniqueLongids: string[] = [];
  public importedKeysUniqueLongids: string[] = [];
  public mathingPassphrases: string[] = [];
  public submitKeyForAddrs: string[];

  public constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'action', 'idToken', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['add_key', 'update_from_ekm', undefined]) as
      | 'add_key'
      | 'update_from_ekm'
      | undefined;
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
    this.keyImportUi.onBadPassphrase = () => $('#step_2b_manual_enter .input_passphrase').val('').trigger('focus');
    this.keyImportUi.renderPassPhraseStrengthValidationInput($('#step_2a_manual_create .input_password'), $('#step_2a_manual_create .action_proceed_private'));
    this.keyImportUi.renderPassPhraseStrengthValidationInput(
      $('#step_2_ekm_choose_pass_phrase .input_password'),
      $('#step_2_ekm_choose_pass_phrase .action_proceed_private')
    );
    this.gmail = new Gmail(this.acctEmail);
    // modules
    this.setupRecoverKey = new SetupRecoverKeyModule(this);
    this.setupCreateKey = new SetupCreateKeyModule(this);
    this.setupImportKey = new SetupImportKeyModule(this);
    this.setupRender = new SetupRenderModule(this);
    this.setupWithEmailKeyManager = new SetupWithEmailKeyManagerModule(this);
    this.backupUi = new BackupUi();
  }

  public isCustomerUrlFesUsed = () => Boolean(this.storage.fesUrl);

  public render = async () => {
    await initPassphraseToggle(['step_2b_manual_enter_passphrase'], 'hide');
    await initPassphraseToggle([
      'step_2a_manual_create_input_password',
      'step_2a_manual_create_input_password2',
      'step_2_ekm_input_password',
      'step_2_ekm_input_password2',
      'recovery_password',
    ]);
    this.storage = await AcctStore.get(this.acctEmail, ['setup_done', 'email_provider', 'fesUrl']);
    this.storage.email_provider = this.storage.email_provider || 'gmail';
    this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
    if (this.clientConfiguration.shouldHideArmorMeta() && typeof opgp !== 'undefined') {
      opgp.config.showComment = false;
      opgp.config.showVersion = false;
    }
    this.pubLookup = new PubLookup(this.clientConfiguration);
    if (this.clientConfiguration.usesKeyManager() && this.idToken) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.keyManager = new KeyManager(this.clientConfiguration.getKeyManagerUrlForPrivateKeys()!);
    }
    if (!this.clientConfiguration.canCreateKeys()) {
      const forbidden = `${Lang.setup.creatingKeysNotAllowedPleaseImport} <a href="${Xss.escape(window.location.href)}">Back</a>`;
      Xss.sanitizeRender('#step_2a_manual_create, #step_2_easy_generating', `<div class="aligncenter"><div class="line">${forbidden}</div></div>`);
      $('#button-go-back').remove(); // back button would allow users to choose other options (eg create - not allowed)
    }
    if (this.clientConfiguration.mustSubmitToAttester() || !this.clientConfiguration.canSubmitPubToAttester()) {
      $('.remove_if_pubkey_submitting_not_user_configurable').remove();
    }
    if (this.clientConfiguration.forbidStoringPassPhrase()) {
      $('.input_passphrase_save').prop('checked', false);
    } else {
      $('.input_passphrase_save_label').removeClass('hidden');
      if (this.clientConfiguration.rememberPassPhraseByDefault()) {
        $('.input_passphrase_save').prop('checked', true);
      }
    }
    if (this.clientConfiguration.getEnforcedKeygenAlgo()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      $('.key_type').val(this.clientConfiguration.getEnforcedKeygenAlgo()!).prop('disabled', true);
    }
    if (!this.clientConfiguration.canBackupKeys()) {
      $('.input_backup_inbox').prop('checked', false).prop('disabled', true);
      $('.remove_if_backup_not_allowed').remove();
    }
    this.tabId = await BrowserMsg.requiredTabId();
    await this.setupRender.renderInitial();
  };

  public setHandlers = () => {
    BrowserMsg.addListener('close_page', async () => {
      Swal.close();
    });
    BrowserMsg.addListener('notification_show', async ({ notification }: Bm.NotificationShow) => {
      await Ui.modal.info(notification);
    });
    BrowserMsg.listen(this.tabId);
    $('.action_send').attr('href', Google.webmailUrl(this.acctEmail));
    $('.action_show_help').on(
      'click',
      this.setHandler(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        async () => await Settings.renderSubPage(this.acctEmail, this.tabId!, '/chrome/settings/modules/help.htm')
      )
    );
    $('#button-go-back')
      .off()
      .on(
        'click',
        this.setHandler(() => this.actionBackHandler())
      );
    $('#step_2_ekm_choose_pass_phrase .action_proceed_private').on(
      'click',
      this.setHandlerPrevent('double', () => this.setupWithEmailKeyManager.continueEkmSetupHandler())
    );
    $('#step_2_recovery .action_recover_account').on(
      'click',
      this.setHandlerPrevent('double', () => this.setupRecoverKey.actionRecoverAccountHandler())
    );
    $('#step_4_more_to_recover .action_recover_remaining').on(
      'click',
      this.setHandler(() => this.setupRecoverKey.actionRecoverRemainingKeysHandler())
    );
    $('#lost_pass_phrase').on(
      'click',
      this.setHandler(() => this.showLostPassPhraseModal())
    );
    $('.action_account_settings').on(
      'click',
      this.setHandler(() => {
        window.location.href = Url.create('index.htm', { acctEmail: this.acctEmail });
      })
    );
    $('.input_submit_key').on(
      'click',
      this.setHandler(el => this.actionSubmitPublicKeyToggleHandler(el))
    );
    $('#step_0_found_key .action_manual_create_key, #step_1_easy_or_manual .action_manual_create_key').on(
      'click',
      this.setHandler(() => this.setupRender.displayBlock('step_2a_manual_create'))
    );
    $('#step_0_found_key .action_manual_enter_key, #step_1_easy_or_manual .action_manual_enter_key').on(
      'click',
      this.setHandler(() => this.setupRender.displayBlock('step_2b_manual_enter'))
    );
    $('#step_2b_manual_enter .action_add_private_key').on(
      'click',
      this.setHandler(el => this.setupImportKey.actionImportPrivateKeyHandle(el))
    );
    $('#step_2a_manual_create .action_proceed_private').on(
      'click',
      this.setHandlerPrevent('double', () => this.setupCreateKey.actionCreateKeyHandler())
    );
    $('#step_2a_manual_create .action_show_advanced_create_settings').on(
      'click',
      this.setHandler(el => this.setupCreateKey.actionShowAdvancedSettingsHandle(el))
    );
    $('#step_4_close .action_close').on(
      'click',
      this.setHandler(() => this.actionCloseHandler())
    ); // only rendered if action=add_key which means parentTabId was used
    $('#step_2a_manual_create .input_password').on('keydown', this.setEnterHandlerThatClicks('#step_2a_manual_create .action_proceed_private'));
    $('#step_2a_manual_create.input_password2').on('keydown', this.setEnterHandlerThatClicks('#step_2a_manual_create .action_proceed_private'));
    $('#step_2_ekm_choose_pass_phrase .input_password').on('keydown', this.setEnterHandlerThatClicks('#step_2_ekm_choose_pass_phrase .action_proceed_private'));
    $('#step_2_ekm_choose_pass_phrase .input_password2').on(
      'keydown',
      this.setEnterHandlerThatClicks('#step_2_ekm_choose_pass_phrase .action_proceed_private')
    );
    $('#recovery_password').on('keydown', this.setEnterHandlerThatClicks('#step_2_recovery .action_recover_account'));
  };

  public actionBackHandler = () => {
    $('h1').text('Set Up FlowCrypt');
    this.setupRender.displayBlock('step_1_easy_or_manual');
  };

  public showLostPassPhraseModal = () => {
    Ui.modal
      .info(
        `
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
      `,
        true
      )
      .catch(Catch.reportErr);
    $('.action_skip_recovery').on(
      'click',
      this.setHandler(() => this.setupRecoverKey.actionSkipRecoveryHandler())
    );
    $('.reload_page').on(
      'click',
      this.setHandler(() => window.location.reload())
    );
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
      BrowserMsg.send.redirect(this.parentTabId, {
        location: Url.create('index.htm', { acctEmail: this.acctEmail, advanced: true }),
      });
    } else {
      Catch.report('setup.ts missing parentTabId');
    }
  };

  /* eslint-disable @typescript-eslint/naming-convention */
  public submitPublicKeys = async ({ submit_main, submit_all }: { submit_main: boolean; submit_all: boolean }): Promise<void> => {
    const mostUsefulPrv = KeyStoreUtil.chooseMostUseful(await KeyStoreUtil.parse(await KeyStore.getRequired(this.acctEmail)), 'ONLY-FULLY-USABLE');
    try {
      await this.submitPublicKeyIfNeeded(mostUsefulPrv?.keyInfo.public, { submit_main, submit_all });
    } catch (e) {
      return await Settings.promptToRetry(
        e,
        e instanceof CompanyLdapKeyMismatchError ? Lang.setup.failedToImportUnknownKey : Lang.setup.failedToSubmitToAttester,
        () => this.submitPublicKeys({ submit_main, submit_all }),
        Lang.general.contactIfNeedAssistance(this.isCustomerUrlFesUsed())
      );
    }
  };

  public finalizeSetup = async (): Promise<void> => {
    await AcctStore.set(this.acctEmail, { setup_date: Date.now(), setup_done: true, cryptup_enabled: true });
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  public shouldSubmitPubkey = (checkboxSelector: string) => {
    if (this.clientConfiguration.mustSubmitToAttester() && !this.clientConfiguration.canSubmitPubToAttester()) {
      throw new Error('Organisation rules are misconfigured: ENFORCE_ATTESTER_SUBMIT not compatible with NO_ATTESTER_SUBMIT');
    }
    if (!this.clientConfiguration.canSubmitPubToAttester()) {
      return false;
    }
    if (this.clientConfiguration.mustSubmitToAttester()) {
      return true;
    }
    return Boolean($(checkboxSelector).prop('checked'));
  };

  public isCreatePrivateFormInputCorrect = async (section: string): Promise<boolean> => {
    const password1 = $(`#${section} .input_password`);
    const password2 = $(`#${section} .input_password2`);
    if (!password1.val()) {
      await Ui.modal.warning('Pass phrase is needed to protect your private email. Please enter a pass phrase.');
      password1.trigger('focus');
      return false;
    }
    if ($(`#${section} .action_proceed_private`).hasClass('gray')) {
      await Ui.modal.warning('Pass phrase is not strong enough. Please make it stronger, by adding a few words.');
      password1.trigger('focus');
      return false;
    }
    if (password1.val() !== password2.val()) {
      await Ui.modal.warning('The pass phrases do not match. Please try again.');
      password2.val('').trigger('focus');
      return false;
    }
    let notePp = String(password1.val());
    if (await shouldPassPhraseBeHidden()) {
      notePp = notePp.substring(0, 2) + notePp.substring(2, notePp.length - 2).replace(/[^ ]/g, '*') + notePp.substring(notePp.length - 2, notePp.length);
    }
    if (!this.clientConfiguration.usesKeyManager()) {
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
    options: { submit_main: boolean; submit_all: boolean } // eslint-disable-line @typescript-eslint/naming-convention
  ) => {
    if (!options.submit_main) {
      return;
    }
    if (!this.clientConfiguration.canSubmitPubToAttester()) {
      if (!this.clientConfiguration.usesKeyManager) {
        // users who use EKM get their setup automated - no need to inform them of this
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
      const idToken = await InMemoryStore.get(this.acctEmail, InMemoryStoreKeys.ID_TOKEN);
      this.pubLookup.attester.welcomeMessage(this.acctEmail, armoredPubkey, idToken).catch(ApiErr.reportIfSignificant);
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
    if (this.clientConfiguration.setupEnsureImportedPrvMatchLdapPub()) {
      // this will generally ignore errors if conflicting key already exists, except for certain orgs
      const result = await this.pubLookup.attester.doLookupLdap(this.acctEmail);
      if (result.pubkeys.length) {
        const prvs = await KeyStoreUtil.parse(await KeyStore.getRequired(this.acctEmail));
        const parsedPubKeys: Key[] = [];
        for (const pubKey of result.pubkeys) {
          parsedPubKeys.push(...(await KeyUtil.parseMany(pubKey)));
        }
        const hasMatchingKey = await asyncSome(prvs, async privateKey => {
          return parsedPubKeys.some(parsedPubKey => privateKey.key.id === parsedPubKey.id);
        });
        if (!hasMatchingKey) {
          const keyIds = prvs.map(prv => prv.key.id).join(', ');
          const pubKeyIds = parsedPubKeys.map(pub => pub.id).join(', ');
          throw new CompanyLdapKeyMismatchError(
            `Imported private key with ids ${keyIds} does not match public keys on company LDAP server with ids ${pubKeyIds} for ${this.acctEmail}. Please ask your help desk.`
          );
        }
      } else {
        throw new CompanyLdapKeyMismatchError(
          `Your organization requires public keys to be present on company LDAP server, but no public key was found for ${this.acctEmail}. Please ask your internal help desk.`
        );
      }
    } else {
      // this will actually replace the submitted public key if there was a conflict, better ux
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await this.pubLookup.attester.submitPrimaryEmailPubkey(this.acctEmail, pubkey, this.idToken!);
    }
    const aliases = addresses.filter(a => a !== this.acctEmail);
    if (aliases.length) {
      await Promise.all(aliases.map(a => this.pubLookup.attester.submitPubkeyWithConditionalEmailVerification(a, pubkey)));
    }
  };
}

View.run(SetupView);
