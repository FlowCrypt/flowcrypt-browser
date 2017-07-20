/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

var url_params = tool.env.url_params(['account_email', 'embedded', 'parent_tab_id']);

tool.ui.passphrase_toggle(['passphrase_entry']);

if(url_params.embedded) {
  $('.change_passhrase_container, .title_container').css('display', 'none');
  $('.line').css('padding', '7px 0');
}

window.flowcrypt_storage.subscription(function (level, expire, active, method) {
  if(active) {
    $('.select_loader_container').html(tool.ui.spinner('green'));
    tool.api.cryptup.account_update().then(response => {
      $('.select_loader_container').html('');
      $('.default_message_expire').val(Number(response.result.default_message_expire).toString()).prop('disabled', false).css('display', 'inline-block');
      $('.default_message_expire').change(function () {
        $('.select_loader_container').html(tool.ui.spinner('green'));
        $('.default_message_expire').css('display', 'none');
        tool.api.cryptup.account_update({default_message_expire: Number($('.default_message_expire').val())}).done(() => window.location.reload());
      });
    }, error => {
      if(error.internal === 'auth' && !url_params.embedded) {
        alert('Your account information is outdated. Please add this device to your account.');
        show_settings_page('/chrome/elements/subscribe.htm', '&source=auth_error');
      } else {
        $('.select_loader_container').html('');
        $('.default_message_expire').replaceWith('(unknown)');
      }
    }).catch(catcher.handle_exception);
  } else {
    $('.default_message_expire').val('3').css('display', 'inline-block');
    $('.default_message_expire').parent().append('<a href="#">upgrade</a>').find('a').click(function() {
      show_settings_page('/chrome/elements/subscribe.htm');
    });
  }
});

if(!window.flowcrypt_storage.restricted_get('local', url_params.account_email, 'master_passphrase')) {
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
    if($('input#passphrase_entry').val() === window.flowcrypt_storage.passphrase_get(url_params.account_email)) {
      window.flowcrypt_storage.restricted_set('local', url_params.account_email, 'master_passphrase', '');
      window.flowcrypt_storage.restricted_set('session', url_params.account_email, 'master_passphrase', '');
      window.location.reload();
    } else {
      alert('Pass phrase did not match, please try again.');
      $('input#passphrase_entry').val('').focus();
    }
  } else { // save pass phrase
    var key = openpgp.key.readArmored(window.flowcrypt_storage.keys_get(url_params.account_email, 'primary').private).keys[0];
    if(tool.crypto.key.decrypt(key, $('input#passphrase_entry').val()).success) {
      window.flowcrypt_storage.restricted_set('local', url_params.account_email, 'master_passphrase', $('input#passphrase_entry').val());
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

window.flowcrypt_storage.get(url_params.account_email, ['hide_message_password'], storage => {
  $('#hide_message_password').prop('checked', storage.hide_message_password === true);
  $('#hide_message_password').change(function () {
    window.flowcrypt_storage.set(url_params.account_email, {hide_message_password: $(this).is(':checked')}, function () {
      window.location.reload();
    });
  });
});
