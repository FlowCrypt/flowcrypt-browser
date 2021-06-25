/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SetupOptions, SetupView } from '../setup.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { Buf } from '../../../js/common/core/buf.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Api } from '../../../js/common/api/shared/api.js';
import { Settings } from '../../../js/common/settings.js';
import { KeyUtil } from '../../../js/common/core/crypto/key.js';
import { OpenPGPKey } from '../../../js/common/core/crypto/pgp/openpgp-key.js';

export class SetupWithEmailKeyManagerModule {

  constructor(private view: SetupView) {
  }

  public continueEkmSetupHandler = async () => {
    if (! await this.view.isCreatePrivateFormInputCorrect('step_2_ekm_choose_pass_phrase')) {
      return;
    }
    const passphrase = $('#step_2_ekm_choose_pass_phrase .input_password').val();
    await this.setupWithEkmThenRenderSetupDone(typeof passphrase === 'string' ? passphrase : '');
  }

  public setupWithEkmThenRenderSetupDone = async (passphrase: string) => {
    const setupOptions: SetupOptions = {
      passphrase_save: this.view.orgRules.mustAutogenPassPhraseQuietly() || Boolean($('#step_2_ekm_choose_pass_phrase .input_passphrase_save').prop('checked')),
      submit_main: this.view.orgRules.canSubmitPubToAttester(),
      submit_all: false,
      passphrase
    };
    try {
      const { privateKeys } = await this.view.keyManager!.getPrivateKeys(this.view.idToken!);
      if (privateKeys.length) {
        // keys already exist on keyserver, auto-import
        await this.processAndStoreKeysFromEkmLocally(privateKeys, setupOptions);
      } else {
        // generate keys on client and store them on key manager
        await this.autoGenerateKeyAndStoreBothLocallyAndToEkm(setupOptions);
      }
      await this.view.submitPublicKeysAndFinalizeSetup(setupOptions);
      await this.view.setupRender.renderSetupDone();
    } catch (e) {
      if (ApiErr.isNetErr(e) && await Api.isInternetAccessible()) { // frendly message when key manager is down, helpful during initial infrastructure setup
        e.message = `FlowCrypt Email Key Manager at ${this.view.orgRules.getKeyManagerUrlForPrivateKeys()} is down, please inform your network admin.`;
      }
      throw e;
    }
  }

  private processAndStoreKeysFromEkmLocally = async (privateKeys: { decryptedPrivateKey: string }[], setupOptions: SetupOptions) => {
    const { keys } = await KeyUtil.readMany(Buf.fromUtfStr(privateKeys.map(pk => pk.decryptedPrivateKey).join('\n')));
    if (!keys.length) {
      throw new Error(`Could not parse any valid keys from Key Manager response for user ${this.view.acctEmail}`);
    }
    for (const prv of keys) {
      if (!prv.isPrivate) {
        throw new Error(`Key ${prv.id} for user ${this.view.acctEmail} is not a private key`);
      }
      if (!prv.fullyDecrypted) {
        throw new Error(`Key ${prv.id} for user ${this.view.acctEmail} from FlowCrypt Email Key Manager is not fully decrypted`);
      }
      await KeyUtil.encrypt(prv, setupOptions.passphrase);
    }
    await this.view.saveKeysAndPassPhrase(keys, setupOptions);
  }

  private autoGenerateKeyAndStoreBothLocallyAndToEkm = async (setupOptions: SetupOptions) => {
    const keygenAlgo = this.view.orgRules.getEnforcedKeygenAlgo();
    if (!keygenAlgo) {
      const notSupportedErr = 'Combination of org rules not yet supported: PRV_AUTOIMPORT_OR_AUTOGEN cannot yet be used without enforce_keygen_algo.';
      await Ui.modal.error(`${notSupportedErr}\n\nPlease write human@flowcrypt.com to add support.`);
      window.location.href = Url.create('index.htm', { acctEmail: this.view.acctEmail });
      return;
    }
    const { full_name } = await AcctStore.get(this.view.acctEmail, ['full_name']);
    const expireInMonths = this.view.orgRules.getEnforcedKeygenExpirationMonths();
    const pgpUids = [{ name: full_name || '', email: this.view.acctEmail }];
    const generated = await OpenPGPKey.create(pgpUids, keygenAlgo, setupOptions.passphrase, expireInMonths);
    const decryptablePrv = await KeyUtil.parse(generated.private);
    if (! await KeyUtil.decrypt(decryptablePrv, setupOptions.passphrase)) {
      throw new Error('Unexpectedly cannot decrypt newly generated key');
    }
    const pubArmor = KeyUtil.armor(await KeyUtil.asPublicKey(decryptablePrv));
    const storePrvOnKm = async () => this.view.keyManager!.storePrivateKey(this.view.idToken!, KeyUtil.armor(decryptablePrv), pubArmor);
    await Settings.retryUntilSuccessful(storePrvOnKm, 'Failed to store newly generated key on FlowCrypt Email Key Manager');
    await this.view.saveKeysAndPassPhrase([await KeyUtil.parse(generated.private)], setupOptions); // store encrypted key + pass phrase locally
  }

}
