'use strict';

console.log('background_process.js starting');

signal_scope_set(signal_scope_default_value);

signal_listen('background_process', {
  gmail_auth_request: gmail_auth_request_handler,
  gmail_auth_code_result: gmail_auth_code_result_handler,
});

var gmail_oauth2 = chrome.runtime.getManifest().oauth2;

var auth_code_request_state = {
  pack: function(status_object) {
    return gmail_oauth2.state_header + JSON.stringify(status_object);
  },
  unpack: function(status_string) {
    return JSON.parse(status_string.replace(gmail_oauth2.state_header, '', 1));
  },
};

// initial auth step 1
function gmail_auth_request_handler(signal_data) {
  var auth_code_url = gmail_oauth2.url_code +
    '?client_id=' + encodeURIComponent(gmail_oauth2.client_id) +
    '&response_type=code' +
    '&access_type=offline' +
    '&state=' + encodeURIComponent(auth_code_request_state.pack(signal_data)) +
    '&redirect_uri=' + encodeURIComponent(gmail_oauth2.url_redirect) +
    '&scope=' + encodeURIComponent(gmail_oauth2.scopes.join(' ')) +
    '&login_hint=' + encodeURIComponent(signal_data.account_email);
  var auth_code_window = window.open(auth_code_url, '_blank', 'height=400,left=100,menubar=no,status=no,toolbar=no,top=100,width=500');
  // auth window will show up. Inside the window, google_auth_code.js gets executed which will send
  // a "gmail_auth_code_result" signal to "gmail_auth_code_result_handler" and close itself
}

// initial auth step 2
function gmail_auth_code_result_handler(signal_data) {
  var parts = signal_data.title.split(' ', 2);
  var result = parts[0];
  var message = parts[1];
  switch(result) {
    case 'Success':
      var data_parts = message.split('&');
      var params = {};
      for(var i = 0; i < data_parts.length; i++) {
        var key_value = data_parts[i].split('=');
        params[key_value[0]] = decodeURIComponent(key_value[1]);
      }
      var state_object = auth_code_request_state.unpack(params.state);
      gmail_auth_get_tokens(params.code, function(tokens_object) {
        //code seems to be for 1 time use, after that returns tokens_object = {
        //   "error": "invalid_grant",
        //   "error_description": "Invalid code."
        // }
        var expires = new Date();
        expires.setSeconds(expires.getSeconds() + tokens_object.expires_in);
        var to_save = {
          google_token_access: tokens_object.access_token,
          google_token_refresh: tokens_object.refresh_token,
          gogole_token_expires: expires,
        };
        account_storage_set(state_object.account_email, to_save, function() {
          signal_send(state_object.signal_reply_to_listener, 'gmail_auth_response', {
            message_id: state_object.message_id
          }, state_object.signal_reply_to_scope);
        });
      });
      break;
    case 'Denied':
      // Example: error_subtype=access_denied&error=immediate_failed
      alert(result + ': ' + message);
      break;
    case 'Error':
      // Example: 400 (OAuth2 Error)!!1
      alert(result + ': ' + message);
      break;
  }
}

function gmail_auth_get_tokens(code, callback) {
  // /oauth2/v4/token
  var get_tokens_url = gmail_oauth2.url_tokens + '?grant_type=authorization_code' +
    '&code=' + encodeURIComponent(code) +
    '&client_id=' + encodeURIComponent(gmail_oauth2.client_id) +
    '&redirect_uri=' + encodeURIComponent(gmail_oauth2.url_redirect);
  $.ajax({
    url: get_tokens_url,
    method: 'POST',
    crossDomain: true,
    async: true,
    success: function(response) {
      callback(response);
    },
    error: function(XMLHttpRequest, status, error) {
      callback({
        request: XMLHttpRequest,
        status: status,
        error: error
      });
    },
  });
}
