/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ClientConfiguration } from '../../../js/common/client-configuration.js';
import { Key, UnexpectedKeyTypeError } from '../../../js/common/core/crypto/key.js';
import { saveKeysAndPassPhrase, setPassphraseForPrvs } from '../../../js/common/helpers.js';
import { Lang } from '../../../js/common/lang.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Settings } from '../../../js/common/settings.js';
import { UserAlert, KeyCanBeFixed } from '../../../js/common/ui/key-import-ui.js';
import { SetupOptions, SetupView } from '../../settings/setup.js';

export class KeyErrors {
  protected fesUrl: string;
  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly clientConfiguration: ClientConfiguration;
  private readonly setupView?: SetupView;

  public constructor(fesUrl: string, acctEmail: string, parentTabId: string, clientConfiguration: ClientConfiguration, setupView?: SetupView) {
    this.fesUrl = fesUrl;
    this.acctEmail = acctEmail;
    this.parentTabId = parentTabId;
    this.clientConfiguration = clientConfiguration;
    this.setupView = setupView;
  }

  public handlePrivateKeyError = async (exception: unknown, origPrv: Key, setupOptions?: SetupOptions) => {
    if (exception instanceof UserAlert) {
      return await Ui.modal.warning(exception.message, Ui.testCompatibilityLink);
    } else if (exception instanceof KeyCanBeFixed) {
      return await this.renderAndFinalizeSetup(origPrv, setupOptions);
    } else if (exception instanceof UnexpectedKeyTypeError) {
      return await Ui.modal.warning(`This does not appear to be a validly formatted key.\n\n${exception.message}`);
    } else {
      Catch.reportErr(exception);
      return await Ui.modal.error(
        `An error happened when processing the key: ${String(exception)}\n${Lang.general.contactForSupportSentence(this.isCustomerUrlFesUsed())}`,
        false,
        Ui.testCompatibilityLink
      );
    }
  };

  private isCustomerUrlFesUsed = () => Boolean(this.fesUrl);

  private saveKeyAndContinue = async (key: Key) => {
    await saveKeysAndPassPhrase(this.acctEmail, [key]); // resulting new_key checked above
    /* eslint-disable @typescript-eslint/naming-convention */
    await setPassphraseForPrvs(this.clientConfiguration, this.acctEmail, [key], {
      passphrase: String($('.input_passphrase').val()),
      passphrase_save: !!$('.input_passphrase_save').prop('checked'),
      passphrase_ensure_single_copy: false, // we require KeyImportUi to rejectKnown keys
    });
    /* eslint-enable @typescript-eslint/naming-convention */
    BrowserMsg.send.reload(this.parentTabId, { advanced: true });
  };

  private toggleCompatibilityView = (visible: boolean) => {
    if (visible) {
      $('#add_key_container').hide();
      $('#compatibility_fix').show();
    } else {
      $('#add_key_container').show();
      $('#compatibility_fix').hide();
    }
  };

  private renderCompatibilityFix = async (origPrv: Key, options?: SetupOptions) => {
    try {
      return await Settings.renderPrvCompatFixUiAndWaitTilSubmittedByUser(
        this.acctEmail,
        '#step_3_compatibility_fix',
        origPrv,
        options?.passphrase || String($('.input_passphrase').val()),
        window.location.href.replace(/#$/, '')
      );
    } catch (e) {
      Catch.reportErr(e);
      await Ui.modal.error(`Failed to fix key (${String(e)}). ${Lang.general.writeMeToFixIt(this.isCustomerUrlFesUsed())}`, false, Ui.testCompatibilityLink);
      if (this.setupView?.setupRender.displayBlock) {
        // in Function 1
        this.setupView.setupRender.displayBlock('step_2b_manual_enter');
      } else {
        // in Function 2
        this.toggleCompatibilityView(false);
      }
      return;
    }
  };

  private renderAndFinalizeSetup = async (origPrv: Key, options?: SetupOptions) => {
    $('.ask_support_assistance_container').text(Lang.general.contactIfNeedAssistance(this.isCustomerUrlFesUsed()));
    this.setupView?.setupRender.displayBlock('step_3_compatibility_fix');

    const fixedPrv = await this.renderCompatibilityFix(origPrv, options);

    if (this.setupView?.setupRender.renderSetupDone) {
      // in Function 1
      await saveKeysAndPassPhrase(this.setupView?.acctEmail, [fixedPrv!], options);
      await this.setupView.submitPublicKeys(options!);
      await this.setupView.finalizeSetup();
      await this.setupView.setupRender.renderSetupDone();
    } else {
      // in Function 2
      await this.saveKeyAndContinue(fixedPrv!);
    }
  };
}
