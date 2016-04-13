'use strict';

function google_api_call(account_email, method, url, parameters, callback, fail_on_auth) {
  account_storage_get(account_email, ['google_token_access', 'google_token_expires'], function(auth) {
    if(method === 'POST') {
      var data = JSON.stringify(parameters);
    } else {
      var data = parameters;
    }
    if(typeof auth.google_token_access !== 'undefined' && auth.google_token_expires > new Date().getTime()) { // have a valid gmail_api oauth token
      $.ajax({
        url: url,
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
          try {
            var error_obj = JSON.parse(response.responseText);
            if(typeof error_obj.error !== 'undefined' && error_obj.error.message === "Invalid Credentials") {
              google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, response, gmail_api_call);
            } else {
              response._error = error_obj.error;
              callback(false, response);
            }
          } catch(err) {
            response._error = {};
            var re_title = /<title>([^<]+)<\/title>/mgi;
            var title_match = re_title.exec(response.responseText);
            if(title_match) {
              response._error.message = title_match[1];
            }
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
  google_api_call(account_email, 'GET', 'https://www.googleapis.com/oauth2/v1/userinfo', {
    alt: 'json'
  }, callback);
}

function google_api_contacts(account_email, query, max, callback) {
  google_api_call(account_email, 'GET', 'https://www.google.com/m8/feeds/contacts/default/thin', {
    'alt': 'json',
    'q': query,
    'max-results': max,
    'v': '3.0',
  }, function(success, response) {
    if(!success) {
      callback(false, response);
    } else {
      var structured = [];
      $.each(response.feed.entry, function(_, person) {
        $.each(person.gd$email, function(__, email) {
          if(email.primary === "true") {
            structured.push({
              name: (person.gd$name && person.gd$name.gd$fullName && person.gd$name.gd$fullName.$t) ? person.gd$name.gd$fullName.$t : '',
              email: email.address,
            });
          }
        });
      });
      callback(true, structured);
    }
  });
}
