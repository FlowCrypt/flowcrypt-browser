/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var USELESS_CONTACTS_FILTER = '-to:txt.voice.google.com -to:reply.craigslist.org -to:sale.craigslist.org -to:hous.craigslist.org';

function gmail_api_call(account_email, method, resource, parameters, callback, fail_on_auth) {
  account_storage_get(account_email, ['google_token_access', 'google_token_expires'], function(auth) {
    if(method === 'GET' || method === 'DELETE') {
      var data = parameters;
    } else {
      var data = JSON.stringify(parameters);
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
          if(callback) {
            callback(true, response);
          }
        },
        error: function(response) {
          try {
            var error_obj = JSON.parse(response.responseText);
            if(typeof error_obj.error !== 'undefined' && error_obj.error.message === "Invalid Credentials") {
              google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, response, gmail_api_call);
            } else {
              response._error = error_obj.error;
              if(callback) {
                callback(false, response);
              }
            }
          } catch(err) {
            response._error = {};
            var re_title = /<title>([^<]+)<\/title>/mgi;
            var title_match = re_title.exec(response.responseText);
            if(title_match) {
              response._error.message = title_match[1];
            }
            if(callback) {
              callback(false, response);
            }
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

/*
  body: either string (plaintext) or a dict {'text/plain': ..., 'text/html': ...}
  headers: at least {To, From, Subject}
  attachments: [{filename: 'some.txt', type: 'text/plain', content: }]
*/
function to_mime(account_email, body, headers, attachments, mime_message_callback) {
  set_up_require();
  require(['emailjs-mime-builder'], function(MimeBuilder) {
    var root_node = new MimeBuilder('multipart/mixed');
    $.each(headers, function(key, header) {
      root_node.addHeader(key, header);
    });
    root_node.addHeader('OpenPGP', 'id=' + key_fingerprint(private_storage_get('local', account_email, 'master_public_key')));
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
    mime_message_callback(root_node.build());
  });
}

function gmail_api_get_thread(account_email, thread_id, format, get_thread_callback) {
  gmail_api_call(account_email, 'GET', 'threads/' + thread_id, {
    format: format
  }, get_thread_callback);
}

function gmail_api_draft_create(account_email, mime_message, thread_id, callback) {
  gmail_api_call(account_email, 'POST', 'drafts', {
    message: {
      raw: base64url_encode(mime_message),
      threadId: thread_id || null,
    },
  }, callback);
}

function gmail_api_draft_delete(account_email, id, callback) {
  gmail_api_call(account_email, 'DELETE', 'drafts/' + id, null, callback);
}

function gmail_api_draft_update(account_email, id, mime_message, callback) {
  gmail_api_call(account_email, 'PUT', 'drafts/' + id, {
    message: {
      raw: base64url_encode(mime_message),
    },
  }, callback);
}

function gmail_api_draft_get(account_email, id, format, callback) {
  gmail_api_call(account_email, 'GET', 'drafts/' + id, {
    format: format || 'full'
  }, callback);
}

function gmail_api_draft_send(account_email, id, callback) {
  gmail_api_call(account_email, 'POST', 'drafts/send', {
    id: id,
  }, callback);
}

function gmail_api_message_send(account_email, mime_message, thread_id, callback) {
  gmail_api_call(account_email, 'POST', 'messages/send', {
    raw: base64url_encode(mime_message),
    threadId: thread_id || null,
  }, callback);
}

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
        format: format || 'full', //raw, full or metadata
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
      format: format || 'full', //raw, full or metadata
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

function gmail_api_find_bodies(gmail_email_object, internal_results) {
  if(!internal_results) {
    internal_results = {};
  }
  if(typeof gmail_email_object.payload !== 'undefined') {
    gmail_api_find_bodies(gmail_email_object.payload, internal_results);
  }
  if(typeof gmail_email_object.parts !== 'undefined') {
    $.each(gmail_email_object.parts, function(i, part) {
      gmail_api_find_bodies(part, internal_results);
    });
  }
  if(typeof gmail_email_object.body !== 'undefined' && typeof gmail_email_object.body.data !== 'undefined' && typeof gmail_email_object.body.size !== 0) {
    internal_results[gmail_email_object.mimeType] = gmail_email_object.body.data;
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
  if(typeof gmail_api_message_object.payload.headers !== 'undefined') {
    for(var i = 0; i < gmail_api_message_object.payload.headers.length; i++) {
      if(gmail_api_message_object.payload.headers[i].name.toLowerCase() === header_name.toLowerCase()) {
        return gmail_api_message_object.payload.headers[i].value;
      }
    }
  }
  return null;
}

function gmail_api_search_contacts(account_email, user_query, known_contacts, callback) {
  var gmail_query = ['is:sent', USELESS_CONTACTS_FILTER];
  if(user_query) {
    gmail_query.push();
    var variations_of_to = user_query.split(/[ \.]/g);
    if(variations_of_to.indexOf(user_query) === -1) {
      variations_of_to.push(user_query);
    }
    gmail_query.push('(to:' + variations_of_to.join(' OR to:') + ')');
  }
  $.each(known_contacts, function(i, contact) {
    gmail_query.push('-to:"' + contact.email + '"');
  });
  gmail_api_loop_through_emails_to_compile_contacts(account_email, gmail_query.join(' '), callback)
}

function gmail_api_loop_through_emails_to_compile_contacts(account_email, query, callback, results) {
  results = results || [];
  fetch_messages_based_on_query_and_extract_first_available_header(account_email, query, ['to', 'date'], function(headers) {
    if(headers && headers.to) {
      var result = headers.to.split(/, ?/).map(parse_email_string).map(function(r) {
        r.date = headers.date;
        return r;
      });
      var add_filter = result.map(function(email) {
        return ' -to:"' + email.email + '"';
      }).join('');
      results = results.concat(result);
      callback({
        new: result,
        all: results,
      });
      gmail_api_loop_through_emails_to_compile_contacts(account_email, query + add_filter, callback, results);
    } else {
      callback({
        new: [],
        all: results,
      });
    }
  });
}

function fetch_messages_based_on_query_and_extract_first_available_header(account_email, q, header_names, callback) {
  gmail_api_message_list(account_email, q, false, function(success, message_list_response) {
    if(success && typeof message_list_response.messages !== 'undefined') {
      fetch_messages_sequentially_from_list_and_extract_first_available_header(account_email, message_list_response.messages, header_names, callback);
    } else {
      callback(); // if the request is !success, it will just return undefined, which may not be the best
    }
  });
}

function fetch_messages_sequentially_from_list_and_extract_first_available_header(account_email, messages, header_names, callback, i) {
  // this won a prize for the most precisely named function in the hostory of javascriptkind
  i = i || 0;
  gmail_api_message_get(account_email, messages[i].id, 'metadata', function(success, message_get_response) {
    var header_values = {};
    var missing_header = false;
    if(success) { // non-mission critical - just skip failed requests
      $.each(header_names, function(i, header_name) {
        header_values[header_name] = gmail_api_find_header(message_get_response, header_name);
        if(!header_values[header_name]) {
          missing_header = true;
        }
      });
    }
    if(!missing_header) {
      callback(header_values);
    } else if(i + 1 < messages.length) {
      fetch_messages_sequentially_from_list_and_extract_first_available_header(account_email, messages, header_names, callback, i + 1);
    } else {
      callback();
    }
  });
}

/*
 * Extracts the encrypted message from gmail api. Sometimes it's sent as a text, sometimes html, sometimes attachments in various forms.
 * success_callback(str armored_pgp_message)
 * error_callback(str error_type, str html_formatted_data_to_display_to_user)
 *    ---> html_formatted_data_to_display_to_user might be unknown type of mime message, or pgp message with broken format, etc.
 *    ---> The motivation is that user might have other tool to process this. Also helps debugging issues in the field.
 */
function extract_armored_message_using_gmail_api(account_email, message_id, format, success_callback, error_callback) {
  gmail_api_message_get(account_email, message_id, format, function(get_message_success, gmail_message_object) {
    if(get_message_success) {
      if(format === 'full') {
        var bodies = gmail_api_find_bodies(gmail_message_object);
        var attachments = gmail_api_find_attachments(gmail_message_object);
        var armored_message_from_bodies = extract_armored_message_from_text(base64url_decode(bodies['text/plain'])) || extract_armored_message_from_text(strip_pgp_armor(base64url_decode(bodies['text/html'])));

        // !!! hard to get the =20 version from gmail - find out how, maybe raw instead of full
        // console.log(base64url_decode(bodies['text/plain']));
        // utf8_from_str_with_equal_sign_notation
        if(armored_message_from_bodies) {
          success_callback(armored_message_from_bodies);
        } else if(attachments.length) {
          var found = false;
          $.each(attachments, function(i, attachment_meta) {
            if(attachment_meta.name.match(/\.asc$/)) {
              found = true;
              gmail_api_fetch_attachments(url_params.account_email, [attachment_meta], function(fetch_attachments_success, attachment) {
                if(fetch_attachments_success) {
                  var armored_message_text = base64url_decode(attachment[0].data);
                  var armored_message = extract_armored_message_from_text(armored_message_text);
                  if(armored_message) {
                    success_callback(armored_message);
                  } else {
                    error_callback('format', armored_message_text);
                  }
                } else {
                  error_callback('connection');
                }
              });
              return false;
            }
          });
          if(!found) {
            error_callback('format', as_html_formatted_string(gmail_message_object.payload));
          }
        } else {
          error_callback('format', as_html_formatted_string(gmail_message_object.payload));
        }
      } else { // format === raw
        parse_mime_message(base64url_decode(gmail_message_object.raw), function(success, mime_message) {
          if(success) {
            var armored_message = extract_armored_message_from_text(mime_message.text); // todo - the message might be in attachments
            if(armored_message) {
              success_callback(armored_message);
            } else {
              error_callback('format');
            }
          } else {
            error_callback('format');
          }
        });
      }
    } else {
      error_callback('connection');
    }
  });
}
