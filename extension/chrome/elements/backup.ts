/* © 2016-2019 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../js/common/platform/catch.js';
import { Ui, Env } from '../../js/common/browser.js';
import { mnemonic } from '../../js/common/core/mnemonic.js';
import { Pgp } from '../../js/common/core/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Store } from '../../js/common/platform/store.js';
import { Assert } from '../../js/common/assert.js';
import { initPassphraseToggle } from '../../js/common/ui/passphrase_ui.js';

Catch.try(async () => {
  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'armoredPrvBackup', 'parentTabId', 'frameId']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
  const armoredPrvBackup = Assert.urlParamRequire.string(uncheckedUrlParams, 'armoredPrvBackup');

  await initPassphraseToggle(['pass_phrase']);

  const render = async () => {
    const prvBackup = await Pgp.key.read(armoredPrvBackup);
    const longid = await Pgp.key.longid(prvBackup) || '';
    const [storedPrvWithMatchingLongid] = await Store.keysGet(acctEmail, [longid]);

    if (prvBackup) {
      $('.line.fingerprints .fingerprint').text(await Pgp.key.fingerprint(prvBackup, 'spaced') || '(fingerprint error)');
      $('.line.fingerprints .keywords').text(mnemonic(longid) || '(mnemonic error)');
      if (! await prvBackup.getEncryptionKey() && ! await prvBackup.getSigningKey()) {
        $('.line.add_contact').addClass('bad').text('This private key looks correctly formatted, but cannot be used for encryption.');
        $('.line.fingerprints').css({ display: 'none', visibility: 'hidden' });
      }
    } else {
      $('.line.fingerprints').css({ display: 'none' });
    }

    if (storedPrvWithMatchingLongid) {
      $('.line .private_key_status').text('This Private Key is already imported.');
    } else {
      $('.line .private_key_status')
        .text('This private key was not imported yet. We suggest to import all backups so that you can read all incoming encrypted emails.')
        .after('<div class="line"><div class="button green" id="action_import_key">Import Missing Private Key</div></div>');
      $("#action_import_key").click(Ui.event.handle(async target => {
        BrowserMsg.send.bg.settings({ acctEmail, page: '/chrome/settings/modules/add_key.htm' });
      }));
    }
    $('#pass_phrase').keydown(event => {
      if (event.which === 13) {
        $('.action_test_pass').click();
      }
    });
  };

  $('.action_test_pass').click(Ui.event.handle(async () => {
    if (await Pgp.key.decrypt(await Pgp.key.read(armoredPrvBackup), [String($('#pass_phrase').val())]) === true) {
      await Ui.modal.info('Success - your pass phrase matches this backup!');
    } else {
      await Ui.modal.warning('Pass phrase did not match. Please try again. If you forgot your pass phrase, please change it, so that you don\'t get' +
        ' locked out of your encrypted messages.');
    }
    $('#pass_phrase').val('');
  }));

  const sendResizeMsg = () => {
    const desiredHeight = $('#backup_block').height()!;
    BrowserMsg.send.setCss(parentTabId, { selector: `iframe#${frameId}`, css: { height: `${desiredHeight}px` } });
  };

  await render();
  sendResizeMsg();

})();
