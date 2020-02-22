/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyCanBeFixed, UserAlert } from '../../../js/common/ui/key-import-ui.js';
import { SetupOptions, SetupView } from '../setup.js';

import { Catch } from '../../../js/common/platform/catch.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class SetupImportKeyModule {

  constructor(private view: SetupView) {
  }

  public actionImportPrivateKeyHandle = async (button: HTMLElement) => {
    if (button.className.includes('gray')) {
      await Ui.modal.warning('Please double check the pass phrase input field for any issues.');
      return;
    }
    const options: SetupOptions = {
      passphrase: String($('#step_2b_manual_enter .input_passphrase').val()),
      submit_main: this.view.shouldSubmitPubkey('#step_2b_manual_enter .input_submit_key'),
      submit_all: this.view.shouldSubmitPubkey('#step_2b_manual_enter .input_submit_all'),
      passphrase_save: Boolean($('#step_2b_manual_enter .input_passphrase_save').prop('checked')),
      is_newly_created_key: false,
      recovered: false,
    };
    try {
      const checked = await this.view.keyImportUi.checkPrv(this.view.acctEmail, String($('#step_2b_manual_enter .input_private_key').val()), options.passphrase);
      Xss.sanitizeRender('#step_2b_manual_enter .action_add_private_key', Ui.spinner('white'));
      await this.view.saveKeys([checked.encrypted], options);
      await this.view.preFinalizeSetup(options);
      await this.view.finalizeSetup(options);
      await this.view.setupRender.renderSetupDone();
    } catch (e) {
      if (e instanceof UserAlert) {
        return await Ui.modal.warning(e.message, Ui.testCompatibilityLink);
      } else if (e instanceof KeyCanBeFixed) {
        return await this.renderCompatibilityFixBlockAndFinalizeSetup(e.encrypted, options);
      } else {
        Catch.reportErr(e);
        return await Ui.modal.error(`An error happened when processing the key: ${String(e)}\nPlease write at human@flowcrypt.com`, false, Ui.testCompatibilityLink);
      }
    }
  }

  public renderCompatibilityFixBlockAndFinalizeSetup = async (origPrv: OpenPGP.key.Key, options: SetupOptions) => {
    this.view.setupRender.displayBlock('step_3_compatibility_fix');
    let fixedPrv;
    try {
      fixedPrv = await Settings.renderPrvCompatFixUiAndWaitTilSubmittedByUser(
        this.view.acctEmail, '#step_3_compatibility_fix', origPrv, options.passphrase, window.location.href.replace(/#$/, ''));
    } catch (e) {
      Catch.reportErr(e);
      await Ui.modal.error(`Failed to fix key (${String(e)}). Please write us at human@flowcrypt.com, we are very prompt to fix similar issues.`, false, Ui.testCompatibilityLink);
      this.view.setupRender.displayBlock('step_2b_manual_enter');
      return;
    }
    await this.view.saveKeys([fixedPrv], options);
    await this.view.preFinalizeSetup(options);
    await this.view.finalizeSetup(options);
    await this.view.setupRender.renderSetupDone();
  }
}
