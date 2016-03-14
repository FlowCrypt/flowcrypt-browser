'use strict';

var url_params = get_url_params(['account_email', 'frame_id', 'message', 'width', 'parent_tab_id']);

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
  // $('#pgp_block').css({
  //   height: 'auto'
  // });
  setTimeout(function() {
    $(window).resize(prevent(spree(), send_resize_message));
  }, 1000);
  send_resize_message();
}

function diagnose_pubkeys_button(text, color) {
  return '<br><div class="button settings long ' + color + '" style="margin:30px 0;" target="cryptup">' + text + '</div>';
}
//font-family: "Courier New"
function render_error(error_box_content) {
  $('body').removeClass('pgp_secure').addClass('pgp_insecure');
  render_content('<div class="error">' + error_box_content.replace(/\n/g, '<br>') + '</div><div class="raw_pgp_block">' + url_params.message.replace(/\n/g, '<br>') + '</div>');
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

var my_prvkey_armored = restricted_account_storage_get(url_params.account_email, 'master_private_key');
var my_passphrase = restricted_account_storage_get(url_params.account_email, 'master_passphrase');
if(typeof my_prvkey_armored !== 'undefined') {
  var private_key = openpgp.key.readArmored(my_prvkey_armored).keys[0];
  if(typeof my_passphrase !== 'undefined' && my_passphrase !== '') {
    private_key.decrypt(my_passphrase);
  }
  var message = openpgp.message.readArmored(url_params.message);
  try {
    var options = {
      message: message,
      privateKey: private_key,
      format: 'utf8',
    };
    openpgp.decrypt(options).then(function(plaintext) {
      render_content(format_plaintext(plaintext.data));
    }).catch(function(error) {
      if(String(error) === "Error: Error decrypting message: Cannot read property 'isDecrypted' of null") { // wrong private key
        handle_private_key_mismatch(url_params.account_email, message);
      } else {
        render_error(l.cant_open + '<em>' + String(error) + '</em>');
      }
    });
  } catch(err) {
    render_error(l.cant_open + l.bad_format + '\n\n' + '<em>' + err.message + '</em>');
  }
} else {
  render_error(l.cant_open + l.no_private_key);
}
