/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Dict } from '../../../js/common/common.js';
import { Xss, Ui, KeyImportUi, UserAlert, Env } from '../../../js/common/browser.js';
import { Pgp } from '../../../js/common/pgp.js';
import { mnemonic } from '../../../js/common/mnemonic.js';
import { Settings } from '../../../js/common/settings.js';
import { Api, PubkeySearchResult } from '../../../js/common/api.js';
import { Catch } from '../../../js/common/catch.js';

Catch.try(async () => {

  const urlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  Xss.sanitizeRender('#status', 'Loading from keyserver<br/><br/><br/>' + Ui.spinner('green'));

  const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
  Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  const primaryPubkeyArmored = primaryKi.public;
  let keyserverRes: PubkeySearchResult;
  let expectLongid: string;

  const reqReplacement = async () => {
    try {
      const keyImportUi = new KeyImportUi({ expectLongid, rejectKnown: true, checkSigning: true });
      const checkedOldKey = await keyImportUi.checkPrv(acctEmail, $('.input_private_key').val() as string, $('.input_passphrase').val() as string);
      if (checkedOldKey) {
        const reqDict: Dict<string> = {
          'ATT': 'CRYPTUP', // todo - should be the original attester
          'ACT': 'REQUEST_REPLACEMENT',
          'ADD': Pgp.hash.doubleSha1Upper(acctEmail),
          'OLD': checkedOldKey.fingerprint,
          'PUB': Pgp.key.fingerprint(primaryPubkeyArmored) as string,
        };
        let signedPacket;
        try {
          signedPacket = await Api.attester.packet.createSign(reqDict, checkedOldKey.decrypted);
        } catch (e) {
          Catch.report('Error signing REQUEST_REPLACEMENT: ' + e.message);
          return alert('Error signing request. If this happens repeatedly, write us at human@flowcrypt.com. Error message:\n\n' + JSON.stringify(e.message));
        }
        try {
          await Api.attester.replaceRequest(acctEmail, signedPacket, primaryPubkeyArmored);
        } catch (e) {
          return alert('Error requesting Re-Attestation. If this happens repeatedly, write us at human@flowcrypt.com. Error message:\n\n' + JSON.stringify(e.message));
        }
        await Settings.saveAttestReq(acctEmail, 'CRYPTUP'); // todo - should be the original attester
        alert('Successfully requested Re-Attestation. It should get processed within a few minutes. You will also receive attestation email shortly. No further actions needed.');
        Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/keyserver.htm');
      }
    } catch (e) {
      if (e instanceof UserAlert) {
        return alert(e.message);
      } else {
        Catch.handleException(e);
        return alert(`An error happened when processing the key: ${String(e)}\nPlease write at human@flowcrypt.com`);
      }
    }
  };

  try {
    const r = await Api.attester.lookupEmail([acctEmail]);
    keyserverRes = r.results[0];
  } catch (e) {
    Xss.sanitizeRender('#status', `Internet connection dropped. ${Ui.retryLink()}`);
    return;
  }

  if (!keyserverRes.pubkey || !keyserverRes.attested || Pgp.key.fingerprint(primaryPubkeyArmored) === Pgp.key.fingerprint(keyserverRes.pubkey)) {
    Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/keyserver.htm');
  } else { // email previously attested, and there indeed is a pubkey mismatch
    expectLongid = Pgp.key.fingerprint(keyserverRes.pubkey!)!;
    Xss.sanitizeRender('#status',
      `Original key KeyWords:<br/>
      <span class="good">${mnemonic(Pgp.key.longid(keyserverRes.pubkey)!)}<br/>${Pgp.key.fingerprint(keyserverRes.pubkey, 'spaced')}</span>
    `);
    $('#step_2b_manual_enter').css('display', 'block');
    $('.action_request_replacement').click(Ui.event.prevent('double', reqReplacement));
  }

})();
