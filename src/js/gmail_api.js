'use strict';

signal_listen('gmail_api', {
  gmail_auth_response: gmail_api_process_postponed_request
});

var requests_waiting_for_auth = {};

require.config({
  baseUrl: '../../js',
  paths: {
    'emailjs-mime-builder': './emailjs-mime-builder/src/emailjs-mime-builder',
    'emailjs-addressparser': './emailjs-mime-builder/node_modules/emailjs-addressparser/src/emailjs-addressparser',
    'emailjs-mime-types': './emailjs-mime-builder/node_modules/emailjs-mime-types/src/emailjs-mime-types',
    'emailjs-mime-codec': './emailjs-mime-builder/node_modules/emailjs-mime-codec/src/emailjs-mime-codec',
    'punycode': './emailjs-mime-builder/node_modules/punycode/punycode',
    'emailjs-stringencoding': './emailjs-mime-builder/node_modules/emailjs-stringencoding/src/emailjs-stringencoding',
    'sinon': './emailjs-mime-builder/node_modules/sinon/pkg/sinon',
  },
  shim: {
    sinon: {
      exports: 'sinon',
    }
  }
});

function gmail_api_call(account_email, method, resource, parameters, callback, fail_on_auth) {
  account_storage_get(account_email, ['google_token_access', 'google_token_expires'], function(auth) {
    if(method === 'POST') {
      var data = JSON.stringify(parameters);
    } else {
      var data = parameters;
    }
    if(typeof auth.google_token_access !== 'undefined') { // have a valid gmail_api oauth token
      $.ajax({
        url: 'https://www.googleapis.com/gmail/v1/users/me/' + resource,
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
            gmail_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, response);
          } else {
            callback(false, response);
          }
        },
      });
    } else { // no valid gmail_api oauth token
      gmail_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, null);
    }
  });
}

function gmail_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, error_response) {
  // send signal to initiate auth or call supplied callback
  if(fail_on_auth !== true) {
    var message_id = Math.floor(Math.random() * 100000);
    requests_waiting_for_auth[message_id] = {
      account_email: account_email,
      method: method,
      resource: resource,
      parameters: parameters,
      callback: callback
    };
    var signal_data = {
      message_id: message_id,
      account_email: account_email,
      signal_reply_to_listener: 'gmail_api',
      signal_reply_to_scope: signal_scope_get()
    };
    signal_send('background_process', 'gmail_auth_request', signal_data, signal_scope_default_value); //todo - later check they signed up on the right account
  } else {
    callback(false, error_response);
  }
}

function gmail_api_process_postponed_request(signal_data) {
  var parameters = requests_waiting_for_auth[signal_data.message_id];
  gmail_api_call(parameters.account_email, parameters.method, parameters.resource, parameters.parameters, parameters.callback, true);
}

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function gmail_api_get_thread(account_email, thread_id, format, get_thread_callback) {
  gmail_api_call(account_email, 'GET', 'threads/' + thread_id, {
    format: format
  }, get_thread_callback);
}

function gmail_api_message_send(account_email, from, to, subject, thread_id, message, add_headers, message_send_callback) {
  require(['emailjs-mime-builder'], function(MimeBuilder) {
    var root_node = new MimeBuilder('multipart/alternative');
    root_node.addHeader('To', to);
    root_node.addHeader('From', from);
    root_node.addHeader('Subject', subject);
    for(var key in add_headers) {
      root_node.addHeader(key, add_headers[key]);
    }
    root_node.appendChild(new MimeBuilder('text/plain').setContent(convert_html_tags_to_newlines(message))); //todo - strip tags and add \n instead
    // root_node.appendChild(new MimeBuilder('text/html').setContent(message));
    var params = {
      raw: base64url(root_node.build()),
      threadId: thread_id || null,
    };
    gmail_api_call(account_email, 'POST', 'messages/send', params, message_send_callback);
  });
};

function gmail_api_message_list(account_email, q, callback) {
  gmail_api_call(account_email, 'GET', 'messages', {
    q: q
  }, function(success, response) {
    callback(response);
  });
}

function gmail_api_message_get(account_email, message_id, format, callback) {
  gmail_api_call(account_email, 'GET', 'messages/' + message_id, {
    format: format || full //full or metadata
  }, function(success, response) {
    callback(response);
  });
}

function convert_html_tags_to_newlines(text) {
  return text.replace(/<[bB][rR] ?\/?>/g, '\n').replace(/<[dD][iI][vV][^>]*>/g, '').replace(/<\/[dD][iI][vV][^>]*>/g, '\n').trim();
}
