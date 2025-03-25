/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Browser } from './browser/browser.js';
import { Ui } from './browser/ui.js';
import { Dict, UrlParam, UrlParams } from './core/common.js';
import { KeyInfoWithIdentity, KeyUtil } from './core/crypto/key.js';
import { Lang } from './lang.js';
import { Catch, UnreportableError } from './platform/catch.js';
import { AcctStore } from './platform/store/acct-store.js';
import { KeyStore } from './platform/store/key-store.js';
import { Xss } from './platform/xss.js';
import { Settings } from './settings.js';
import { isCustomerUrlFesUsed } from './helpers.js';

export class AssertError extends UnreportableError {}
/**
 * Methods in this class will render a fatal message in the browser when assertion fails.
 */
export class Assert {
  public static urlParamRequire = {
    string: (values: UrlParams, name: string): string => {
      return String(Assert.abortAndRenderErrOnUrlParamTypeMismatch(values, name, 'string'));
    },
    optionalString: (values: UrlParams, name: string): string | undefined => {
      const r = Assert.abortAndRenderErrOnUrlParamTypeMismatch(values, name, 'string?');
      if (typeof r === 'string' || typeof r === 'undefined') {
        return r;
      }
      throw new Error(`urlParamRequire.optionalString: type of ${name} unexpectedly ${typeof r}`);
    },
    oneof: <T>(values: UrlParams, name: string, allowed: T[]): T => {
      return Assert.abortAndRenderErrOnUrlParamValMismatch(values, name, allowed as unknown as UrlParam[]) as unknown as T; // todo - there should be a better way
    },
  };

  public static async abortAndRenderErrOnUnprotectedKey(acctEmail?: string, tabId?: string) {
    if (acctEmail) {
      const kis = await KeyStore.get(acctEmail);
      const parsedKeys = await Promise.all(kis.map(ki => KeyUtil.parse(ki.private)));
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { setup_done } = await AcctStore.get(acctEmail, ['setup_done']);
      if (setup_done && kis.length) {
        const key = parsedKeys.find(k => !k.fullyEncrypted);
        if (key) {
          // can fix one key at a time. When they reload, it will complain about another key
          if (window.location.pathname === '/chrome/settings/index.htm') {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            await Settings.renderSubPage(acctEmail, tabId!, '/chrome/settings/modules/change_passphrase.htm');
          } else {
            const msg = `Protect your key with a pass phrase to finish setup.`;
            const r = await Ui.renderOverlayPromptAwaitUserChoice(
              { finishSetup: {}, later: { color: 'gray' } },
              msg,
              undefined,
              Lang.general.contactIfNeedAssistance(await isCustomerUrlFesUsed(acctEmail))
            );
            if (r === 'finish_setup') {
              await Browser.openSettingsPage('index.htm', acctEmail);
            }
          }
        }
      }
    }
  }

  public static abortAndRenderErrorIfKeyinfoEmpty(kis: KeyInfoWithIdentity[], doThrow = true) {
    if (!kis.length) {
      const msg = `Cannot find any account key. Is FlowCrypt not set up yet? ${Ui.retryLink()}`;
      const target = $($('#content').length ? '#content' : 'body');
      target.addClass('error-occured');
      Xss.sanitizeRender(target, msg);
      if (doThrow) {
        throw new AssertError(msg);
      }
    }
  }

  public static abortAndRenderErrOnUrlParamTypeMismatch(values: UrlParams, name: string, expectedType: string): UrlParam {
    // eslint-disable-next-line no-null/no-null
    const actualType = values[name] === null ? 'null' : typeof values[name];
    if (actualType === expectedType.replace(/\?$/, '')) {
      // eg expected string or optional string, and got string
      return values[name];
    }
    if (actualType === 'undefined' && /\?$/.exec(expectedType)) {
      // optional type, got undefined: ok
      return values[name];
    }
    console.info(values[name]); // for local debugging
    const msg = `Cannot render page (expected ${Xss.escape(name)} to be of type ${Xss.escape(expectedType)} but got ${Xss.escape(actualType)})`;
    const renderMsg = `${msg}<br><br><button class="button green long action_report_issue">report issue</button>`;
    Xss.sanitizeRender('body', renderMsg).addClass('bad').css({ padding: '20px', 'font-size': '16px' });
    $('.action_report_issue').on(
      'click',
      Ui.event.handle(async () => {
        Catch.report(msg, { currentUrl: window.location.href, params: values });
        $('body').text(`Thank you. ${Lang.general.contactIfNeedAssistance()}`);
      })
    );
    throw new AssertError(msg);
  }

  public static abortAndRenderErrOnUrlParamValMismatch<T>(values: Dict<T>, name: string, expectedVals: T[]): T {
    if (!expectedVals.includes(values[name])) {
      const msg = `Cannot render page (expected ${Xss.escape(name)} to be one of ${Xss.escape(expectedVals.map(String).join(','))}
        but got ${Xss.escape(String(values[name]))}<br><br>Was the URL editted manually? Please write human@flowcrypt.com for help.`;
      Xss.sanitizeRender('body', msg).addClass('bad').css({ padding: '20px', 'font-size': '16px' });
      throw new AssertError(msg);
    }
    return values[name];
  }
}
