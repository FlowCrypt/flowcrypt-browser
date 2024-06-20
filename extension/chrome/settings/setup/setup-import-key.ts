/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SetupOptions, SetupView } from '../setup.js';

import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { saveKeysAndPassPhrase } from '../../../js/common/helpers.js';
import { KeyErrors } from '../../elements/shared/key_errors.js';
import { Key } from '../../../js/common/core/crypto/key.js';

export class SetupImportKeyModule {
  private keyErrors: KeyErrors | undefined;
  public constructor(private view: SetupView) {}

  public actionImportPrivateKeyHandle = async (button: HTMLElement) => {
    if (button.className.includes('gray')) {
      await Ui.modal.warning('Please double check the pass phrase input field for any issues.');
      return;
    }
    /* eslint-disable @typescript-eslint/naming-convention */
    const options: SetupOptions = {
      passphrase: String($('#step_2b_manual_enter .input_passphrase').val()),
      submit_main: this.view.shouldSubmitPubkey('#step_2b_manual_enter .input_submit_key'),
      submit_all: this.view.shouldSubmitPubkey('#step_2b_manual_enter .input_submit_all'),
      passphrase_save: Boolean($('#step_2b_manual_enter .input_passphrase_save').prop('checked')),
      passphrase_ensure_single_copy: true,
      recovered: false,
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    try {
      const checked = await this.view.keyImportUi.checkPrv(
        this.view.acctEmail,
        String($('#step_2b_manual_enter .input_private_key').val()),
        options.passphrase
      );
      if (checked.decrypted.family === 'x509') {
        if (
          !(await Ui.modal.confirm(
            'Using S/MIME as the only key on account is experimental. ' +
              'You should instead import an OpenPGP key here, and then add S/MIME keys as additional keys in FlowCrypt Settings.' +
              '\n\nContinue anyway? (not recommented).'
          ))
        ) {
          return;
        }
      }
      Xss.sanitizeRender('#step_2b_manual_enter .action_add_private_key', Ui.spinner('white'));
      await saveKeysAndPassPhrase(this.view.acctEmail, [checked.encrypted], options, this.view.submitKeyForAddrs);
      await this.view.submitPublicKeys(options);
      await this.view.finalizeSetup();
      await this.view.setupRender.renderSetupDone();
    } catch (e) {
      this.keyErrors = new KeyErrors(
        this.view.storage.fesUrl || '',
        this.view.acctEmail,
        this.view.parentTabId || '',
        this.view.clientConfiguration,
        this.view
      );
      await this.keyErrors.handlePrivateKeyError(e, (e as { encrypted: Key }).encrypted, options);
    }
  };
}
