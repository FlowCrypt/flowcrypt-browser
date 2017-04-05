/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var google_oauth2 = chrome.runtime.getManifest().oauth2;

var auth_responders = [];
var RESPONDED = 'RESPONDED';

function google_auth(auth_request, sender, respond) {
  account_storage_get(auth_request.account_email, ['google_token_access', 'google_token_expires', 'google_token_refresh', 'google_token_scopes'], function (storage) {
    if(typeof storage.google_token_access === 'undefined' || typeof storage.google_token_refresh === 'undefined' || has_new_scope(auth_request.scopes, storage.google_token_scopes, auth_request.omit_read_scope)) {
      google_auth_window_show_and_respond_to_auth_request(auth_request, storage.google_token_scopes, respond);
    } else {
      google_auth_refresh_token(storage.google_token_refresh, function (success, result) {
        if(!success && result === tool.api.error.network) {
          respond({ success: false, error: tool.api.error.network });
        } else if(typeof result.access_token !== 'undefined') {
          google_auth_save_tokens(auth_request.account_email, result, storage.google_token_scopes, function () {
            respond({ success: true, message_id: auth_request.message_id, account_email: auth_request.account_email }); //todo: email should be tested first with google_auth_check_email?
          });
        } else {
          google_auth_window_show_and_respond_to_auth_request(auth_request, storage.google_token_scopes, respond);
        }
      });
    }
  });
}

function has_new_scope(new_scopes, original_scopes, omit_read_scope) {
  if(!(original_scopes || []).length) { // no original scopes
    return true;
  }
  if(!(new_scopes || []).length) { // no new scopes specified
    return(original_scopes.length === 2 && !omit_read_scope); // however, previously there were only two of three scopes, and third was not omitted this time
  }
  for(var i = 0; i < new_scopes.length; i++) {
    if(!tool.value(new_scopes[i]).in(original_scopes)) {
      return true; // found a new scope
    }
  }
  return false; // no new scope found
}

var google_auth_code_request_state = {
  pack: function (status_object) {
    return google_oauth2.state_header + JSON.stringify(status_object);
  },
  unpack: function (status_string) {
    return JSON.parse(status_string.replace(google_oauth2.state_header, '', 1));
  },
};

function google_auth_window_show_and_respond_to_auth_request(auth_request, current_scopes, respond) {
  auth_request.auth_responder_id = tool.str.random(20);
  auth_responders[auth_request.auth_responder_id] = respond;
  auth_request.scopes = auth_request.scopes || [];
  $.each(google_oauth2.scopes, function (i, scope) {
    if(!tool.value(scope).in(auth_request.scopes)) {
      if(scope !== tool.api.gmail.scope('read') || !auth_request.omit_read_scope) { // leave out read messages permission if user chose so
        auth_request.scopes.push(scope);
      }
    }
  });
  $.each(current_scopes || [], function (i, scope) {
    if(!tool.value(scope).in(auth_request.scopes)) {
      auth_request.scopes.push(scope);
    }
  });
  var auth_code_url = tool.env.url_create(google_oauth2.url_code, {
    client_id: google_oauth2.client_id,
    response_type: 'code',
    access_type: 'offline',
    state: google_auth_code_request_state.pack(auth_request),
    redirect_uri: google_oauth2.url_redirect,
    scope: auth_request.scopes.join(' '),
    login_hint: auth_request.account_email,
  });
  var auth_code_window = window.open(auth_code_url, '_blank', 'height=600,left=100,menubar=no,status=no,toolbar=no,top=100,width=500');
  // auth window will show up. Inside the window, google_auth_code.js gets executed which will send
  // a "gmail_auth_code_result" chrome message to "google_auth.google_auth_window_result_handler" and close itself
  var window_closed_timer = setInterval(window_closed_watcher, 200);

  function window_closed_watcher() {
    if(auth_code_window.closed) {
      clearInterval(window_closed_timer);
      if(auth_responders[auth_request.auth_responder_id] !== RESPONDED) {
        // if user did clock Allow/Deny on auth, race condition is prevented, because auth_responders[] are always marked as RESPONDED before closing window.
        // thus it's impossible for another process to try to respond before the next line
        // that also means, if window got closed and it's not marked as RESPONDED, it was the user closing the window manually, which is what we're watching for.
        auth_responders[auth_request.auth_responder_id]({
          success: false,
          result: 'closed',
          account_email: auth_request.account_email,
          message_id: auth_request.message_id,
        });
        auth_responders[auth_request.auth_responder_id] = RESPONDED;
      }
    }
  }
}

