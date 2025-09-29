/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../js/common/assert.js';
import { Attachment } from '../../js/common/core/attachment.js';
import { AttachmentDownloadView } from './attachment.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { MsgUtil, DecryptError, DecryptErrTypes, DecryptSuccess, DecryptionError } from '../../js/common/core/crypto/pgp/msg-util.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Url } from '../../js/common/core/common.js';
import { Browser } from '../../js/common/browser/browser.js';
import { AttachmentWarnings } from './shared/attachment_warnings.js';
import * as pdfjsLib from 'pdfjs';
import { AttachmentPreviewPdf } from '../../js/common/ui/attachment_preview_pdf.js';

// https://github.com/FlowCrypt/flowcrypt-browser/issues/5822#issuecomment-2362529197

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(`lib/pdf.worker.min.mjs`);
type AttachmentType = 'img' | 'txt' | 'pdf';

View.run(
  class AttachmentPreviewView extends AttachmentDownloadView {
    protected readonly initiatorFrameId?: string;

    private attachmentPreviewContainer = $('#attachment-preview-container');

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['initiatorFrameId']);
      this.initiatorFrameId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'initiatorFrameId');
    }

    public render = async () => {
      try {
        Xss.sanitizeRender(this.attachmentPreviewContainer, `${Ui.spinner('green', 'large_spinner')}<span class="download_progress"></span>`);
        this.attachment = new Attachment({
          ...this.attachmentId,
          name: this.origNameBasedOnFilename,
          type: this.type,
        });
        await this.downloadDataIfNeeded();
        const result = this.isEncrypted ? await this.decrypt() : this.attachment.getData();
        if (result) {
          const blob = new Blob([result], { type: this.type });
          const url = window.URL.createObjectURL(blob);
          const attachmentType = this.getAttachmentType(this.origNameBasedOnFilename);
          const attachmentForSave = new Attachment({
            name: this.origNameBasedOnFilename,
            type: this.type,
            data: result,
          });
          if (attachmentType) {
            if (attachmentType === 'img') {
              // image
              this.attachmentPreviewContainer.html(`<img src="${url}" class="attachment-preview-img" alt="${Xss.escape(this.origNameBasedOnFilename)}">`); // xss-escaped
            } else if (attachmentType === 'txt') {
              // text
              this.attachmentPreviewContainer.html(`<div class="attachment-preview-txt">${Xss.escape(result.toUtfStr()).replace(/\n/g, '<br>')}</div>`); // xss-escaped
            } else if (attachmentType === 'pdf') {
              // PDF
              await this.renderPdf(result);
            }
          } else {
            // no preview available, download button
            this.attachmentPreviewContainer.html('<div class="attachment-preview-unavailable"></div>'); // xss-escaped
            $('.attachment-preview-unavailable').prepend('No preview available'); // xss-escaped
            $('#attachment-preview-download').appendTo('.attachment-preview-unavailable');
          }
          $('body').on('click', e => {
            if (e.target === document.body || $('body').children().toArray().includes(e.target)) {
              BrowserMsg.send.closeDialog(this);
            }
          });
          $('#attachment-preview-download')
            .css('display', 'flex')
            .on('click', async e => {
              e.stopPropagation();
              if (await AttachmentWarnings.confirmSaveToDownloadsIfNeeded(attachmentForSave)) {
                Browser.saveToDownloads(attachmentForSave);
              }
            });
          $('#attachment-preview-filename').text(this.origNameBasedOnFilename);
        }
      } catch (e) {
        this.renderErr(e);
      }
    };

    private getAttachmentType = (filename: string): AttachmentType | undefined => {
      const nameSplit = filename.split('.');
      const extension = nameSplit[nameSplit.length - 1].toLowerCase();
      if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
        return 'img';
      } else if (['txt', 'pdf'].includes(extension)) {
        return extension as AttachmentType;
      }
      return undefined;
    };

    private decrypt = async () => {
      const result = await MsgUtil.decryptMessage({
        kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(this.acctEmail),
        encryptedData: this.attachment.getData(),
        verificationPubs: [], // todo: #4158 signature verification of attachments
      });
      if ((result as DecryptSuccess).content) {
        return result.content;
      } else if ((result as DecryptError).error.type === DecryptErrTypes.needPassphrase) {
        BrowserMsg.send.passphraseDialog(this.parentTabId, {
          type: 'attachment',
          longids: (result as DecryptError).longids.needPassphrase,
          initiatorFrameId: this.initiatorFrameId,
        });
        return;
      }
      throw new DecryptionError(result as DecryptError);
    };

    private renderPdf = async (data: Uint8Array, password?: string) => {
      try {
        // .slice() is used to copy attachment data https://github.com/FlowCrypt/flowcrypt-browser/issues/5408
        const loadingOptions: { data: Uint8Array; password?: string } = { data: data.slice() };
        if (password) {
          loadingOptions.password = password;
        }
        const pdf = await pdfjsLib.getDocument(loadingOptions).promise;
        const previewPdf = new AttachmentPreviewPdf(this.attachmentPreviewContainer, pdf);
        await previewPdf.render();
      } catch (e) {
        if (e instanceof Error && e.name === 'PasswordException') {
          const error = e as Error & { code: number };
          const needsPassword = error.code === 1; // PasswordException.NEED_PASSWORD
          const incorrectPassword = error.code === 2; // PasswordException.INCORRECT_PASSWORD

          if (needsPassword || incorrectPassword) {
            // Show password prompt with appropriate message
            const message = incorrectPassword
              ? 'Incorrect password. Please enter the correct password:'
              : 'This PDF is password protected. Please enter the password:';
            const userPassword = await this.promptForPdfPassword(message);

            if (userPassword) {
              // User provided a password, try again
              await this.renderPdf(data, userPassword);
            } else {
              // User cancelled the password prompt
              this.attachmentPreviewContainer.html('<div class="attachment-preview-unavailable">PDF is password protected. Password required to view.</div>');
              $('#attachment-preview-download').appendTo('.attachment-preview-unavailable').css('display', 'flex');
              $('#attachment-preview-filename').text(this.origNameBasedOnFilename);
            }
          }
        } else {
          throw e;
        }
      }
    };

    private promptForPdfPassword = async (message?: string): Promise<string | undefined> => {
      return await Ui.modal.passwordInput('Password Required', message || 'This PDF is password protected. Please enter the password:');
    };
  }
);
