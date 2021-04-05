/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { DecryptErrTypes, MsgUtil } from '../../../js/common/core/crypto/pgp/msg-util.js';

import { Assert } from '../../../js/common/assert.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { AttachmentUI } from '../../../js/common/ui/attachment-ui.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../../js/common/xss-safe-factory.js';
import { KeyStore } from '../../../js/common/platform/store/key-store.js';

View.run(class ManualDecryptView extends View {

  private readonly acctEmail: string;
  private readonly attachmentUi = new AttachmentUI(() => Promise.resolve({ count: 1, size: 100 * 1024 * 1024, size_mb: 100 }));

  private factory: XssSafeFactory | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.attachmentUi.initAttachmentDialog('fineuploader', 'fineuploader_button');
  }

  public render = async () => {
    const tabId = await BrowserMsg.requiredTabId();
    this.factory = new XssSafeFactory(this.acctEmail, tabId);
    BrowserMsg.addListener('close_dialog', async () => { $('.passphrase_dialog').text(''); });
    BrowserMsg.listen(tabId);
  }

  public setHandlers = () => {
    $('.action_decrypt_and_download').click(this.setHandlerPrevent('double', el => this.actionDecryptAndDownloadHandler(el)));
  }

  private actionDecryptAndDownloadHandler = async (button: HTMLElement) => {
    const ids = this.attachmentUi.getAttachmentIds();
    if (ids.length === 1) {
      const origContent = $(button).html();
      Xss.sanitizeRender(button, 'Decrypting.. ' + Ui.spinner('white'));
      const collected = await this.attachmentUi.collectAttachment(ids[0]);
      await this.decryptAndDownload(collected);
      Xss.sanitizeRender('.action_decrypt_and_download', origContent);
    } else {
      await Ui.modal.warning('Please add a file to decrypt');
    }
  }

  private decryptAndDownload = async (encrypted: Attachment) => { // todo - this is more or less copy-pasted from attachment.js, should use common function
    const result = await MsgUtil.decryptMessage({ kisWithPp: await KeyStore.getAllWithOptionalPassPhrase(this.acctEmail), encryptedData: encrypted.getData() });
    if (result.success) {
      const attachment = new Attachment({ name: encrypted.name.replace(/\.(pgp|gpg|asc)$/i, ''), type: encrypted.type, data: result.content });
      Browser.saveToDownloads(attachment);
    } else if (result.error.type === DecryptErrTypes.needPassphrase) {
      $('.passphrase_dialog').html(this.factory!.embeddedPassphrase(result.longids.needPassphrase)); // xss-safe-factory
    } else {
      console.info(result);
      await Ui.modal.error('These was a problem decrypting this file, details are in the console.');
    }
  }

});
