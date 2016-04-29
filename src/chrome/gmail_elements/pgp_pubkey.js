'use strict';

var url_params = get_url_params(['account_email', 'armored_pubkey', 'parent_tab_id', 'frame_id']);

var pubkey = openpgp.key.readArmored(url_params.armored_pubkey).keys[0];

var cache = pubkey_cache_retrieve();

$('.pubkey').text(url_params.armored_pubkey);

if(typeof pubkey !== 'undefined') {
  $('.input_email').val(trim_lower(pubkey.users[0].userId.userid));
  set_button_text();
} else {
  $('.add_pubkey').replaceWith('<div style="color: red;">This public key is invalid or has unknown format.</div>');
  send_resize_message();
}

$('.add_pubkey').click(prevent(doubleclick(), function(self) {
  if(is_email_valid($('.input_email').val())) {
    pubkey_cache_add($('.input_email').val(), pubkey.armor());
    $(self).replaceWith('<b style="color: green;">' + $('.input_email').val() +' added</b>')
    $('.input_email').remove();
  } else {
    alert('This email is invalid, please check for typos. Not added.');
    $('.input_email').focus();
  }
}));

function send_resize_message() {
  chrome_message_send(url_params.parent_tab_id, 'pgp_block_iframe_set_css', {
    frame_id: url_params.frame_id,
    css: {
      height: $('#pgp_block').height() + 30
    }
  });
}

function set_button_text() {
  if(Object.keys(cache).indexOf($('.input_email').val()) === -1) {
    $('.add_pubkey').text('add to contacts');
  } else {
    $('.add_pubkey').text('update contact');
  }
}

$('.input_email').keyup(set_button_text);

send_resize_message();
