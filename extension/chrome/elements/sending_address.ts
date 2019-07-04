/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Value } from '../../js/common/core/common.js';
import { Ui, Env } from '../../js/common/browser.js';
import { Settings } from '../../js/common/settings.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Api } from '../../js/common/api/api.js';
import { Buf } from '../../js/common/core/buf.js';
import { Assert } from '../../js/common/assert.js';
import { Xss } from '../../js/common/platform/xss.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'placement']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const container = $('.emails');

  const storage = await Store.getAcct(acctEmail, ['addresses']);
  const addresses = storage.addresses || [acctEmail];

  const renderInitial = () => {
    const emailAddrToHtmlRadio = (a: string) => {
      a = Xss.escape(a);
      const b64 = Buf.fromUtfStr(a).toBase64Str();
      return `<input type="radio" name="a" value="${a}" id="${b64}"> <label data-test="action-choose-address" for="${b64}">${a}</label><br>`;
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
  };

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
          Catch.reportErr(e);
        }
        await Ui.modal.error(`There was an error refreshing aliases, please try again\n\n${String(e)}`);
        await Ui.time.sleep(1000);
      }
    }
    window.location.reload();
    done();
  }));

  $('.action_close').click(Ui.event.handle(() => BrowserMsg.send.closeDialog(parentTabId)));

  await renderInitial();

})();
