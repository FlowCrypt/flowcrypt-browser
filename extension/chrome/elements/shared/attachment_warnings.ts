/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ConfirmationResultTracker, Ui } from '../../../js/common/browser/ui.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { Lang } from '../../../js/common/lang.js';

export class AttachmentWarnings {
  public static confirmSaveToDownloadsIfNeeded = async (attachment: Attachment, confirmationResultTracker?: ConfirmationResultTracker): Promise<boolean> => {
    if (!attachment.isExecutableFile()) {
      return true;
    }
    const confirmFunction = confirmationResultTracker ? Ui.modalInParentTab(confirmationResultTracker).confirm : Ui.modal.confirm;
    return await confirmFunction(Lang.attachment.executableFileWarning);
  };
}
