'use strict';

function gmail_api_call(account_email, method, resource, parameters, callback, fail_on_auth) {
  account_storage_get(account_email, ['google_token_access', 'google_token_expires'], function(auth) {
    if(method === 'POST') {
      var data = JSON.stringify(parameters);
    } else {
      var data = parameters;
    }
    if(typeof auth.google_token_access !== 'undefined' && auth.google_token_expires > new Date().getTime()) { // have a valid gmail_api oauth token
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
      google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, null, gmail_api_call);
    }
  });
}

function google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, error_response, base_api_function) {
  if(fail_on_auth !== true) {
    chrome_message_send(null, 'google_auth', {
      account_email: account_email,
    }, function(response) {
      //todo: respond with success in background script, test if response.success === true, and error handling
      base_api_function(account_email, method, resource, parameters, callback, true);
    });
  } else {
    callback(false, error_response);
  }
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
  set_up_require();
  require(['emailjs-mime-builder'], function(MimeBuilder) {
    var root_node = new MimeBuilder('multipart/mixed');
    $.each(headers, function(key, header) {
      root_node.addHeader(key, header);
    });
    var text_node = new MimeBuilder('multipart/alternative');
    if(typeof body === 'string') {
      text_node.appendChild(new MimeBuilder('text/plain').setContent(body));
    } else {
      $.each(body, function(type, content) {
        text_node.appendChild(new MimeBuilder(type).setContent(content));
      });
    }
    root_node.appendChild(text_node);
    $.each(attachments || [], function(i, attachment) {
      root_node.appendChild(new MimeBuilder(attachment.type + '; name="' + attachment.filename + '"', {
        filename: attachment.filename
      }).setHeader({
        'Content-Disposition': 'attachment',
        'X-Attachment-Id': 'f_' + random_string(10),
        'Content-Transfer-Encoding': 'base64',
      }).setContent(attachment.content));
    });
    var raw_email = root_node.build();
    var params = {
      raw: base64url_encode(raw_email),
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
        format: format || 'full' //full or metadata
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
      format: format || 'full' //full or metadata
    }, callback);
  }
}

function gmail_api_message_attachment_get(account_email, message_id, attachment_id, callback) {
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
    $.each(gmail_email_object.parts, function(i, part) {
      gmail_api_find_attachments(part, internal_results, internal_message_id);
    });
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

function gmail_api_find_header(gmail_api_message_object, header_name) {
  for(var i = 0; i < gmail_api_message_object.payload.headers.length; i++) {
    if(gmail_api_message_object.payload.headers[i].name.toLowerCase() === header_name.toLowerCase()) {
      return gmail_api_message_object.payload.headers[i].value;
    }
  }
  return null;
}
