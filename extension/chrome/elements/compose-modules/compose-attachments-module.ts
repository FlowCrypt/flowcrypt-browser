/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AttachmentLimits, AttachmentUI } from '../../../js/common/ui/attachment-ui.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';

export class ComposeAttachmentsModule extends ViewModule<ComposeView> {

  public attachment: AttachmentUI;

  constructor(view: ComposeView) {
    super(view);
    this.attachment = new AttachmentUI(() => this.getMaxAttachmentSizeAndOversizeNotice());
  }

  public setHandlers = () => {
    this.view.S.cached('body').bind({ drop: Ui.event.stop(), dragover: Ui.event.stop() }); // prevents files dropped out of the intended drop area to interfere
    this.attachment.initAttachmentDialog('fineuploader', 'fineuploader_button', {
      uiChanged: () => {
        this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
        this.view.sizeModule.resizeComposeBox();
      }
    });
  }

  private getMaxAttachmentSizeAndOversizeNotice = async (): Promise<AttachmentLimits> => {
    const sizeMb = 25;
    return {
      sizeMb,
      size: sizeMb * 1024 * 1024,
      count: 10,
      oversize: async (combinedSize: number) => {
        await Ui.modal.warning('Combined attachment size is limited to 25 MB. The last file brings it to ' + Math.ceil(combinedSize / (1024 * 1024)) + ' MB.');
      },
    };
  }

}
