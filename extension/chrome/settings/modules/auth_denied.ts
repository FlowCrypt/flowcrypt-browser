/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Ui } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['account_email', 'parent_tab_id', 'email_provider']);
  let account_email = urlParams.account_email as string|undefined;
  let parent_tab_id = Env.urlParamRequire.string(urlParams, 'parent_tab_id');
  if (!urlParams.email_provider) {
    urlParams.email_provider = 'gmail';
  }

  let render_setup_done = (setup_done: boolean) => {
    if (setup_done) {
      $('.show_if_setup_done').css('display', 'block');
    } else {
      $('.show_if_setup_not_done').css('display', 'block');
    }
  };

  if (!urlParams.account_email) {
    render_setup_done(false);
  } else {
    let {setup_done} = await Store.getAccount(account_email!, ['setup_done']);
    render_setup_done(setup_done || false);
  }

  $('.hidable').not('.' + urlParams.email_provider).css('display', 'none');

  if (urlParams.email_provider === 'outlook') {
    $('.permission_send').text('Manage drafts and send emails');
    $('.permission_read').text('Read messages');
  } else { // gmail
    $('.permission_send').text('Manage drafts and send emails');
    $('.permission_read').text('Read messages');
  }

  $('.action_auth_proceed').click(Ui.event.handle(() => BrowserMsg.send(parent_tab_id, 'open_google_auth_dialog', {account_email})));

  $('.auth_action_limited').click(Ui.event.handle(() => BrowserMsg.send(parent_tab_id, 'open_google_auth_dialog', {omit_read_scope: true, account_email})));

  $('.close_page').click(Ui.event.handle(() => BrowserMsg.send(parent_tab_id, 'close_page')));

})();
