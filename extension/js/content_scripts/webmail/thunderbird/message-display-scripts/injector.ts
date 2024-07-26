/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../../common/platform/catch.js';

// send message to background script about decryption

(async () => {
  const fullMsg = (await messenger.runtime.sendMessage('decrypt')) as messenger.messages.MessagePart;
  if (fullMsg?.headers && 'openpgp' in fullMsg.headers) {
    // note : embeddedMsg for pgp_block injection -> replaceArmoredBlocks
    // do secure compose badge injection eg. signed or encrypted, (secure email status rendering) etc
    // render decrypted message right into the messageDisplay
  }
})().catch(Catch.reportErr);
