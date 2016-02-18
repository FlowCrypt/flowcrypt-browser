'use strict';

console.log('background_process.js starting');

signal_scope_set(signal_scope_default_value);

signal_listen('background_process', {
  gmail_auth_request: google_auth_request_handler,
  gmail_auth_code_result: google_auth_window_result_handler,
});

function google_auth_request_handler(signal_data) {
  account_storage_get(signal_data.account_email, ['google_token_access', 'google_token_expires', 'google_token_refresh'], function(storage) {
    if(typeof storage.google_token_access === 'undefined' || typeof storage.google_token_refresh === 'undefined') {
      google_auth_window_show_and_respond_to_signal(signal_data);
    } else {
      google_auth_refresh_token_and_respond_to_signal(signal_data, storage.google_token_refresh, function(success) {
        if(success === false) {
          google_auth_window_show_and_respond_to_signal(signal_data);
        }
      });
    }
  });
}
