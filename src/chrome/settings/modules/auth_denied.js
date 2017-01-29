/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = get_url_params(['account_email', 'use_account_email', 'parent_tab_id']);
if(!url_params.use_account_email) {
  url_params.account_email = undefined;
}

if(!url_params.account_email) {
  render_setup_done(false);
} else {
  account_storage_get(url_params.account_email, ['setup_done'], function (storage) {
    render_setup_done(storage.setup_done);
  });
}

$('.action_auth_proceed').click(function () {
  chrome_message_send(url_params.parent_tab_id, 'open_google_auth_dialog', {
    account_email: url_params.account_email,
  });
});

$('.auth_action_limited').click(function () {
  chrome_message_send(url_params.parent_tab_id, 'open_google_auth_dialog', {
    omit_read_scope: true,
    account_email: url_params.account_email,
  });
});

$('.close_page').click(function () {
  chrome_message_send(url_params.parent_tab_id, 'close_page');
});

function render_setup_done(setup_done) {
  if(setup_done) {
    $('.show_if_setup_done').css('display', 'block');
  } else {
    $('.show_if_setup_not_done').css('display', 'block');
  }
}
