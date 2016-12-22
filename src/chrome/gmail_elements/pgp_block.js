'use strict';

var GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

var url_params = get_url_params(['account_email', 'frame_id', 'message', 'question', 'parent_tab_id', 'message_id', 'is_outgoing']);
url_params.is_outgoing = Boolean(Number(url_params.is_outgoing || ''));

var ready_attachmments = [];
var height_history = [];

var passphrase_interval = undefined;

increment_metric('view');

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
  enter_passphrase: 'Enter passphrase',
  to_open_message: 'to open this message.',
}

function send_resize_message() {
  var new_height = $('#pgp_block').height() + 40;

  function is_infinite_resize_loop() {
    height_history.push(new_height);
    var len = height_history.length;
    if(len < 4) {
      return false;
    }
    if(height_history[len - 1] === height_history[len - 3] && height_history[len - 2] === height_history[len - 4] && height_history[len - 1] !== height_history[len - 2]) {
      console.log('pgp_block.js: repetitive resize loop prevented'); //got repetitive, eg [70, 80, 200, 250, 200, 250]
      new_height = Math.max(height_history[len - 1], height_history[len - 2]);
    }
  }

  if(!is_infinite_resize_loop()) {
    chrome_message_send(url_params.parent_tab_id, 'set_css', {
      selector: 'iframe#' + url_params.frame_id,
      css: {
        height: new_height,
      }
    });
  }
}

function render_content(content, is_error, callback) {
  account_storage_get(url_params.account_email, ['successfully_received_at_leat_one_message'], function(storage) {
    if(!is_error && !url_params.is_outgoing) { //successfully opened incoming message
      account_storage_set(url_params.account_email, {
        successfully_received_at_leat_one_message: true
      });
    }
    $('#pgp_block').html(content);
    if(callback) {
      callback();
    }
    setTimeout(function() {
      $(window).resize(prevent(spree(), send_resize_message));
    }, 1000);
    send_resize_message();
  });
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

function render_error(error_box_content, raw_message_substitute, callback) {
  $('body').removeClass('pgp_secure').addClass('pgp_insecure');
  render_content('<div class="error">' + error_box_content.replace(/\n/g, '<br>') + '</div>' + armored_message_as_html(raw_message_substitute), true, function() {
    $('.settings.button').click(function() {
      chrome_message_send(null, 'settings', {
        account_email: url_params.account_email,
        page: '/chrome/settings/modules/keyserver.htm',
      });
    });
    if(callback) {
      callback();
    }
  });
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
    render_content(format_mime_plaintext_to_display(decrypted_content, url_params.message));
  } else {
    $('#pgp_block').text('Formatting...');
    parse_mime_message(decrypted_content, function(success, result) {
      if(success) {
        if(result.text || result.html) {
          render_content(format_mime_plaintext_to_display(result.text || result.html, url_params.message), false, function() {
            if(result.attachments.length) {
              render_inner_attachments(result.attachments);
            }
          });
        } else {
          // this will probably show ugly MIME text to user, which would later be reported by them as a bug
          // with each report we can extend the capabilities to recognize content of MIME messages
          render_content(format_mime_plaintext_to_display(decrypted_content, url_params.message));
        }
      } else {
        // var "result" will contain the error message, once implemented error handling in parse_mime_message
        render_content(format_mime_plaintext_to_display(decrypted_content, url_params.message));
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
      $('body').removeClass('pgp_insecure').addClass('pgp_secure');
      decide_decrypted_content_formatting_and_render(plaintext.data);
    }).catch(function(error) {
      if(String(error) === "Error: Error decrypting message: Cannot read property 'isDecrypted' of null" && option_key === 'privateKey') { // wrong private key
        handle_private_key_mismatch(url_params.account_email, options.message);
      } else if(String(error) === 'Error: Error decrypting message: Invalid session key for decryption.' && option_key === 'privateKey') { // attempted opening password only message with key
        if(url_params.question) {
          render_password_prompt();
        } else {
          handle_private_key_mismatch(url_params.account_email, options.message);
        }
      } else if(String(error) === 'Error: Error decrypting message: Invalid enum value.' && option_key === 'password') { // wrong password
        wrong_password_callback();
      } else {
        render_error(l.cant_open + '<em>' + String(error) + '</em>');
      }
    });
  } catch(err) {
    render_error(l.cant_open + l.bad_format + '\n\n' + '<em>' + err.message + '</em>');
  }
}

function render_password_prompt() {
  var prompt = '<p>' + l.question_decryt_prompt + '"' + url_params.question + '" </p>';
  prompt += '<p><input id="answer" placeholder="Answer"></p><p><div class="button green long decrypt">decrypt message</div></p>';
  prompt += armored_message_as_html();
  render_content(prompt, true, function() {
    $('.button.decrypt').click(prevent(doubleclick(), function(self) {
      $(self).html('Opening');
      setTimeout(function() {
        decrypt_and_render('password', $('#answer').val(), function() {
          alert('Incorrect answer, please try again');
          render_password_prompt();
        });
      }, 50);
    }));
  });
}

function check_passphrase_entered() {
  if(get_passphrase(url_params.account_email) !== null) {
    clearInterval(passphrase_interval);
    pgp_block_init();
  }
}

function pgp_block_init() {
  var my_prvkey_armored = private_storage_get('local', url_params.account_email, 'master_private_key', url_params.parent_tab_id);
  var my_passphrase = get_passphrase(url_params.account_email);
  if(my_passphrase !== null) {
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
    render_error('<a href="#" class="enter_passphrase">' + l.enter_passphrase + '</a> ' + l.to_open_message, undefined, function() {
      clearInterval(passphrase_interval);
      passphrase_interval = setInterval(check_passphrase_entered, 1000);
      $('.enter_passphrase').click(prevent(doubleclick(), function() {
        chrome_message_send(url_params.parent_tab_id, 'passphrase_dialog', {
          type: 'message',
        });
        clearInterval(passphrase_interval);
        passphrase_interval = setInterval(check_passphrase_entered, 250);
      }));
    });
  }
}

if(url_params.message) { // ascii armored message supplied
  $('#pgp_block').text('Decrypting...');
  pgp_block_init();
} else { // need to fetch the message from gmail api
  account_storage_get(url_params.account_email, ['google_token_scopes'], function(storage) {
    if(typeof storage.google_token_scopes !== 'undefined' && storage.google_token_scopes.indexOf(GMAIL_READ_SCOPE) !== -1) {
      $('#pgp_block').text('Retrieving message...');
      extract_armored_message_using_gmail_api(url_params.account_email, url_params.message_id, function(message_raw) {
        $('#pgp_block').text('Decrypting...');
        url_params.message = message_raw;
        pgp_block_init();
      }, function(error_type, url_formatted_data_block) {
        if(error_type === 'format') {
          render_error(l.cant_open + l.dont_know_how_open, url_formatted_data_block);
        } else if(error_type === 'connection') {
          render_error(l.connection_error, url_formatted_data_block);
        } else {
          alert('Unknown error type: ' + error_type);
        }
      });
    } else { // gmail message read auth not allowed
      $('#pgp_block').html('This encrypted message is very large (possibly containing an attachment). Your browser needs to access gmail it in order to decrypt and display the message.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div>');
      $('.auth_settings').click(function() {
        chrome_message_send(null, 'settings', {
          account_email: url_params.account_email,
          page: '/chrome/settings/modules/auth_denied.htm',
        });
      });
    }
  });

}
