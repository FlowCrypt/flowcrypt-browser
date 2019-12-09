/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../common/platform/catch.js';
import { Assert } from '../../common/assert.js';
import { Url } from '../../common/core/common.js';
import { BrowserMsg } from '../../common/browser/browser-msg.js';

Catch.try(async () => {

  const uncheckedUrlParams = Url.parse(['parentTabId']);
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');

  document.addEventListener('cryptup_stripe_result', Catch.try(() => {
    BrowserMsg.send.stripeResult(parentTabId, { token: String($('#stripe_result').text()) });
  }));

})();
