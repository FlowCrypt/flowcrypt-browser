/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../common/extension.js';
import { Catch } from '../../common/catch.js';
import { Env } from '../../common/browser.js';

Catch.try(async () => {

  const urlParams = Env.urlParams(['parentTabId']);
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  document.addEventListener('cryptup_stripe_result', Catch.try(() => {
    BrowserMsg.send.stripeResult(parentTabId, { token: String($('#stripe_result').text()) });
  }));

})();
