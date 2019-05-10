/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../common/extension.js';
import { Catch } from '../../common/platform/catch.js';
import { Env } from '../../common/browser.js';
import { Assert } from '../../common/assert.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['parentTabId']);
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');

  document.addEventListener('cryptup_stripe_result', Catch.try(() => {
    BrowserMsg.send.stripeResult(parentTabId, { token: String($('#stripe_result').text()) });
  }));

})();
