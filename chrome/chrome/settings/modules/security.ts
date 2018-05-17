/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'embedded', 'parent_tab_id']);

  tool.ui.passphrase_toggle(['passphrase_entry']);

  Store.keys_get(url_params.account_email as string, ['primary']).then(([primary_ki]) => {

    if(url_params.embedded) {
      $('.change_passhrase_container, .title_container').css('display', 'none');
      $('.line').css('padding', '7px 0');
    }

    Store.subscription().then(subscription => {
      if(subscription.active) {
        $('.select_loader_container').html(tool.ui.spinner('green'));
        tool.api.cryptup.account_update().then(response => {
          $('.select_loader_container').html('');
          $('.default_message_expire').val(Number(response.result.default_message_expire).toString()).prop('disabled', false).css('display', 'inline-block');
          $('.default_message_expire').change(function () {
            $('.select_loader_container').html(tool.ui.spinner('green'));
            $('.default_message_expire').css('display', 'none');
            tool.api.cryptup.account_update({default_message_expire: Number($('.default_message_expire').val())}).resolved(() => window.location.reload());
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

    if(primary_ki !== null) { // not set up yet
      Store.passphrase_get(url_params.account_email as string, primary_ki.longid, true).then(stored_passphrase => {
        if(stored_passphrase === null) {
          $('#passphrase_to_open_email').prop('checked', true);
        }
        $('#passphrase_to_open_email').change(function () {
          $('.passhprase_checkbox_container').css('display', 'none');
          $('.passphrase_entry_container').css('display', 'block');
        });
      });
    }

    $('.action_change_passphrase').click(function () {
      show_settings_page('/chrome/settings/modules/change_passphrase.htm');
    });

    $('.action_test_passphrase').click(function () {
      show_settings_page('/chrome/settings/modules/test_passphrase.htm');
    });

    $('.confirm_passphrase_requirement_change').click(function () {
      if($('#passphrase_to_open_email').is(':checked')) { // todo - forget pass all phrases, not just master
        Store.passphrase_get(url_params.account_email as string, primary_ki.longid).then(stored_passphrase => {
          if($('input#passphrase_entry').val() === stored_passphrase) {
            Promise.all([
              Store.passphrase_save('local', url_params.account_email as string, primary_ki.longid, undefined),
              Store.passphrase_save('session', url_params.account_email as string, primary_ki.longid, undefined),
            ]).then(() => window.location.reload());
          } else {
            alert('Pass phrase did not match, please try again.');
            $('input#passphrase_entry').val('').focus();
          }
        });
      } else { // save pass phrase
        var key = openpgp.key.readArmored(primary_ki.private).keys[0];
        if(tool.crypto.key.decrypt(key, $('input#passphrase_entry').val() as string).success) { // text input
          Store.passphrase_save('local', url_params.account_email as string, primary_ki.longid, $('input#passphrase_entry').val() as string).then(() => window.location.reload()); // text input
        } else {
          alert('Pass phrase did not match, please try again.');
          $('input#passphrase_entry').val('').focus();
        }
      }
    });

    $('.cancel_passphrase_requirement_change').click(function () {
      window.location.reload();
    });

    Store.get(url_params.account_email as string, ['hide_message_password']).then(storage => {
      $('#hide_message_password').prop('checked', storage.hide_message_password === true);
      $('#hide_message_password').change(function () {
        Store.set(url_params.account_email as string, {hide_message_password: $(this).is(':checked')}).then(() => window.location.reload());
      });
    });

  });

})();