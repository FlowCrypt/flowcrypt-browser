/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Ui } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['acctEmail', 'parentTabId', 'emailProvider']);
  let acctEmail = urlParams.acctEmail as string|undefined;
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  if (!urlParams.emailProvider) {
    urlParams.emailProvider = 'gmail';
  }

  let renderSetupDone = (setup_done: boolean) => {
    if (setup_done) {
      $('.show_if_setup_done').css('display', 'block');
    } else {
      $('.show_if_setup_not_done').css('display', 'block');
    }
  };

  if (!urlParams.acctEmail) {
    renderSetupDone(false);
  } else {
    let {setup_done} = await Store.getAcct(acctEmail!, ['setup_done']);
    renderSetupDone(setup_done || false);
  }

  $('.hidable').not('.' + urlParams.emailProvider).css('display', 'none');

  if (urlParams.emailProvider === 'outlook') {
    $('.permission_send').text('Manage drafts and send emails');
    $('.permission_read').text('Read messages');
  } else { // gmail
    $('.permission_send').text('Manage drafts and send emails');
    $('.permission_read').text('Read messages');
  }

  $('.action_auth_proceed').click(Ui.event.handle(() => BrowserMsg.send(parentTabId, 'open_google_auth_dialog', {acctEmail})));

  $('.auth_action_limited').click(Ui.event.handle(() => BrowserMsg.send(parentTabId, 'open_google_auth_dialog', {omitReadScope: true, acctEmail})));

  $('.close_page').click(Ui.event.handle(() => BrowserMsg.send(parentTabId, 'close_page')));

})();
