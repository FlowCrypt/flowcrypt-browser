'use strict';

var google_oauth2 = chrome.runtime.getManifest().oauth2;

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

var google_auth_code_request_state = {
  pack: function(status_object) {
    return google_oauth2.state_header + JSON.stringify(status_object);
  },
  unpack: function(status_string) {
    return JSON.parse(status_string.replace(google_oauth2.state_header, '', 1));
  },
};

function google_auth_respond_to_signal(signal_object, callback) {
  signal_send(signal_object.signal_reply_to_listener, 'gmail_auth_response', {
    message_id: signal_object.message_id,
    account_email: signal_object.account_email,
  }, signal_object.signal_reply_to_scope);
}

function google_auth_window_show_and_respond_to_signal(signal_data) {
  var auth_code_url = google_oauth2.url_code +
    '?client_id=' + encodeURIComponent(google_oauth2.client_id) +
    '&response_type=code' +
    '&access_type=offline' +
    '&state=' + encodeURIComponent(google_auth_code_request_state.pack(signal_data)) +
    '&redirect_uri=' + encodeURIComponent(google_oauth2.url_redirect) +
    '&scope=' + encodeURIComponent(google_oauth2.scopes.join(' ')) +
    '&login_hint=' + encodeURIComponent(signal_data.account_email);
  var auth_code_window = window.open(auth_code_url, '_blank', 'height=550,left=100,menubar=no,status=no,toolbar=no,top=100,width=500');
  // auth window will show up. Inside the window, google_auth_code.js gets executed which will send
  // a "gmail_auth_code_result" signal to "google_auth.window_result_handler" and close itself
}

function google_auth_save_tokens(account_email, tokens_object, callback) {
  var to_save = {
    google_token_access: tokens_object.access_token,
    google_token_expires: new Date().getTime() + tokens_object.expires_in * 1000,
  };
  if(typeof tokens_object.refresh_token !== 'undefined') {
    to_save['google_token_refresh'] = tokens_object.refresh_token;
  }
  account_storage_set(account_email, to_save, callback);
}

function google_auth_get_tokens(code, callback) {
  var get_tokens_url = google_oauth2.url_tokens +
    '?grant_type=authorization_code' +
    '&code=' + encodeURIComponent(code) +
    '&client_id=' + encodeURIComponent(google_oauth2.client_id) +
    '&redirect_uri=' + encodeURIComponent(google_oauth2.url_redirect);
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

function google_auth_refresh_token_and_respond_to_signal(signal_data, refresh_token, is_success_callback) {
  google_auth_refresh_token(refresh_token, function(tokens_object) {
    if(typeof tokens_object.access_token !== 'undefined') {
      google_auth_save_tokens(signal_data.account_email, tokens_object, function() {
        google_auth_respond_to_signal(signal_data);
        is_success_callback(true);
      });
    } else {
      alert('Failed to login to gmail. Please enable your gmail account in the following window.');
      console.log('failed token refresh');
      console.log(refresh_token);
      console.log(tokens_object);
      is_success_callback(false);
    }
  });
}

function google_auth_refresh_token(refresh_token, callback) {
  var get_refresh_token_url = google_oauth2.url_tokens +
    '?grant_type=refresh_token' +
    '&refresh_token=' + encodeURIComponent(refresh_token) +
    '&client_id=' + encodeURIComponent(google_oauth2.client_id);
  $.ajax({
    url: get_refresh_token_url,
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

function google_auth_check_email(expected_email, access_token, callback) {
  $.ajax({
    url: 'https://www.googleapis.com/gmail/v1/users/me/profile',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + access_token
    },
    crossDomain: true,
    contentType: 'application/json; charset=UTF-8',
    async: true,
    success: function(response) {
      callback(response.emailAddress);
    },
    error: function(response) {
      console.log('google_auth_check_email error');
      console.log(expected_email);
      console.log(response);
      callback(expected_email); //todo - handle better
    },
  });
}

function google_auth_window_result_handler(signal_data) {
  var parts = signal_data.title.split(' ', 2);
  var result = parts[0];
  var message = parts[1];
  switch(result) {
    case 'Success':
      var params = get_url_params(['code', 'state'], message);
      var state_object = google_auth_code_request_state.unpack(params.state);
      google_auth_get_tokens(params.code, function(tokens_object) {
        if(typeof tokens_object.access_token !== 'undefined') {
          google_auth_check_email(state_object.account_email, tokens_object.access_token, function(account_email) {
            // if(state_object.account_email && state_object.account_email !== account_email) {
            //   //user authorized a different account then expected
            // }
            state_object.account_email = account_email;
            google_auth_save_tokens(state_object.account_email, tokens_object, function() {
              google_auth_respond_to_signal(state_object);
            });
          });
        } else {
          console.log(params.code); // code seems to be for 1 time use
          console.log(tokens_object); // example {"error": "invalid_grant", "error_description": "Invalid code."}
          alert('error getting auth tokens from google');
        }
      });
      break;
    case 'Denied':
    case 'Error':
      // Example: 400 (OAuth2 Error)!!1
      alert(result + ': ' + message);
      break;
  }
}
