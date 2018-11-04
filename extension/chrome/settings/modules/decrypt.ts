/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Att } from '../../../js/common/att.js';
import { Xss, Ui, XssSafeFactory, AttUI } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Pgp, DecryptErrTypes } from '../../../js/common/pgp.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  let tabId = await BrowserMsg.requiredTabId();

  let origContent: string;

  let attUi = new AttUI(() => ({count: 1, size: 100 * 1024 * 1024, size_mb: 100}));
  attUi.initAttDialog('fineuploader', 'fineuploader_button');
  let factory = new XssSafeFactory(acctEmail, tabId);

  BrowserMsg.listen({
    close_dialog: () => {
      $('.passphrase_dialog').text('');
    },
  }, tabId);

  $('.action_decrypt_and_download').click(Ui.event.prevent('double', async (self) => {
    let ids = attUi.getAttIds();
    if (ids.length === 1) {
      origContent = $(self).html();
      Xss.sanitizeRender(self, 'Decrypting.. ' + Ui.spinner('white'));
      let collected = await attUi.collectAtt(ids[0]);
      await decryptAndDownload(collected);
    } else {
      alert('Please add a file to decrypt');
    }
  }));

  let decryptAndDownload = async (encrypted: Att) => { // todo - this is more or less copy-pasted from att.js, should use common function
    let result = await Pgp.msg.decrypt(acctEmail, encrypted.asBytes(), null, true);
    if (result.success) {
      let attachment = new Att({name: encrypted.name.replace(/\.(pgp|gpg|asc)$/i, ''), type: encrypted.type, data: result.content.uint8!}); // uint8!: requested uint8 above
      Att.methods.saveToDownloads(attachment);
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