function google_auth_save_tokens(account_email, tokens_object, scopes, callback) {
  var to_save = {
    google_token_access: tokens_object.access_token,
    google_token_expires: new Date().getTime() + tokens_object.expires_in * 1000,
    google_token_scopes: scopes,
  };
  if(typeof tokens_object.refresh_token !== 'undefined') {
    to_save.google_token_refresh = tokens_object.refresh_token;
  }
  account_storage_set(account_email, to_save, callback);
}

function google_auth_get_tokens(code, callback, retries_left) {
  $.ajax({
    url: tool.env.url_create(google_oauth2.url_tokens, { grant_type: 'authorization_code', code: code, client_id: google_oauth2.client_id, redirect_uri: google_oauth2.url_redirect }),
    method: 'POST',
    crossDomain: true,
    async: true,
    success: function (response) {
      callback(response);
    },
    error: function (XMLHttpRequest, status, error) {
      if(!retries_left) {
        callback({ request: XMLHttpRequest, status: status, error: error });
      } else {
        setTimeout(function () { // retry again
          google_auth_get_tokens(code, callback, retries_left - 1);
        }, 2000);
      }
    },
  });
}

function google_auth_refresh_token(refresh_token, callback) {
  $.ajax({
    url: tool.env.url_create(google_oauth2.url_tokens, { grant_type: 'refresh_token', refresh_token: refresh_token, client_id: google_oauth2.client_id }),
    method: 'POST',
    crossDomain: true,
    async: true,
    success: function (response) {
      callback(true, response);
    },
    error: function (XMLHttpRequest, status, error) {
      if(XMLHttpRequest.status === 0 && status === 'error') { // connection error
        callback(false, tool.api.error.network);
      } else {
        callback(false, { request: XMLHttpRequest, status: status, error: error });
      }
    },
  });
}

function google_auth_check_email(expected_email, access_token, callback) {
  $.ajax({
    url: 'https://www.googleapis.com/gmail/v1/users/me/profile',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + access_token },
    crossDomain: true,
    contentType: 'application/json; charset=UTF-8',
    async: true,
    success: function (response) {
      callback(response.emailAddress);
    },
    error: function (response) {
      console.log('google_auth_check_email error');
      console.log(expected_email);
      console.log(response);
      callback(expected_email); //todo - handle better. On a network error, this could result in saving this wrongly. Should re-try two times with some delay, then call back.
    },
  });
}

function google_auth_window_result_handler(auth_code_window_result, sender, close_auth_window) {
  function safe_respond(responder, response) {
    if(typeof responder === 'function') {
      try {
        responder(response);
      } catch(e) {
        if(!tool.value('Attempting to use a disconnected port object').in(e.message)) { // ignore this message - target tab no longer exists
          throw e;
        }
      }
    }
  }
  var parts = auth_code_window_result.title.split(' ', 2);
  var result = parts[0];
  var params = tool.env.url_params(['code', 'state', 'error'], parts[1]);
  var state_object = google_auth_code_request_state.unpack(params.state);
  var auth_responder = auth_responders[state_object.auth_responder_id];
  auth_responders[state_object.auth_responder_id] = RESPONDED;
  close_auth_window();
  switch(result) {
  case 'Success':
    google_auth_get_tokens(params.code, function (tokens_object) {
      if(typeof tokens_object.access_token !== 'undefined') {
        google_auth_check_email(state_object.account_email, tokens_object.access_token, function (account_email) {
          google_auth_save_tokens(account_email, tokens_object, state_object.scopes, function () {
            safe_respond(auth_responder, {
              account_email: account_email,
              success: true,
              result: result.toLowerCase(),
              message_id: state_object.message_id,
            });
          });
        });
      } else {
        safe_respond(auth_responder, {
          success: false,
          result: result.toLowerCase(),
          account_email: state_object.account_email,
          message_id: state_object.message_id,
        });
      }
    }, 2);
    break;
  case 'Denied':
  case 'Error':
    safe_respond(auth_responder, {
      success: false,
      result: result.toLowerCase(),
      error: params.error,
      account_email: state_object.account_email,
      message_id: state_object.message_id,
    });
    break;
  }
}
