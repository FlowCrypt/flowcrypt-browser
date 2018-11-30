/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/platform/store.js';
import { Ui, Env } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Catch } from '../../../js/common/platform/catch.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'emailProvider']);
  const acctEmail = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const emailProvider = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'emailProvider') || 'gmail';

  const renderSetupDone = (setupDone: boolean) => {
    if (setupDone) {
      $('.show_if_setup_done').css('display', 'block');
    } else {
      $('.show_if_setup_not_done').css('display', 'block');
    }
  };

  if (!acctEmail) {
    renderSetupDone(false);
  } else {
    const { setup_done } = await Store.getAcct(acctEmail!, ['setup_done']);
    renderSetupDone(setup_done || false);
  }

  $('.hidable').not(`.${emailProvider}`).css('display', 'none');

  if (emailProvider === 'outlook') {
    $('.permission_send').text('Manage drafts and send emails');
    $('.permission_read').text('Read messages');
  } else { // gmail
    $('.permission_send').text('Manage drafts and send emails');
    $('.permission_read').text('Read messages');
  }

  $('.action_auth_proceed').click(Ui.event.handle(() => BrowserMsg.send.openGoogleAuthDialog(parentTabId, { acctEmail })));

  $('.auth_action_limited').click(Ui.event.handle(() => BrowserMsg.send.openGoogleAuthDialog(parentTabId, { omitReadScope: true, acctEmail })));

  $('.close_page').click(Ui.event.handle(() => BrowserMsg.send.closePage(parentTabId)));

})();
