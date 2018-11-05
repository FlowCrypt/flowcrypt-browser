/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Value } from './../../js/common/common.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';
import { Settings } from '../../js/common/settings.js';
import { Pgp } from '../../js/common/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Catch } from '../../js/common/catch.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['acctEmail', 'parentTabId', 'placement']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  let hash = Pgp.hash.sha1;
  let container = $('.emails');

  let storage = await Store.getAcct(acctEmail, ['addresses']);
  let addresses = storage.addresses || [urlParams.acctEmail];

  let emailAddrToHtmlRadio = (a: string) => {
    a = Xss.escape(a);
    return `<input type="radio" name="a" value="${a}" id="${hash(a)}"> <label data-test="action-choose-address" for="${hash(a)}">${a}</label><br>`;
  };

  Xss.sanitizeRender(container, addresses.map(emailAddrToHtmlRadio).join(''));
  container.find('input').first().prop('checked', true);
  container.find('input').click(Ui.event.handle(async target => {
    let chosenSendingAddr = $(target).val() as string;
    if (chosenSendingAddr !== addresses[0]) {
      let orderedAddrs = Value.arr.unique([chosenSendingAddr].concat(storage.addresses || []));
      await Store.set(acctEmail, { addresses: orderedAddrs });
      window.location.reload();
    }
  }));

  $('.action_fetch_aliases').click(Ui.event.prevent('parallel', async (target, done) => {
    Xss.sanitizeRender(target, Ui.spinner('green'));
    let addresses = await Settings.fetchAcctAliasesFromGmail(acctEmail);
    await Store.set(acctEmail, { addresses: Value.arr.unique(addresses.concat(acctEmail)) });
    window.location.reload();
    done();
  }));

  $('.action_close').click(Ui.event.handle(() => BrowserMsg.send(parentTabId, 'close_dialog')));

})();
