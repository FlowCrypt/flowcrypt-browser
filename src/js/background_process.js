'use strict';

console.log('background_process.js starting');

signal_scope_set(signal_scope_default_value);

signal_listen('background_process', {
  gmail_auth_request: google_auth_request_handler,
  gmail_auth_code_result: google_auth_window_result_handler,
  migrate: migrate,
  list_pgp_attachments_request: list_pgp_attachments_request_handler,
});


function open_settings_page() {
  window.open(chrome.extension.getURL('chrome/settings/index.htm'), 'cryptup');
}
if(!localStorage.settings_seen) {
  open_settings_page();
}
chrome.browserAction.onClicked.addListener(open_settings_page); // Called when the user clicks on the browser action icon.


function list_pgp_attachments_request_handler(signal_data) {
  gmail_api_message_get(signal_data.account_email, signal_data.message_id, 'full', function(success, message) {
    if(success) {
      var attachments = gmail_api_find_attachments(message);
      var pgp_attachments = [];
      for(var i in attachments) {
        if(attachments[i].name.match('(\.pgp)|(\.gpg)$')) {
          pgp_attachments.push(attachments[i]);
        }
      }
      signal_send('gmail_tab', 'list_pgp_attachments_response', {
        success: true,
        attachments: pgp_attachments,
        message_id: signal_data.message_id,
      }, signal_data.reply_to_signal_scope);
    } else {
      signal_send('list_pgp_attachments_response', {
        success: false,
        message_id: signal_data.message_id,
      }, signal_data.reply_to_signal_scope);
    }
  });
}
