/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SetupView, SetupOptions } from '../setup.js';
import { Ui } from '../../../js/common/browser.js';
import { Lang } from '../../../js/common/lang.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Store } from '../../../js/common/platform/store.js';
import { Api } from '../../../js/common/api/api.js';
import { Catch } from '../../../js/common/platform/catch.js';

declare const openpgp: typeof OpenPGP;

export class SetupRecoveryModule {

  constructor(private view: SetupView) {
  }

  public async actionRecoverAccountHandler() {
    try {
      const passphrase = String($('#recovery_pasword').val());
      const newlyMatchingKeys: OpenPGP.key.Key[] = [];
      if (passphrase && this.view.mathingPassphrases.includes(passphrase)) {
        await Ui.modal.warning(Lang.setup.tryDifferentPassPhraseForRemainingBackups);
        return;
      }
      if (!passphrase) {
        await Ui.modal.warning('Please enter the pass phrase you used when you first set up FlowCrypt, so that we can recover your original keys.');
        return;
      }
      let matchedPreviouslyRecoveredKey = false;
      for (const fetchedKey of this.view.fetchedKeyBackups) {
        const longid = await Pgp.key.longid(fetchedKey);
        if (longid && await Pgp.key.decrypt(await Pgp.key.read(fetchedKey.armor()), passphrase) === true) { // attempt to decrypt a copy of the key
          if (!this.view.mathingPassphrases.includes(passphrase)) {
            this.view.mathingPassphrases.push(passphrase);
          }
          if (!this.view.importedKeysUniqueLongids.includes(longid)) {
            const { keys: [prv] } = await openpgp.key.readArmored(fetchedKey.armor());
            newlyMatchingKeys.push(prv);
            this.view.importedKeysUniqueLongids.push(longid);
          } else {
            matchedPreviouslyRecoveredKey = true;
          }
        }
      }
      if (!newlyMatchingKeys.length) {
        $('.line_skip_recovery').css('display', 'block');
        if (matchedPreviouslyRecoveredKey) {
          $('#recovery_pasword').val('');
          await Ui.modal.warning('This is a correct pass phrase, but it matches a key that was already recovered. Please try another pass phrase.');
        } else if (this.view.fetchedKeyBackupsUniqueLongids.length > 1) {
          await Ui.modal.warning(`This pass phrase did not match any of your ${this.view.fetchedKeyBackupsUniqueLongids.length} backed up keys. Please try again.`);
        } else {
          await Ui.modal.warning('This pass phrase did not match your original setup. Please try again.');
        }
        return;
      }
      const options: SetupOptions = {
        submit_main: false, // todo - reevaluate submitting when recovering
        submit_all: false,
        passphrase,
        passphrase_save: true, // todo - reevaluate saving passphrase when recovering
        key_backup_prompt: false,
        recovered: true,
        setup_simple: true,
        is_newly_created_key: false,
      };
      await this.view.saveKeys(newlyMatchingKeys, options);
      const { setup_done } = await Store.getAcct(this.view.acctEmail, ['setup_done']);
      if (!setup_done) { // normal situation - fresh setup
        await this.view.preFinalizeSetup(options);
        await this.view.finalizeSetup(options);
        await this.view.renderSetupDone();
      } else { // setup was finished before, just added more keys now
        await this.view.renderSetupDone();
      }
    } catch (e) {
      if (Api.err.isSignificant(e)) {
        Catch.reportErr(e);
      }
      await Ui.modal.error(`Error setting up FlowCrypt:\n\n${Api.err.eli5(e)} (${String(e)})\n\nPlease write human@flowcrypt.com if this happens repeatedly.`);
    }
  }

}
