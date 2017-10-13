/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

tool.ui.passphrase_toggle(['input_passphrase']);

let private_keys_long_ids = window.flowcrypt_storage.keys_get(url_params.account_email).map(ki => ki.longid);

$('#spinner_container').html(tool.ui.spinner('green') + ' loading..');

tool.api.gmail.fetch_key_backups(url_params.account_email, function (success, keys) {
  if(success) {
    if(keys && keys.length) {
      let not_imported_backup_longids = [];
      tool.each(tool.arr.unique(keys.map(tool.crypto.key.longid)), function (i, longid) {
        if(!tool.value(longid).in(private_keys_long_ids)) {
          not_imported_backup_longids.push(longid);
        }
      });
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

let attach_js = window.flowcrypt_attach.init(function() { return {count: 100, size: 1024 * 1024, size_mb: 1};});
attach_js.initialize_attach_dialog('fineuploader', 'fineuploader_button');
attach_js.set_attachment_added_callback(function (file) {
  let content = tool.str.from_uint8(file.content);
  let k = openpgp.key.readArmored(content).keys[0];
  if(typeof k !== 'undefined') {
    $('.input_private_key').val(k.armor()).prop('disabled', true);
    $('.source_paste_container').css('display', 'block');
  } else {
    alert('Not able to read this key. Is it a valid PGP private key?');
  }
});

$('.action_add_private_key').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
  let normalized_armored_key = tool.crypto.key.normalize($('.input_private_key').val());
  let new_key = openpgp.key.readArmored(normalized_armored_key).keys[0];
  let passphrase = $('.input_passphrase').val();
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
        window.flowcrypt_storage.keys_add(url_params.account_email, normalized_armored_key);
        if($('.input_passphrase_save').prop('checked')) {
          window.flowcrypt_storage.passphrase_save('local', url_params.account_email, new_key_longid, passphrase);
        } else {
          window.flowcrypt_storage.passphrase_save('session', url_params.account_email, new_key_longid, passphrase);
        }
        tool.browser.message.send(url_params.parent_tab_id, 'reload', { advanced: true });
      } else {
        alert('The pass phrase does not match. Please try a different pass phrase.');
      }
    }
  }
}));

$('input[type=radio][name=source]').change(function() {
  if(this.value === 'file') {
    $('.source_paste_container').css('display', 'none');
    $('#fineuploader_button > input').click()
  } else if(this.value === 'paste') {
    $('.input_private_key').val('').prop('disabled', false);
    $('.source_paste_container').css('display', 'block');
  } else if(this.value === 'backup') {
    window.location = tool.env.url_create('../setup.htm', {account_email: url_params.account_email, parent_tab_id: url_params.parent_tab_id, action: 'add_key'})
  }
});