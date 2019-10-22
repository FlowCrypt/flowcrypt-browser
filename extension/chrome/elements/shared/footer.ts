
/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store, AccountStore } from '../../../js/common/platform/store.js';
import { Ui, Env } from '../../../js/common/browser.js';
import { BrowserMsg, BrowserWidnow } from '../../../js/common/extension.js';
import { Assert } from '../../../js/common/assert.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'emailAlias', 'grandparentTabId']); // placement: compose||settings
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const emailAlias = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'emailAlias');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');

  const email = emailAlias || acctEmail;

  const renderInitial = async () => {
    const { sendAs, email_footer } = await Store.getAcct(acctEmail, ['sendAs', 'email_footer']);
    let footer = sendAs && sendAs[email] && sendAs[email].footer;
    if (email_footer && sendAs && sendAs[email] && sendAs[email].isPrimary) {
      footer = email_footer;
    }
    $('.input_email_footer').val(footer || '');
    $('.input_remember').prop('checked', 'checked');
  };

  const saveFooterIfAppropriate = async (requested: boolean, emailFooter: string) => {
    const { sendAs } = await Store.getAcct(acctEmail, ['sendAs']);
    if (requested && sendAs && sendAs[email]) {
      const update: AccountStore = {};
      sendAs[email].footer = emailFooter;
      update.sendAs = sendAs;
      if (sendAs[email].isPrimary) {
        update.email_footer = null; // tslint:disable-line: no-null-keyword
      }
      await Store.setAcct(acctEmail, update);
    }
  };

  $('.action_add_footer').click(Ui.event.prevent('double', async self => {
    let footer = `${String($('.input_email_footer').val())}`;
    footer = (window as unknown as BrowserWidnow)['emailjs-mime-codec'].foldLines(footer, 72, true); // tslint:disable-line:no-unsafe-any
    footer = footer.split('\n').map(l => l.replace(/\s+$/g, '')).join('\n').trim();
    await saveFooterIfAppropriate(Boolean($('.input_remember').prop('checked')), footer);
    BrowserMsg.send.setFooter(parentTabId, { email, footer });
  }));

  $('.action_cancel').click(Ui.event.handle(() => BrowserMsg.send.closeDialog(parentTabId)));

  await renderInitial();

})();
