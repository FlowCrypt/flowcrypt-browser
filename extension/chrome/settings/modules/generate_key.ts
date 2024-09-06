/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PubLookup } from '../../../js/common/api/pub-lookup.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ClientConfiguration } from '../../../js/common/client-configuration.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Url } from '../../../js/common/core/common.js';
import { KeyStoreUtil } from '../../../js/common/core/crypto/key-store-util.js';
import { KeyAlgo, KeyIdentity, KeyUtil } from '../../../js/common/core/crypto/key.js';
import { MsgUtil } from '../../../js/common/core/crypto/pgp/msg-util.js';
import { OpenPGPKey } from '../../../js/common/core/crypto/pgp/openpgp-key.js';
import { saveKeysAndPassPhrase } from '../../../js/common/helpers.js';
import { submitPublicKeyIfNeeded } from '../../../js/common/key-helper.js';
import { Lang } from '../../../js/common/lang.js';
import { Catch, CompanyLdapKeyMismatchError } from '../../../js/common/platform/catch.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Settings } from '../../../js/common/settings.js';
import { BackupUi } from '../../../js/common/ui/backup-ui/backup-ui.js';
import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase-ui.js';
import { View } from '../../../js/common/view.js';
import { SetupOptions } from '../setup.js';

View.run(
  class GenerateKeyView extends View {
    public readonly backupUi: BackupUi;
    public readonly parentTabId: string;
    protected fesUrl?: string;
    private readonly acctEmail: string;
    private readonly keyImportUi = new KeyImportUi({ rejectKnown: true });
    private clientConfiguration!: ClientConfiguration;
    private pubLookup!: PubLookup;

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
      this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
      this.backupUi = new BackupUi();
    }

    public render = async () => {
      await this.keyImportUi.renderKeyManualCreateView('#generate-key-container');
      $('#step_2a_manual_create').css('display', 'block');
      const storage = await AcctStore.get(this.acctEmail, ['fesUrl']);
      this.fesUrl = storage.fesUrl;
      this.clientConfiguration = await ClientConfiguration.newInstance(this.acctEmail);
      this.pubLookup = new PubLookup(this.clientConfiguration);
      if (!this.clientConfiguration.forbidStoringPassPhrase()) {
        $('.input_passphrase_save_label').removeClass('hidden');
        $('.input_passphrase_save').prop('checked', true);
      }
      if (this.clientConfiguration.usesKeyManager()) {
        Xss.sanitizeRender(
          'body',
          `
      <br><br>
      <div data-test="container-err-text">Please contact your IT staff if you wish to update your keys.</div>
      <br><br>
      `
        );
      } else {
        $('#content').show();
        if (!this.clientConfiguration.forbidStoringPassPhrase()) {
          $('.input_passphrase_save').prop('checked', true).prop('disabled', false);
        }
        await initPassphraseToggle(['step_2a_manual_create_input_password', 'step_2a_manual_create_input_password2']);
      }
    };

    public setHandlers = () => {
      $('#step_2a_manual_create .action_proceed_private').on(
        'click',
        this.setHandlerPrevent('double', () => this.actionCreateKeyHandler())
      );
      $('#step_2a_manual_create .input_password').on('keydown', this.setEnterHandlerThatClicks('#step_2a_manual_create .action_proceed_private'));
      $('#step_2a_manual_create.input_password2').on('keydown', this.setEnterHandlerThatClicks('#step_2a_manual_create .action_proceed_private'));
    };

    public createSaveKeyPair = async (options: SetupOptions, keyAlgo: KeyAlgo): Promise<KeyIdentity> => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { full_name } = await AcctStore.get(this.acctEmail, ['full_name']);
      const pgpUids = [{ name: full_name || '', email: this.acctEmail }]; // todo - add all addresses?
      const expireMonths = this.clientConfiguration.getEnforcedKeygenExpirationMonths();
      const key = await OpenPGPKey.create(pgpUids, keyAlgo, options.passphrase, expireMonths);
      const prv = await KeyUtil.parse(key.private);
      await saveKeysAndPassPhrase(this.acctEmail, [prv], options, []);
      return { id: prv.id, family: prv.family };
    };

    public actionCreateKeyHandler = async () => {
      try {
        $('#step_2a_manual_create input').prop('disabled', true);
        Xss.sanitizeRender('#step_2a_manual_create .action_proceed_private', Ui.spinner('white') + 'just a minute');
        /* eslint-disable @typescript-eslint/naming-convention */
        const opts: SetupOptions = {
          passphrase: String($('#step_2a_manual_create .input_password').val()),
          passphrase_save: Boolean($('#step_2a_manual_create .input_passphrase_save').prop('checked')),
          passphrase_ensure_single_copy: false, // there can't be any saved passphrases for the new key
          submit_main: this.keyImportUi.shouldSubmitPubkey(this.clientConfiguration, '#step_2a_manual_create .input_submit_key'),
          submit_all: this.keyImportUi.shouldSubmitPubkey(this.clientConfiguration, '#step_2a_manual_create .input_submit_all'),
          recovered: false,
        };
        /* eslint-enable @typescript-eslint/naming-convention */
        const keyAlgo = this.clientConfiguration.getEnforcedKeygenAlgo() || ($('#step_2a_manual_create .key_type').val() as KeyAlgo);
        const keyIdentity = await this.createSaveKeyPair(opts, keyAlgo);
        if (this.clientConfiguration.getPublicKeyForPrivateKeyBackupToDesignatedMailbox()) {
          const adminPubkey = this.clientConfiguration.getPublicKeyForPrivateKeyBackupToDesignatedMailbox();
          if (adminPubkey) {
            const msgEncryptionKey = await KeyUtil.parse(adminPubkey);
            const destinationEmail = msgEncryptionKey.emails[0];
            try {
              const privateKey = await KeyStore.get(this.acctEmail);
              const primaryKeyId = privateKey[0].id;
              await this.backupUi.initialize({
                acctEmail: this.acctEmail,
                action: 'setup_automatic',
                keyIdentity,
                onBackedUpFinished: async () => {
                  this.closeDialog();
                },
              });
              const parsedPrivateKey = await KeyUtil.parse(privateKey[0].private);
              await OpenPGPKey.decryptKey(parsedPrivateKey, opts.passphrase);
              const armoredPrivateKey = KeyUtil.armor(parsedPrivateKey);
              const encryptedPrivateKey = await MsgUtil.encryptMessage({
                pubkeys: [msgEncryptionKey],
                data: Buf.fromUtfStr(armoredPrivateKey),
                armor: false,
              });
              const privateKeyAttachment = new Attachment({
                name: `0x${primaryKeyId}.asc.pgp`,
                type: 'application/pgp-encrypted',
                data: encryptedPrivateKey.data,
              });
              await this.backupUi.manualModule.doBackupOnDesignatedMailbox(msgEncryptionKey, privateKeyAttachment, destinationEmail, primaryKeyId);
            } catch (e) {
              if (ApiErr.isNetErr(e)) {
                await Ui.modal.warning('Need internet connection to finish. Please click the button again to retry.');
              } else {
                Catch.reportErr(e);
                await Ui.modal.error(`Error happened: ${String(e)}`);
              }
            }
          }
        } else if (this.clientConfiguration.canBackupKeys()) {
          await this.submitPublicKeys(opts);
          const action = $('#step_2a_manual_create .input_backup_inbox').prop('checked') ? 'setup_automatic' : 'setup_manual';
          // only finalize after backup is done.
          $('#step_2a_manual_create').hide();
          await this.backupUi.initialize({
            acctEmail: this.acctEmail,
            action,
            keyIdentity,
            onBackedUpFinished: async () => {
              this.closeDialog();
            },
          });
        } else {
          this.closeDialog();
        }
      } catch (e) {
        Catch.reportErr(e);
        await Ui.modal.error(`There was an error, please try again.\n\n(${String(e)})`);
        $('#step_2a_manual_create .action_proceed_private').text('CREATE AND SAVE');
      }
    };

    /* eslint-disable @typescript-eslint/naming-convention */
    private submitPublicKeys = async ({ submit_main, submit_all }: { submit_main: boolean; submit_all: boolean }): Promise<void> => {
      const mostUsefulPrv = KeyStoreUtil.chooseMostUseful(await KeyStoreUtil.parse(await KeyStore.getRequired(this.acctEmail)), 'ONLY-FULLY-USABLE');
      try {
        await submitPublicKeyIfNeeded(this.clientConfiguration, this.acctEmail, [], this.pubLookup.attester, mostUsefulPrv?.keyInfo.public, {
          submit_main,
          submit_all,
        });
      } catch (e) {
        return await Settings.promptToRetry(
          e,
          e instanceof CompanyLdapKeyMismatchError ? Lang.setup.failedToImportUnknownKey : Lang.setup.failedToSubmitToAttester,
          () => this.submitPublicKeys({ submit_main, submit_all }),
          Lang.general.contactIfNeedAssistance(Boolean(this.fesUrl))
        );
      }
    };
    /* eslint-enable @typescript-eslint/naming-convention */

    private closeDialog() {
      BrowserMsg.send.reload(this.parentTabId, { advanced: true });
    }
  }
);
