/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SetupOptions, SetupView } from '../setup.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { AjaxErr, ApiErr, EnterpriseServerAuthErr } from '../../../js/common/api/shared/api-error.js';
import { Api } from '../../../js/common/api/shared/api.js';
import { Settings } from '../../../js/common/settings.js';
import { KeyUtil } from '../../../js/common/core/crypto/key.js';
import { OpenPGPKey } from '../../../js/common/core/crypto/pgp/openpgp-key.js';
import { Lang } from '../../../js/common/lang.js';
import { processAndStoreKeysFromEkmLocally, saveKeysAndPassPhrase } from '../../../js/common/helpers.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';

export class SetupWithEmailKeyManagerModule {
  public constructor(private view: SetupView) {}

  public continueEkmSetupHandler = async () => {
    const submitButtonSelector = '#step_2_ekm_choose_pass_phrase .action_proceed_private';
    const submitButton = $(submitButtonSelector);
    const submitButtonText = submitButton.text();
    const setBtnColor = (type: 'gray' | 'green') => {
      submitButton.addClass(type === 'gray' ? 'gray' : 'green');
      submitButton.removeClass(type === 'gray' ? 'green' : 'gray');
    };
    if (!(await this.view.isCreatePrivateFormInputCorrect('step_2_ekm_choose_pass_phrase'))) {
      return;
    }
    try {
      Xss.sanitizeRender(submitButtonSelector, Ui.spinner('white') + 'Loading...');
      setBtnColor('gray');
      const passphrase = $('#step_2_ekm_choose_pass_phrase .input_password').val();
      await this.setupWithEkmThenRenderSetupDone(typeof passphrase === 'string' ? passphrase : '');
    } catch (e) {
      await Ui.modal.error(String(e));
    } finally {
      setBtnColor('green');
      submitButton.text(submitButtonText);
    }
  };

  public setupWithEkmThenRenderSetupDone = async (passphrase: string) => {
    /* eslint-disable @typescript-eslint/naming-convention */
    const setupOptions: SetupOptions = {
      passphrase_save:
        this.view.clientConfiguration.mustAutogenPassPhraseQuietly() || Boolean($('#step_2_ekm_choose_pass_phrase .input_passphrase_save').prop('checked')),
      passphrase_ensure_single_copy: false, // there can't be any saved passphrases for the new key
      submit_main: this.view.clientConfiguration.canSubmitPubToAttester(),
      submit_all: false,
      passphrase,
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    try {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const { privateKeys } = await this.view.keyManager!.getPrivateKeys(this.view.acctEmail);
      if (privateKeys.length) {
        // keys already exist on keyserver, auto-import
        try {
          await processAndStoreKeysFromEkmLocally({
            acctEmail: this.view.acctEmail,
            decryptedPrivateKeys: privateKeys.map(entry => entry.decryptedPrivateKey),
            ppOptions: setupOptions,
          });
        } catch (e) {
          throw new Error(`Could not store keys from EKM due to error: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else if (this.view.clientConfiguration.canCreateKeys()) {
        // generate keys on client and store them on key manager
        await this.autoGenerateKeyAndStoreBothLocallyAndToEkm(setupOptions);
      } else {
        await Ui.modal.error(Lang.setup.noKeys);
        window.location.href = Url.create('index.htm', { acctEmail: this.view.acctEmail });
        return;
      }
      await this.view.submitPublicKeys(setupOptions);
      await this.view.finalizeSetup();
      await this.view.setupRender.renderSetupDone();
    } catch (e) {
      if (e instanceof EnterpriseServerAuthErr) {
        await BrowserMsg.send.bg.await.reconnectCustomIDPAcctAuthPopup({ acctEmail: this.view.acctEmail });
        return;
      }
      if (ApiErr.isNetErr(e) && (await Api.isInternetAccessible())) {
        // frendly message when key manager is down, helpful during initial infrastructure setup
        const url = this.view.clientConfiguration.getKeyManagerUrlForPrivateKeys();
        const message =
          `FlowCrypt Email Key Manager at ${url} cannot be reached. ` +
          'If your organization requires a VPN, please connect to it. Else, please inform your network admin.';
        if (e instanceof AjaxErr) {
          e.message = message; // we assume isNetErr wasn't identified by the message property
        } else {
          // convert to AjaxErr, identifiable as a net error, with a custom message
          throw AjaxErr.fromNetErr(message, e.stack, url);
        }
      }
      throw e;
    }
  };

  private autoGenerateKeyAndStoreBothLocallyAndToEkm = async (setupOptions: SetupOptions) => {
    const keygenAlgo = this.view.clientConfiguration.getEnforcedKeygenAlgo();
    if (!keygenAlgo) {
      const notSupportedErr = 'Combination of org rules not yet supported: PRV_AUTOIMPORT_OR_AUTOGEN cannot yet be used without enforce_keygen_algo.';
      await Ui.modal.error(`${notSupportedErr}\n\nPlease ${Lang.general.contactMinimalSubsentence(this.view.isCustomerUrlFesUsed())} to add support.`);
      window.location.href = Url.create('index.htm', { acctEmail: this.view.acctEmail });
      return;
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { full_name } = await AcctStore.get(this.view.acctEmail, ['full_name']);
    const expireInMonths = this.view.clientConfiguration.getEnforcedKeygenExpirationMonths();
    const pgpUids = [{ name: full_name || '', email: this.view.acctEmail }];
    const generated = await OpenPGPKey.create(pgpUids, keygenAlgo, setupOptions.passphrase, expireInMonths);
    const decryptablePrv = await KeyUtil.parse(generated.private);
    if (!(await KeyUtil.decrypt(decryptablePrv, setupOptions.passphrase))) {
      throw new Error('Unexpectedly cannot decrypt newly generated key');
    }
    const storePrvOnKm = async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await this.view.keyManager!.storePrivateKey(this.view.acctEmail, KeyUtil.armor(decryptablePrv));
    };
    await Settings.retryUntilSuccessful(
      storePrvOnKm,
      'Failed to store newly generated key on FlowCrypt Email Key Manager',
      Lang.general.contactIfNeedAssistance(this.view.isCustomerUrlFesUsed())
    );
    await saveKeysAndPassPhrase(this.view.acctEmail, [await KeyUtil.parse(generated.private)], setupOptions); // store encrypted key + pass phrase locally
  };
}
