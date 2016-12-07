'use strict';

var url_params = get_url_params(['parent_tab_id']);

$('.action_auth_proceed').click(function() {
  chrome_message_send(url_params.parent_tab_id, 'open_google_auth_dialog', {
    scope: undefined, //todo: make some permissions optional
  });
});

$('.close_page').click(function() {
  chrome_message_send(url_params.parent_tab_id, 'close_page');
});
