/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { DecryptErrTypes, MsgUtil } from '../../js/common/core/crypto/pgp/msg-util.js';
import { PromiseCancellation, Url } from '../../js/common/core/common.js';
import { Api } from '../../js/common/api/shared/api.js';
import { ApiErr } from '../../js/common/api/shared/api-error.js';
import { Assert } from '../../js/common/assert.js';
import { Attachment } from '../../js/common/core/attachment.js';
import { Browser } from '../../js/common/browser/browser.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { KeyStore } from '../../js/common/platform/store/key-store.js';
import { PassphraseStore } from '../../js/common/platform/store/passphrase-store.js';
import { XssSafeFactory } from '../../js/common/xss-safe-factory.js';

export class AttachmentDownloadView extends View {
  protected readonly acctEmail: string;
  protected readonly parentTabId: string;
  protected readonly frameId: string;
  protected readonly origNameBasedOnFilename: string;
  protected readonly isEncrypted: boolean;
  protected readonly type: string | undefined;
  protected readonly msgId: string | undefined;
  protected readonly id: string | undefined;
  protected readonly name: string | undefined;
  protected readonly url: string | undefined;
  protected readonly gmail: Gmail;
  protected attachment!: Attachment;
  protected ppChangedPromiseCancellation: PromiseCancellation = { cancel: false };

