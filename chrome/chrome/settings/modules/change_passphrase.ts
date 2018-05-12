/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email']);

  tool.ui.passphrase_toggle(['original_password', 'password', 'password2']);

  (window as FlowCryptWindow).flowcrypt_storage.keys_get(url_params.account_email as string).then((private_keys: KeyInfo[]) => {
    if(private_keys.length > 1) {
      $('#step_0_enter .sentence').text('Enter the current passphrase for your primary key');
      $('#step_0_enter #original_password').attr('placeholder', 'Current primary key pass phrase');
      $('#step_1_password #password').attr('placeholder', 'Enter a new primary key pass phrase');
    }
  });

  (window as FlowCryptWindow).flowcrypt_storage.keys_get(url_params.account_email as string, 'primary').then((primary_ki: KeyInfo) => {
    if(primary_ki === null) {
      return $('body').text('Key not found. Is FlowCrypt well set up? Contact us at human@flowcrypt.com for help.');
    }
    (window as FlowCryptWindow).flowcrypt_storage.passphrase_get(url_params.account_email as string, primary_ki.longid).then(original_passphrase => {

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

      function display_block(name: string) {
        let blocks = ['step_0_enter', 'step_1_password', 'step_2_confirm', 'step_3_done'];
        tool.each(blocks, function (i, block) {
          $('#' + block).css('display', 'none');
        });
        $('#' + name).css('display', 'block');
      }

      $('.action_enter').click(function () {
        let key = openpgp.key.readArmored(primary_ki.private).keys[0];
        if(tool.crypto.key.decrypt(key, $('#original_password').val() as string).success) { // text input
          original_passphrase = $('#original_password').val() as string; // text input
          display_block('step_1_password');
        } else {
          alert('Pass phrase did not match, please try again.');
          $('#original_password').val('').focus();
        }
      });

      $('#password').on('keyup', tool.ui.event.prevent(tool.ui.event.spree(), function () {
        render_password_strength('#step_1_password', '#password', '.action_password');
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
        render_password_strength('#step_1_password', '#password', '.action_password');
        $('#password').focus();
      });

      $('.action_change').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        let new_passphrase = $('#password').val() as string; // text input
        if(new_passphrase !== $('#password2').val()) {
          alert('The two pass phrases do not match, please try again.');
          $('#password2').val('');
          $('#password2').focus();
        } else {
          let prv = openpgp.key.readArmored(primary_ki.private).keys[0];
          // @ts-ignore - todo - check this
          tool.crypto.key.decrypt(prv, original_passphrase);
          openpgp_key_encrypt(prv, new_passphrase);
          (window as FlowCryptWindow).flowcrypt_storage.passphrase_get(url_params.account_email as string, primary_ki.longid, true).then(stored_passphrase => {
            Promise.all([
              (window as FlowCryptWindow).flowcrypt_storage.keys_add(url_params.account_email as string, prv.armor()),
              (window as FlowCryptWindow).flowcrypt_storage.passphrase_save('local', url_params.account_email as string, primary_ki.longid, stored_passphrase !== null ? new_passphrase : undefined),
              (window as FlowCryptWindow).flowcrypt_storage.passphrase_save('session', url_params.account_email as string, primary_ki.longid, stored_passphrase !== null ? undefined : new_passphrase),
            ]).then(() => { // Pass phrase change done in the extension storage. A new backup should be created (protected by updated pass phrase).
              (window as FlowCryptWindow).flowcrypt_storage.get(url_params.account_email as string, ['setup_simple'], storage => {
                if(storage.setup_simple) {
                  show_settings_page('/chrome/settings/modules/backup.htm', '&action=passphrase_change_gmail_backup');
                } else {
                  alert('Now that you changed your pass phrase, you should back up your key. New backup will be protected with new passphrase.');
                  show_settings_page('/chrome/settings/modules/backup.htm', '&action=options');
                }
              });
            });
          });
        }
      }));

    });
  });

})();