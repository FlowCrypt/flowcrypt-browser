/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SetupOptions, SetupView } from '../setup.js';

import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { Buf } from '../../../js/common/core/buf.js';
import { PgpPwd } from '../../../js/common/core/pgp-password.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Api } from '../../../js/common/api/api.js';
import { Settings } from '../../../js/common/settings.js';

export class SetupKeyManagerAutogenModule {

  constructor(private view: SetupView) {
  }

  public getKeyFromKeyManagerOrAutogenAndStoreItThenRenderSetupDone = async () => {
    if (!this.view.rules.mustAutogenPassPhraseQuietly()) {
      const notSupportedErr = 'Combination of org rules not yet supported: PRV_AUTOIMPORT_OR_AUTOGEN cannot yet be used without PASS_PHRASE_QUIET_AUTOGEN.';
      await Ui.modal.error(`${notSupportedErr}\n\nPlease write human@flowcrypt.com to add support.`);
      window.location.href = Url.create('index.htm', { acctEmail: this.view.acctEmail });
      return;
    }
    const keygenAlgo = this.view.rules.getEnforcedKeygenAlgo();
    if (!keygenAlgo) {
      const notSupportedErr = 'Combination of org rules not yet supported: PRV_AUTOIMPORT_OR_AUTOGEN cannot yet be used without enforce_keygen_algo.';
      await Ui.modal.error(`${notSupportedErr}\n\nPlease write human@flowcrypt.com to add support.`);
      window.location.href = Url.create('index.htm', { acctEmail: this.view.acctEmail });
      return;
    }
    const passphrase = PgpPwd.random(); // mustAutogenPassPhraseQuietly
    const opts: SetupOptions = { passphrase_save: true, submit_main: true, submit_all: false, passphrase };
    try {
      const { privateKeys } = await this.view.keyManager!.getPrivateKeys(this.view.idToken!);
      if (privateKeys.length) { // keys already exist on keyserver, auto-import
        const { keys } = await PgpKey.readMany(Buf.fromUtfStr(privateKeys.map(pk => pk.decryptedPrivateKey).join('\n')));
        if (!keys.length) {
          throw new Error(`Could not parse any valid keys from Key Manager response for user ${this.view.acctEmail}`);
        }
        for (const prv of keys) {
          if (!prv.isPrivate()) {
            throw new Error(`Key ${await PgpKey.longid(prv)} for user ${this.view.acctEmail} is not a private key`);
          }
          if (!prv.isFullyDecrypted()) {
            throw new Error(`Key ${await PgpKey.longid(prv)} for user ${this.view.acctEmail} from FlowCrypt Email Key Manager is not fully decrypted`);
          }
          await PgpKey.encrypt(prv, passphrase);
        }
        await this.view.saveKeys(keys, opts);
      } else { // generate keys and store them on key manager
        const { full_name } = await AcctStore.get(this.view.acctEmail, ['full_name']);
        const generated = await PgpKey.create([{ name: full_name || '', email: this.view.acctEmail }], keygenAlgo, passphrase);
        const decryptablePrv = await PgpKey.read(generated.private);
        const generatedKeyFingerprint = await PgpKey.fingerprint(decryptablePrv);
        if (! await PgpKey.decrypt(decryptablePrv, passphrase)) {
          throw new Error('Unexpectedly cannot decrypt newly generated key');
        }
        const storePrvOnKm = () => this.view.keyManager!.storePrivateKey(this.view.idToken!, decryptablePrv.armor(), decryptablePrv.toPublic().armor(), generatedKeyFingerprint!);
        await Settings.retryUntilSuccessful(storePrvOnKm, 'Failed to store newly generated key on FlowCrypt Email Key Manager');
        await this.view.saveKeys([await PgpKey.read(generated.private)], opts); // store encrypted key + pass phrase locally
      }
      await this.view.finalizeSetup(opts);
      await this.view.setupRender.renderSetupDone();
    } catch (e) {
      if (ApiErr.isNetErr(e) && await Api.isInternetAccessible()) { // frendly message when key manager is down, helpful during initial infrastructure setup
        e.message = `FlowCrypt Email Key Manager at ${this.view.rules.getKeyManagerUrl()} is down, please inform your network admin.`;
      }
      throw e;
    }
  }

}
