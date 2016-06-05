var url_params = get_url_params(['account_email', 'embedded']);
url_params.embedded = Boolean(Number(url_params.embedded));

if(url_params.embedded) {
  $('.change_passhrase_container').css('display', 'none');
}

if(!private_storage_get(localStorage, url_params.account_email, 'master_passphrase')) {
  $('#passphrase_to_open_email').prop('checked', true);
}

$('.action_change_passphrase').click(function() {
  window.location = 'change_passphrase.htm?account_email=' + encodeURIComponent(url_params.account_email);
});

$('.confirm_passphrase_requirement_change').click(function() {
  if($('#passphrase_to_open_email').is(':checked')) { // forget passphrase
    if($('input#passphrase_entry').val() === get_passphrase(url_params.account_email)) {
      private_storage_set(localStorage, url_params.account_email, 'master_passphrase', '');
      private_storage_set(sessionStorage, url_params.account_email, 'master_passphrase', '');
      window.location.reload();
    } else {
      alert('Pass phrase did not match, please try again.');
      $('input#passphrase_entry').val('').focus();
    }
  } else { // save passhprase
    var key = openpgp.key.readArmored(private_storage_get(localStorage, url_params.account_email, 'master_private_key')).keys[0];
    if(key.decrypt($('input#passphrase_entry').val()) === true) {
      private_storage_set(localStorage, url_params.account_email, 'master_passphrase', $('input#passphrase_entry').val());
      window.location.reload();
    } else {
      alert('Pass phrase did not match, please try again.');
      $('input#passphrase_entry').val('').focus();
    }
  }
});

$('.cancel_passphrase_requirement_change').click(function() {
  window.location.reload();
});

$('#passphrase_to_open_email').change(function() {
  $('.passhprase_checkbox_container').css('display', 'none');
  $('.passphrase_entry_container').css('display', 'block');
});
