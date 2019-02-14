
/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui, Env } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'grandparentTabId']); // placement: compose||settings
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const grandparentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'grandparentTabId');  // grandparent is the email provider tab

  const initialRender = async () => {
    const subscription = await Store.subscription();
    const storage = await Store.getAcct(acctEmail, ['email_footer']);
    if (!subscription.active && storage.email_footer) {
      storage.email_footer = undefined;
      await Store.setAcct(acctEmail, storage);
    }
    if (subscription.active) {
      $('.input_email_footer').val(storage.email_footer || '');
      $('.input_remember').prop('checked', 'checked');
    }
  };

  const saveFooterIfAppropriate = async (requested: boolean, emailFooter: string) => {
    const subscription = await Store.subscription();
    if (requested && subscription.active) {
      await Store.setAcct(acctEmail, { email_footer: emailFooter });
    }
  };

  $('.input_remember').change(Ui.event.handle(async target => {
    const doRemember = $(target).is(':checked');
    const subscription = await Store.subscription();
    if (doRemember && !subscription.active) {
      $('.input_remember').prop('checked', false);
      if (await Ui.modal.confirm(`FlowCrypt Advanced is needed to save custom footers. Show more info?`)) {
        BrowserMsg.send.subscribeDialog(grandparentTabId, {}); // grandparent is the email provider tab
      }
    }
  }));

  $('.action_add_footer').click(Ui.event.prevent('double', async self => {
    const footer = String($('.input_email_footer').val());
    await saveFooterIfAppropriate(Boolean($('.input_remember').prop('checked')), footer);
    BrowserMsg.send.setFooter(parentTabId, { footer });
  }));

  $('.action_cancel').click(Ui.event.handle(() => BrowserMsg.send.closeDialog(parentTabId)));

  await initialRender();

})();
