/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  await tool.ui.passphrase_toggle(['input_passphrase']);
  let key_import_ui = new KeyImportUI({reject_known: true});
  key_import_ui.init_prv_import_source_form(account_email, parent_tab_id);

  tool.ui.sanitize_render('#spinner_container', tool.ui.spinner('green') + ' loading..');

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
    try {
      let checked = await key_import_ui.check_prv(account_email, $('.input_private_key').val() as string, $('.input_passphrase').val() as string);
      if(checked) {
        await Store.keys_add(account_email, checked.normalized); // resulting new_key checked above
        await Store.passphrase_save($('.input_passphrase_save').prop('checked') ? 'local' : 'session', account_email, checked.longid, checked.passphrase);
        tool.browser.message.send(parent_tab_id, 'reload', { advanced: true });
      }
    } catch(e) {
      if(e instanceof UserAlert) {
        return alert(e.message);
      } else if(e instanceof KeyCanBeFixed) {
        return alert(`This type of key cannot be set as non-primary yet. Please write human@flowcrypt.com`);
      } else {
        tool.catch.handle_exception(e);
        return alert(`An error happened when processing the key: ${String(e)}\nPlease write at human@flowcrypt.com`);
      }
    }
  }));

})();
