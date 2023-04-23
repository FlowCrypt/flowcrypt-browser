/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from '../../../js/common/api/shared/api.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { PgpBlockView } from '../pgp_block';
import { CommonHandlers, Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { XssSafeFactory } from '../../../js/common/xss-safe-factory.js';
import { Str } from '../../../js/common/core/common.js';
import { AttachmentWarnings } from '../shared/attachment_warnings.js';

declare const filesize: { filesize: Function }; // eslint-disable-line @typescript-eslint/ban-types

export class PgpBlockViewAttachmentsModule {
  public includedAttachments: Attachment[] = [];

  public constructor(private view: PgpBlockView) {}

  public getParentTabId = () => {
    return this.view.parentTabId;
  };

  public renderInnerAttachments = (attachments: Attachment[], isEncrypted: boolean) => {
    Xss.sanitizeAppend('#pgp_block', '<div id="attachments"></div>');
    this.includedAttachments = attachments;
    for (const i of attachments.keys()) {
      const name = attachments[i].name ? Str.stripPgpOrGpgExtensionIfPresent(attachments[i].name) : 'noname';
      const nameVisible = name.length > 100 ? name.slice(0, 100) + '…' : name;
      const size = filesize.filesize(attachments[i].length);
      const htmlContent = `<b>${Xss.escape(nameVisible)}</b>&nbsp;&nbsp;&nbsp;${size}<span class="progress"><span class="percent"></span></span>`;
      const attachment = $(`<a href="#" index="${Number(i)}">`);
      attachment.attr('title', name);
      Xss.sanitizeAppend(attachment, htmlContent);
      if (isEncrypted) {
        attachment.addClass('preview-attachment');
        attachment.attr('data-test', 'preview-attachment');
        attachment.append(
          `<button class="download-attachment" data-test="download-attachment-${Number(i)}" index="${Number(
            i
          )}" title="DOWNLOAD"><img src="/img/svgs/download-link-green.svg"></button>`
        ); // xss-escaped
      } else {
        attachment.attr('data-test', `download-attachment-${Number(i)}`);
        attachment.addClass('download-attachment');
      }
      $('#attachments').append(attachment); // xss-escaped
    }
    this.view.renderModule.resizePgpBlockFrame();
    $('#attachments .preview-attachment').on(
      'click',
      this.view.setHandlerPrevent('double', async target => {
        const attachment = this.includedAttachments[Number($(target).attr('index'))];
        await this.previewAttachmentClickedHandler(attachment);
      })
    );
    $('#attachments .download-attachment').on(
      'click',
      this.view.setHandlerPrevent('double', async (target, event) => {
        event.stopPropagation();
        const attachment = this.includedAttachments[Number($(target).attr('index'))];
        if (attachment.hasData()) {
          await this.decryptAndSaveAttachmentToDownloads(attachment);
        } else {
          Xss.sanitizePrepend($(target).find('.progress'), Ui.spinner('green'));
          attachment.setData(
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await Api.download(attachment.url!, (perc, load, total) =>
              this.renderProgress($(target).find('.progress .percent'), perc, load, total || attachment.length)
            )
          );
          await Ui.delay(100); // give browser time to render
          $(target).find('.progress').text('');
          await this.decryptAndSaveAttachmentToDownloads(attachment);
        }
      })
    );
    BrowserMsg.addListener('confirmation_result', CommonHandlers.createConfirmationResultHandler(this));
    BrowserMsg.listen(this.view.parentTabId);
  };

  private previewAttachmentClickedHandler = async (attachment: Attachment) => {
    const factory = new XssSafeFactory(this.view.acctEmail, this.view.parentTabId);
    const iframeUrl = factory.srcPgpAttachmentIframe(attachment, false, undefined, 'chrome/elements/attachment_preview.htm');
    BrowserMsg.send.showAttachmentPreview(this.view.parentTabId, { iframeUrl });
  };

  private decryptAndSaveAttachmentToDownloads = async (encrypted: Attachment) => {
    const kisWithPp = await KeyStore.getAllWithOptionalPassPhrase(this.view.acctEmail);
    // todo: #4158 signature verification of attachments
    const decrypted = await BrowserMsg.send.bg.await.pgpMsgDecrypt({
      kisWithPp,
      encryptedData: encrypted.getData(),
      verificationPubs: [],
    });
    if (decrypted.success) {
      const attachment = new Attachment({
        name: Str.stripPgpOrGpgExtensionIfPresent(encrypted.name),
        type: encrypted.type,
        data: decrypted.content,
      });
      if (await AttachmentWarnings.confirmSaveToDownloadsIfNeeded(attachment, this)) {
        Browser.saveToDownloads(attachment);
      }
    } else {
      console.info(decrypted);
      await Ui.modal.error(`There was a problem decrypting this file (${decrypted.error.type}: ${decrypted.error.message}). Downloading encrypted original.`);
      Browser.saveToDownloads(encrypted);
      this.view.renderModule.resizePgpBlockFrame();
    }
  };

  private renderProgress = (element: JQuery<HTMLElement>, percent: number | undefined, received: number | undefined, size: number) => {
    if (percent) {
      element.text(percent + '%');
    } else if (size && received) {
      element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  };
}
