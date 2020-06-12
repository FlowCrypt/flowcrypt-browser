/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, UnreportableError } from './platform/catch.js';
import { Dict, UrlParam, UrlParams } from './core/common.js';
import { Browser } from './browser/browser.js';
import { KeyInfo, KeyUtil } from './core/crypto/key.js';
import { Settings } from './settings.js';
import { Ui } from './browser/ui.js';
import { Xss } from './platform/xss.js';
import { KeyStore } from './platform/store/key-store.js';
import { AcctStore } from './platform/store/acct-store.js';

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
      return Assert.abortAndRenderErrOnUrlParamValMismatch(values, name, allowed as any as UrlParam[]) as any as T; // todo - there should be a better way
    },
  };

  public static abortAndRenderErrOnUnprotectedKey = async (acctEmail?: string, tabId?: string) => {
    if (acctEmail) {
      const [primaryKi] = await KeyStore.get(acctEmail, ['primary']);
      const { setup_done } = await AcctStore.get(acctEmail, ['setup_done']);
      if (setup_done && primaryKi && !(await KeyUtil.parse(primaryKi.private)).fullyEncrypted) {
        if (window.location.pathname === '/chrome/settings/index.htm') {
          await Settings.renderSubPage(acctEmail, tabId!, '/chrome/settings/modules/change_passphrase.htm');
        } else {
          const msg = `Protect your key with a pass phrase to finish setup.`;
          const r = await Ui.renderOverlayPromptAwaitUserChoice({ finishSetup: {}, later: { color: 'gray' } }, msg);
          if (r === 'finish_setup') {
            await Browser.openSettingsPage('index.htm', acctEmail);
          }
        }
      }
    }
  }

  public static abortAndRenderErrorIfKeyinfoEmpty = (ki: KeyInfo | undefined, doThrow: boolean = true) => {
    if (!ki) {
      const msg = `Cannot find primary key. Is FlowCrypt not set up yet? ${Ui.retryLink()}`;
      Xss.sanitizeRender($('#content').length ? '#content' : 'body', msg);
      if (doThrow) {
        throw new UnreportableError(msg);
      }
    }
  }

  public static abortAndRenderErrOnUrlParamTypeMismatch = (values: UrlParams, name: string, expectedType: string): UrlParam => {
    const actualType = values[name] === null ? 'null' : typeof values[name];
    if (actualType === expectedType.replace(/\?$/, '')) { // eg expected string or optional string, and got string
      return values[name];
    }
    if (actualType === 'undefined' && expectedType.match(/\?$/)) { // optional type, got undefined: ok
      return values[name];
    }
    console.info(values[name]);  // for local debugging
    const msg = `Cannot render page (expected ${Xss.escape(name)} to be of type ${Xss.escape(expectedType)} but got ${Xss.escape(actualType)})`;
    const renderMsg = `${msg}<br><br><button class="button green long action_report_issue">report issue</button>`;
    Xss.sanitizeRender('body', renderMsg).addClass('bad').css({ padding: '20px', 'font-size': '16px' });
    $('.action_report_issue').click(Ui.event.handle(async target => {
      Catch.report(msg, { currentUrl: window.location.href, params: values });
      $('body').text('Thank you. Feel free to reach out to human@flowcrypt.com in you need assistance.');
    }));
    throw new UnreportableError(msg);
  }

  public static abortAndRenderErrOnUrlParamValMismatch = <T>(values: Dict<T>, name: string, expectedVals: T[]): T => {
    if (expectedVals.indexOf(values[name]) === -1) {
      const msg = `Cannot render page (expected ${Xss.escape(name)} to be one of ${Xss.escape(expectedVals.map(String).join(','))}
        but got ${Xss.escape(String(values[name]))}<br><br>Was the URL editted manually? Please write human@flowcrypt.com for help.`;
      Xss.sanitizeRender('body', msg).addClass('bad').css({ padding: '20px', 'font-size': '16px' });
      throw new UnreportableError(msg);
    }
    return values[name];
  }

}
