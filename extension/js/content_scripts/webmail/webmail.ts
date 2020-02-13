/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// todo - a few things are duplicated here, refactor

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />

import { Bm, BrowserMsg } from '../../common/browser/browser-msg.js';
import { WebmailVariantObject, contentScriptSetupIfVacant } from './setup-webmail-content-script.js';

import { Buf } from '../../common/core/buf.js';
import { Catch } from '../../common/platform/catch.js';
import { ContentScriptWindow } from '../../common/browser/browser-window.js';
import { Env } from '../../common/browser/env.js';
import { GmailElementReplacer } from './gmail-element-replacer.js';
import { Injector } from '../../common/inject.js';
import { Notifications } from '../../common/notifications.js';
import { PgpMsg } from '../../../js/common/core/pgp-msg.js';
import { Store } from '../../common/platform/store.js';
import { Str } from '../../common/core/common.js';
import { XssSafeFactory } from '../../common/xss-safe-factory.js';

Catch.try(async () => {

  const gmailWebmailStartup = async () => {
    let replacePgpElsInterval: number;
    let replacer: GmailElementReplacer;
    let hostPageInfo: WebmailVariantObject;

    const getUserAccountEmail = (): undefined | string => {
      if (window.location.search.indexOf('&view=btop&') === -1) {  // when view=btop present, FlowCrypt should not be activated
        if (hostPageInfo.email) {
          return hostPageInfo.email;
        }
        const acctEmailLoadingMatch = $("#loading div.msg").text().match(/[a-z0-9._\-]+@[^…< ]+/gi);
        if (acctEmailLoadingMatch) { // try parse from loading div
          return acctEmailLoadingMatch[0].trim().toLowerCase();
        }
        const emailFromAccountDropdown = $('div.gb_Cb > div.gb_Ib').text().trim().toLowerCase();
        if (Str.isEmailValid(emailFromAccountDropdown)) {
          return emailFromAccountDropdown;
        }
      }
      return undefined;
    };

    const getInsightsFromHostVariables = () => {
      const insights: WebmailVariantObject = { newDataLayer: undefined, newUi: undefined, email: undefined, gmailVariant: undefined };
      $('body').append([ // xss-direct - not sanitized because adding a <script> in intentional here
        '<script>',
        '  (function() {',
        '    const payload = JSON.stringify([String(window.GM_SPT_ENABLED), String(window.GM_RFT_ENABLED), String((window.GLOBALS || [])[10])]);',
        '    let e = document.getElementById("FC_VAR_PASS");',
        '    if (!e) {e = document.createElement("div");e.style="display:none";e.id="FC_VAR_PASS";document.body.appendChild(e)}',
        '    e.innerText=payload;',
        '  })();',
        '</script>',
      ].join('')); // executed synchronously - we can read the vars below
      try {
        const extracted = (JSON.parse($('body > div#FC_VAR_PASS').text()) as any[]).map(String);
        if (extracted[0] === 'true') {
          insights.newDataLayer = true;
        } else if (extracted[0] === 'false') {
          insights.newDataLayer = false;
        }
        if (extracted[1] === 'true') {
          insights.newUi = true;
        } else if (extracted[1] === 'false') {
          insights.newUi = false;
        }
        if (Str.isEmailValid(extracted[2])) {
          insights.email = extracted[2].trim().toLowerCase();
        }
        if (typeof insights.newDataLayer === 'undefined' && typeof insights.newUi === 'undefined' && typeof insights.email === 'undefined') {
          insights.gmailVariant = 'html';
        } else if (insights.newUi === false) {
          insights.gmailVariant = 'standard';
        } else if (insights.newUi === true) {
          insights.gmailVariant = 'new';
        }
      } catch (e) {
        // no need to handle
      }
      return insights;
    };

    const start = async (acctEmail: string, injector: Injector, notifications: Notifications, factory: XssSafeFactory, notifyMurdered: () => void) => {
      hijackGmailHotkeys();
      const storage = await Store.getAcct(acctEmail, ['sendAs', 'google_token_scopes', 'full_name']);
      const scopes = await Store.getScopes(acctEmail);
      if (!storage.sendAs) {
        storage.sendAs = {};
        storage.sendAs[acctEmail] = { name: storage.full_name, isPrimary: true };
      }
      const canReadEmails = scopes.read || scopes.modify;
      injector.btns();
      replacer = new GmailElementReplacer(factory, acctEmail, storage.sendAs, canReadEmails, injector, notifications, hostPageInfo.gmailVariant);
      await notifications.showInitial(acctEmail);
      const intervaliFunctions = replacer.getIntervalFunctions();
      for (const intervalFunction of intervaliFunctions) {
        intervalFunction.handler();
        replacePgpElsInterval = (window as unknown as ContentScriptWindow).TrySetDestroyableInterval(() => {
          if (typeof (window as any).$ === 'function') {
            intervalFunction.handler();
          } else { // firefox will unload jquery when extension is restarted or updated
            clearInterval(replacePgpElsInterval);
            notifyMurdered();
          }
        }, intervalFunction.interval);
      }

    };

    const hijackGmailHotkeys = () => {
      const keys = Env.keyCodes();
      const unsecureReplyKeyShortcuts = [keys.a, keys.r, keys.A, keys.R, keys.f, keys.F];
      $(document).keypress(e => {
        Catch.try(() => {
          const causesUnsecureReply = unsecureReplyKeyShortcuts.includes(e.which);
          if (causesUnsecureReply && !$(document.activeElement!).is('input, select, textarea, div[contenteditable="true"]') && $('iframe.reply_message').length) {
            e.stopImmediatePropagation();
            replacer.setReplyBoxEditable().catch(Catch.reportErr);
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

    BrowserMsg.addListener('pgpMsgDiagnosePubkeys', PgpMsg.diagnosePubkeys);
  };

  // when we support more webmails, there will be if/else here to figure out which one to run
  // in which case each *WebmailStartup function should go into its own file
  await gmailWebmailStartup();

})();
