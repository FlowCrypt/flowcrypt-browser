/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Dict } from '../../../js/common/core/common.js';
import { Xss, Ui, KeyImportUi, UserAlert, Env } from '../../../js/common/browser.js';
import { Pgp } from '../../../js/common/core/pgp.js';
import { mnemonic } from '../../../js/common/core/mnemonic.js';
import { Settings } from '../../../js/common/settings.js';
import { Api, PubkeySearchResult } from '../../../js/common/api/api.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');

  Xss.sanitizeRender('#status', 'Loading from keyserver<br/><br/><br/>' + Ui.spinner('green'));

  const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
  Ui.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  const primaryPubkeyArmored = primaryKi.public;
  let keyserverRes: PubkeySearchResult;

  const reqReplacement = async (expectLongid: string) => {
    try {
      const keyImportUi = new KeyImportUi({ expectLongid, rejectKnown: true, checkSigning: true });
      const checkedOldKey = await keyImportUi.checkPrv(acctEmail, String($('.input_private_key').val()), String($('.input_passphrase').val()));
      if (checkedOldKey) {
        const reqDict: Dict<string> = {
          'ATT': 'CRYPTUP',
          'ACT': 'REQUEST_REPLACEMENT',
          'ADD': await Pgp.hash.doubleSha1Upper(acctEmail),
          'OLD': checkedOldKey.fingerprint,
          'PUB': primaryKi.fingerprint,
        };
        let signedPacket;
        try {
          signedPacket = await Api.attester.packet.createSign(reqDict, checkedOldKey.decrypted);
        } catch (e) {
          Catch.report(`Error signing REQUEST_REPLACEMENT: ${String(e)}`);
          return alert(`Error signing request. If this happens repeatedly, write us at human@flowcrypt.com. Error message:\n\n${String(e)}`);
        }
        try {
          await Api.attester.replaceRequest(acctEmail, signedPacket, primaryPubkeyArmored);
        } catch (e) {
          return alert(`Error requesting Re-Attestation. If this happens repeatedly, write us at human@flowcrypt.com. Error message:\n\n${String(e)}`);
        }
        await Settings.saveAttestReq(acctEmail, 'CRYPTUP'); // todo - should be the original attester
        alert('Successfully requested Re-Attestation. It should get processed within a few minutes. You will also receive attestation email shortly. No further actions needed.');
        Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/keyserver.htm');
      }
    } catch (e) {
      if (e instanceof UserAlert) {
        return alert(e.message);
      } else {
        Catch.handleErr(e);
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

  if (!keyserverRes.pubkey || !keyserverRes.attested || await Pgp.key.fingerprint(primaryPubkeyArmored) === await Pgp.key.fingerprint(keyserverRes.pubkey)) {
    Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/keyserver.htm');
  } else { // email previously attested, and there indeed is a pubkey mismatch
    Xss.sanitizeRender('#status',
      `Original key KeyWords:<br/>
      <span class="good">${mnemonic(keyserverRes.longid!)}<br/>${await Pgp.key.fingerprint(keyserverRes.pubkey, 'spaced')}</span>
    `);
    $('#step_2b_manual_enter').css('display', 'block');
    $('.action_request_replacement').click(Ui.event.prevent('double', () => reqReplacement(keyserverRes.longid!)));
  }

})();
