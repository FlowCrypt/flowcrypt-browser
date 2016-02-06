'use strict';

signal_scope_set(signal_scope_default_value);

signal_listen('background_process', {
  gmail_auth_request: gmail_auth
});

console.log('background_process.js starting');

function gmail_auth(signal_data) {
  console.log('gmail_auth start');
  var scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';
  var url = 'https://accounts.google.com/o/oauth2/v2/auth?response_type=token' +
    '&client_id=' + encodeURIComponent('717284730244-1ko46mlo9u0h9r16mlr6paine5u1qn7p.apps.googleusercontent.com') + //webapp
    '&redirect_uri=' + encodeURIComponent(chrome.identity.getRedirectURL('redirect')) +
    '&scope=' + encodeURIComponent(scope) +
    '&login_hint=' + encodeURIComponent(signal_data.account);
  console.log('url:' + url);
  chrome.identity.launchWebAuthFlow({
    'url': url,
    'interactive': true
  }, function(redirect_uri) {
    var access_token = redirect_uri.split('access_token=')[1].split('&token_type=')[0];
    // console.log('logged in with access token: ' + access_token);
    account_storage_set(signal_data.account, 'token', access_token, function() {
      signal_send(signal_data.signal_reply_to_listener, 'gmail_auth_response', {
        message_id: signal_data.message_id
      }, signal_data.signal_reply_to_scope);
    });
  });
}
