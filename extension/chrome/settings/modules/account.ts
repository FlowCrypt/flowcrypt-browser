/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Backend } from '../../../js/common/api/backend.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { Subscription } from '../../../js/common/subscription.js';

// todo - this this page should be removed, link from settings should point to flowcrypt.com/account once available

View.run(class AccountView extends View {

  private acctEmail: string;
  private parentTabId: string;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  }

  public render = async () => {
    Xss.sanitizeRender('.loading', Ui.spinner('green', 'large_spinner'));
    const authInfo = await AcctStore.authInfo(this.acctEmail);
    let subscription = await AcctStore.getSubscription(this.acctEmail);
    try {
      const r = await Backend.accountGetAndUpdateLocalStore(authInfo);
      subscription = new Subscription(r.subscription);
    } catch (e) {
      if (ApiErr.isAuthErr(e) && subscription.level) {
        Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail, () => window.location.reload());
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
    }
    if (subscription.method !== 'group') {
      $('.get_group_billing').css('display', 'block');
    }
    $('.loading').text(' ');
    $('.list_table').css('display', 'block');
  }

  public setHandlers = () => {
    $('.action_go_subscription').click(this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/elements/subscribe.htm', '&placement=settings')));
  }

});
