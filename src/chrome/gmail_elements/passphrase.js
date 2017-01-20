'use strict';

var url_params = get_url_params(['account_email', 'parent_tab_id', 'longids', 'type']);

add_show_hide_passphrase_toggle(['passphrase']);

var all_private_keys = private_keys_get(url_params.account_email);

if(url_params.longids) {
  var private_keys = private_keys_get(url_params.account_email, url_params.longids.split(','));
} else {
  var private_keys = all_private_keys;
}

if(all_private_keys.length > 1) {
  if(private_keys.length === 1) {
    var html = 'For the following key: <span class="good">' + mnemonic(private_keys[0].longid) + '</span> (KeyWords)';
  } else {
    var html = 'Pass phrase needed for any of the following keys:';
    $.each(private_keys, function(i, keyinfo) {
      html += 'KeyWords ' + String(i + 1) + ': <div class="good">' + mnemonic(private_keys[i].longid) + '</div>';
    });
  }
  $('.which_key').html(html);
  $('.which_key').css('display', 'block');
}

function render_error() {
  $('input.passphrase').val('');
  $('input.passphrase').css('border-color', 'red');
  $('input.passphrase').css('color', 'red');
  $('input.passphrase').attr('placeholder', 'Please try again');
}

function render_normal() {
  $('input.passphrase').css('border-color', 'gray');
  $('input.passphrase').css('color', 'black');
  $('input.passphrase').focus();
}

$('.action_close').click(prevent(doubleclick(), function() {
  chrome_message_send(url_params.parent_tab_id, 'close_dialog');
}));

$('.action_ok').click(prevent(doubleclick(), function() {
  var pass = $('input.passphrase').val();
  var is_correct = false;
  $.each(private_keys, function(i, keyinfo) { // if passphrase matches more keys, it will save them all
    var prv = openpgp.key.readArmored(keyinfo.armored).keys[0];
    if(decrypt_key(prv, pass) === true) {
      is_correct = true;
      if($('.forget').prop('checked')) {
        save_passphrase('session', url_params.account_email, keyinfo.longid, pass);
      } else {
        save_passphrase('local', url_params.account_email, keyinfo.longid, pass);
      }
      chrome_message_send(url_params.parent_tab_id, 'close_dialog');
    }
  });
  if(!is_correct) {
    render_error();
    setTimeout(render_normal, 1500);
  }
}));

$('input.passphrase').keyup(render_normal);
