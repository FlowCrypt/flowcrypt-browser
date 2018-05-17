/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

  tool.ui.passphrase_toggle(['input_passphrase']);
  
  $('#spinner_container').html(tool.ui.spinner('green') + ' loading..');
  
  Store.keys_get(url_params.account_email as string).then(keyinfos => {
    let private_keys_long_ids = keyinfos.map(ki => ki.longid);
  
    tool.api.gmail.fetch_key_backups(url_params.account_email as string, function (success, keys) {
      if(success && Array.isArray(keys)) {
        if(keys && keys.length) {
          let not_imported_backup_longids: string[] = [];
          for(let longid of tool.arr.unique(keys.map(tool.crypto.key.longid))) {
            if(!tool.value(longid).in(private_keys_long_ids)) {
              not_imported_backup_longids.push(longid);
            }
          }
          if(not_imported_backup_longids.length) {
            $('label[for=source_backup]').text('Load from backup (' + not_imported_backup_longids.length + ' new to import)');
          } else {
            $('label[for=source_backup]').text('Load from backup (already loaded)').css('color', '#AAA');
            $('#source_backup').prop('disabled', true);
          }
        } else {
          $('label[for=source_backup]').text('Load from backup (no backups found)').css('color', '#AAA');
          $('#source_backup').prop('disabled', true);
        }
      } else {
        $('label[for=source_backup]').text('Load from backup (error checking backups)').css('color', '#AAA');
        $('#source_backup').prop('disabled', true);
      }
      $('.source_selector').css('display', 'block');
      $('#spinner_container').text('');
    });
  
    $('.action_add_private_key').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
      let normalized_armored_key = tool.crypto.key.normalize($('.input_private_key').val() as string); // textarea
      let new_key = openpgp.key.readArmored(normalized_armored_key).keys[0];
      let passphrase = $('.input_passphrase').val() as string; // text input
      let prv_headers = tool.crypto.armor.headers('private_key');
      if(typeof new_key === 'undefined') {
        alert('Private key is not correctly formated. Please insert complete key, including "' + prv_headers.begin + '" and "' + prv_headers.end + '"');
      } else {
        let new_key_longid = tool.crypto.key.longid(new_key);
        if(new_key.isPublic()) {
          alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prv_headers.begin + '"');
        } else if(!new_key_longid) {
          alert('This key may not be compatible. Please write me at human@flowcrypt.com and let me know which software created this key, so that I can fix it.\n\n(error: cannot get long_id)');
        } else if(tool.value(new_key_longid).in(private_keys_long_ids)) {
          alert('This is one of your current keys.');
        } else {
          let decrypt_result = tool.crypto.key.decrypt(new_key, passphrase);
          if(decrypt_result.error) {
            alert('This key type may not be supported by FlowCrypt. Please write me at human@flowcrypt.com to let me know which software created this key, so that I can add support soon. (subkey decrypt error: ' + decrypt_result.error + ')');
          } else if(decrypt_result.success) {
            Promise.all([
              Store.keys_add(url_params.account_email as string, normalized_armored_key!), // resulting new_key checked above
              Store.passphrase_save($('.input_passphrase_save').prop('checked') ? 'local' : 'session', url_params.account_email as string, new_key_longid, passphrase),
            ]).then(() => {
              tool.browser.message.send(url_params.parent_tab_id as string, 'reload', { advanced: true });
            });
          } else {
            alert('The pass phrase does not match. Please try a different pass phrase.');
          }
        }
      }
    }));
  
    initialize_private_key_import_ui();
  
  });

})();