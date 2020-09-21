/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Att } from '../../js/common/core/att.js';
import { AttachmentDownloadView } from './attachment.js';
import { Browser } from '../../js/common/browser/browser.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { PDFDocumentProxy } from '../../types/pdf.js';
import { PgpMsg, DecryptError, DecryptSuccess } from '../../js/common/core/crypto/pgp/pgp-msg.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Ui } from '../../js/common/browser/ui.js';

type AttachmentType = 'img' | 'txt' | 'pdf';

declare const pdfjsLib: any; // tslint:disable-line:ban-types

View.run(class AttachmentPreviewView extends AttachmentDownloadView {
  private attachmentPreviewContainer = $('#attachment-preview-container');

  constructor() {
    super();
  }

  public render = async () => {
    try {
      Xss.sanitizeRender(this.attachmentPreviewContainer, `${Ui.spinner('green', 'large_spinner')}<span class="download_progress"></span>`);
      this.att = new Att({ name: this.origNameBasedOnFilename, type: this.type, msgId: this.msgId, id: this.id, url: this.url });
      await this.downloadDataIfNeeded();
      const result = this.isEncrypted ? await this.decrypt() : this.att.getData();
      if (result) {
        const blob = new Blob([result], { type: this.type });
        const url = window.URL.createObjectURL(blob);
        const attachmentType = this.getAttachmentType(this.origNameBasedOnFilename);
        const attForSave = new Att({ name: this.origNameBasedOnFilename, type: this.type, data: result });
        if (attachmentType) {
          if (attachmentType === 'img') { // image
            this.attachmentPreviewContainer.html(`<img src="${url}" class="attachment-preview-img" alt="${Xss.escape(this.origNameBasedOnFilename)}">`); // xss-escaped
          } else if (attachmentType === 'txt') { // text
            this.attachmentPreviewContainer.html(`<div class="attachment-preview-txt">${Xss.escape(result.toString()).replace(/\n/g, '<br>')}</div>`); // xss-escaped
          } else if (attachmentType === 'pdf') { // PDF
            const renderPdfPage = (pdf: PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement) => {
              const scale = 1;
              pdf.getPage(pageNumber).then((page) => {
                const viewport = page.getViewport({ scale });
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                page.render({ canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D, viewport });
              });
            };
            const renderPdf = (pdf: PDFDocumentProxy) => {
              const attachmentPreviewPdf = $('<div class="attachment-preview-pdf"></div>');
              this.attachmentPreviewContainer.empty().append(attachmentPreviewPdf); // xss-escaped
              for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
                const canvas = $('<canvas class="attachment-preview-pdf-page"></canvas>');
                attachmentPreviewPdf.append(canvas); // xss-escaped
                renderPdfPage(pdf, pageNumber, canvas.get(0) as HTMLCanvasElement);
              }
            };
            pdfjsLib.getDocument({ data: result }).promise.then(renderPdf); // tslint:disable-line:no-unsafe-any
          }
        } else { // no preview available, download button
          this.attachmentPreviewContainer.html('<div class="attachment-preview-unavailable"></div>'); // xss-escaped
          $('.attachment-preview-unavailable').prepend('No preview available'); // xss-escaped
          $('#attachment-preview-download').appendTo('.attachment-preview-unavailable');
        }
        $('body').click((e) => {
          if (e.target === document.body || $('body').children().toArray().indexOf(e.target) !== -1) {
            BrowserMsg.send.closeSwal(this.parentTabId);
          }
        });
        $('#attachment-preview-download').css('display', 'flex').click((e) => {
          e.stopPropagation();
          Browser.saveToDownloads(attForSave);
        });
      }
    } catch (e) {
      Catch.reportErr(e);
      this.attachmentPreviewContainer.html(`<span class="attachment-preview-error">${Xss.escape(String(e))}.<br><br> Contact human@flowcrypt.com</span>`); // xss-escaped
      return;
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
    const result = await PgpMsg.decryptMessage({ kisWithPp: await KeyStore.getAllWithPp(this.acctEmail), encryptedData: this.att.getData() });
    if ((result as DecryptSuccess).content) {
      return result.content;
    }
    throw new Error((result as DecryptError).error.message);
  }
});
