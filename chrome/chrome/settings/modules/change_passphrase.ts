/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  tool.ui.passphrase_toggle(['original_password', 'password', 'password2']);

  let private_keys = await Store.keys_get(account_email);
  if(private_keys.length > 1) {
    $('#step_0_enter .sentence').text('Enter the current passphrase for your primary key');
    $('#step_0_enter #original_password').attr('placeholder', 'Current primary key pass phrase');
    $('#step_1_password #password').attr('placeholder', 'Enter a new primary key pass phrase');
  }

  let [primary_ki] = await Store.keys_get(account_email, ['primary']);
  Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);

  let original_passphrase = await Store.passphrase_get(account_email, primary_ki.longid);

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
    for(let block of blocks) {
      $('#' + block).css('display', 'none');
    }
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
    Settings.render_password_strength('#step_1_password', '#password', '.action_password');
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
    Settings.render_password_strength('#step_1_password', '#password', '.action_password');
    $('#password').focus();
  });

  $('.action_change').click(tool.ui.event.prevent(tool.ui.event.double(), async self => {
    let new_passphrase = $('#password').val() as string; // text input
    if(new_passphrase !== $('#password2').val()) {
      alert('The two pass phrases do not match, please try again.');
      $('#password2').val('');
      $('#password2').focus();
    } else {
      let prv = openpgp.key.readArmored(primary_ki.private).keys[0];
      tool.crypto.key.decrypt(prv, original_passphrase!); // !null because we checked for this above, and user entry cannot be null
      Settings.openpgp_key_encrypt(prv, new_passphrase);
      let stored_passphrase = await Store.passphrase_get(account_email, primary_ki.longid, true);
      await Store.keys_add(account_email, prv.armor());
      await Store.passphrase_save('local', account_email, primary_ki.longid, stored_passphrase !== null ? new_passphrase : undefined);
      await Store.passphrase_save('session', account_email, primary_ki.longid, stored_passphrase !== null ? undefined : new_passphrase);
      let {setup_simple} = await Store.get_account(account_email, ['setup_simple']);
      if(setup_simple) {
        Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/backup.htm', '&action=passphrase_change_gmail_backup');
      } else {
        alert('Now that you changed your pass phrase, you should back up your key. New backup will be protected with new passphrase.');
        Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/backup.htm', '&action=options');
      }
    }
  }));

})();