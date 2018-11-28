/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';
import { Settings } from '../../js/common/settings.js';
import { BrowserMsg, Bm } from '../../js/common/extension.js';
import { Catch } from '../../js/common/catch.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'attestPacket', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const attestPacket = Env.urlParamRequire.string(uncheckedUrlParams, 'attestPacket');

  const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
  Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  const passphrase = await Store.passphraseGet(acctEmail, primaryKi.longid);

  const processAttest = async (passphrase: string | undefined) => {
    if (typeof passphrase !== 'undefined') {
      Xss.sanitizeRender('.status', 'Verifying..' + Ui.spinner('green'));
      const attestation = await BrowserMsg.send.await.bg.attestPacketReceived({ acctEmail, packet: attestPacket, passphrase });
      $('.status').addClass(attestation.success ? 'good' : 'bad')[0].innerText = attestation.result;
    }
  };

  if (openpgp.key.readArmored(primaryKi.private).keys[0].isDecrypted()) { // unencrypted private key
    $('.status').text('Not allowed to attest keys that do not have a pass phrase. Please go to FlowCrypt Settings -> Security -> Change pass phrase');
    return;
  }

  if (typeof passphrase !== 'undefined' && passphrase) {
    await processAttest(passphrase);
    return;
  }

  Xss.sanitizeRender('.status', 'Pass phrase needed to process this attest message. <a href="#" class="action_passphrase">Enter pass phrase</a>');
  $('.action_passphrase').click(Ui.event.handle(() => BrowserMsg.send.passphraseDialog(parentTabId, { type: 'attest', longids: ['primary'] })));
  const tabId = await BrowserMsg.requiredTabId();
  BrowserMsg.addListener('passphrase_entry', async ({ entered }: Bm.PassphraseEntry) => {
    if (entered) {
      const pp = await Store.passphraseGet(acctEmail, primaryKi.longid);
      await processAttest(pp);
    }
  });
  BrowserMsg.listen(tabId);

})();
