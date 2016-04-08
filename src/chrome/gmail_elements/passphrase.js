'use strict';

var url_params = get_url_params(['account_email', 'parent_tab_id', 'type']);

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
  var prv = openpgp.key.readArmored(private_storage_get(localStorage, url_params.account_email, 'master_private_key')).keys[0];
  var pass = $('input.passphrase').val();
  if(prv.decrypt(pass) === true) {
    if($('.forget').prop('checked')) {
      private_storage_set(sessionStorage, url_params.account_email, 'master_passphrase', pass);
    } else {
      private_storage_set(localStorage, url_params.account_email, 'master_passphrase', pass);
    }
    chrome_message_send(url_params.parent_tab_id, 'close_dialog');
  } else {
    render_error();
    setTimeout(render_normal, 1500);
  }
}));

$('input.passphrase').keyup(render_normal);
