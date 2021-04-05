/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../common/assert.js';
import { BrowserMsg } from '../../common/browser/browser-msg.js';
import { Catch } from '../../common/platform/catch.js';
import { Url } from '../../common/core/common.js';

Catch.try(async () => {

  const uncheckedUrlParams = Url.parse(['parentTabId']);
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');

  document.addEventListener('cryptup_stripe_result', Catch.try(() => {
    BrowserMsg.send.stripeResult(parentTabId, { token: String($('#stripe_result').text()) });
  }));

})();
