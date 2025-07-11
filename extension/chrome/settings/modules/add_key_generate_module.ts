/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { PubLookup } from '../../../js/common/api/pub-lookup.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { Buf } from '../../../js/common/core/buf.js';
import { KeyAlgo, KeyIdentity, KeyUtil } from '../../../js/common/core/crypto/key.js';
import { KeyStoreUtil } from '../../../js/common/core/crypto/key-store-util.js';
import { MsgUtil } from '../../../js/common/core/crypto/pgp/msg-util.js';
import { OpenPGPKey } from '../../../js/common/core/crypto/pgp/openpgp-key.js';
import { saveKeysAndPassPhrase } from '../../../js/common/helpers.js';
import { submitPublicKeyIfNeeded } from '../../../js/common/key-helper.js';
import { Lang } from '../../../js/common/lang.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { CompanyLdapKeyMismatchError } from '../../../js/common/platform/error-report.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Settings } from '../../../js/common/settings.js';
import { BackupUi } from '../../../js/common/ui/backup-ui/backup-ui.js';
import { KeyImportUi } from '../../../js/common/ui/key-import-ui.js';
import { initPassphraseToggle, isCreatePrivateFormInputCorrect } from '../../../js/common/ui/passphrase-ui.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { SetupOptions } from '../setup';
import { AddKeyView } from './add_key';

export class AddKeyGenerateModule extends ViewModule<AddKeyView> {
  public readonly backupUi: BackupUi;
  private readonly keyImportUi = new KeyImportUi({ rejectKnown: true });
  private pubLookup!: PubLookup;

  public constructor(composer: AddKeyView) {
    super(composer);
    this.backupUi = new BackupUi();
  }

  public initGenerateKeyView = async () => {
    this.pubLookup = new PubLookup(this.view.clientConfiguration);
    await this.keyImportUi.renderKeyManualCreateView('#generate-key-container');
    $('#step_2a_manual_create').css('display', 'block');
    await initPassphraseToggle(['step_2a_manual_create_input_password', 'step_2a_manual_create_input_password2']);
  };

  public setHandlers = () => {
    $('#step_2a_manual_create .action_proceed_private').on(
      'click',
      this.view.setHandlerPrevent('double', () => this.actionCreateKeyHandler())
    );
    $('#step_2a_manual_create .input_password').on('keydown', this.view.setEnterHandlerThatClicks('#step_2a_manual_create .action_proceed_private'));
    $('#step_2a_manual_create.input_password2').on('keydown', this.view.setEnterHandlerThatClicks('#step_2a_manual_create .action_proceed_private'));
  };

  public createSaveKeyPair = async (options: SetupOptions, keyAlgo: KeyAlgo, aliasList: { name: string; email: string }[] = []): Promise<KeyIdentity> => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { full_name } = await AcctStore.get(this.view.acctEmail, ['full_name']);
    const fullName = full_name ?? '';
    const pgpUids = [{ name: fullName, email: this.view.acctEmail }];
    for (const alias of aliasList) {
      pgpUids.push({ name: alias.name ?? fullName, email: alias.email });
    }
    const expireMonths = this.view.clientConfiguration.getEnforcedKeygenExpirationMonths();
    const key = await OpenPGPKey.create(pgpUids, keyAlgo, options.passphrase, expireMonths);
    const prv = await KeyUtil.parse(key.private);
    await saveKeysAndPassPhrase(this.view.acctEmail, [prv], options, []);
    return { id: prv.id, family: prv.family };
  };

  public actionCreateKeyHandler = async () => {
    await Settings.forbidAndRefreshPageIfCannot('CREATE_KEYS', this.view.clientConfiguration);
    if (!(await isCreatePrivateFormInputCorrect('step_2a_manual_create', this.view.clientConfiguration))) {
      return;
    }
    try {
      $('#step_2a_manual_create input').prop('disabled', true);
      Xss.sanitizeRender('#step_2a_manual_create .action_proceed_private', Ui.spinner('white') + 'just a minute');
      /* eslint-disable @typescript-eslint/naming-convention */
      const opts: SetupOptions = {
        passphrase: String($('#step_2a_manual_create .input_password').val()),
        passphrase_save: Boolean($('#step_2a_manual_create .input_passphrase_save').prop('checked')),
        passphrase_ensure_single_copy: false, // there can't be any saved passphrases for the new key
        submit_main: this.keyImportUi.shouldSubmitPubkey(this.view.clientConfiguration, '#step_2a_manual_create .input_submit_key'),
        recovered: false,
      };
      /* eslint-enable @typescript-eslint/naming-convention */
      const keyAlgo = this.view.clientConfiguration.getEnforcedKeygenAlgo() || ($('#step_2a_manual_create .key_type').val() as KeyAlgo);
      const keyIdentity = await this.createSaveKeyPair(opts, keyAlgo, this.keyImportUi.getSelectedEmailAliases('generate_private_key'));
      if (this.view.clientConfiguration.getPublicKeyForPrivateKeyBackupToDesignatedMailbox()) {
        const adminPubkey = this.view.clientConfiguration.getPublicKeyForPrivateKeyBackupToDesignatedMailbox();
        if (adminPubkey) {
          const msgEncryptionKey = await KeyUtil.parse(adminPubkey);
          const destinationEmail = msgEncryptionKey.emails[0];
          try {
            const privateKey = await KeyStore.get(this.view.acctEmail);
            const primaryKeyId = privateKey[0].id;
            await this.backupUi.initialize({
              acctEmail: this.view.acctEmail,
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
      } else if (this.view.clientConfiguration.canBackupKeys()) {
        await this.submitPublicKeys(opts);
        const action = $('#step_2a_manual_create .input_backup_inbox').prop('checked') ? 'setup_automatic' : 'setup_manual';
        // only finalize after backup is done.
        $('#step_2a_manual_create').hide();
        await this.backupUi.initialize({
          acctEmail: this.view.acctEmail,
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
  private submitPublicKeys = async ({ submit_main }: { submit_main: boolean }): Promise<void> => {
    const mostUsefulPrv = KeyStoreUtil.chooseMostUseful(await KeyStoreUtil.parse(await KeyStore.getRequired(this.view.acctEmail)), 'ONLY-FULLY-USABLE');
    try {
      await submitPublicKeyIfNeeded(this.view.clientConfiguration, this.view.acctEmail, [], this.pubLookup.attester, mostUsefulPrv?.keyInfo.public, {
        submit_main,
      });
    } catch (e) {
      return await Settings.promptToRetry(
        e,
        e instanceof CompanyLdapKeyMismatchError ? Lang.setup.failedToImportUnknownKey : Lang.setup.failedToSubmitToAttester,
        () => this.submitPublicKeys({ submit_main }),
        Lang.general.contactIfNeedAssistance(Boolean(this.view.fesUrl))
      );
    }
  };
  /* eslint-enable @typescript-eslint/naming-convention */

  private closeDialog = () => {
    BrowserMsg.send.reload(this.view.parentTabId, { advanced: true });
  };
}
