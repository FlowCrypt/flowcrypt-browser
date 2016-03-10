'use strict';

var url_params = get_url_params(['account_email', 'frame_id', 'message', 'width', 'parent_tab_id']);

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

function set_frame_content_and_resize(content) {
  $('#pgp_block').html(content);
  $('#pgp_block').css({
    height: 'auto'
  });
  setTimeout(function() {
    $(window).resize(prevent(spree(), send_resize_message));
  }, 1000);
  send_resize_message();
}


var my_prvkey = restricted_account_storage_get(url_params['account_email'], 'master_private_key');
var my_passphrase = restricted_account_storage_get(url_params['account_email'], 'master_passphrase');
if(typeof my_prvkey !== 'undefined') {
  var private_key = openpgp.key.readArmored(my_prvkey).keys[0];
  if(typeof my_passphrase !== 'undefined' && my_passphrase !== '') {
    private_key.decrypt(my_passphrase);
  }
  try {
    var options = {
      message: openpgp.message.readArmored(url_params['message']),
      privateKey: private_key, // for decryption
      format: 'utf8',
    };
    openpgp.decrypt(options).then(function(plaintext) {
      set_frame_content_and_resize(format_plaintext(plaintext.data));
    }).catch(function(error) {
      set_frame_content_and_resize('<div style="color:red">[error decrypting message, possibly wrong private key]</div><br>' + url_params['message'].replace(/\n/g, '<br>'));
    });
  } catch(err) {
    set_frame_content_and_resize('<div style="color:red">[badly formatted or unknown type of message, error detail: "' + err.message + '"]</div><br>' + url_params['message'].replace(/\n/g, '<br>'));
  }
} else {
  set_frame_content_and_resize('<div style="color:red">[no private key set yet to decrypt this message]</div><br>' + url_params['message'].replace(/\n/g, '<br>'));
}
