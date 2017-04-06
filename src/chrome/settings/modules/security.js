/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

var url_params = tool.env.url_params(['account_email', 'embedded', 'parent_tab_id']);

tool.ui.passphrase_toggle(['passphrase_entry']);

if(url_params.embedded) {
  $('.change_passhrase_container').css('display', 'none');
}

if(!private_storage_get('local', url_params.account_email, 'master_passphrase')) {
  $('#passphrase_to_open_email').prop('checked', true);
}

$('.action_change_passphrase').click(function () {
  show_settings_page('/chrome/settings/modules/change_passphrase.htm');
});

$('.action_test_passphrase').click(function () {
  show_settings_page('/chrome/settings/modules/test_passphrase.htm');
});

$('.confirm_passphrase_requirement_change').click(function () {
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
    if(tool.crypto.key.decrypt(key, $('input#passphrase_entry').val()) === true) {
      private_storage_set('local', url_params.account_email, 'master_passphrase', $('input#passphrase_entry').val());
      window.location.reload();
    } else {
      alert('Pass phrase did not match, please try again.');
      $('input#passphrase_entry').val('').focus();
    }
  }
});

$('.cancel_passphrase_requirement_change').click(function () {
  window.location.reload();
});

$('#passphrase_to_open_email').change(function () {
  $('.passhprase_checkbox_container').css('display', 'none');
  $('.passphrase_entry_container').css('display', 'block');
});

account_storage_get(url_params.account_email, ['hide_message_password'], function(storage) {
  $('#hide_message_password').prop('checked', storage.hide_message_password === true);
  $('#hide_message_password').change(function () {
    account_storage_set(url_params.account_email, {hide_message_password: $(this).is(':checked')}, function () {
      window.location.reload();
    });
  });
});
