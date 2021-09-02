/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AttachmentLimits, AttachmentUI } from '../../../js/common/ui/attachment-ui.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { ComposeView } from '../compose.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ViewModule } from '../../../js/common/view-module.js';

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
    this.view.S.cached('body').on('click', '#attachment_list li', async (e: JQuery.Event) => {
      const fileId = $(e.currentTarget).attr('qq-file-id') as string;
      const attachment = await this.attachment.collectAttachment(fileId);
      Browser.saveToDownloads(attachment);
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
