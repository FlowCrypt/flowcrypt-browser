/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Catch, Env, Dict } from './../../js/common/common.js';
import { Xss, Ui } from '../../js/common/browser.js';
import { Settings } from '../settings/settings.js';
import { BrowserMsg } from '../../js/common/extension.js';

declare let openpgp: typeof OpenPGP;

Catch.try(async () => {

  Ui.event.protect();

  let url_params = Env.url_params(['account_email', 'attest_packet', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  let [primary_ki] = await Store.keys_get(account_email, ['primary']);
  Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);

  let passphrase = await Store.passphrase_get(account_email, primary_ki.longid);

  let process_attest = async (passphrase: string|null) => {
    if (passphrase !== null) {
      Xss.sanitize_render('.status', 'Verifying..' + Ui.spinner('green'));
      let attestation = await BrowserMsg.send_await(null, 'attest_packet_received', {account_email, packet: url_params.attest_packet, passphrase});
      $('.status').addClass(attestation.success ? 'good' : 'bad')[0].innerText = attestation.result;
    }
  };

  if(openpgp.key.readArmored(primary_ki.private).keys[0].isDecrypted()) { // unencrypted private key
    $('.status').text('Not allowed to attest keys that do not have a pass phrase. Please go to FlowCrypt Settings -> Security -> Change pass phrase');
    return;
  }

  if (passphrase !== null && passphrase) {
    await process_attest(passphrase);
    return;
  }

  Xss.sanitize_render('.status', 'Pass phrase needed to process this attest message. <a href="#" class="action_passphrase">Enter pass phrase</a>');
  $('.action_passphrase').click(Ui.event.handle(() => BrowserMsg.send(parent_tab_id, 'passphrase_dialog', {type: 'attest', longids: 'primary'})));
  let tab_id = await BrowserMsg.required_tab_id();
  BrowserMsg.listen({
    passphrase_entry: async (message: {entered: boolean}, sender, respond) => {
      if (message.entered) {
        let pp = await Store.passphrase_get(account_email, primary_ki.longid);
        await process_attest(pp);
      }
    },
  }, tab_id);

})();
