/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../js/common/assert.js';
import { Attachment } from '../../js/common/core/attachment.js';
import { AttachmentDownloadView } from './attachment.js';
import { AttachmentPreviewPdf } from '../../js/common/ui/attachment_preview_pdf.js';
import { Browser } from '../../js/common/browser/browser.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { PDFDocumentProxy } from '../../types/pdf.js';
import { MsgUtil, DecryptError, DecryptErrTypes, DecryptSuccess, DecryptionError } from '../../js/common/core/crypto/pgp/msg-util.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Url } from '../../js/common/core/common.js';

type AttachmentType = 'img' | 'txt' | 'pdf';

declare const pdfjsLib: any; // tslint:disable-line:ban-types

View.run(class AttachmentPreviewView extends AttachmentDownloadView {
  protected readonly initiatorFrameId?: string;
  private attachmentPreviewContainer = $('#attachment-preview-container');

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['initiatorFrameId']);
    this.initiatorFrameId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'initiatorFrameId');
  }

  public render = async () => {
    try {
      Xss.sanitizeRender(this.attachmentPreviewContainer, `${Ui.spinner('green', 'large_spinner')}<span class="download_progress"></span>`);
      this.attachment = new Attachment({ name: this.origNameBasedOnFilename, type: this.type, msgId: this.msgId, id: this.id, url: this.url });
      await this.downloadDataIfNeeded();
      const result = this.isEncrypted ? await this.decrypt() : this.attachment.getData();
      if (result) {
        const blob = new Blob([result], { type: this.type });
        const url = window.URL.createObjectURL(blob);
        const attachmentType = this.getAttachmentType(this.origNameBasedOnFilename);
        const attachmentForSave = new Attachment({ name: this.origNameBasedOnFilename, type: this.type, data: result });
        if (attachmentType) {
          if (attachmentType === 'img') { // image
            this.attachmentPreviewContainer.html(`<img src="${url}" class="attachment-preview-img" alt="${Xss.escape(this.origNameBasedOnFilename)}">`); // xss-escaped
          } else if (attachmentType === 'txt') { // text
            this.attachmentPreviewContainer.html(`<div class="attachment-preview-txt">${Xss.escape(result.toString()).replace(/\n/g, '<br>')}</div>`); // xss-escaped
          } else if (attachmentType === 'pdf') { // PDF
            pdfjsLib.getDocument({ data: result }).promise.then(async (pdf: PDFDocumentProxy) => { // tslint:disable-line:no-unsafe-any
              const previewPdf = new AttachmentPreviewPdf(this.attachmentPreviewContainer, pdf);
              await previewPdf.render();
            });
          }
        } else { // no preview available, download button
          this.attachmentPreviewContainer.html('<div class="attachment-preview-unavailable"></div>'); // xss-escaped
          $('.attachment-preview-unavailable').prepend('No preview available'); // xss-escaped
          $('#attachment-preview-download').appendTo('.attachment-preview-unavailable');
        }
        $('body').click((e) => {
          if (e.target === document.body || $('body').children().toArray().indexOf(e.target) !== -1) {
            BrowserMsg.send.closeDialog(this.parentTabId);
          }
        });
        $('#attachment-preview-download').css('display', 'flex').click((e) => {
          e.stopPropagation();
          Browser.saveToDownloads(attachmentForSave);
        });
      }
    } catch (e) {
      this.renderErr(e);
    }
  }

  private getAttachmentType = (filename: string): AttachmentType | undefined => {
    const nameSplit = filename.split('.');
    const extension = nameSplit[nameSplit.length - 1].toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
      return 'img';
    } else if (extension === 'txt') {
      return 'txt';
    } else if (extension === 'pdf') {
      return 'pdf';
    }
    return undefined;
  }

  private decrypt = async () => {
    const result = await MsgUtil.decryptMessage({ kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(this.acctEmail), encryptedData: this.attachment.getData() });
    if ((result as DecryptSuccess).content) {
      return result.content;
    } else if ((result as DecryptError).error.type === DecryptErrTypes.needPassphrase) {
      return BrowserMsg.send.passphraseDialog(this.parentTabId, { type: 'attachment', longids: (result as DecryptError).longids.needPassphrase, initiatorFrameId: this.initiatorFrameId });
    }
    throw new DecryptionError(result as DecryptError);
  }
});
