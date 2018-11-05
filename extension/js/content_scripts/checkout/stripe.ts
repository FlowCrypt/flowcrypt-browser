/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../common/extension.js';
import { Catch } from '../../common/catch.js';
import { Env } from '../../common/browser.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['parentTabId']);

  document.addEventListener('cryptup_stripe_result', Catch.try(() => {
    BrowserMsg.send(urlParams.parentTabId as string, 'stripe_result', { token: $('#stripe_result').text() });
  }));

})();
