'use strict';

var url_params = get_url_params(['account_email', 'frame_id', 'message', 'question', 'parent_tab_id', 'message_id']);

var ready_attachmments = [];

var l = {
  cant_open: 'Could not open this message with CryptUP.\n\n',
  encrypted_correctly_file_bug: 'It\'s correctly encrypted for you. Please file a bug report if you see this on multiple messages. ',
  single_sender: 'Normally, messages are encrypted for at least two people (sender and the receiver). It seems the sender encrypted this message manually for themselves, and forgot to add you as a receiver. ',
  account_info_outdated: 'Some your account information is incorrect. Update it to prevent future errors. ',
  wrong_pubkey_used: 'It looks like it was encrypted for someone else. ',
  ask_resend: 'Please ask them to send a new message. ',
  receivers_hidden: 'We cannot tell if the message was encrypted correctly for you. ',
  bad_format: 'Message is either badly formatted or not compatible with CryptUP. ',
  no_private_key: 'No private key to decrypt this message. Try reloading the page. ',
  refresh_page: 'Refresh page to see more information.',
  question_decryt_prompt: 'To decrypt the message, answer: ',
  connection_error: 'Could not connect to Gmail to open the message, please refresh the page to try again. ',
  dont_know_how_open: 'Please submit a bug report, and mention what software was used to send this message to you. We usually fix similar incompatibilities within one week. ',
}

function format_plaintext(text) {
  if(/<((br)|(div)|p) ?\/?>/.test(text)) {
    return text;
  }
  return text.replace(/\n/g, '<br>\n');
}

function send_resize_message() {
  chrome_message_send(url_params.parent_tab_id, 'pgp_block_iframe_set_css', {
    frame_id: url_params.frame_id,
    css: {
      height: $('#pgp_block').height() + 30
    }
  });
}

function render_content(content) {
  $('#pgp_block').html(content);
  setTimeout(function() {
    $(window).resize(prevent(spree(), send_resize_message));
  }, 1000);
  send_resize_message();
}

function diagnose_pubkeys_button(text, color) {
  return '<br><div class="button settings long ' + color + '" style="margin:30px 0;" target="cryptup">' + text + '</div>';
}

function armored_message_as_html(raw_message_substitute) {
  if(raw_message_substitute || url_params.message) {
    return '<div class="raw_pgp_block">' + (raw_message_substitute || url_params.message).replace(/\n/g, '<br>') + '</div>';
  }
  return '';
}

function render_error(error_box_content, raw_message_substitute) {
  $('body').removeClass('pgp_secure').addClass('pgp_insecure');
  render_content('<div class="error">' + error_box_content.replace(/\n/g, '<br>') + '</div>' + armored_message_as_html(raw_message_substitute));
  $('.settings.button').click(prevent(doubleclick(), function() {
    chrome_message_send(null, 'settings', {
      page: 'pubkeys.htm?account_email=' + encodeURIComponent(url_params.account_email),
    });
  }));
}

function handle_private_key_mismatch(account_email, message) {
  var msg_diagnosis = check_pubkeys_message(account_email, message);
  if(msg_diagnosis.found_match) {
    render_error(l.cant_open + l.encrypted_correctly_file_bug);
  } else {
    if(msg_diagnosis.receivers === 1) {
      render_error(l.cant_open + l.single_sender + l.ask_resend + diagnose_pubkeys_button('account settings', 'gray2'));
    } else {
      check_pubkeys_keyserver(account_email, function(ksrv_diagnosis) {
        if(!ksrv_diagnosis) {
          render_error(l.cant_open + l.refresh_page);
        } else {
          if(msg_diagnosis.receivers) {
            if(ksrv_diagnosis.has_pubkey_mismatch) {
              render_error(l.cant_open + l.account_info_outdated + diagnose_pubkeys_button('review outdated information', 'green'));
            } else {
              render_error(l.cant_open + l.wrong_pubkey_used + l.ask_resend + diagnose_pubkeys_button('account settings', 'gray2'));
            }
          } else {
            if(ksrv_diagnosis.has_pubkey_mismatch) {
              render_error(l.cant_open + l.receivers_hidden + l.account_info_outdated + diagnose_pubkeys_button('review outdated information', 'green'));
            } else {
              render_error(l.cant_open + l.receivers_hidden + l.ask_resend + diagnose_pubkeys_button('account settings', 'gray2'));
            }
          }
        }
      });
    }
  }
}

