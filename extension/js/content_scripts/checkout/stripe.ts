/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, Env } from '../../common/common.js';
import { BrowserMsg } from '../../common/extension.js';

Catch.try(async () => {

  let url_params = Env.url_params(['parent_tab_id']);

  document.addEventListener('cryptup_stripe_result', Catch.try(() => {
    BrowserMsg.send(url_params.parent_tab_id as string, 'stripe_result', { token: $('#stripe_result').text() });
  }));

})();
