/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, StorageType } from '../../js/common/store.js';
import { Value } from './../../js/common/common.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';
import { mnemonic } from './../../js/common/mnemonic.js';
import { Pgp } from '../../js/common/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Catch } from '../../js/common/catch.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  Ui.event.protect();

  const urlParams = Env.urlParams(['acctEmail', 'parentTabId', 'longids', 'type']);
  const acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');
  const longids = Env.urlParamRequire.string(urlParams, 'longids').split(',');
  const type = Env.urlParamRequire.oneof(urlParams, 'type', ['embedded', 'sign', 'attest', 'message', 'draft', 'attachment']);

  if (type === 'embedded') {
    $('h1').parent().css('display', 'none');
    $('div.separator').css('display', 'none');
    $('body#settings > div#content.dialog').css({ width: 'inherit', background: '#fafafa', });
    $('.line.which_key').css({ display: 'none', position: 'absolute', visibility: 'hidden', left: '5000px', });
  } else if (type === 'sign') {
    $('h1').text('Enter your pass phrase to sign email');
  } else if (type === 'draft') {
    $('h1').text('Enter your pass phrase to load a draft');
  } else if (type === 'attest') {
    $('h1').text('Enter your pass phrase to confirm attestation');
  } else if (type === 'attachment') {
    $('h1').text('Enter your pass phrase to decrypt a file');
  }
  await Ui.passphraseToggle(['passphrase']);
  $('#passphrase').focus();

  const allPrivateKeys = await Store.keysGet(acctEmail);
  const selectedPrivateKeys = allPrivateKeys.filter(ki => Value.is(ki.longid).in(longids) || (ki.primary && Value.is('primary').in(longids)));

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

  const renderErr = () => {
    $('#passphrase').val('');
    $('#passphrase').css('border-color', 'red');
    $('#passphrase').css('color', 'red');
    $('#passphrase').attr('placeholder', 'Please try again');
  };

  const renderNormal = () => {
    $('#passphrase').css('border-color', '');
    $('#passphrase').css('color', 'black');
    $('#passphrase').focus();
  };

  $('.action_close').click(Ui.event.handle(() => {
    BrowserMsg.send.passphraseEntry('broadcast', { entered: false });
    BrowserMsg.send.closeDialog(parentTabId);
  }));

  $('.action_ok').click(Ui.event.handle(async () => {
    const pass = $('#passphrase').val() as string; // it's a text input
    const storageType: StorageType = $('.forget').prop('checked') ? 'session' : 'local';
    let atLeastOneMatched = false;
    for (const keyinfo of selectedPrivateKeys) { // if passphrase matches more keys, it will save them all
      const prv = openpgp.key.readArmored(keyinfo.private).keys[0];
      try {
        if (await Pgp.key.decrypt(prv, [pass]) === true) {
          await Store.passphraseSave(storageType, acctEmail, keyinfo.longid, pass);
          atLeastOneMatched = true;
        }
      } catch (e) {
        if (e.message === 'Unknown s2k type.') {
          alert(`One of your keys ${keyinfo.longid} is not supported yet (${e.message}).\n\nPlease write human@flowcrypt.com with details about how was this key created.`);
        } else {
          throw e;
        }
      }
    }
    if (atLeastOneMatched) {
      BrowserMsg.send.passphraseEntry('broadcast', { entered: true });
      BrowserMsg.send.closeDialog(parentTabId);
    } else {
      renderErr();
      Catch.setHandledTimeout(renderNormal, 1500);
    }
  }));

  $('#passphrase').keyup(renderNormal);

})();
