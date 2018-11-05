/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Att } from '../../../js/common/att.js';
import { Xss, Ui, XssSafeFactory, AttUI, Env, Browser } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Pgp, DecryptErrTypes } from '../../../js/common/pgp.js';
import { Catch } from '../../../js/common/catch.js';

Catch.try(async () => {

  const urlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  const tabId = await BrowserMsg.requiredTabId();

  let origContent: string;

  const attUi = new AttUI(() => ({ count: 1, size: 100 * 1024 * 1024, size_mb: 100 }));
  attUi.initAttDialog('fineuploader', 'fineuploader_button');
  const factory = new XssSafeFactory(acctEmail, tabId);

  BrowserMsg.listen({
    close_dialog: () => {
      $('.passphrase_dialog').text('');
    },
  }, tabId);

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
    const result = await Pgp.msg.decrypt(acctEmail, encrypted.asBytes(), null, true);
    if (result.success) {
      const attachment = new Att({ name: encrypted.name.replace(/\.(pgp|gpg|asc)$/i, ''), type: encrypted.type, data: result.content.uint8! }); // uint8!: requested uint8 above
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
