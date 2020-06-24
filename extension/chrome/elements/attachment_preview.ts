/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Att } from '../../js/common/core/att.js';
import { AttachmentDownloadView } from './attachment.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { PgpMsg } from '../../js/common/core/crypto/pgp/pgp-msg.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Ui } from '../../js/common/browser/ui.js';

type AttachmentType = 'img' | 'txt';

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
        const downloadBtn = $(`<a href="${url}" download="${Xss.escape(this.origNameBasedOnFilename)}" class="download-attachment">
          Right-click here and choose 'Save Link As' to save encrypted file
          <img src="/img/svgs/download-link.png">
        </a>`);
        downloadBtn.click((e) => e.preventDefault());
        if (attachmentType) {
          if (attachmentType === 'img') { // image
            this.attachmentPreviewContainer.html(`<img src="${url}" class="attachment-preview-img" alt="${Xss.escape(this.origNameBasedOnFilename)}">`); // xss-escaped
          } else if (attachmentType === 'txt') { // text
            this.attachmentPreviewContainer.html(`<div class="attachment-preview-txt">${Xss.escape(result.toString()).replace(/\n/g, '<br>')}</div>`); // xss-escaped
          }
          $('#attachment-preview-download').append(downloadBtn); // xss-escaped
        } else { // no preview available, download button
          this.attachmentPreviewContainer.html('<div class="attachment-preview-unavailable">No preview available</div>'); // xss-escaped
          $('.attachment-preview-unavailable').append(downloadBtn); // xss-escaped
        }
        $('body').click((e) => {
          if (e.target === document.body || $('body').children().toArray().indexOf(e.target) !== -1) {
            BrowserMsg.send.closeSwal(this.parentTabId);
          }
        });
      }
    } catch (e) {
      Catch.reportErr(e);
      $('body.attachment').text(`Error processing params: ${String(e)}. Contact human@flowcrypt.com`);
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
    }
    return undefined;
  }

  private decrypt = async () => {
    const result = await PgpMsg.decryptMessage({ kisWithPp: await KeyStore.getAllWithPp(this.acctEmail), encryptedData: this.att.getData() });
    return result.content;
  }
});
