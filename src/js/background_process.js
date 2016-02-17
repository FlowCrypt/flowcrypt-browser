'use strict';

console.log('background_process.js starting');

signal_scope_set(signal_scope_default_value);

signal_listen('background_process', {
  gmail_auth_request: google_auth_request_handler,
  gmail_auth_code_result: google_auth_window_result_handler,
});

function google_auth_request_handler(signal_data) {
  // todo - if already have refresh token, don't show auth window, refresh only
  // todo - if refresh token doesn't work, show auth window
  google_auth_window_show(signal_data);
}
