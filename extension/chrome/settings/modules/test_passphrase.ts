/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Xss, Ui, Env } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Settings } from '../../../js/common/settings.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Lang } from '../../../js/common/lang.js';
import { Assert } from '../../../js/common/assert.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase_ui.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');

  await initPassphraseToggle(['password']);

  const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
  Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  const { keys: [key] } = await openpgp.key.readArmored(primaryKi.private);
  if (key.isDecrypted()) {
    const setUpPpUrl = Env.urlCreate('change_passphrase.htm', { acctEmail, parentTabId });
    Xss.sanitizeRender('#content', `<div class="line">No pass phrase set up yet: <a href="${setUpPpUrl}">set up pass phrase</a></div>`);
    return;
  }

  $('.action_verify').click(Ui.event.handle(async () => {

    if (await Pgp.key.decrypt(key, [String($('#password').val())]) === true) {
      Xss.sanitizeRender('#content', `
        <div class="line">${Lang.setup.ppMatchAllSet}</div>
        <div class="line"><div class="button green close" data-test="action-test-passphrase-successful-close">close</div></div>
      `);
      $('.close').click(Ui.event.handle(() => BrowserMsg.send.closePage(parentTabId)));
    } else {
      await Ui.modal.warning('Pass phrase did not match. Please try again. If you forgot your pass phrase, please change it, so that you don\'t get locked out of your encrypted messages.');
    }
  }));

  $('.action_change_passphrase').click(Ui.event.handle(() => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/change_passphrase.htm')));

})();
