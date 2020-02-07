/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Backend, FcUuidAuth, PaymentMethod, SubscriptionLevel } from '../../js/common/api/backend.js';
import { Bm, BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Str, Url } from '../../js/common/core/common.js';

import { ApiErr } from '../../js/common/api/error/api-error.js';
import { Assert } from '../../js/common/assert.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Lang } from '../../js/common/lang.js';
import { Settings } from '../../js/common/settings.js';
import { Store } from '../../js/common/platform/store.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../js/common/xss-safe-factory.js';

// todo - this page should be removed, link from settings should point to flowcrypt.com/account once available

export type Product = { id: null | string, method: null | PaymentMethod, name: null | string, level: SubscriptionLevel };
export type ProductName = 'null' | 'trial' | 'advancedMonthly';

View.run(class SubscribeView extends View {

  private readonly acctEmail: string;
  private readonly parentTabId: string;
  private readonly placement: string | undefined;
  private authInfo: FcUuidAuth | undefined;
  private tabId: string | undefined;

  private readonly PRODUCTS: { [productName in ProductName]: Product } = {
    null: { id: null, method: null, name: null, level: null }, // tslint:disable-line:no-null-keyword
    trial: { id: 'free_month', method: 'trial', name: 'trial', level: 'pro' },
    advancedMonthly: { id: 'cu-adv-month', method: 'stripe', name: 'advanced_monthly', level: 'pro' },
  };

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'placement', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.placement = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'placement', ['settings', 'settings_compose', 'default', 'dialog', 'gmail', 'compose', undefined]);
  }

  public render = async () => {
    Ui.event.protect();
    if (this.placement === 'settings') {
      $('#content').removeClass('dialog').css({ 'margin-top': 0, 'margin-bottom': 30 });
      $('.line.button_padding').css('padding', 0);
    } else {
      $('body').css('overflow', 'hidden');
    }
    $('.list_table').css('display', 'block');
    $('#content').css('display', 'block');
    await this.renderSubscriptionDetails();
    this.tabId = await BrowserMsg.requiredTabId();
    $('.stripe_checkout')
      .html(`${Lang.account.creditOrDebit}<br><br>${new XssSafeFactory(this.acctEmail, this.tabId).embeddedStripeCheckout()}<br>${Ui.retryLink('back')}`); // xss-safe-factory
  }

  public setHandlers = () => {
    $('.action_close').click(this.setHandler(() => this.closeDialog()));
    $('.action_show_stripe').click(this.setHandler(() => this.showStripeHandler()));
    $('.action_get_trial').click(this.setHandlerPrevent('parallel', async (target, done) => {
      await this.subscribeAndHandleResult(this.PRODUCTS.trial, undefined);
      done();
    }));
    BrowserMsg.addListener('stripe_result', (res) => this.stripeCcEnteredHandler(res as Bm.StripeResult));
    BrowserMsg.listen(this.tabId!);
  }

  private renderSubscriptionDetails = async () => {
    this.authInfo = await Store.authInfo(this.acctEmail);
    try {
      await Backend.accountGetAndUpdateLocalStore(this.authInfo);
    } catch (e) {
      if (ApiErr.isAuthErr(e)) {
        Xss.sanitizeRender('#content', `Not logged in. ${Ui.retryLink()}`);
        Settings.offerToLoginWithPopupShowModalOnErr(this.acctEmail, () => window.location.reload());
      } else if (ApiErr.isNetErr(e)) {
        Xss.sanitizeRender('#content', `Failed to load due to internet connection. ${Ui.retryLink()}`);
      } else {
        Catch.reportErr(e);
        Xss.sanitizeRender('#content', `Unknown error happened when fetching account info. ${Ui.retryLink()}`);
      }
    }
    const subscription = await Store.subscription(this.acctEmail); // updated in accountGetAndUpdateLocalStore
    if (!subscription.active) {
      if (subscription.level && subscription.expire) {
        if (subscription.method === 'trial') {
          $('.status').text('Your trial has expired on ' + Str.datetimeToDate(subscription.expire) + '. Upgrade now to continue using FlowCrypt Advanced.');
        } else if (subscription.method === 'group') {
          $('.status').text('Your group licensing is due for renewal. Please check with company leadership.');
        } else {
          $('.status').text('Your subscription has ended on ' + subscription.expire + '. Renew now to continue using FlowCrypt Advanced.');
        }
        $('.action_get_trial').css('display', 'none');
        $('.action_show_stripe').removeClass('gray').addClass('green');
      } else {
        $('.status').text('After the trial, your account will automatically switch to Free Forever.');
      }
    } else if (subscription.active && subscription.method === 'trial') {
      Xss.sanitizeRender('.status',
        'After the trial, your account will automatically switch to Free Forever.<br/><br/>You can subscribe now to stay on FlowCrypt Advanced. It\'s $5 a month.');
    }
    if (subscription.active) {
      if (subscription.method === 'trial') {
        $('.list_table').css('display', 'none');
        $('.action_get_trial').css('display', 'none');
        $('.action_show_stripe').removeClass('gray').addClass('green');
      } else {
        Xss.sanitizeRender('#content', `<div class="line">${Lang.account.alreadyUpgraded}</div><div class="line"><button class="button green long action_close">close</button></div>`);
        $('.action_close').click(this.setHandler(() => this.closeDialog()));
      }
    }
  }

  private showStripeHandler = () => {
    $('.status').text('You are subscribing to a $5 monthly payment for FlowCrypt Advanced.');
    $('.hide_on_checkout').css('display', 'none');
    $('.stripe_checkout').css('display', 'block');
  }

  private subscribeAndHandleResult = async (chosenProduct: Product, source: string | undefined) => {
    try {
      const response = await Backend.accountSubscribe(this.authInfo!, chosenProduct.id!, chosenProduct.method!, source);
      if (response.subscription.level === chosenProduct.level && response.subscription.method === chosenProduct.method) {
        await Ui.modal.info('Successfully upgraded to FlowCrypt Advanced.');
        this.closeDialog();
      }
      throw new Error('Something went wrong when upgrading (values don\'t match), please email human@flowcrypt.com to get this resolved.');
    } catch (e) {
      const renderErr = (msg: string, e?: any) => {
        msg = Xss.escape(msg);
        const debug = e ? `<pre>${Xss.escape(JSON.stringify(e, undefined, 2))}</pre>` : '';
        Xss.sanitizeRender('#content', `<br><br><br><div class="line">Could not complete action: ${msg}. ${Ui.retryLink()}</div><br><br>${debug}`);
      };
      if (ApiErr.isNetErr(e)) {
        renderErr('network error');
      } else if (ApiErr.isAuthErr(e)) {
        renderErr('auth error', e);
      } else {
        renderErr('unknown error. Please write us at human@flowcrypt.com to get this resolved', e);
        Catch.reportErr(e);
      }
    }
  }

  private stripeCcEnteredHandler = async ({ token }: Bm.StripeResult) => {
    $('.stripe_checkout').text('').css('display', 'none');
    await this.subscribeAndHandleResult(this.PRODUCTS.advancedMonthly, token);
  }

  private closeDialog = () => {
    $('body').attr('data-test-state', 'closed'); // used by automated tests
    if (this.placement === 'settings_compose') {
      window.close();
    } else if (this.placement === 'settings') {
      BrowserMsg.send.reload(this.parentTabId, {});
    } else {
      BrowserMsg.send.closeDialog(this.parentTabId);
    }
  }
});
