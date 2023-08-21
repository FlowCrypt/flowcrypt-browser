/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SetupOptions, SetupView } from '../setup.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { KeyAlgo, KeyIdentity, KeyUtil } from '../../../js/common/core/crypto/key.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { OpenPGPKey } from '../../../js/common/core/crypto/pgp/openpgp-key.js';
import { saveKeysAndPassPhrase } from '../../../js/common/helpers.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { MsgUtil } from '../../../js/common/core/crypto/pgp/msg-util.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Attachment } from '../../../js/common/core/attachment.js';

export class SetupCreateKeyModule {
  public constructor(private view: SetupView) {}

  public actionCreateKeyHandler = async () => {
    await Settings.forbidAndRefreshPageIfCannot('CREATE_KEYS', this.view.clientConfiguration);
    if (!(await this.view.isCreatePrivateFormInputCorrect('step_2a_manual_create'))) {
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
        submit_main: this.view.shouldSubmitPubkey('#step_2a_manual_create .input_submit_key'),
        submit_all: this.view.shouldSubmitPubkey('#step_2a_manual_create .input_submit_all'),
        recovered: false,
      };
      /* eslint-enable @typescript-eslint/naming-convention */
      const keyAlgo = this.view.clientConfiguration.getEnforcedKeygenAlgo() || ($('#step_2a_manual_create .key_type').val() as KeyAlgo);
      const keyIdentity = await this.createSaveKeyPair(opts, keyAlgo);
      if (this.view.clientConfiguration.getPublicKeyForPrivateKeyBackupToDesignatedMailbox()) {
        const adminPubkey = this.view.clientConfiguration.getPublicKeyForPrivateKeyBackupToDesignatedMailbox();
        if (adminPubkey) {
          const msgEncryptionKey = await KeyUtil.parse(adminPubkey);
          const destinationEmail = msgEncryptionKey.emails[0];
          try {
            const privateKey = await KeyStore.get(this.view.acctEmail);
            const primaryKeyId = privateKey[0].id;
            await this.view.backupUi.initialize({
              acctEmail: this.view.acctEmail,
              action: 'setup_automatic',
              keyIdentity,
              onBackedUpFinished: async () => {
                $('pre.status_details').remove();
                $('#backup-template-container').remove();
                await this.view.finalizeSetup();
                await this.view.setupRender.renderSetupDone();
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
            await this.view.backupUi.manualModule.doBackupOnDesignatedMailbox(msgEncryptionKey, privateKeyAttachment, destinationEmail, primaryKeyId);
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
        await this.view.submitPublicKeys(opts);
        const action = $('#step_2a_manual_create .input_backup_inbox').prop('checked') ? 'setup_automatic' : 'setup_manual';
        // only finalize after backup is done.
        $('#step_2a_manual_create').hide();
        await this.view.backupUi.initialize({
          acctEmail: this.view.acctEmail,
          action,
          keyIdentity,
          onBackedUpFinished: async () => {
            $('#backup-template-container').remove();
            await this.view.finalizeSetup();
            await this.view.setupRender.renderSetupDone();
          },
        });
      } else {
        await this.view.submitPublicKeys(opts);
        await this.view.finalizeSetup();
        await this.view.setupRender.renderSetupDone();
      }
    } catch (e) {
      Catch.reportErr(e);
      await Ui.modal.error(`There was an error, please try again.\n\n(${String(e)})`);
      $('#step_2a_manual_create .action_proceed_private').text('CREATE AND SAVE');
    }
  };

  public actionShowAdvancedSettingsHandle = async (target: HTMLElement) => {
    const advancedCreateSettings = $('#step_2a_manual_create .advanced_create_settings');
    const container = $('#step_2a_manual_create .advanced_create_settings_container');
    if (advancedCreateSettings.is(':visible')) {
      advancedCreateSettings.hide('fast');
      $(target).find('span').text('Show Advanced Settings');
      container.css('width', '360px');
    } else {
      advancedCreateSettings.show('fast');
      $(target).find('span').text('Hide Advanced Settings');
      container.css('width', 'auto');
    }
  };

  public createSaveKeyPair = async (options: SetupOptions, keyAlgo: KeyAlgo): Promise<KeyIdentity> => {
    await Settings.forbidAndRefreshPageIfCannot('CREATE_KEYS', this.view.clientConfiguration);
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { full_name } = await AcctStore.get(this.view.acctEmail, ['full_name']);
    const pgpUids = [{ name: full_name || '', email: this.view.acctEmail }]; // todo - add all addresses?
    const expireMonths = this.view.clientConfiguration.getEnforcedKeygenExpirationMonths();
    const key = await OpenPGPKey.create(pgpUids, keyAlgo, options.passphrase, expireMonths);
    const prv = await KeyUtil.parse(key.private);
    await saveKeysAndPassPhrase(this.view.acctEmail, [prv], options);
    return { id: prv.id, family: prv.family };
  };
}
