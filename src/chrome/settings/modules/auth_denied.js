'use strict';

var url_params = get_url_params(['account_email', 'use_account_email', 'parent_tab_id']);
if(!url_params.use_account_email) {
  url_params.account_email = undefined;
}

$('.action_auth_proceed').click(function() {
  chrome_message_send(url_params.parent_tab_id, 'open_google_auth_dialog', {
    account_email: url_params.account_email,
  });
});

$('.auth_action_limited').click(function() {
  chrome_message_send(url_params.parent_tab_id, 'open_google_auth_dialog', {
    omit_read_scope: true,
    account_email: url_params.account_email,
  });
});

$('.close_page').click(function() {
  chrome_message_send(url_params.parent_tab_id, 'close_page');
});
