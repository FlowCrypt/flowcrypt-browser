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
  src += `/chrome/elements/pgp_block.htm?${location.search}`;
  src += `&parentTabId=${encodeURIComponent(tabId)}`;
  $('body').append(`<iframe src="${src}" frameborder="0"></iframe>`); // xss-escaped
})();
