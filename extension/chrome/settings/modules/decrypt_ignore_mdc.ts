/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Xss, Ui, XssSafeFactory, Env } from '../../../js/common/browser.js';
import { Pgp, DecryptErrTypes } from '../../../js/common/pgp.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Catch } from '../../../js/common/catch.js';

declare const openpgp: typeof OpenPGP;
openpgp.config.ignore_mdc_error = true; // will only affect OpenPGP in local frame

Catch.try(async () => {

  const urlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  const tabId = await BrowserMsg.requiredTabId();
  let origContent: string;
  const factory = new XssSafeFactory(acctEmail, tabId);

  BrowserMsg.listen({
    close_dialog: () => {
      $('.passphrase_dialog').text('');
    },
  }, tabId);

  $('.action_decrypt').click(Ui.event.prevent('double', async self => {
    const encrypted = $('.input_message').val() as string;
    if (!encrypted) {
      alert('Please paste an encrypted message');
      return;
    }
    origContent = $(self).html();
    Xss.sanitizeRender(self, 'Decrypting.. ' + Ui.spinner('white'));
    const result = await Pgp.msg.decrypt(acctEmail, encrypted);
    if (result.success) {
      alert(`MESSAGE CONTENT BELOW\n---------------------------------------------------------\n${result.content.text!}`);
    } else if (result.error.type === DecryptErrTypes.needPassphrase) {
      $('.passphrase_dialog').html(factory.embeddedPassphrase(result.longids.needPassphrase)); // xss-safe-factory
    } else {
      delete result.message;
      console.info(result);
      alert('These was a problem decrypting this file, details are in the console.');
    }
    Xss.sanitizeRender(self, origContent);
  }));

})();
