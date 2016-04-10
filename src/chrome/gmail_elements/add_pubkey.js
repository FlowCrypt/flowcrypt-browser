'use strict';

var url_params = get_url_params(['account_email', 'parent_tab_id', 'emails']);

$.each(url_params.emails.split(','), function(i, email) {
  $('select.email').append('<option value="' + email + '">' + email + '</option>');
});

$('.action_ok').click(prevent(doubleclick(), function() {
  var pubkey = openpgp.key.readArmored(strip_pgp_armor($('.pubkey').val())).keys[0];
  if(typeof pubkey !== 'undefined') {
    pubkey_cache_add($('select.email').val(), pubkey.armor());
    close_dialog();
  } else {
    alert('Could not recognize the format, please try again.');
    $('.pubkey').val('').focus();
  }
}));

$('.action_settings').click(prevent(doubleclick(), function() {
  chrome_message_send(null, 'settings', {
    page: 'account.htm',
    account_email: url_params.account_email,
  });
}));

$('.action_close').click(prevent(doubleclick(), close_dialog));

function close_dialog() {
  chrome_message_send(url_params.parent_tab_id, 'close_dialog');
}
