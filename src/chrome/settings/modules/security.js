var url_params = get_url_params(['account_email', 'embedded', 'parent_tab_id']);
url_params.embedded = Boolean(Number(url_params.embedded));

if(url_params.embedded) {
  $('.change_passhrase_container').css('display', 'none');
}

if(!private_storage_get('local', url_params.account_email, 'master_passphrase')) {
  $('#passphrase_to_open_email').prop('checked', true);
}

$('.action_change_passphrase').click(function() {
  show_settings_page('/chrome/settings/modules/change_passphrase.htm');
});

$('.action_test_passphrase').click(function() {
  show_settings_page('/chrome/settings/modules/test_passphrase.htm');
});

$('.confirm_passphrase_requirement_change').click(function() {
  if($('#passphrase_to_open_email').is(':checked')) { // forget pass all phrases
    if($('input#passphrase_entry').val() === get_passphrase(url_params.account_email)) {
      private_storage_set('local', url_params.account_email, 'master_passphrase', '');
      private_storage_set('session', url_params.account_email, 'master_passphrase', '');
      window.location.reload();
    } else {
      alert('Pass phrase did not match, please try again.');
      $('input#passphrase_entry').val('').focus();
    }
  } else { // save pass phrase
    var key = openpgp.key.readArmored(private_storage_get('local', url_params.account_email, 'master_private_key')).keys[0];
    if(key.decrypt($('input#passphrase_entry').val()) === true) {
      private_storage_set('local', url_params.account_email, 'master_passphrase', $('input#passphrase_entry').val());
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
