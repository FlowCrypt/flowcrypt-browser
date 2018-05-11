/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['parent_tab_id']);

  document.addEventListener('cryptup_stripe_result', tool.catch.try(() => {
    tool.browser.message.send(url_params.parent_tab_id as string, 'stripe_result', { token: $('#stripe_result').text() });
  }));

})();
