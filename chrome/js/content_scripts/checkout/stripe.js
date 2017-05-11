/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['parent_tab_id']);

document.addEventListener('cryptup_stripe_result', catcher.try(function() {
  tool.browser.message.send(url_params.parent_tab_id, 'stripe_result', { token: $('#stripe_result').text() });
}));

