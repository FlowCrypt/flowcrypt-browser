/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Settings } from '../../../js/common/settings.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { Assert } from '../../../js/common/assert.js';
import { initPassphraseToggle } from '../../../js/common/ui/passphrase_ui.js';
import { KeyImportUi } from '../../../js/common/ui/key_import_ui.js';
import { Url } from '../../../js/common/core/common.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const keyImportUi = new KeyImportUi({});

  await initPassphraseToggle(['original_password', 'password', 'password2']);

  const privateKeys = await Store.keysGet(acctEmail);
  if (privateKeys.length > 1) {
    $('#step_0_enter_current .sentence').text('Enter the current passphrase for your primary key');
    $('#step_0_enter_current #original_password').attr('placeholder', 'Current primary key pass phrase');
    $('#step_1_enter_new #password').attr('placeholder', 'Enter a new primary key pass phrase');
  }

  const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
  Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  const storedOrSessionPp = await Store.passphraseGet(acctEmail, primaryKi.longid);
  let { keys: [primaryPrv] } = await openpgp.key.readArmored(primaryKi.private);

  const displayBlock = (name: string) => {
    const blocks = ['step_0_enter_current', 'step_1_enter_new', 'step_2_confirm_new', 'step_3_done'];
    for (const block of blocks) {
      $(`#${block}`).css('display', 'none');
    }
    $(`#${name}`).css('display', 'block');
  };

  if (primaryPrv.isFullyDecrypted() || (storedOrSessionPp && await Pgp.key.decrypt(primaryPrv, storedOrSessionPp))) {
    displayBlock('step_1_enter_new'); // current pp is already known
  } else {
    displayBlock('step_0_enter_current');
  }

  $('#step_0_enter_current .action_test_current_passphrase').click(Ui.event.handle(async () => {
    const { keys: [prv] } = await openpgp.key.readArmored(primaryKi.private);
    if (await Pgp.key.decrypt(prv, String($('#original_password').val())) === true) {
      primaryPrv = prv;
      displayBlock('step_1_enter_new');
    } else {
      await Ui.modal.error('Pass phrase did not match, please try again.');
      $('#original_password').val('').focus();
    }
  }));

  keyImportUi.renderPassPhraseStrengthValidationInput($('#password'), $('.action_set_pass_phrase'));
  $('#password').on('keydown', event => {
    if (event.which === 13) {
      $('#step_1_enter_new .action_set_pass_phrase').click();
    }
  });

  $('#step_1_enter_new .action_set_pass_phrase').click(Ui.event.handle(async (target: HTMLElement) => {
    if ($(target).hasClass('green')) {
      displayBlock('step_2_confirm_new');
    } else {
      await Ui.modal.warning('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
    }
  }));

  $('#step_2_confirm_new .action_use_another').click(Ui.event.handle(() => {
    $('#password').val('').keyup();
    $('#password2').val('');
    displayBlock('step_1_enter_new');
    $('#password').focus();
  }));

  $("#password2").on('keydown', event => {
    if (event.which === 13) {
      $('#step_2_confirm_new .action_change').click();
    }
  });
  $('#step_2_confirm_new .action_change').click(Ui.event.prevent('double', async () => {
    const newPp = String($('#password').val());
    if (newPp !== $('#password2').val()) {
      await Ui.modal.warning('The two pass phrases do not match, please try again.');
      $('#password2').val('');
      $('#password2').focus();
      return;
    }
    try {
      await Pgp.key.encrypt(primaryPrv, newPp);
    } catch (e) {
      Catch.reportErr(e);
      await Ui.modal.error(`There was an unexpected error. Please ask for help at human@flowcrypt.com:\n\n${e instanceof Error ? e.stack : String(e)}`);
      return;
    }
    await Store.keysAdd(acctEmail, primaryPrv.armor());
    const persistentlyStoredPp = await Store.passphraseGet(acctEmail, primaryKi.longid, true);
    await Store.passphraseSave('local', acctEmail, primaryKi.longid, typeof persistentlyStoredPp === 'undefined' ? undefined : newPp);
    await Store.passphraseSave('session', acctEmail, primaryKi.longid, typeof persistentlyStoredPp === 'undefined' ? newPp : undefined);
    const { setup_simple } = await Store.getAcct(acctEmail, ['setup_simple']);
    if (setup_simple) {
      Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/backup.htm', '&action=passphrase_change_gmail_backup');
    } else {
      await Ui.modal.info('Now that you changed your pass phrase, you should back up your key. New backup will be protected with new passphrase.');
      Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/backup.htm', '&action=options');
    }
  }));

})();
