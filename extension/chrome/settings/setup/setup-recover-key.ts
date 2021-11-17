/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SetupOptions, SetupView } from '../setup.js';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Lang } from '../../../js/common/lang.js';
import { Key, KeyUtil } from '../../../js/common/core/crypto/key.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';

export class SetupRecoverKeyModule {

  constructor(private view: SetupView) {
  }

  public actionRecoverAccountHandler = async () => {
    try {
      const passphrase = String($('#recovery_password').val());
      const newlyMatchingKeys: Key[] = [];
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
        if (await KeyUtil.checkPassPhrase(fetchedKey.private, passphrase) === true) {
          if (!this.view.mathingPassphrases.includes(passphrase)) {
            this.view.mathingPassphrases.push(passphrase);
          }
          if (!this.view.importedKeysUniqueLongids.includes(fetchedKey.longid)) {
            const prv = await KeyUtil.parse(fetchedKey.private);
            newlyMatchingKeys.push(prv);
            this.view.importedKeysUniqueLongids.push(fetchedKey.longid);
          } else {
            matchedPreviouslyRecoveredKey = true;
          }
        }
      }
      if (!newlyMatchingKeys.length) {
        if (matchedPreviouslyRecoveredKey) {
          $('#recovery_password').val('');
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
        recovered: true,
      };
      await this.view.saveKeysAndPassPhrase(newlyMatchingKeys, options);
      const { setup_done } = await AcctStore.get(this.view.acctEmail, ['setup_done']);
      if (!setup_done) { // normal situation - fresh setup
        await this.view.submitPublicKeys(options);
        await this.view.finalizeSetup();
        await this.view.setupRender.renderSetupDone();
      } else { // setup was finished before, just added more keys now
        await this.view.setupRender.renderSetupDone();
      }
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      await Ui.modal.error(`Error setting up FlowCrypt:\n\n${ApiErr.eli5(e)} (${String(e)})\n\nPlease write human@flowcrypt.com if this happens repeatedly.`);
    }
  };

  public actionRecoverRemainingKeysHandler = async () => {
    this.view.setupRender.displayBlock('step_2_recovery');
    $('#recovery_password').val('');
    const nImported = (await KeyStore.get(this.view.acctEmail)).length;
    const nFetched = this.view.fetchedKeyBackupsUniqueLongids.length;
    const txtKeysTeft = (nFetched - nImported > 1) ? `are ${nFetched - nImported} backups` : 'is one backup';
    if (this.view.action !== 'add_key') {
      Xss.sanitizeRender('#step_2_recovery .recovery_status', Lang.setup.nBackupsAlreadyRecoveredOrLeft(nImported, nFetched, txtKeysTeft));
      Xss.sanitizeReplace('#step_2_recovery .line_skip_recovery', Ui.e('div', { class: 'line', html: Ui.e('a', { href: '#', class: 'skip_recover_remaining', html: 'Skip this step' }) }));
      $('#step_2_recovery .skip_recover_remaining').click(this.view.setHandler(() => { window.location.href = Url.create('index.htm', { acctEmail: this.view.acctEmail }); }));
    } else {
      Xss.sanitizeRender('#step_2_recovery .recovery_status', `There ${txtKeysTeft} left to recover.<br><br>Try different pass phrases to unlock all backups.`);
      $('#step_2_recovery .line_skip_recovery').css('display', 'none');
    }
  };

  public actionSkipRecoveryHandler = async () => {
    if (await Ui.modal.confirm(Lang.setup.confirmSkipRecovery)) {
      this.view.fetchedKeyBackups = [];
      this.view.fetchedKeyBackupsUniqueLongids = [];
      this.view.mathingPassphrases = [];
      this.view.importedKeysUniqueLongids = [];
      this.view.setupRender.displayBlock('step_1_easy_or_manual');
    }
  };

  public renderAddKeyFromBackup = async () => { // at this point, account is already set up, and this page is showing in a lightbox after selecting "from backup" in add_key.htm
    $('.profile-row, .skip_recover_remaining, .action_send, .action_account_settings, #lost_pass_phrase').css({ display: 'none', visibility: 'hidden', opacity: 0 });
    Xss.sanitizeRender($('h1').parent(), '<h1>Recover key from backup</h1>');
    $('.action_recover_account').text('load key from backup');
    try {
      const backups = await this.view.gmail.fetchKeyBackups();
      this.view.fetchedKeyBackups = backups.keyinfos.backups;
      this.view.fetchedKeyBackupsUniqueLongids = backups.longids.backups;
    } catch (e) {
      window.location.href = Url.create('modules/add_key.htm', { acctEmail: this.view.acctEmail, parentTabId: this.view.parentTabId });
      return;
    }
    if (this.view.fetchedKeyBackupsUniqueLongids.length) {
      const storedKeys = await KeyStore.get(this.view.acctEmail);
      this.view.importedKeysUniqueLongids = storedKeys.map(ki => ki.longid);
      await this.view.setupRender.renderSetupDone();
      $('#step_4_more_to_recover .action_recover_remaining').click();
    } else {
      window.location.href = Url.create('modules/add_key.htm', { acctEmail: this.view.acctEmail, parentTabId: this.view.parentTabId });
    }
  };

}
