/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Xss, Ui, KeyImportUI, UserAlert } from '../../../js/common/browser.js';
import { Pgp } from '../../../js/common/pgp.js';
import { mnemonic } from '../../../js/common/mnemonic.js';

import { Settings } from '../../../js/common/settings.js';
import { Api, PubkeySearchResult } from '../../../js/common/api.js';

Catch.try(async () => {

  let url_params = Env.urlParams(['account_email', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  Xss.sanitize_render('#status', 'Loading from keyserver<br/><br/><br/>' + Ui.spinner('green'));

  let [primary_ki] = await Store.keysGet(account_email, ['primary']);
  Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);

  let primary_pubkey_armored = primary_ki.public;
  let keyserver_result: PubkeySearchResult;
  let expect_longid: string;

  let request_replacement = async () => {
    try {
      let key_import_ui = new KeyImportUI({expect_longid, reject_known: true, check_signing: true});
      let checked_old_key = await key_import_ui.check_prv(account_email, $('.input_private_key').val() as string, $('.input_passphrase').val() as string);
      if(checked_old_key) {
        let request_replacement: Dict<string> = {
          'ATT': 'CRYPTUP', // todo - should be the original attester
          'ACT': 'REQUEST_REPLACEMENT',
          'ADD': Pgp.hash.double_sha1_upper(account_email),
          'OLD': checked_old_key.fingerprint,
          'PUB': Pgp.key.fingerprint(primary_pubkey_armored) as string,
        };
        let signed_packet;
        try {
          signed_packet = await Api.attester.packet.createSign(request_replacement, checked_old_key.decrypted);
        } catch (e) {
          Catch.report('Error signing REQUEST_REPLACEMENT: ' + e.message);
          return alert('Error signing request. If this happens repeatedly, write us at human@flowcrypt.com. Error message:\n\n' + JSON.stringify(e.message));
        }
        try {
          await Api.attester.replaceRequest(account_email, signed_packet, primary_pubkey_armored);
        } catch (e) {
          return alert('Error requesting Re-Attestation. If this happens repeatedly, write us at human@flowcrypt.com. Error message:\n\n' + JSON.stringify(e.message));
        }
        await Settings.save_attest_request(account_email, 'CRYPTUP'); // todo - should be the original attester
        alert('Successfully requested Re-Attestation. It should get processed within a few minutes. You will also receive attestation email shortly. No further actions needed.');
        Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/keyserver.htm');
      }
    } catch (e) {
      if(e instanceof UserAlert) {
        return alert(e.message);
      } else {
        Catch.handle_exception(e);
        return alert(`An error happened when processing the key: ${String(e)}\nPlease write at human@flowcrypt.com`);
      }
    }
  };

  try {
    let r = await Api.attester.lookupEmail([account_email]);
    keyserver_result = r.results[0];
  } catch (e) {
    Xss.sanitize_render('#status', `Internet connection dropped. ${Ui.retry_link()}`);
    return;
  }

  if (!keyserver_result.pubkey || !keyserver_result.attested || Pgp.key.fingerprint(primary_pubkey_armored) === Pgp.key.fingerprint(keyserver_result.pubkey)) {
    Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/keyserver.htm');
  } else { // email previously attested, and there indeed is a pubkey mismatch
    expect_longid = Pgp.key.fingerprint(keyserver_result.pubkey!)!;
    Xss.sanitize_render('#status', `Original key KeyWords:<br/><span class="good">${mnemonic(Pgp.key.longid(keyserver_result.pubkey)!)}<br/>${Pgp.key.fingerprint(keyserver_result.pubkey, 'spaced')}</span>`); // all pubkeys on keyserver should have computable longid
    $('#step_2b_manual_enter').css('display', 'block');
    $('.action_request_replacement').click(Ui.event.prevent('double', request_replacement));
  }

})();