  private size: number | undefined;
  private downloadButton = $('#download');
  private header = $('#header');
  private originalButtonHTML: string | undefined;
  private canClickOnAtt: boolean = false;
  private downloadInProgress = false;
  private tabId!: string;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'msgId', 'attId', 'name', 'type', 'size', 'url', 'parentTabId', 'content', 'decrypted', 'frameId', 'isEncrypted']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.origNameBasedOnFilename = uncheckedUrlParams.name ? String(uncheckedUrlParams.name).replace(/\.(pgp|gpg)$/ig, '') : 'noname';
    this.isEncrypted = uncheckedUrlParams.isEncrypted === true;
    this.size = uncheckedUrlParams.size ? parseInt(String(uncheckedUrlParams.size)) : undefined;
    this.type = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'type');
    this.msgId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'msgId');
    this.id = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'attId');
    this.name = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'name');
    // url contains either actual url of remote content or objectUrl for direct content, either way needs to be downloaded
    this.url = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'url');
    this.gmail = new Gmail(this.acctEmail);
  }

  public render = async () => {
    this.tabId = await BrowserMsg.requiredTabId();
    try {
      this.attachment = new Attachment({ name: this.origNameBasedOnFilename, type: this.type, msgId: this.msgId, id: this.id, url: this.url });
    } catch (e) {
      Catch.reportErr(e);
      $('body.attachment').text(`Error processing params: ${String(e)}. Contact human@flowcrypt.com`);
      return;
    }
    $('#type').text(this.type || 'unknown type');
    $('#name').text(this.name || 'noname');
    this.renderHeader();
    $('#name').attr('title', this.name || '');
    $('img#file-format').attr('src', this.getFileIconSrc());
    if (!this.size && this.url) { // download url of a file that has an unknown size
      this.getUrlFileSize(this.url!).then(fileSize => {
        if (typeof fileSize !== 'undefined') {
          this.size = fileSize;
        }
      }).catch(ApiErr.reportIfSignificant);
    }
    try {
      this.canClickOnAtt = ! await this.processAsPublicKeyAndHideAttIfAppropriate();
    } catch (e) {
      this.renderErr(e);
    }
    Ui.setTestState('ready');
  }

  public setHandlers = () => {
    Ui.event.protect();
    if (this.canClickOnAtt) {
      this.downloadButton.click(this.setHandlerPrevent('double', () => this.downloadButtonClickedHandler()));
      this.downloadButton.click((e) => e.stopPropagation());
      $('body').click(this.setHandlerPrevent('double', async () => {
        if ($('body').attr('id') !== 'attachment-preview' && !$('body').hasClass('download-error')) {
          await this.previewAttachmentClickedHandler();
        }
      }));
    }
    BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
      if (!entered) {
        this.downloadInProgress = false;
        this.downloadButton.show();
        this.ppChangedPromiseCancellation.cancel = true; // update original object which is monitored by a promise
        this.ppChangedPromiseCancellation = { cancel: false }; // set to a new, not yet used object
        BrowserMsg.send.closeSwal(this.parentTabId); // attachment preview
      }
    });
    BrowserMsg.listen(this.tabId);
  }

  protected downloadDataIfNeeded = async () => {
    if (this.attachment.hasData()) {
      return;
    }
    if (this.attachment.url) { // when content was downloaded and decrypted
      this.attachment.setData(await Api.download(this.attachment.url, this.renderProgress));
    } else if (this.attachment.id && this.attachment.msgId) { // gmail attId
      const { data } = await this.gmail.attGet(this.attachment.msgId, this.attachment.id, this.renderProgress);
      this.attachment.setData(data);
    } else {
      throw new Error('File is missing both id and url - this should be fixed');
    }
  }

  protected renderErr = (e: any) => {
    if (ApiErr.isAuthErr(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(this.parentTabId, { acctEmail: this.acctEmail });
      Xss.sanitizeRender('body', `Error downloading file - google auth needed. ${Ui.retryLink()}`);
    } else if (ApiErr.isNetErr(e)) {
      Xss.sanitizeRender('body', `Error downloading file - no internet. ${Ui.retryLink()}`);
    } else {
      Catch.reportErr(e);
      Xss.sanitizeRender('body', `Error downloading file - ${String(e)}. ${Ui.retryLink()}`);
    }
    $('body').addClass('download-error').attr('title', '');
  }

  private renderHeader = () => {
    const span = $(`<span>${this.isEncrypted ? 'ENCRYPTED\n' : 'PLAIN\n'} FILE</span>`);
    this.header.empty().append(span); // xss-escaped
  }

  private getFileIconSrc = () => {
    const icon = (name: string) => `/img/fileformat/${name}.png`;
    const nameSplit = this.origNameBasedOnFilename.split('.');
    const extension = nameSplit[nameSplit.length - 1].toLowerCase();
    if (['jpg', 'jpeg'].includes(extension)) {
      return icon('jpg');
    } else if (['xls', 'xlsx'].includes(extension)) {
      return icon('excel');
    } else if (['doc', 'docx'].includes(extension)) {
      return icon('word');
    } else if (extension === 'png') {
      return icon('png');
    } else {
      return icon('generic');
    }
  }

  private getUrlFileSize = async (url: string): Promise<number | undefined> => {
    console.info('trying to figure out figetUrlFileSizee size');
    if (url.indexOf('docs.googleusercontent.getUrlFileSizeom/docs/securesc') !== -1) {
      try {
        const googleDriveFileId = url.split('/').pop()!.split('?').shift(); // try and catch any errors below if structure is not as expected
        url = googleDriveFileId ? `https://drive.google.com/uc?export=download&id=${googleDriveFileId}` : url; // attempt to get length headers from Google Drive file if available
      } catch (e) {
        // leave url as is
      }
    }
    return await new Promise(resolve => {
      const xhr = new XMLHttpRequest();
      xhr.open('HEAD', url, true);
      xhr.onreadystatechange = function () {
        if (this.readyState === this.DONE) {
          const contentLength = xhr.getResponseHeader('Content-Length');
          if (contentLength !== null) {
            resolve(parseInt(contentLength));
          } else {
            console.info('was not able to find out file size');
            resolve(undefined);
          }
        }
      };
      xhr.send();
    });
  }

  private processAsPublicKeyAndHideAttIfAppropriate = async () => {
    if (this.attachment.msgId && this.attachment.id && this.attachment.treatAs() === 'publicKey') { // this is encrypted public key - download && decrypt & parse & render
      const { data } = await this.gmail.attGet(this.attachment.msgId, this.attachment.id);
      const decrRes = await MsgUtil.decryptMessage({ kisWithPp: await KeyStore.getAllWithPp(this.acctEmail), encryptedData: data });
      if (decrRes.success && decrRes.content) {
        const openpgpType = await MsgUtil.type({ data: decrRes.content });
        if (openpgpType && openpgpType.type === 'publicKey' && openpgpType.armored) { // 'openpgpType.armored': could potentially process unarmored pubkey files, maybe later
          BrowserMsg.send.renderPublicKeys(this.parentTabId, { afterFrameId: this.frameId, traverseUp: 2, publicKeys: [decrRes.content.toUtfStr()] }); // render pubkey
          BrowserMsg.send.setCss(this.parentTabId, { selector: `#${this.frameId}`, traverseUp: 1, css: { display: 'none' } }); // hide attachment
          $('body').text('');
          return true;
        }
      }
    }
    return false;
  }

  private downloadButtonClickedHandler = async () => {
    if (this.downloadInProgress) {
      return;
    }
    this.downloadInProgress = true;
    this.downloadButton.hide();
    try {
      this.originalButtonHTML = this.downloadButton.html();
      Xss.sanitizeRender(this.header, `${Ui.spinner('green', 'large_spinner')}<span class="download_progress"></span>`);
      await this.recoverMissingAttIdIfNeeded();
      await this.downloadDataIfNeeded();
      if (!this.isEncrypted) {
        Browser.saveToDownloads(this.attachment);
      } else {
        await this.decryptAndSaveAttToDownloads();
      }
      this.renderHeader();
    } catch (e) {
      this.renderErr(e);
    } finally {
      this.downloadInProgress = false;
      this.downloadButton.show();
    }
  }

  private previewAttachmentClickedHandler = async () => {
    if (!this.attachment.length) {
      this.attachment.length = this.size!;
    }
    const factory = new XssSafeFactory(this.acctEmail, this.parentTabId);
    const iframeUrl = factory.srcPgpAttIframe(this.attachment, this.isEncrypted, undefined, 'chrome/elements/attachment_preview.htm');
    BrowserMsg.send.showAttachmentPreview(this.parentTabId, { iframeUrl });
  }

  private decryptAndSaveAttToDownloads = async () => {
    const result = await MsgUtil.decryptMessage({ kisWithPp: await KeyStore.getAllWithPp(this.acctEmail), encryptedData: this.attachment.getData() });
    Xss.sanitizeRender(this.downloadButton, this.originalButtonHTML || '');
    if (result.success) {
      if (!result.filename || ['msg.txt', 'null'].includes(result.filename)) {
        result.filename = this.attachment.name;
      }
      Browser.saveToDownloads(new Attachment({ name: result.filename, type: this.attachment.type, data: result.content }));
    } else if (result.error.type === DecryptErrTypes.needPassphrase) {
      BrowserMsg.send.passphraseDialog(this.parentTabId, { type: 'attachment', longids: result.longids.needPassphrase });
      if (! await PassphraseStore.waitUntilPassphraseChanged(this.acctEmail, result.longids.needPassphrase, 1000, this.ppChangedPromiseCancellation)) {
        return;
      }
      await this.decryptAndSaveAttToDownloads();
    } else {
      delete result.message;
      console.info(result);
      $('body.attachment').text(`Error decrypting file (${result.error.type}: ${result.error.message}). Downloading original..`);
      Browser.saveToDownloads(new Attachment({ name, type: this.type, data: this.attachment.getData() })); // won't work in ff, possibly neither on some chrome versions (on webmail)
    }
  }

  private renderProgress = (percent: number, received: number, fileSize: number) => {
    this.size = fileSize || this.size;
    const progressEl = $('.download_progress');
    if (!percent && this.size) {
      percent = Math.floor(((received * 0.75) / this.size) * 100);
    }
    if (percent) {
      progressEl.text(`${Math.min(100, percent)}%`);
    }
  }

  private recoverMissingAttIdIfNeeded = async () => {
    if (!this.attachment.url && !this.attachment.id && this.attachment.msgId) {
      const result = await this.gmail.msgGet(this.attachment.msgId, 'full');
      if (result && result.payload && result.payload.parts) {
        for (const attMeta of result.payload.parts) {
          if (attMeta.filename === name && attMeta.body && attMeta.body.size === this.size && attMeta.body.attachmentId) {
            this.attachment.id = attMeta.body.attachmentId;
            return;
          }
        }
      } else {
        throw new Error('Could not recover missing attachmentId');
      }
    }
  }

}

View.run(AttachmentDownloadView);