function mime_node_type(node) {
  if(node.headers['content-type'] && node.headers['content-type'][0]) {
    return node.headers['content-type'][0].value;
  }
}

function mime_node_filename(node) {
  if(node.headers['content-disposition'] && node.headers['content-disposition'][0] && node.headers['content-disposition'][0].params && node.headers['content-disposition'][0].params.filename) {
    return node.headers['content-disposition'][0].params.filename;
  }
  if(node.headers['content-type'] && node.headers['content-type'][0] && node.headers['content-type'][0].params && node.headers['content-type'][0].params.name) {
    return node.headers['content-disposition'][0].params.name;
  }
}


function parse_mime_message(mime_message, callback) {
  set_up_require();
  var mime_message_contents = {
    attachments: []
  };
  require(['emailjs-mime-parser'], function(MimeParser) {
    //todo - handle mime formatting errors and such, with callback(false, 'XX went wrong');
    var parser = new MimeParser();
    var parsed = {};
    parser.onbody = function(node, chunk) {
      var path = String(node.path.join("."));
      if(typeof parsed[path] === 'undefined') {
        parsed[path] = node;
      }
    };
    parser.onend = function() {
      $.each(parsed, function(path, node) {
        var node_content = uint8_to_str(node.content);
        if(mime_node_type(node) === 'application/pgp-signature') {
          mime_message_contents.signature = node_content;
        } else if(mime_node_type(node) === 'text/html' && !mime_node_filename(node)) {
          mime_message_contents.html = node_content;
        } else if(mime_node_type(node) === 'text/plain' && !mime_node_filename(node)) {
          // todo - encoding, some UTF-8 chars get garbled up
          mime_message_contents.text = node_content;
        } else {
          mime_message_contents.attachments.push({
            name: mime_node_filename(node),
            size: node_content.length,
            type: mime_node_type(node),
            data: node_content,
          });
        }
      });
      callback(true, mime_message_contents);
    }
    parser.write(mime_message);
    parser.end();
  });
}

function render_inner_attachments(attachments) {
  $('#pgp_block').append('<div id="attachments"></div>');
  ready_attachmments = attachments;
  $.each(ready_attachmments, function(i, attachment) {
    $('#attachments').append('<div class="attachment" index="' + i + '"><b>' + attachment.name + '</b>&nbsp;&nbsp;&nbsp;(' + number_format(Math.ceil(attachment.size / 1024)) + 'KB, ' + attachment.type + ')</div>');
  });
  send_resize_message();
  $('div.attachment').click(prevent(doubleclick(), function(self) {
    var attachment = ready_attachmments[$(self).attr('index')];
    download_file(attachment.name, attachment.type, str_to_uint8(attachment.data));
  }));
}

function decide_decrypted_content_formatting_and_render(decrypted_content) {
  if(!is_mime_message(decrypted_content)) {
    render_content(format_plaintext(decrypted_content));
  } else {
    $('#pgp_block').text('Formatting...');
    parse_mime_message(decrypted_content, function(success, result) {
      if(success) {
        if(result.text) {
          render_content(format_plaintext(result.text));
        } else {
          render_content(format_plaintext(result.html));
        }
        if(result.attachments.length) {
          render_inner_attachments(result.attachments);
        }
      } else {
        // var result will contain the error message, once implemented error handling in parse_mime_message
        render_content(format_plaintext(decrypted_content));
      }
    });
  }
}

