/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'use_account_email', 'parent_tab_id', 'email_provider']);
  if(!url_params.use_account_email) {
    url_params.account_email = undefined;
  }
  if(!url_params.email_provider) {
    url_params.email_provider = 'gmail';
  }

  if(!url_params.account_email) {
    render_setup_done(false);
  } else {
    Store.get_account(url_params.account_email as string, ['setup_done']).then(storage => {
      render_setup_done(storage.setup_done || false);
    });
  }

  $('.hidable').not('.' + url_params.email_provider).css('display', 'none');

  if(url_params.email_provider === 'outlook') {
    $('.permission_send').text('Manage drafts and send emails');
    $('.permission_read').text('Read messages');
  } else { // gmail
    $('.permission_send').text('Manage drafts and send emails');
    $('.permission_read').text('Read messages');
  }

  $('.action_auth_proceed').click(function () {
    tool.browser.message.send(url_params.parent_tab_id as string, 'open_google_auth_dialog', { account_email: url_params.account_email });
  });

  $('.auth_action_limited').click(function () {
    tool.browser.message.send(url_params.parent_tab_id as string, 'open_google_auth_dialog', { omit_read_scope: true, account_email: url_params.account_email });
  });

  $('.close_page').click(function () {
    tool.browser.message.send(url_params.parent_tab_id as string, 'close_page');
  });

  function render_setup_done(setup_done: boolean) {
    if(setup_done) {
      $('.show_if_setup_done').css('display', 'block');
    } else {
      $('.show_if_setup_not_done').css('display', 'block');
    }
  }

})();