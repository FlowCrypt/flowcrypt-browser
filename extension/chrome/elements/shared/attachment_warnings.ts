/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ConfirmationResultTracker, Ui } from '../../../js/common/browser/ui.js';
import { Attachment } from '../../../js/common/core/attachment.js';

export class AttachmentWarnings {
  public static confirmSaveToDownloadsIfNeeded = async (attachment: Attachment, confirmationResultTracker?: ConfirmationResultTracker): Promise<boolean> => {
    if (!attachment.isExecutableFile()) {
      return true;
    }
    const confirmFunction = confirmationResultTracker ? Ui.modalInParentTab(confirmationResultTracker).confirm : Ui.modal.confirm;
    const executableFileWarning = 'This executable file was not checked for viruses, and may be dangerous to download or run. Proceed anyway?'; // xss-safe-value
    return await confirmFunction(executableFileWarning);
  };
}
