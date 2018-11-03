/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env, Value } from '../../../js/common/common.js';
import { Xss, Ui, KeyImportUI, UserAlert, KeyCanBeFixed } from '../../../js/common/browser.js';
import { Pgp } from '../../../js/common/pgp.js';
import { Api } from '../../../js/common/api.js';
import { BrowserMsg } from '../../../js/common/extension.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['account_email', 'parent_tab_id']);
  let account_email = Env.urlParamRequire.string(urlParams, 'account_email');
  let parent_tab_id = Env.urlParamRequire.string(urlParams, 'parent_tab_id');

  await Ui.passphraseToggle(['input_passphrase']);
  let key_import_ui = new KeyImportUI({reject_known: true});
  key_import_ui.init_prv_import_source_form(account_email, parent_tab_id);

  Xss.sanitizeRender('#spinner_container', Ui.spinner('green') + ' loading..');

  let keyinfos = await Store.keysGet(account_email);
  let private_keys_long_ids = keyinfos.map(ki => ki.longid);
  let key_backups;

  try {
    key_backups = await Api.gmail.fetchKeyBackups(account_email);
    if (key_backups.length) {
      let not_imported_backup_longids: string[] = [];
      for (let longid of Value.arr.unique(key_backups.map(Pgp.key.longid))) {
        if (longid && !Value.is(longid).in(private_keys_long_ids)) {
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
    if(Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
    }
    $('label[for=source_backup]').text('Load from backup (error checking backups)').css('color', '#AAA');
    $('#source_backup').prop('disabled', true);
  }

  $('.source_selector').css('display', 'block');
  $('#spinner_container').text('');

  $('.action_add_private_key').click(Ui.event.prevent('double', async () => {
    try {
      let checked = await key_import_ui.check_prv(account_email, $('.input_private_key').val() as string, $('.input_passphrase').val() as string);
      if(checked) {
        await Store.keys_add(account_email, checked.normalized); // resulting new_key checked above
        await Store.passphrase_save($('.input_passphrase_save').prop('checked') ? 'local' : 'session', account_email, checked.longid, checked.passphrase);
        BrowserMsg.send(parent_tab_id, 'reload', { advanced: true });
      }
    } catch(e) {
      if(e instanceof UserAlert) {
        return alert(e.message);
      } else if(e instanceof KeyCanBeFixed) {
        return alert(`This type of key cannot be set as non-primary yet. Please write human@flowcrypt.com`);
      } else {
        Catch.handle_exception(e);
        return alert(`An error happened when processing the key: ${String(e)}\nPlease write at human@flowcrypt.com`);
      }
    }
  }));

})();
