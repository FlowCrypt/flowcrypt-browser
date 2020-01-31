/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { PgpMsg } from '../../js/common/core/pgp-msg.js';

Catch.try(async () => {
  const tabId = await BrowserMsg.requiredTabId();
  console.log(tabId);

  BrowserMsg.addListener('pgpMsgDiagnosePubkeys', PgpMsg.diagnosePubkeys);
  BrowserMsg.listen(tabId);
})();
