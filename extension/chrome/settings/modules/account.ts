/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store, Subscription } from '../../../js/common/platform/store.js';
import { Ui, Env } from '../../../js/common/browser.js';
import { Settings } from '../../../js/common/settings.js';
import { Backend } from '../../../js/common/api/backend.js';
import { Assert } from '../../../js/common/assert.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Api } from '../../../js/common/api/api.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');

  Xss.sanitizeRender('.loading', Ui.spinner('green', 'large_spinner'));

  const authInfo = await Store.authInfo(acctEmail);
  let subscription = await Store.subscription(acctEmail);
  try {
    const r = await Backend.getSubscriptionWithoutLogin(acctEmail);
    subscription = new Subscription(r.subscription);
    await Backend.accountGet(authInfo); // here to test auth
  } catch (e) {
    if (Api.err.isAuthErr(e) && subscription.level) {
      Settings.offerToLoginWithPopupShowModalOnErr(acctEmail, () => window.location.reload());
      return;
    }
  }

  $('.email').text(authInfo.account);
  $('.level').text('advanced');
  $('.expire').text(subscription.expire ? subscription.expire.split(' ')[0] : 'lifetime');
  if (subscription.method === 'stripe') {
    $('.line.cancel').css('display', 'block');
    $('.expire_label').text('Renews on');
    $('.price').text('$5 monthly');
    $('.method').text('Credit Card (processed by Stripe Payments)');
  } else if (subscription.method === 'group') {
    $('.price').text('Group billing');
    $('.hide_if_group_billing').css('display', 'none');
  } else {
    $('.expire_label').text('Until');
    $('.price').text('free');
    Xss.sanitizeRender('.method', 'trial <a href="#" class="action_go_subscription">upgrade</a>');
    $('.action_go_subscription').click(Ui.event.handle(() => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/elements/subscribe.htm', '&placement=settings')));
  }
  if (subscription.method !== 'group') {
    $('.get_group_billing').css('display', 'block');
  }
  $('.loading').text(' ');
  $('.list_table').css('display', 'block');

})();
