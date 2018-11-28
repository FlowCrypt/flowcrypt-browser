/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Str } from './../../js/common/common.js';
import { Xss, Ui, XssSafeFactory, Env } from '../../js/common/browser.js';
import { FcAcct, CheckVerificationEmail } from './../../js/common/account.js';
import { Lang } from './../../js/common/lang.js';
import { Api } from '../../js/common/api/api.js';
import { BrowserMsg, Bm } from '../../js/common/extension.js';
import { Catch } from '../../js/common/catch.js';
import { GoogleAuth } from '../../js/common/api/google.js';

Catch.try(async () => {

  Ui.event.protect();

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'placement', 'isAuthErr', 'parentTabId', 'subscribeResultTabId']);
  let acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  const subscribeResultTabId = Env.urlParamRequire.optionalString(uncheckedUrlParams, 'subscribeResultTabId');
  const placement = Env.urlParamRequire.oneof(uncheckedUrlParams, 'placement', ['settings', 'settings_compose', 'default', 'dialog', 'gmail', 'embedded', 'compose', undefined]);
  const isAuthErr = uncheckedUrlParams.isAuthErr === true;

  const authInfo = await Store.authInfo();
  if (authInfo.acctEmail) {
    acctEmail = authInfo.acctEmail; // todo - allow user to select and confirm email address
  }
  let origBtnContent: string;
  let origBtnSel: JQuery<HTMLElement>;

  const handleErrRes = (e: any) => {
    const renderErr = (msg: string, e?: any) => {
      msg = Xss.escape(msg);
      const debug = e ? `<pre>${Xss.escape(JSON.stringify(e, undefined, 2))}</pre>` : '';
      Xss.sanitizeRender('#content', `<br><br><br><div class="line">Could not complete action: ${msg}. ${Ui.retryLink()}</div><br><br>${debug}`);
    };
    if (Api.err.isNetErr(e)) {
      renderErr('network error');
    } else if (Api.err.isAuthErr(e)) {
      renderErr('auth error', e);
    } else if (e instanceof CheckVerificationEmail) {
      $('.action_get_trial, .action_add_device').css('display', 'none');
      $('.action_close').text('ok');
      renderStatusText(e.message);
      btnRestore();
    } else {
      renderErr('unknown error. Please write us at human@flowcrypt.com to get this resolved', e);
      Catch.handleErr(e);
    }
  };

  const stripeCcEnteredHandler: Bm.ResponselessHandler = async ({ token }: Bm.StripeResult) => {
    $('.stripe_checkout').text('').css('display', 'none');
    try {
      await fcAccount.subscribe(acctEmail, fcAccount.PRODUCTS.advancedMonthly, token);
      handleSuccessfulUpgrade();
    } catch (e) {
      handleErrRes(e);
    }
  };

  const renderStatusText = (content: string) => {
    $('.status').text(content);
  };

  const btnSpin = (element: HTMLElement) => {
    origBtnContent = $(element).html();
    origBtnSel = $(element);
    Xss.sanitizeRender(element, Ui.spinner('white'));
  };

  const btnRestore = () => {
    Xss.sanitizeRender(origBtnSel, origBtnContent);
  };

  const handleSuccessfulUpgrade = () => {
    BrowserMsg.send.notificationShow(parentTabId, { notification: 'Successfully upgraded to FlowCrypt Advanced.' });
    if (subscribeResultTabId) {
      BrowserMsg.send.subscribeResult(subscribeResultTabId, { active: true });
    }
    closeDialog();
  };

  const closeDialog = () => {
    if (placement === 'settings_compose') {
      window.close();
    } else if (placement === 'settings') {
      BrowserMsg.send.reload(parentTabId, {});
    } else {
      BrowserMsg.send.closeDialog(parentTabId);
    }
  };

  try {
    await Api.fc.accountCheckSync();
  } catch (e) {
    if (Api.err.isAuthErr(e)) {
      // todo - handle auth error - add device
      Xss.sanitizeRender('#content', `Failed to load - unknown device. ${Ui.retryLink()}`);
    } else if (Api.err.isNetErr(e)) {
      Xss.sanitizeRender('#content', `Failed to load due to internet connection. ${Ui.retryLink()}`);
    } else {
      Catch.handleErr(e);
      Xss.sanitizeRender('#content', `Unknown error happened when fetching account info. ${Ui.retryLink()}`);
    }
  }

  const subscription = await Store.subscription();
  const { google_token_scopes } = await Store.getAcct(acctEmail, ['google_token_scopes']);
  const canReadEmail = GoogleAuth.hasScope(google_token_scopes || [], 'read');
  const fcAccount = new FcAcct({ renderStatusText }, canReadEmail);

  if (placement === 'settings') {
    $('#content').removeClass('dialog').css({ 'margin-top': 0, 'margin-bottom': 30 });
    $('.line.button_padding').css('padding', 0);
  } else {
    $('body').css('overflow', 'hidden');
  }
  if (isAuthErr) {
    $('.list_table').css('display', 'block');
  } else {
    $('.action_get_trial').addClass('action_add_device').removeClass('action_get_trial').text('Add Device');
  }
  $('#content').css('display', 'block');

  $('.action_show_stripe').click(Ui.event.handle(() => {
    $('.status').text('You are subscribing to a $5 monthly payment for FlowCrypt Advanced.');
    $('.hide_on_checkout').css('display', 'none');
    $('.stripe_checkout').css('display', 'block');
  }));

  $('.action_contact_page').click(Ui.event.handle(() => BrowserMsg.send.bg.settings({ page: '/chrome/settings/modules/contact_page.htm', acctEmail })));

  $('.action_close').click(Ui.event.handle(closeDialog));

  $('.action_get_trial').click(Ui.event.prevent('parallel', async (target, done) => {
    btnSpin(target);
    try {
      await fcAccount.subscribe(acctEmail, fcAccount.PRODUCTS.trial, undefined);
      handleSuccessfulUpgrade();
    } catch (e) {
      handleErrRes(e);
    }
    done();
  }));

  $('.action_add_device').click(Ui.event.prevent('parallel', async (target, done) => {
    btnSpin(target);
    try {
      await fcAccount.registerNewDevice(acctEmail);
      closeDialog();
    } catch (e) {
      handleErrRes(e);
    }
    done();
  }));

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
    Xss.sanitizeRender('.status', 'After the trial, your account will automatically switch to Free Forever.<br/><br/>You can subscribe now to stay on FlowCrypt Advanced. It\'s $5 a month.');
  } else {
    // todo - upgrade to business
  }
  if (subscription.active) {
    if (isAuthErr) {
      if (subscription.method === 'trial') {
        $('.list_table').css('display', 'none');
        $('.action_get_trial').css('display', 'none');
        $('.action_show_stripe').removeClass('gray').addClass('green');
      } else {
        Xss.sanitizeRender('#content', `<div class="line">${Lang.account.alreadyUpgraded}</div><div class="line"><div class="button green long action_close">close</div></div>`);
        $('.action_close').click(Ui.event.handle(() => {
          if (subscribeResultTabId) {
            BrowserMsg.send.subscribeResult(subscribeResultTabId, { active: true });
          }
          closeDialog();
        }));
      }
    } else {
      $('h1').text('New Device');
      $('.action_show_stripe, .action_show_group').css('display', 'none');
      $('.status').text(`This browser or device is not registered on your FlowCrypt Account (${acctEmail}).`);
      $('.action_add_device, .action_close').addClass('long');
      // try API call auth in case it got fixed meanwhile
      try {
        await Api.fc.accountUpdate();
        $('.status').text(`Successfully verified your new device for your FlowCrypt Account (${acctEmail}).`);
        $('.action_add_device').css('display', 'none');
        $('.action_close').removeClass('gray').addClass('green').text('ok');
      } catch (e) {
        if (!Api.err.isAuthErr(e) && !Api.err.isNetErr(e)) {
          Catch.handleErr(e);
        }
      }
    }
  }

  const tabId = await BrowserMsg.requiredTabId();
  BrowserMsg.addListener('stripe_result', stripeCcEnteredHandler);
  BrowserMsg.listen(tabId);

  $('.stripe_checkout').html(`${Lang.account.creditOrDebit}<br><br>${new XssSafeFactory(acctEmail, tabId).embeddedStripeCheckout()}<br>${Ui.retryLink('back')}`); // xss-safe-factory

})();
