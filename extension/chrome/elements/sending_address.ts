/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
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

  const storage = await Store.getAcct(acctEmail, ['sendAs']);
  const addresses = storage.sendAs ? Object.keys(storage.sendAs) : [acctEmail];

  const renderInitial = () => {
    const emailAddrToHtmlRadio = (a: string) => {
      a = Xss.escape(a);
      const isChecked = storage.sendAs && storage.sendAs[a] && storage.sendAs[a].isDefault;
      const b64 = Buf.fromUtfStr(a).toBase64Str();
      return `<input type="radio" name="a" ${isChecked ? 'checked' : ''} value="${a}" id="${b64}"> <label data-test="action-choose-address" for="${b64}">${a}</label><br>`;
    };

    Xss.sanitizeRender(container, addresses.map(emailAddrToHtmlRadio).join(''));
    container.find('input').click(Ui.event.handle(async target => {
      const chosenSendingAddr = String($(target).val());
      if (storage.sendAs && !storage.sendAs[chosenSendingAddr].isDefault) {
        for (const email of Object.keys(storage.sendAs)) {
          if (storage.sendAs[email]) {
            storage.sendAs[email].isDefault = email === chosenSendingAddr;
          }
        }
        await Store.setAcct(acctEmail, { sendAs: storage.sendAs });
      }
    }));
  };

  $('.action_fetch_aliases').click(Ui.event.prevent('parallel', async (target, done) => {
    try {
      Xss.sanitizeRender(target, Ui.spinner('green'));
      await Settings.refreshAcctAliases(acctEmail);
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

  renderInitial();

})();
