
console.log('background_process.js starting');

function gmail_auth(signal_data, gmail_auth_request_sender) {
  console.log('gmail_auth start');
  var registered_redirect_uri = chrome.identity.getRedirectURL('redirect');
  console.log('regd: ' + registered_redirect_uri);
  var scope = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send';
  var client_id = '717284730244-1ko46mlo9u0h9r16mlr6paine5u1qn7p.apps.googleusercontent.com'; //webapp
  var endpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  var url = endpoint + '?response_type=token&client_id=' + encodeURIComponent(client_id) + '&redirect_uri=' + encodeURIComponent(registered_redirect_uri) +
    '&scope=' + encodeURIComponent(scope) + '&login_hint=' + encodeURIComponent(signal_data.account);
  console.log('url:' + url);
  chrome.identity.launchWebAuthFlow({'url': url, 'interactive': true}, function(redirect_uri) {
    var access_token = redirect_uri.split('access_token=')[1].split('&token_type=')[0];
    // console.log('logged in with access token: ' + access_token);
    chrome.storage.local.set({'token': access_token}, function(){
      console.log('saved token, sending signal back to: ' + gmail_auth_request_sender)
      send_signal('gmail_auth_response', 'background_process', gmail_auth_request_sender, {message_id: signal_data.message_id});
    });
  });
}

set_signal_listener('background_process', {
  gmail_auth_request: gmail_auth
});
