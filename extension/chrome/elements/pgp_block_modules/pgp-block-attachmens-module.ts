/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from '../../../js/common/api/shared/api.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { PgpBlockView } from '../pgp_block';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';
import { XssSafeFactory } from '../../../js/common/xss-safe-factory.js';

declare const filesize: Function; // tslint:disable-line:ban-types

export class PgpBlockViewAttachmentsModule {

  public includedAtts: Attachment[] = [];

  constructor(private view: PgpBlockView) {
  }

  public renderInnerAtts = (attachments: Attachment[], isEncrypted: boolean) => {
    Xss.sanitizeAppend('#pgp_block', '<div id="attachments"></div>');
    this.includedAtts = attachments;
    for (const i of attachments.keys()) {
      const name = (attachments[i].name ? attachments[i].name : 'noname').replace(/\.(pgp|gpg)$/, '');
      const nameVisible = name.length > 100 ? name.slice(0, 100) + '…' : name;
      const size = filesize(attachments[i].length);
      const htmlContent = `<b>${Xss.escape(nameVisible)}</b>&nbsp;&nbsp;&nbsp;${size}<span class="progress"><span class="percent"></span></span>`;
      const attachment = $(`<a href="#" index="${Number(i)}">`);
      attachment.attr('title', name);
      Xss.sanitizeAppend(attachment, htmlContent);
      if (isEncrypted) {
        attachment.addClass('preview-attachment');
        attachment.append(`<button class="download-attachment" index="${Number(i)}" title="DOWNLOAD"><img src="/img/svgs/download-link-green.svg"></button>`); // xss-escaped
      } else {
        attachment.addClass('download-attachment');
      }
      $('#attachments').append(attachment); // xss-escaped
    }
    this.view.renderModule.resizePgpBlockFrame();
    $('#attachments .preview-attachment').click(this.view.setHandlerPrevent('double', async (target) => {
      const attachment = this.includedAtts[Number($(target).attr('index'))];
      await this.previewAttachmentClickedHandler(attachment);
    }));
    $('#attachments .download-attachment').click(this.view.setHandlerPrevent('double', async (target, event) => {
      event.stopPropagation();
      const attachment = this.includedAtts[Number($(target).attr('index'))];
      if (attachment.hasData()) {
        Browser.saveToDownloads(attachment);
        this.view.renderModule.resizePgpBlockFrame();
      } else {
        Xss.sanitizePrepend($(target).find('.progress'), Ui.spinner('green'));
        attachment.setData(await Api.download(attachment.url!, (perc, load, total) => this.renderProgress($(target).find('.progress .percent'), perc, load, total || attachment.length)));
        await Ui.delay(100); // give browser time to render
        $(target).find('.progress').text('');
        await this.decryptAndSaveAttToDownloads(attachment);
      }
    }));
  }

  private previewAttachmentClickedHandler = async (attachment: Attachment) => {
    const factory = new XssSafeFactory(this.view.acctEmail, this.view.parentTabId);
    const iframeUrl = factory.srcPgpAttIframe(attachment, false, undefined, 'chrome/elements/attachment_preview.htm');
    BrowserMsg.send.showAttachmentPreview(this.view.parentTabId, { iframeUrl });
  }

  private decryptAndSaveAttToDownloads = async (encrypted: Attachment) => {
    const kisWithPp = await KeyStore.getAllWithOptionalPassPhrase(this.view.acctEmail);
    const decrypted = await BrowserMsg.send.bg.await.pgpMsgDecrypt({ kisWithPp, encryptedData: encrypted.getData() });
    if (decrypted.success) {
      const attachment = new Attachment({ name: encrypted.name.replace(/\.(pgp|gpg)$/, ''), type: encrypted.type, data: decrypted.content });
      Browser.saveToDownloads(attachment);
      this.view.renderModule.resizePgpBlockFrame();
    } else {
      delete decrypted.message;
      console.info(decrypted);
      await Ui.modal.error(`There was a problem decrypting this file (${decrypted.error.type}: ${decrypted.error.message}). Downloading encrypted original.`);
      Browser.saveToDownloads(encrypted);
      this.view.renderModule.resizePgpBlockFrame();
    }
  }

  private renderProgress = (element: JQuery<HTMLElement>, percent: number | undefined, received: number | undefined, size: number) => {
    if (percent) {
      element.text(percent + '%');
    } else if (size && received) {
      element.text(Math.floor(((received * 0.75) / size) * 100) + '%');
    }
  }

}
