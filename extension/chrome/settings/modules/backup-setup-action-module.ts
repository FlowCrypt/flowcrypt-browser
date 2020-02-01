/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Lang } from '../../../js/common/lang.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { BackupView } from './backup.js';
import { Settings } from '../../../js/common/settings.js';
import { Store } from '../../../js/common/platform/store.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { Assert } from '../../../js/common/assert.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class BackupSetupActionModule extends ViewModule<BackupView> {

  public setHandlers = () => { // is run after renderSetupAction
    $('#module_setup_1_enter_pp .action_password').click(this.view.setHandler(el => this.actionEnterPassPhraseHandler(el)));
    $("#module_setup_2_confirm_pp #pass_phrase_confirm").keydown(this.view.setEnterHandlerThatClicks('#module_setup_2_confirm_pp .action_backup'));
    $('#module_setup_2_confirm_pp .action_reset_password').click(this.view.setHandler(el => this.actionResetPassPhraseEntryHandler()));
    $('#module_setup_2_confirm_pp .action_backup').click(this.view.setHandlerPrevent('double', el => this.actionBackupHandler(el)));
  }

  public renderSetupAction = async (setupSimple: boolean | undefined) => {
    $('.back').css('display', 'none');
    $('#module_manual .action_skip_backup').parent().css('display', 'none');
    if (setupSimple) {
      try {
        await this.view.manualActionModule.setupCreateSimpleAutomaticInboxBackup();
      } catch (e) {
        return await Settings.promptToRetry('REQUIRED', e, Lang.setup.failedToBackUpKey, this.view.manualActionModule.setupCreateSimpleAutomaticInboxBackup);
      }
    } else {
      this.view.displayBlock('module_manual');
      $('h1').text('Back up your private key');
    }
  }

  private actionEnterPassPhraseHandler = async (target: HTMLElement) => {
    if ($(target).hasClass('green')) {
      this.view.displayBlock('module_setup_2_confirm_pp');
    } else {
      await Ui.modal.warning('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
    }
  }

  private actionResetPassPhraseEntryHandler = async () => {
    $('#module_setup_1_enter_pp #password').val('').keyup();
    $('#module_setup_2_confirm_pp #pass_phrase_confirm').val('');
    this.view.displayBlock('module_setup_1_enter_pp');
    $('#module_setup_1_enter_pp #password').focus();
  }

  private actionBackupHandler = async (target: HTMLElement) => {
    const newPassphrase = String($('#password').val());
    if (newPassphrase !== $('#module_setup_2_confirm_pp #pass_phrase_confirm').val()) {
      await Ui.modal.warning('The two pass phrases do not match, please try again.');
      $('#module_setup_2_confirm_pp #pass_phrase_confirm').val('');
      $('#module_setup_2_confirm_pp #pass_phrase_confirm').focus();
    } else {
      const btnText = $(target).text();
      Xss.sanitizeRender(target, Ui.spinner('white'));
      const [primaryKi] = await Store.keysGet(this.view.acctEmail, ['primary']);
      Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
      const prv = await PgpKey.read(primaryKi.private);
      await PgpKey.encrypt(prv, newPassphrase);
      await Store.passphraseSave('local', this.view.acctEmail, primaryKi.longid, newPassphrase);
      await Store.keysAdd(this.view.acctEmail, prv.armor());
      try {
        await this.view.manualActionModule.doBackupOnEmailProvider(prv.armor());
      } catch (e) {
        if (ApiErr.isNetErr(e)) {
          await Ui.modal.warning('Need internet connection to finish. Please click the button again to retry.');
        } else if (this.view.parentTabId && ApiErr.isAuthPopupNeeded(e)) {
          BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
          await Ui.modal.warning('Account needs to be re-connected first. Please try later.');
        } else {
          Catch.reportErr(e);
          await Ui.modal.error(`Error happened, please try again (${String(e)})`);
        }
        $(target).text(btnText);
        return;
      }
      await this.view.writeBackupDoneAndRender(false, 'inbox');
    }
  }

}
