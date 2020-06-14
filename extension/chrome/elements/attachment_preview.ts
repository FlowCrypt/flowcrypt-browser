/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Att } from '../../js/common/core/att.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { PgpMsg } from '../../js/common/core/pgp-msg.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { AttachmentDownloadView } from './attachment.js';
import { XssSafeFactory } from '../../js/common/xss-safe-factory.js';

type AttachmentType = 'img' | 'txt';

View.run(class AttachmentPreviewView extends AttachmentDownloadView {
  constructor() {
    super();
  }

  public render = async () => {
    try {
      this.att = new Att({ name: this.origNameBasedOnFilename, type: this.type, msgId: this.msgId, id: this.id, url: this.url });
      await this.downloadDataIfNeeded();
      const result = this.isEncrypted ? await this.decrypt() : this.att.getData();
      if (result) {
        const blob = new Blob([result], { type: this.type });
        const url = window.URL.createObjectURL(blob);
        const attachmentType = this.getAttachmentType(this.origNameBasedOnFilename);
        if (attachmentType === 'img') {
          $('#attachment-preview-container').html(`<img src="${url}" class="attachment-preview-img" alt="${this.name}">`);
        } else if (attachmentType === 'txt') {
          $('#attachment-preview-container').html(`<div class="attachment-preview-txt">${Xss.escape(result.toString()).replace(/\n/g, '<br>')}</div>`);
        }
        const downloadBtn = (new XssSafeFactory(this.acctEmail, this.tabId)).btnDownloadAttachment(url, this.origNameBasedOnFilename);
        const downloadBtnEl = $(downloadBtn);
        downloadBtnEl.on('click', e => e.preventDefault());
        $('#attachment-preview-download').empty().append(downloadBtnEl);
        $('body').on('click', (e) => {
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
    const result = await PgpMsg.decrypt({ kisWithPp: await KeyStore.getAllWithPp(this.acctEmail), encryptedData: this.att.getData() });
    return result.content;
  }
});