function decrypt_and_render(option_key, option_value, wrong_password_callback) {
  try {
    var options = {
      message: openpgp.message.readArmored(url_params.message),
      format: 'utf8',
    }
    if(option_key !== 'password') {
      options[option_key] = option_value;
    } else {
      options[option_key] = challenge_answer_hash(option_value);
    }
    openpgp.decrypt(options).then(function(plaintext) {
      decide_decrypted_content_formatting_and_render(plaintext.data);
    }).catch(function(error) {
      if(String(error) === "Error: Error decrypting message: Cannot read property 'isDecrypted' of null" && option_key === 'privateKey') { // wrong private key
        handle_private_key_mismatch(url_params.account_email, message);
      } else if(String(error) === 'Error: Error decrypting message: Invalid enum value.' && option_key === 'password') { // wrong password
        wrong_password_callback();
      } else {
        render_error(l.cant_open + '<em>' + String(error) + '</em>');
      }
    });
  } catch(err) {
    console.log('ee');
    render_error(l.cant_open + l.bad_format + '\n\n' + '<em>' + err.message + '</em>');
  }
}

function render_password_prompt() {
  render_content('<p>' + l.question_decryt_prompt + '"' + url_params.question + '" </p><p><input id="answer" placeholder="Answer"></p><p><div class="button green long decrypt">decrypt message</div></p>' + armored_message_as_html());
  $('.button.decrypt').click(prevent(doubleclick(), function(self) {
    $(self).html('Opening');
    setTimeout(function() {
      decrypt_and_render('password', $('#answer').val(), function() {
        alert('Incorrect answer, please try again');
        render_password_prompt();
      });
    }, 50);
  }));
}

function pgp_block_init() {
  if(!url_params.question) {
    var my_prvkey_armored = restricted_account_storage_get(url_params.account_email, 'master_private_key');
    var my_passphrase = restricted_account_storage_get(url_params.account_email, 'master_passphrase');
    if(typeof my_prvkey_armored !== 'undefined') {
      var private_key = openpgp.key.readArmored(my_prvkey_armored).keys[0];
      if(typeof my_passphrase !== 'undefined' && my_passphrase !== '') {
        private_key.decrypt(my_passphrase);
      }
      decrypt_and_render('privateKey', private_key);
    } else {
      render_error(l.cant_open + l.no_private_key);
    }
  } else {
    render_password_prompt();
  }
}

function pull_message_from_gmail_api(then) {
  gmail_api_message_get(url_params.account_email, url_params.message_id, 'full', function(m_success, gmail_message_object) {
    if(m_success) {
      // todo - handle encrypted message in body itself instead of as attachment
      var attachments = gmail_api_find_attachments(gmail_message_object);
      var found = false;
      $.each(attachments, function(i, attachment_meta) {
        if(attachment_meta.name === 'encrypted.asc') {
          found = true;
          gmail_api_fetch_attachments(url_params.account_email, [attachment_meta], function(a_success, attachment) {
            if(a_success) {
              var armored_message = base64url_decode(attachment[0].data);
              var matches = null;
              var re_pgp_block = /-----BEGIN PGP MESSAGE-----(.|[\r?\n])+?-----END PGP MESSAGE-----/m;
              if((matches = re_pgp_block.exec(armored_message)) !== null) {
                then(matches[0]);
              } else {
                render_error(l.cant_open + l.dont_know_how_open, armored_message);
              }
            } else {
              render_error(l.connection_error);
            }
          });
          return false;
        }
      });
      if(!found) {
        render_error(l.cant_open + l.dont_know_how_open, as_html_formatted_string(gmail_message_object.payload));
      }
    } else {
      render_error(l.connection_error);
    }
  });
}

function is_mime_message(message) {
  var m = message.toLowerCase();
  return m.indexOf('content-type:') !== -1 && m.indexOf('boundary=') !== -1 && m.indexOf('content-transfer-encoding:') !== -1;
}


if(url_params.message) { // ascii armored message supplied
  $('#pgp_block').text('Decrypting...');
  pgp_block_init();
} else { // need to fetch the message from gmail api
  $('#pgp_block').text('Retrieving message...');
  pull_message_from_gmail_api(function(message_raw) {
    $('#pgp_block').text('Decrypting...');
    url_params.message = message_raw;
    pgp_block_init();
  });
}
