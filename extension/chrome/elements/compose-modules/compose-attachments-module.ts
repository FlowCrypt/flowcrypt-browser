/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AttachmentLimits, AttachmentUI } from '../../../js/common/ui/attachment-ui.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { ComposeView } from '../compose.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { ViewModule } from '../../../js/common/view-module.js';

export class ComposeAttachmentsModule extends ViewModule<ComposeView> {
  public attachment: AttachmentUI;

  public constructor(view: ComposeView) {
    super(view);
    this.attachment = new AttachmentUI(() => this.getMaxAttachmentSizeAndOversizeNotice());
  }

  public setHandlers = () => {
    this.view.S.cached('body').on({ drop: Ui.event.stop(), dragover: Ui.event.stop() }); // prevents files dropped out of the intended drop area to interfere
    this.attachment.initAttachmentDialog('fineuploader', 'fineuploader_button', {
      uiChanged: () => {
        this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
        this.view.sizeModule.resizeComposeBox();
      },
    });
    this.view.S.cached('body').on('click', '#attachment_list li', async e => {
      // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
      const fileId = $(e.currentTarget).attr('qq-file-id') as string;
      const attachment = await this.attachment.collectAttachment(fileId);
      Browser.saveToDownloads(attachment);
    });
  };

  private getMaxAttachmentSizeAndOversizeNotice = async (): Promise<AttachmentLimits> => {
    // To prevent size bloating, it is recommended to set the attachment size limit to 19MB for Rich-text editor mode - https://github.com/FlowCrypt/flowcrypt-browser/issues/2538#issuecomment-1639926581
    const sizeMb = this.view.inputModule.isRichText() ? 19 : 25;
    return {
      sizeMb,
      size: sizeMb * 1024 * 1024,
      count: 50,
      oversize: async (combinedSize: number) => {
        await Ui.modal.warning(
          `Combined attachment size is limited to ${sizeMb} MB. The last file brings it to ` + Math.ceil(combinedSize / (1024 * 1024)) + ' MB.'
        );
      },
    };
  };
}
