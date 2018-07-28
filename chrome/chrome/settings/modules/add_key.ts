/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  await tool.ui.passphrase_toggle(['input_passphrase']);

  $('#spinner_container').html(tool.ui.spinner('green') + ' loading..');

  let keyinfos = await Store.keys_get(account_email);
  let private_keys_long_ids = keyinfos.map(ki => ki.longid);
  let key_backups;

  try {
    key_backups = await tool.api.gmail.fetch_key_backups(account_email);
    if (key_backups.length) {
      let not_imported_backup_longids: string[] = [];
      for (let longid of tool.arr.unique(key_backups.map(tool.crypto.key.longid))) {
        if (longid && !tool.value(longid).in(private_keys_long_ids)) {
          not_imported_backup_longids.push(longid);
        }
      }
      if (not_imported_backup_longids.length) {
        $('label[for=source_backup]').text('Load from backup (' + not_imported_backup_longids.length + ' new to import)');
      } else {
        $('label[for=source_backup]').text('Load from backup (already loaded)').css('color', '#AAA');
        $('#source_backup').prop('disabled', true);
      }
    } else {
      $('label[for=source_backup]').text('Load from backup (no backups found)').css('color', '#AAA');
      $('#source_backup').prop('disabled', true);
    }
  } catch (e) {
    if(tool.api.error.is_auth_popup_needed(e)) {
      tool.browser.message.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
    }
    $('label[for=source_backup]').text('Load from backup (error checking backups)').css('color', '#AAA');
    $('#source_backup').prop('disabled', true);
  }

  $('.source_selector').css('display', 'block');
  $('#spinner_container').text('');

  $('.action_add_private_key').click(tool.ui.event.prevent(tool.ui.event.double(), async () => {
    let prv_headers = tool.crypto.armor.headers('private_key');
    let normalized_armored_key = tool.crypto.key.normalize($('.input_private_key').val() as string); // textarea
    if (!normalized_armored_key) {
      alert('There was an error processing this key, possibly due to bad formatting.\nPlease insert complete key, including "' + prv_headers.begin + '" and "' + prv_headers.end + '"');
    } else {
      let new_key = openpgp.key.readArmored(normalized_armored_key).keys[0];
      let passphrase = $('.input_passphrase').val() as string; // text input
      if (typeof new_key === 'undefined') {
        alert('Private key is not correctly formated. Please insert complete key, including "' + prv_headers.begin + '" and "' + prv_headers.end + '"');
      } else {
        let new_key_longid = tool.crypto.key.longid(new_key);
        if (new_key.isPublic()) {
          alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prv_headers.begin + '"');
        } else if (!new_key_longid) {
          alert('This key may not be compatible. Please write me at human@flowcrypt.com and let me know which software created this key, so that I can fix it.\n\n(error: cannot get long_id)');
        } else if (tool.value(new_key_longid).in(private_keys_long_ids)) {
          alert('This is one of your current keys.');
        } else {
          let decrypt_result;
          try {
            decrypt_result = await tool.crypto.key.decrypt(new_key, [passphrase]);
          } catch (e) {
            alert(`This key type may not be supported by FlowCrypt. Please write me at human@flowcrypt.com to let us know which software created this key, so that we can add support soon. (decrypt error: ${String(e)})`);
            return;
          }
          if (decrypt_result) {
            await Store.keys_add(account_email, normalized_armored_key!); // resulting new_key checked above
            await Store.passphrase_save($('.input_passphrase_save').prop('checked') ? 'local' : 'session', account_email, new_key_longid, passphrase);
            tool.browser.message.send(parent_tab_id, 'reload', { advanced: true });
          } else {
            alert('The pass phrase does not match. Please try a different pass phrase.');
          }

        }
      }
    }
  }));

  Settings.initialize_private_key_import_ui(account_email, parent_tab_id);

})();
