/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

var url_params = tool.env.url_params(['parent_tab_id']);

document.addEventListener('cryptup_stripe_result', catcher.try(() => {
  tool.browser.message.send(url_params.parent_tab_id, 'stripe_result', { token: $('#stripe_result').text() });
}));

