/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Xss, Ui } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Settings } from '../../../js/common/settings.js';
import { Pgp } from '../../../js/common/pgp.js';
import { Lang } from '../../../js/common/lang.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  let urlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  await Ui.passphraseToggle(['password']);

  let [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
  Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  $('.action_verify').click(Ui.event.handle(async () => {
    let key = openpgp.key.readArmored(primaryKi.private).keys[0];
    if (await Pgp.key.decrypt(key, [$('#password').val() as string]) === true) { // text input
      Xss.sanitizeRender('#content', `
        <div class="line">${Lang.setup.ppMatchAllSet}</div>
        <div class="line"><div class="button green close" data-test="action-test-passphrase-successful-close">close</div></div>
      `);
      $('.close').click(Ui.event.handle(() => BrowserMsg.send(parentTabId, 'close_page')));
    } else {
      alert('Pass phrase did not match. Please try again. If you are not able to recover your pass phrase, please change it, so that do don\'t get locked out of your encrypted messages.');
    }
  }));

  $('.action_change_passphrase').click(Ui.event.handle(() => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/change_passphrase.htm')));

})();
