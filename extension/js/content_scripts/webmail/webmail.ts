/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// todo - a few things are duplicated here, refactor

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />

import { Catch, Str, Value, Env } from '../../common/common.js';
import { Store } from '../../common/store.js';
import { Injector } from '../../common/inject.js';
import { Notifications } from '../../common/notifications.js';
import { InboxElementReplacer } from './inbox_element_replacer.js';
import { GmailElementReplacer } from './gmail_element_replacer.js';
import { contentScriptSetupIfVacant, WebmailVariantObject } from './setup_webmail_content_script.js';
import { Api } from '../../common/api.js';
import { ContentScriptWindow, FcWindow } from '../../common/extension.js';
import { XssSafeFactory } from '../../common/browser.js';

Catch.try(async () => {

  let gmailWebmailStartup = async () => {
    const replacePgElsIntervalMs = 1000;
    let replacePgpElsInterval: number;
    let replacer: GmailElementReplacer;
    let hostPageInfo: WebmailVariantObject;

    let getUserAccountEmail = (): undefined|string => {
      if (window.location.search.indexOf('&view=btop&') === -1) {  // when view=btop present, FlowCrypt should not be activated
        if (hostPageInfo.email) {
          return hostPageInfo.email;
        }
        let accountEmailLoadingMatch = $("#loading div.msg").text().match(/[a-z0-9._\-]+@[^…< ]+/gi);
        if (accountEmailLoadingMatch !== null) { // try parse from loading div
          return accountEmailLoadingMatch[0].trim().toLowerCase();
        }
        let emailFromAccountDropdown = $('div.gb_Cb > div.gb_Ib').text().trim().toLowerCase();
        if (Str.isEmailValid(emailFromAccountDropdown)) {
          return emailFromAccountDropdown;
        }
      }
    };

    let getInsightsFromHostVariables = () => {
      let insights: WebmailVariantObject = {new_data_layer: null, newUi: null, email: null, gmailVariant: null};
      $('body').append(['<script>', '(function() {', // xss-direct - not sanitized because adding a <script> in intentional here
        'let payload = JSON.stringify([String(window.GM_SPT_ENABLED), String(window.GM_RFT_ENABLED), String((window.GLOBALS || [])[10])]);',
        'let e = document.getElementById("FC_VAR_PASS");',
        'if (!e) {e = document.createElement("div");e.style="display:none";e.id="FC_VAR_PASS";document.body.appendChild(e)}',
        'e.innerText=payload;',
      '})();', '</script>'].join('')); // executed synchronously - we can read the vars below
      try {
        let extracted = JSON.parse($('body > div#FC_VAR_PASS').text()).map(String);
        if (extracted[0] === 'true') {
          insights.new_data_layer = true;
        } else if (extracted[0] === 'false') {
          insights.new_data_layer = false;
        }
        if (extracted[1] === 'true') {
          insights.newUi = true;
        } else if (extracted[1] === 'false') {
          insights.newUi = false;
        }
        if (Str.isEmailValid(extracted[2])) {
          insights.email = extracted[2].trim().toLowerCase();
        }
        if (insights.new_data_layer === null && insights.newUi === null && insights.email === null) {
          insights.gmailVariant = 'html';
        } else if (insights.newUi === false) {
          insights.gmailVariant = 'standard';
        } else if (insights.newUi === true) {
          insights.gmailVariant = 'new';
        }
      } catch (e) {} // tslint:disable-line:no-empty
      return insights;
    };

    let start = async (acctEmail: string, injector: Injector, notifications: Notifications, factory: XssSafeFactory, notifyMurdered: () => void) => {
      hijackGmailHotkeys();
      let storage = await Store.getAccount(acctEmail, ['addresses', 'google_token_scopes']);
      let canReadEmails = Api.gmail.hasScope(storage.google_token_scopes || [], 'read');
      injector.buttons();
      replacer = new GmailElementReplacer(factory, acctEmail, storage.addresses || [acctEmail], canReadEmails, injector, notifications, hostPageInfo.gmailVariant);
      await notifications.showInitial(acctEmail);
      replacer.everything();
      replacePgpElsInterval = (window as ContentScriptWindow).TrySetDestroyableInterval(() => {
        if (typeof (window as FcWindow).$ === 'function') {
          replacer.everything();
        } else { // firefox will unload jquery when extension is restarted or updated
          clearInterval(replacePgpElsInterval);
          notifyMurdered();
        }
      }, replacePgElsIntervalMs);
    };

    let hijackGmailHotkeys = () => {
      let keys = Env.keyCodes();
      let unsecureReplyKeyShortcuts = [keys.a, keys.r, keys.A, keys.R, keys.f, keys.F];
      $(document).keypress(e => {
        Catch.try(() => {
          let causesUnsecureReply = Value.is(e.which).in(unsecureReplyKeyShortcuts);
          if (causesUnsecureReply && !$(document.activeElement).is('input, select, textarea, div[contenteditable="true"]') && $('iframe.reply_message').length) {
            e.stopImmediatePropagation();
            replacer.setReplyBoxEditable();
          }
        })();
      });
    };

    hostPageInfo = getInsightsFromHostVariables();
    await contentScriptSetupIfVacant({
      name: 'gmail',
      variant: hostPageInfo.gmailVariant,
      getUserAccountEmail,
      getUserFullName: () => $("div.gb_hb div.gb_lb").text() || $("div.gb_Fb.gb_Hb").text(),
      getReplacer: () => replacer,
      start,
    });
  };

  let inboxWebmailStartup = async () => {
    const replacePgpElementsIntervalMs = 1000;
    let replacePgpElsInterval: number;
    let replacer: InboxElementReplacer;
    let fullName = '';

    let start = async (acctEmail: string, injector: Injector, notifications: Notifications, factory: XssSafeFactory, notifyMurdered: () => void) => {
      let storage = await Store.getAccount(acctEmail, ['addresses', 'google_token_scopes']);
      let canReadEmails = Api.gmail.hasScope(storage.google_token_scopes || [], 'read');
      injector.buttons();
      replacer = new InboxElementReplacer(factory, acctEmail, storage.addresses || [acctEmail], canReadEmails, injector, null);
      await notifications.showInitial(acctEmail);
      replacer.everything();
      replacePgpElsInterval = (window as ContentScriptWindow).TrySetDestroyableInterval(() => {
        if (typeof (window as FcWindow).$ === 'function') {
          replacer.everything();
        } else { // firefox will unload jquery when extension is restarted or updated
          clearInterval(replacePgpElsInterval);
          notifyMurdered();
        }
      }, replacePgpElementsIntervalMs);
    };

    await contentScriptSetupIfVacant({
      name: 'inbox',
      variant: 'standard',
      getUserAccountEmail: () => {
        let creds = $('div > div > a[href="https://myaccount.google.com/privacypolicy"]').parent().siblings('div');
        if (creds.length === 2 &&  creds[0].innerText && creds[1].innerText && Str.isEmailValid(creds[1].innerText)) {
          let account_email = creds[1].innerText.toLowerCase();
          fullName =  creds[0].innerText;
          console.info('Loading for ' + account_email + ' (' + fullName + ')');
          return account_email;
        }
      },
      getUserFullName: () => fullName,
      getReplacer: () => replacer,
      start,
    });
  };

  if (window.location.host !== 'inbox.google.com') {
    await gmailWebmailStartup();
  } else {
    await inboxWebmailStartup(); // to be deprecated by Google in 2019
  }

})();
