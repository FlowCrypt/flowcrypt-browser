/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Value } from './../../js/common/common.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';
import { Settings } from '../../js/common/settings.js';
import { Pgp } from '../../js/common/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Catch } from '../../js/common/catch.js';
import { Api } from '../../js/common/api/api.js';

Catch.try(async () => {

  const urlParams = Env.urlParams(['acctEmail', 'parentTabId', 'placement']);
  const acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  const hash = Pgp.hash.sha1;
  const container = $('.emails');

  const storage = await Store.getAcct(acctEmail, ['addresses']);
  const addresses = storage.addresses || [urlParams.acctEmail];

  const emailAddrToHtmlRadio = (a: string) => {
    a = Xss.escape(a);
    return `<input type="radio" name="a" value="${a}" id="${hash(a)}"> <label data-test="action-choose-address" for="${hash(a)}">${a}</label><br>`;
  };

  Xss.sanitizeRender(container, addresses.map(emailAddrToHtmlRadio).join(''));
  container.find('input').first().prop('checked', true);
  container.find('input').click(Ui.event.handle(async target => {
    const chosenSendingAddr = String($(target).val());
    if (chosenSendingAddr !== addresses[0]) {
      const orderedAddrs = Value.arr.unique([chosenSendingAddr].concat(storage.addresses || []));
      await Store.setAcct(acctEmail, { addresses: orderedAddrs });
      window.location.reload();
    }
  }));

  $('.action_fetch_aliases').click(Ui.event.prevent('parallel', async (target, done) => {
    try {
      Xss.sanitizeRender(target, Ui.spinner('green'));
      const addresses = await Settings.fetchAcctAliasesFromGmail(acctEmail);
      await Store.setAcct(acctEmail, { addresses: Value.arr.unique(addresses.concat(acctEmail)) });
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
      } else {
        if (Api.err.isSignificant(e)) {
          Catch.handleErr(e);
        }
        alert(`There was an error refreshing aliases, please try again\n\n${String(e)}`);
        await Ui.time.sleep(1000);
      }
    }
    window.location.reload();
    done();
  }));

  $('.action_close').click(Ui.event.handle(() => BrowserMsg.send.closeDialog(parentTabId)));

})();
