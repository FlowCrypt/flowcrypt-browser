/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

let url_params = tool.env.url_params(['account_email']);

if(window.flowcrypt_storage.keys_get(url_params.account_email).length > 1) {
  $('#step_0_enter .sentence').text('Enter the current passphrase for your primary key');
  $('#step_0_enter #original_password').attr('placeholder', 'Current primary key pass phrase');
  $('#step_1_password #password').attr('placeholder', 'Enter a new primary key pass phrase');
}

tool.ui.passphrase_toggle(['original_password', 'password', 'password2']);

window.flowcrypt_storage.passphrase_get(url_params.account_email).then(original_passphrase => {

  if(original_passphrase === null) {
    display_block('step_0_enter');
  } else {
    if(original_passphrase === '') {
      $('h1').text('Set a pass phrase');
    } else {
      $('h1').text('Change your pass phrase');
    }
    display_block('step_1_password');
  }

  function display_block(name) {
    let blocks = ['step_0_enter', 'step_1_password', 'step_2_confirm', 'step_3_done'];
    tool.each(blocks, function (i, block) {
      $('#' + block).css('display', 'none');
    });
    $('#' + name).css('display', 'block');
  }

  $('.action_enter').click(function () {
    let key = openpgp.key.readArmored(window.flowcrypt_storage.keys_get(url_params.account_email, 'primary').private).keys[0];
    if(tool.crypto.key.decrypt(key, $('#original_password').val()).success) {
      original_passphrase = $('#original_password').val();
      display_block('step_1_password');
    } else {
      alert('Pass phrase did not match, please try again.');
      $('#original_password').val('').focus();
    }
  });

  $('#password').on('keyup', tool.ui.event.prevent(tool.ui.event.spree(), function () {
    evaluate_password_strength('#step_1_password', '#password', '.action_password');
  }));

  $('.action_password').click(function () {
    if($(this).hasClass('green')) {
      display_block('step_2_confirm');
    } else {
      alert('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
    }
  });

  $('.action_reset_password').click(function () {
    $('#password').val('');
    $('#password2').val('');
    display_block('step_1_password');
    evaluate_password_strength('#step_1_password', '#password', '.action_password');
    $('#password').focus();
  });

  $('.action_change').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
    let new_passphrase = $('#password').val();
    if(new_passphrase !== $('#password2').val()) {
      alert('The two pass phrases do not match, please try again.');
      $('#password2').val('');
      $('#password2').focus();
    } else {
      let prv = openpgp.key.readArmored(window.flowcrypt_storage.keys_get(url_params.account_email, 'primary').private).keys[0];
      tool.crypto.key.decrypt(prv, original_passphrase);
      openpgp_key_encrypt(prv, new_passphrase);
      let stored_passphrase = window.flowcrypt_storage.legacy_storage_get('local', url_params.account_email, 'master_passphrase');
      if(typeof stored_passphrase !== 'undefined' && stored_passphrase !== '') {
        window.flowcrypt_storage.legacy_storage_set('local', url_params.account_email, 'master_passphrase', new_passphrase);
        window.flowcrypt_storage.legacy_storage_set('session', url_params.account_email, 'master_passphrase', undefined);
      } else {
        window.flowcrypt_storage.legacy_storage_set('local', url_params.account_email, 'master_passphrase', undefined);
        window.flowcrypt_storage.legacy_storage_set('session', url_params.account_email, 'master_passphrase', new_passphrase);
      }
      window.flowcrypt_storage.legacy_storage_set('local', url_params.account_email, 'master_passphrase_needed', true);
      window.flowcrypt_storage.keys_add(url_params.account_email, prv.armor(), true);
      // pass phrase change done in the plugin itself.
      // For it to have a real effect though, a new backup containing the new pass phrase needs to be created.
      window.flowcrypt_storage.get(url_params.account_email, ['setup_simple'], storage => {
        if(storage.setup_simple) {
          show_settings_page('/chrome/settings/modules/backup.htm', '&action=passphrase_change_gmail_backup');
        } else {
          alert('Now that you changed your pass phrase, you should back up your key. New backup will be protected with new passphrase.');
          show_settings_page('/chrome/settings/modules/backup.htm', '&action=options');
        }
      });
    }
  }));

});