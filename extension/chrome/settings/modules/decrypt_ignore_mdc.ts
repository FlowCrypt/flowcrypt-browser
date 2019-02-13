/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Xss, Ui, XssSafeFactory, Env } from '../../../js/common/browser.js';
import { DecryptErrTypes, PgpMsg } from '../../../js/common/core/pgp.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Buf } from '../../../js/common/core/buf.js';

declare const openpgp: typeof OpenPGP;
openpgp.config.ignore_mdc_error = true; // will only affect OpenPGP in local frame

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');

  const tabId = await BrowserMsg.requiredTabId();
  let origContent: string;
  const factory = new XssSafeFactory(acctEmail, tabId);

  BrowserMsg.addListener('close_dialog', async () => {
    $('.passphrase_dialog').text('');
  });
  BrowserMsg.listen(tabId);

  $('.action_decrypt').click(Ui.event.prevent('double', async self => {
    const encrypted = String($('.input_message').val());
    if (!encrypted) {
      await Ui.modal.warning('Please paste an encrypted message');
      return;
    }
    origContent = $(self).html();
    Xss.sanitizeRender(self, 'Decrypting.. ' + Ui.spinner('white'));
    const result = await PgpMsg.decrypt({ kisWithPp: await Store.keysGetAllWithPassphrases(acctEmail), encryptedData: Buf.fromUtfStr(encrypted) });
    if (result.success) {
      alert(`MESSAGE CONTENT BELOW\n---------------------------------------------------------\n${result.content.toUtfStr()}`);
    } else if (result.error.type === DecryptErrTypes.needPassphrase) {
      $('.passphrase_dialog').html(factory.embeddedPassphrase(result.longids.needPassphrase)); // xss-safe-factory
    } else {
      delete result.message;
      console.info(result);
      await Ui.modal.error('These was a problem decrypting this file, details are in the console.');
    }
    Xss.sanitizeRender(self, origContent);
  }));

})();
