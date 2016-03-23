'use strict';

function google_api_call(account_email, method, resource, parameters, callback, fail_on_auth) {
  account_storage_get(account_email, ['google_token_access', 'google_token_expires'], function(auth) {
    if(method === 'POST') {
      var data = JSON.stringify(parameters);
    } else {
      var data = parameters;
    }
    if(typeof auth.google_token_access !== 'undefined' && auth.google_token_expires > new Date().getTime()) { // have a valid gmail_api oauth token
      $.ajax({
        url: 'https://www.googleapis.com/oauth2/v1/' + resource,
        method: method,
        data: data,
        headers: {
          'Authorization': 'Bearer ' + auth.google_token_access
        },
        crossDomain: true,
        contentType: 'application/json; charset=UTF-8',
        async: true,
        success: function(response) {
          callback(true, response);
        },
        error: function(response) {
          var error_obj = JSON.parse(response.responseText);
          if(typeof error_obj['error'] !== 'undefined' && error_obj['error']['message'] === "Invalid Credentials") {
            google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, response, google_api_call);
          } else {
            callback(false, response);
          }
        },
      });
    } else { // no valid gmail_api oauth token
      google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, null, google_api_call);
    }
  });
}

function google_api_userinfo(account_email, callback) {
  google_api_call(account_email, 'GET', 'userinfo', {
    alt: 'json'
  }, callback);
}
