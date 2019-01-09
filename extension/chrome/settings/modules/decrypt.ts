/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Att } from '../../../js/common/core/att.js';
import { Xss, Ui, XssSafeFactory, AttUI, Env, Browser } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { DecryptErrTypes, PgpMsg } from '../../../js/common/core/pgp.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');

  const tabId = await BrowserMsg.requiredTabId();

  let origContent: string;

  const attUi = new AttUI(() => Promise.resolve({ count: 1, size: 100 * 1024 * 1024, size_mb: 100 }));
  attUi.initAttDialog('fineuploader', 'fineuploader_button');
  const factory = new XssSafeFactory(acctEmail, tabId);

  BrowserMsg.addListener('close_dialog', async () => {
    $('.passphrase_dialog').text('');
  });
  BrowserMsg.listen(tabId);

  $('.action_decrypt_and_download').click(Ui.event.prevent('double', async (self) => {
    const ids = attUi.getAttIds();
    if (ids.length === 1) {
      origContent = $(self).html();
      Xss.sanitizeRender(self, 'Decrypting.. ' + Ui.spinner('white'));
      const collected = await attUi.collectAtt(ids[0]);
      await decryptAndDownload(collected);
    } else {
      alert('Please add a file to decrypt');
    }
  }));

  const decryptAndDownload = async (encrypted: Att) => { // todo - this is more or less copy-pasted from att.js, should use common function
    const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPassphrases(acctEmail), encryptedData: encrypted.getData() });
    if (result.success) {
      const attachment = new Att({ name: encrypted.name.replace(/\.(pgp|gpg|asc)$/i, ''), type: encrypted.type, data: result.content });
      Browser.saveToDownloads(attachment);
    } else if (result.error.type === DecryptErrTypes.needPassphrase) {
      $('.passphrase_dialog').html(factory.embeddedPassphrase(result.longids.needPassphrase)); // xss-safe-factory
    } else {
      delete result.message;
      console.info(result);
      alert('These was a problem decrypting this file, details are in the console.');
    }
    Xss.sanitizeRender('.action_decrypt_and_download', origContent);
  };

})();
