/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { PgpMsg } from '../../js/common/core/pgp-msg.js';
import { Env } from '../../js/common/browser/env.js';

/* eslint-disable max-len */

Catch.try(async () => {
  const tabId = await BrowserMsg.requiredTabId();

  BrowserMsg.addListener('pgpMsgDiagnosePubkeys', PgpMsg.diagnosePubkeys);
  BrowserMsg.listen(tabId);

  let src = Env.getBaseUrl();
  src += `/chrome/elements/pgp_block.htm?account_email=flowcrypt.compatibility%40gmail.com&frame_id=frame_yVMKFLRDiY&message=&has_password=___cu_false___&message_id=162275c819bcbf9b&sender_email=human%40flowcrypt.com&is_outgoing=___cu_false___`;
  src += `&parentTabId=${encodeURIComponent(tabId)}`;
  $('body').append(`<iframe src="${src}" frameborder="0"></iframe>`);
})();
