/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { DecryptErrTypes, PgpMsg } from '../../../js/common/core/pgp-msg.js';

import { Assert } from '../../../js/common/assert.js';
import { Att } from '../../../js/common/core/att.js';
import { AttUI } from '../../../js/common/ui/att_ui.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../../js/common/xss_safe_factory.js';

View.run(class ManualDecryptView extends View {

  private readonly acctEmail: string;
  private readonly attUi = new AttUI(() => Promise.resolve({ count: 1, size: 100 * 1024 * 1024, size_mb: 100 }));

  private factory: XssSafeFactory | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.attUi.initAttDialog('fineuploader', 'fineuploader_button');
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
    const ids = this.attUi.getAttIds();
    if (ids.length === 1) {
      const origContent = $(button).html();
      Xss.sanitizeRender(button, 'Decrypting.. ' + Ui.spinner('white'));
      const collected = await this.attUi.collectAtt(ids[0]);
      await this.decryptAndDownload(collected);
      Xss.sanitizeRender('.action_decrypt_and_download', origContent);
    } else {
      await Ui.modal.warning('Please add a file to decrypt');
    }
  }

  private decryptAndDownload = async (encrypted: Att) => { // todo - this is more or less copy-pasted from att.js, should use common function
    const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPp(this.acctEmail), encryptedData: encrypted.getData() });
    if (result.success) {
      const attachment = new Att({ name: encrypted.name.replace(/\.(pgp|gpg|asc)$/i, ''), type: encrypted.type, data: result.content });
      Browser.saveToDownloads(attachment);
    } else if (result.error.type === DecryptErrTypes.needPassphrase) {
      $('.passphrase_dialog').html(this.factory!.embeddedPassphrase(result.longids.needPassphrase)); // xss-safe-factory
    } else {
      delete result.message;
      console.info(result);
      await Ui.modal.error('These was a problem decrypting this file, details are in the console.');
    }
  }

});
