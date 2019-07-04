/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Store, StorageType } from '../../js/common/platform/store.js';
import { Ui, Env } from '../../js/common/browser.js';
import { mnemonic } from '../../js/common/core/mnemonic.js';
import { Pgp } from '../../js/common/core/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Assert } from '../../js/common/assert.js';
import { initPassphraseToggle } from '../../js/common/ui/passphrase_ui.js';
import { Xss } from '../../js/common/platform/xss.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'longids', 'type']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const longids = Assert.urlParamRequire.string(uncheckedUrlParams, 'longids').split(',');
  const type = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'type', ['embedded', 'sign', 'message', 'draft', 'attachment']);

  const allPrivateKeys = await Store.keysGet(acctEmail);
  const selectedPrivateKeys = allPrivateKeys.filter(ki => longids.includes(ki.longid) || (ki.primary && longids.includes('primary')));

  await initPassphraseToggle(['passphrase']);

  const renderInitial = () => {
    $('#passphrase').keyup(renderNormalPpPrompt);
    if (type === 'embedded') {
      $('h1').parent().css('display', 'none');
      $('div.separator').css('display', 'none');
      $('body#settings > div#content.dialog').css({ width: 'inherit', background: '#fafafa', });
      $('.line.which_key').css({ display: 'none', position: 'absolute', visibility: 'hidden', left: '5000px', });
    } else if (type === 'sign') {
      $('h1').text('Enter your pass phrase to sign email');
    } else if (type === 'draft') {
      $('h1').text('Enter your pass phrase to load a draft');
    } else if (type === 'attachment') {
      $('h1').text('Enter your pass phrase to decrypt a file');
    }
    $('#passphrase').focus();
    $('#passphrase').keydown(event => {
      if (event.which === 13) {
        $('.action_ok').click();
      }
    });
    if (allPrivateKeys.length > 1) {
      let html: string;
      if (selectedPrivateKeys.length === 1) {
        html = `For key: <span class="good">${Xss.escape(mnemonic(selectedPrivateKeys[0].longid) || '')}</span> (KeyWords)`;
      } else {
        html = 'Pass phrase needed for any of the following keys:';
        for (const i of selectedPrivateKeys.keys()) {
          html += `KeyWords ${String(i + 1)}: <div class="good">${Xss.escape(mnemonic(selectedPrivateKeys[i].longid) || '')}</div>`;
        }
      }
      Xss.sanitizeRender('.which_key', html);
      $('.which_key').css('display', 'block');
    }
  };

  const renderFailedEntryPpPrompt = () => {
    $('#passphrase').val('');
    $('#passphrase').css('border-color', 'red');
    $('#passphrase').css('color', 'red');
    $('#passphrase').attr('placeholder', 'Please try again');
  };

  const renderNormalPpPrompt = () => {
    $('#passphrase').css('border-color', '');
    $('#passphrase').css('color', 'black');
    $('#passphrase').focus();
  };

  const closeDialog = (entered: boolean = false) => {
    BrowserMsg.send.passphraseEntry('broadcast', { entered });
    BrowserMsg.send.closeDialog(parentTabId);
  };
  $('.action_close').click(() => closeDialog());
  $('body').on('keydown', ev => {
    if (ev.which === 27) {
      closeDialog();
    }
  });

  $('.action_ok').click(Ui.event.handle(async () => {
    const pass = String($('#passphrase').val());
    const storageType: StorageType = $('.forget').prop('checked') ? 'session' : 'local';
    let atLeastOneMatched = false;
    for (const keyinfo of selectedPrivateKeys) { // if passphrase matches more keys, it will save the pass phrase for all keys
      const { keys: [prv] } = await openpgp.key.readArmored(keyinfo.private);
      try {
        if (await Pgp.key.decrypt(prv, [pass]) === true) {
          await Store.passphraseSave(storageType, acctEmail, keyinfo.longid, pass);
          atLeastOneMatched = true;
        }
      } catch (e) {
        if (e instanceof Error && e.message === 'Unknown s2k type.') {
          await Ui.modal.error(`One of your keys ${keyinfo.longid} is not supported yet (${String(e)}).\n\nPlease write human@flowcrypt.com with details about how was this key created.`);
        } else {
          throw e;
        }
      }
    }
    if (atLeastOneMatched) {
      closeDialog(true);
    } else {
      renderFailedEntryPpPrompt();
      Catch.setHandledTimeout(renderNormalPpPrompt, 1500);
    }
  }));

  renderInitial();

})();
