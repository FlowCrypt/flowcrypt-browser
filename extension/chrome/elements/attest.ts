/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Catch, Env, Dict } from './../../js/common/common.js';
import { Xss, Ui } from '../../js/common/browser.js';
import { Settings } from '../../js/common/settings.js';
import { BrowserMsg } from '../../js/common/extension.js';

declare let openpgp: typeof OpenPGP;

Catch.try(async () => {

  Ui.event.protect();

  let urlParams = Env.urlParams(['acctEmail', 'attestPacket', 'parentTabId']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  let [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
  Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  let passphrase = await Store.passphraseGet(acctEmail, primaryKi.longid);

  let processAttest = async (passphrase: string | null) => {
    if (passphrase !== null) {
      Xss.sanitizeRender('.status', 'Verifying..' + Ui.spinner('green'));
      let attestation = await BrowserMsg.sendAwait(null, 'attest_packet_received', { acctEmail, packet: urlParams.attestPacket, passphrase });
      $('.status').addClass(attestation.success ? 'good' : 'bad')[0].innerText = attestation.result;
    }
  };

  if (openpgp.key.readArmored(primaryKi.private).keys[0].isDecrypted()) { // unencrypted private key
    $('.status').text('Not allowed to attest keys that do not have a pass phrase. Please go to FlowCrypt Settings -> Security -> Change pass phrase');
    return;
  }

  if (passphrase !== null && passphrase) {
    await processAttest(passphrase);
    return;
  }

  Xss.sanitizeRender('.status', 'Pass phrase needed to process this attest message. <a href="#" class="action_passphrase">Enter pass phrase</a>');
  $('.action_passphrase').click(Ui.event.handle(() => BrowserMsg.send(parentTabId, 'passphrase_dialog', { type: 'attest', longids: 'primary' })));
  let tabId = await BrowserMsg.requiredTabId();
  BrowserMsg.listen({
    passphrase_entry: async (msg: { entered: boolean }, sender, respond) => {
      if (msg.entered) {
        let pp = await Store.passphraseGet(acctEmail, primaryKi.longid);
        await processAttest(pp);
      }
    },
  }, tabId);

})();
