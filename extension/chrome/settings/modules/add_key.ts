/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Value } from '../../../js/common/core/common.js';
import { Xss, Ui, Env } from '../../../js/common/browser.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Api } from '../../../js/common/api/api.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Google } from '../../../js/common/api/google.js';
import { Assert } from '../../../js/common/assert.js';
import { KeyImportUi, UserAlert, KeyCanBeFixed } from '../../../js/common/ui/key_import_ui.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase_ui.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');

  await initPassphraseToggle(['input_passphrase']);
  const keyImportUi = new KeyImportUi({ rejectKnown: true });
  keyImportUi.initPrvImportSrcForm(acctEmail, parentTabId);

  Xss.sanitizeRender('#spinner_container', Ui.spinner('green') + ' loading..');

  const keyinfos = await Store.keysGet(acctEmail);
  const privateKeysLongIds = keyinfos.map(ki => ki.longid);
  let keyBackups;

  try {
    keyBackups = await Google.gmail.fetchKeyBackups(acctEmail);
    if (keyBackups.length) {
      const notImportedBackupLongids: string[] = [];
      for (const longid of Value.arr.unique(await Promise.all(keyBackups.map(Pgp.key.longid)))) {
        if (longid && !privateKeysLongIds.includes(longid)) {
          notImportedBackupLongids.push(longid);
        }
      }
      if (notImportedBackupLongids.length) {
        $('label[for=source_backup]').text('Load from backup (' + notImportedBackupLongids.length + ' new to import)');
      } else {
        $('label[for=source_backup]').text('Load from backup (already loaded)').css('color', '#AAA');
        $('#source_backup').prop('disabled', true);
      }
    } else {
      $('label[for=source_backup]').text('Load from backup (no backups found)').css('color', '#AAA');
      $('#source_backup').prop('disabled', true);
    }
  } catch (e) {
    if (Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
    }
    $('label[for=source_backup]').text('Load from backup (error checking backups)').css('color', '#AAA');
    $('#source_backup').prop('disabled', true);
  }

  $('.source_selector').css('display', 'block');
  $('#spinner_container').text('');

  $('.action_add_private_key').click(Ui.event.prevent('double', async () => {
    try {
      const checked = await keyImportUi.checkPrv(acctEmail, String($('.input_private_key').val()), String($('.input_passphrase').val()));
      if (checked) {
        await Store.keysAdd(acctEmail, checked.normalized); // resulting new_key checked above
        await Store.passphraseSave($('.input_passphrase_save').prop('checked') ? 'local' : 'session', acctEmail, checked.longid, checked.passphrase);
        BrowserMsg.send.reload(parentTabId, { advanced: true });
      }
    } catch (e) {
      if (e instanceof UserAlert) {
        return await Ui.modal.warning(e.message);
      } else if (e instanceof KeyCanBeFixed) {
        return await Ui.modal.error(`This type of key cannot be set as non-primary yet. Please write human@flowcrypt.com`);
      } else {
        Catch.reportErr(e);
        return await Ui.modal.error(`An error happened when processing the key: ${String(e)}\nPlease write at human@flowcrypt.com`);
      }
    }
  }));

})();
