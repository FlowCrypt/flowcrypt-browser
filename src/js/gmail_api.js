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

/*
  body: either string (plaintext) or a dict {'text/plain': ..., 'text/html': ...}
  headers: at least {To, From, Subject}
  attachments: [{filename: 'some.txt', type: 'text/plain', content: }]
*/
function gmail_api_message_send(account_email, body, headers, attachments, thread_id, message_send_callback) {
  require(['emailjs-mime-builder'], function(MimeBuilder) {
    var root_node = new MimeBuilder('multipart/mixed');
    for(var key in headers) {
      root_node.addHeader(key, headers[key]);
    }
    var text_node = new MimeBuilder('multipart/alternative');
    if(typeof body === 'string') {
      text_node.appendChild(new MimeBuilder('text/plain').setContent(body));
    } else {
      for(var type in body) {
        text_node.appendChild(new MimeBuilder(type).setContent(body[type]));
      }
    }
    root_node.appendChild(text_node);
    for(var i in attachments) {
      //attachments[i].type + '; name="' + attachments[i].filename + '"'
      var attachment = new MimeBuilder(false, {
        filename: attachments[i].filename
      }).setHeader({
        'Content-Disposition': 'attachment',
        'X-Attachment-Id': 'f_' + random_string(10),
        'Content-Transfer-Encoding': 'base64',
      }).setContent(attachments[i].content);
      root_node.appendChild(attachment);
    }
    var raw_email = root_node.build();
    var params = {
      raw: base64url(raw_email),
      threadId: thread_id || null,
    };
    gmail_api_call(account_email, 'POST', 'messages/send', params, message_send_callback);
  });
};

function gmail_api_message_list(account_email, q, include_deleted, callback) {
  gmail_api_call(account_email, 'GET', 'messages', {
    q: q,
    includeSpamTrash: include_deleted || false,
  }, callback);
}

function gmail_api_message_get(account_email, message_id, format, callback, results) {
  if(typeof message_id === 'object') { // todo: chained requests are messy and slow. parallel processing with promises would be better
    if(!results) {
      results = {};
    }
    if(message_id.length) {
      var id = message_id.pop();
      gmail_api_call(account_email, 'GET', 'messages/' + id, {
        format: format || full //full or metadata
      }, function(success, response) {
        if(success) {
          results[id] = response;
          gmail_api_message_get(account_email, message_id, format, callback, results);
        } else {
          callback(success, response, results);
        }
      });
    } else {
      callback(true, results);
    }
  } else {
    gmail_api_call(account_email, 'GET', 'messages/' + message_id, {
      format: format || full //full or metadata
    }, callback);
  }
}

function gmail_api_message_attachment_get(account_email, message_id, attachment_id, callback) { //todo
  gmail_api_call(account_email, 'GET', 'messages/' + message_id + '/attachments/' + attachment_id, {}, callback);
}

function gmail_api_find_attachments(gmail_email_object, internal_results, internal_message_id) {
  if(!internal_results) {
    internal_results = [];
  }
  if(typeof gmail_email_object.payload !== 'undefined') {
    internal_message_id = gmail_email_object.id;
    gmail_api_find_attachments(gmail_email_object.payload, internal_results, internal_message_id);
  }
  if(typeof gmail_email_object.parts !== 'undefined') {
    for(var i in gmail_email_object.parts) {
      gmail_api_find_attachments(gmail_email_object.parts[i], internal_results, internal_message_id);
    }
  }
  if(typeof gmail_email_object.body !== 'undefined' && typeof gmail_email_object.body.attachmentId !== 'undefined') {
    internal_results.push({
      message_id: internal_message_id,
      id: gmail_email_object.body.attachmentId,
      size: gmail_email_object.body.size,
      name: gmail_email_object.filename,
      type: gmail_email_object.mimeType,
    });
  }
  return internal_results;
}

function gmail_api_fetch_attachments(account_email, attachments, callback, results) { //todo: parallelize with promises
  if(!results) {
    results = [];
  }
  var attachment = attachments[results.length];
  gmail_api_message_attachment_get(account_email, attachment.message_id, attachment.id, function(success, response) {
    if(success) {
      attachment['data'] = response.data;
      results.push(attachment);
      if(results.length === attachments.length) {
        callback(true, results);
      } else {
        gmail_api_fetch_attachments(account_email, attachments, callback, results);
      }
    } else {
      callback(success, response);
    }
  });
}
