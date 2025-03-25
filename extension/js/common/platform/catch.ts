/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Url } from '../core/common.js';
import { FLAVOR, InMemoryStoreKeys, SHARED_TENANT_API_HOST, VERSION } from '../core/const.js';
import { GlobalStore } from './store/global-store.js';
import { InMemoryStore } from './store/in-memory-store.js';

export class UnreportableError extends Error {}
export class CompanyLdapKeyMismatchError extends UnreportableError {}
type ObjWithStack = { stack: string };
export type ErrorReport = {
  name: string;
  message: string;
  url: string;
  line: number;
  col: number;
  trace: string;
  version: string;
  environment: string;
  product: string;
  buildType: string;
};

type BrowserType = 'firefox' | 'thunderbird' | 'ie' | 'chrome' | 'opera' | 'safari' | 'unknown';
export class Catch {
  public static RUNTIME_ENVIRONMENT = 'undetermined';
  private static ORIG_ONERROR = onerror;
  private static CONSOLE_MSG = ' Please report errors above to human@flowcrypt.com. We fix errors VERY promptly.';
  private static IGNORE_ERR_MSG = [
    // happens in gmail window when reloaded extension + now reloading gmail
    "Invocation of form get(, function) doesn't match definition get(optional string or array or object keys, function callback)",
    // happens in gmail window when reloaded extension + now reloading gmail
    "Invocation of form set(, function) doesn't match definition set(object items, optional function callback)",
    // not sure when this one happens, but likely have to do with extnsion lifecycle as well
    "Invocation of form runtime.connect(null, ) doesn't match definition runtime.connect(optional string extensionId, optional object connectInfo)",
    // this is thrown often by gmail and cought by content script
    'TypeError: a is null',
    'TypeError: d is null',
    'TypeError: G is null',
    'TypeError: window.opener is null',
    // errors on other domains: https://bugzilla.mozilla.org/show_bug.cgi?id=363897
    'Script error.',
    // benign error https://github.com/WICG/ResizeObserver/issues/38#issuecomment-422126006 https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
    'ResizeObserver loop limit exceeded',
    // https://github.com/FlowCrypt/flowcrypt-browser/issues/5280
    '400 when POST-ing https://flowcrypt.com/attester/welcome-message string: email,pubkey -> This key does not appear valid',
  ];

  public static rewrapErr(e: unknown, message: string): Error {
    const newErr = new Error(`${message}::${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    newErr.stack += `\n\n${Catch.stringify(e)}`;
    return newErr;
  }

  public static stringify(e: unknown): string {
    if (e instanceof Error) {
      return `[typeof:Error:${e.name}] ${e.message}\n\n${e.stack}`;
    }
    if (typeof e === 'string') {
      return `[typeof:string] ${e}`;
    }
    try {
      return `[typeof:${typeof e}:${String(e)}] ${JSON.stringify(e)}`;
    } catch {
      return `[unstringifiable typeof:${typeof e}:${String(e)}]`;
    }
  }

  public static hasStack(e: unknown): e is ObjWithStack {
    return !!e && typeof e === 'object' && typeof (e as ObjWithStack).stack === 'string' && Boolean((e as ObjWithStack).stack);
  }

  /**
   * @returns boolean - whether error was reported remotely or not
   */
  public static onErrorInternalHandler(
    errMsg: string | undefined,
    url: string,
    line: number,
    col: number,
    originalErr: unknown,
    isManuallyCalled: boolean
  ): boolean {
    const exception = Catch.formExceptionFromThrown(originalErr, errMsg, url, line, col, isManuallyCalled);
    if (Catch.IGNORE_ERR_MSG.some(err => exception.message.includes(err)) || (errMsg && Catch.IGNORE_ERR_MSG.some(err => errMsg.includes(err)))) {
      return false;
    }
    console.error(originalErr);
    if (exception !== originalErr) {
      console.error(exception);
    }
    console.error(exception.message + '\n' + exception.stack);
    if (!isManuallyCalled && Catch.ORIG_ONERROR && Catch.ORIG_ONERROR !== (Catch.onErrorInternalHandler as OnErrorEventHandler)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      Catch.ORIG_ONERROR.apply(undefined, args); // Call any previously assigned handler
    }
    if (exception instanceof UnreportableError) {
      console.error('Not reporting UnreportableError above');
      return false;
    }
    if ((exception.stack || '').includes('PRIVATE')) {
      exception.stack = '~censored:PRIVATE';
    }
    const formatted = Catch.formatExceptionForReport(exception, line, col);
    // todo - here would have to make a decision if we are sending it to flowcrypt.com or enterprise FES
    if (FLAVOR === 'enterprise') {
      console.log('enterprise flavor - not reporting this remotely');
      // if FES is set up, then on enterprise flavor, we could still send report there
      return false; // do not send to flowcrypt.com backend on enterprise flavor
    }
    // consumer flavor
    void Catch.doSendErrorToSharedTenantFes(formatted);
    return true;
  }

  /**
   * @returns boolean - whether error was reported remotely or not
   */
  public static reportErr(e: unknown): boolean {
    const { line, col } = Catch.getErrorLineAndCol(e);
    return Catch.onErrorInternalHandler(e instanceof Error ? e.message : String(e), location.href, line, col, e, true);
  }

  /**
   * @returns boolean - whether error was reported remotely or not
   */
  public static report(name: string, details?: unknown): boolean {
    return Catch.reportErr(Catch.nameAndDetailsAsException(name, details));
  }

  public static isPromise(v: unknown): v is Promise<unknown> {
    return !!v && typeof v === 'object' && typeof (v as Promise<unknown>).then === 'function' && typeof (v as Promise<unknown>).catch === 'function';
  }

  public static try(code: () => void | Promise<void>) {
    return () => {
      // returns a function
      try {
        const r = code();
        if (Catch.isPromise(r)) {
          r.catch(Catch.reportErr);
        }
      } catch (codeErr) {
        Catch.reportErr(codeErr);
      }
    };
  }

  public static browser(): {
    name: BrowserType;
    v: number | undefined;
  } {
    const userAgent = navigator.userAgent;
    const browsers = [
      { name: 'firefox', regex: /Firefox[\/\s](\d+\.\d+)/ },
      { name: 'thunderbird', regex: /Thunderbird[\/\s](\d+\.\d+)/ },
      { name: 'ie', regex: /MSIE (\d+\.\d+);/ },
      { name: 'chrome', regex: /Chrome[\/\s](\d+\.\d+)/ },
      { name: 'opera', regex: /Opera[\/\s](\d+\.\d+)/ },
      { name: 'safari', regex: /Safari[\/\s](\d+\.\d+)/ },
    ];

    for (const browser of browsers) {
      const match = browser.regex.exec(userAgent);
      if (match?.[1]) {
        return { name: browser.name as BrowserType, v: Number(match[1]) };
      }
    }

    return { name: 'unknown', v: undefined };
  }

  public static isFirefox(): boolean {
    return Catch.browser().name === 'firefox';
  }

  public static isThunderbirdMail(): boolean {
    return Catch.browser().name === 'thunderbird';
  }

  public static environment(url = location.href): string {
    const browserName = Catch.browser().name;
    const origin = new URL(location.href).origin;
    let env = 'unknown';
    if (url.includes('bnjglocicd')) {
      env = 'ex:prod';
    } else if (url.includes('gjdhkacdgd') || url.includes('gggocmadhd')) {
      env = 'ex:dev';
    } else if (url.includes('mefaeofbcc')) {
      env = 'ex:stable';
    } else if (/chrome-extension:\/\/[a-z]{32}\/.+/.test(url)) {
      env = 'ex:fork';
    } else if (/moz-extension:\/\/.+/.test(url)) {
      env = 'ex';
    } else if (origin === 'http://l.flowcrypt.com') {
      env = 'web:local';
    } else if (origin === 'https://flowcrypt.com') {
      env = 'web:prod';
    } else if (origin === 'https://mail.google.com') {
      env = 'ex:s:gmail';
    }
    return browserName + ':' + env;
  }

  public static test(type: 'error' | 'object' = 'error') {
    if (type === 'error') {
      throw new Error('intentional error for debugging');
    } else {
      // eslint-disable-next-line no-throw-literal, @typescript-eslint/only-throw-error
      throw { what: 'intentional thrown object for debugging' };
    }
  }

  public static stackTrace(): string {
    try {
      Catch.test();
    } catch (e) {
      // return stack after removing first 3 lines plus url
      return `${((e as Error).stack || '').split('\n').splice(3).join('\n')}\n\nurl: ${Catch.censoredUrl(location.href)}\n`;
    }
    return ''; // make ts happy - this will never happen
  }

  public static censoredUrl(url: string | undefined): string {
    if (!url) {
      return '(unknown url)';
    }
    const sensitiveFields = ['message', 'senderEmail', 'acctEmail'];
    for (const field of sensitiveFields) {
      url = Url.replaceUrlParam(url, field, '[SCRUBBED]');
    }
    if (url.includes('refreshToken=')) {
      return `${url.split('?')[0]}~censored:refreshToken`;
    }
    if (url.includes('token=')) {
      return `${url.split('?')[0]}~censored:token`;
    }
    if (url.includes('code=')) {
      return `${url.split('?')[0]}~censored:code`;
    }
    if (url.includes('idToken=')) {
      return `${url.split('?')[0]}~censored:idToken`;
    }
    return url;
  }

  public static onUnhandledRejectionInternalHandler(e: unknown) {
    if (Catch.isPromiseRejectionEvent(e)) {
      Catch.reportErr(e.reason);
    } else {
      const str = Catch.stringify(e);
      if (/^\[typeof:object:\[object (PromiseRejectionEvent|CustomEvent|ProgressEvent)\]\] \{"isTrusted":(?:true|false)\}$/.exec(str)) {
        return; // unrelated to FlowCrypt, has to do with JS-initiated clicks/events
      }
      const { line, col } = Catch.getErrorLineAndCol(e);
      const msg = e instanceof Error ? e.message : String(e);
      Catch.onErrorInternalHandler(`REJECTION: ${msg}`, location.href, line, col, e, true);
    }
  }

  public static setHandledInterval(cb: () => void | Promise<void>, ms: number): number {
    return window.setInterval(Catch.try(cb), ms); // error-handled: else setInterval will silently swallow errors
  }

  public static setHandledTimeout(cb: () => void | Promise<void>, ms: number): number {
    return window.setTimeout(Catch.try(cb), ms); // error-handled: else setTimeout will silently swallow errors
  }

  public static async doesReject(p: Promise<unknown>, errNeedle?: string[]) {
    try {
      await p;
      return false;
    } catch (e) {
      if (!errNeedle) {
        // no needles to check against
        return true;
      }
      return !!errNeedle.find(needle => String(e).includes(needle));
    }
  }

  public static async undefinedOnException<T>(p: Promise<T>): Promise<T | undefined> {
    try {
      return await p;
    } catch {
      return undefined;
    }
  }

  private static groupSimilarReports(value: string): string {
    return value
      .replace(/chrome-extension:\/\/[^\/]+\//, 'chrome-extension://EXTENSION_ID/')
      .replace(/https:\/\/www\.googleapis\.com\/gmail\/v1\/users\/me\/threads\/[^\/]+/, 'https://www.googleapis.com/gmail/v1/users/me/threads/THREAD_ID')
      .replace(/https:\/\/www\.googleapis\.com\/gmail\/v1\/users\/me\/messages\/[^\/]+/, 'https://www.googleapis.com/gmail/v1/users/me/messages/MESSAGE_ID')
      .replace(/https:\/\/www\.googleapis\.com\/gmail\/v1\/users\/me\/drafts\/[^\/]+/, 'https://www.googleapis.com/gmail/v1/users/me/drafts/DRAFT_ID');
  }

  private static formatExceptionForReport(thrown: unknown, line?: number, col?: number): ErrorReport {
    if (!line || !col) {
      const { line: parsedLine, col: parsedCol } = Catch.getErrorLineAndCol(thrown);
      line = parsedLine > 0 ? parsedLine : 1;
      col = parsedCol > 0 ? parsedCol : 1;
    }
    if (thrown instanceof Error) {
      // reporting stack may differ from the stack of the actual error, both may be interesting
      thrown.stack += Catch.formattedStackBlock('Catch.reportErr calling stack', Catch.stackTrace());
      if (thrown.hasOwnProperty('workerStack')) {
        // https://github.com/openpgpjs/openpgpjs/issues/656#event-1498323188
        thrown.stack += Catch.formattedStackBlock('openpgp.js worker stack', String((thrown as Error & { workerStack: string }).workerStack));
      }
    }
    const exception = Catch.formExceptionFromThrown(thrown);
    return {
      name: exception.name.substring(0, 50),
      message: Catch.groupSimilarReports(exception.message.substring(0, 200)),
      url: Catch.groupSimilarReports(location.href.split('?')[0]),
      line: line || 1,
      col: col || 1,
      trace: Catch.groupSimilarReports(exception.stack || ''),
      version: VERSION,
      environment: Catch.RUNTIME_ENVIRONMENT,
      product: 'web-ext',
      buildType: FLAVOR,
    };
  }

  private static async doSendErrorToSharedTenantFes(errorReport: ErrorReport) {
    try {
      const { acctEmail: parsedEmail } = Url.parse(['acctEmail']);
      const acctEmail = parsedEmail ? String(parsedEmail) : (await GlobalStore.acctEmailsGet())?.[0];
      if (!acctEmail) {
        console.error('Not reporting error because user is not logged in');
        return;
      }
      const idToken = await InMemoryStore.get(acctEmail, InMemoryStoreKeys.ID_TOKEN);
      void $.ajax({
        url: `${SHARED_TENANT_API_HOST}/api/v1/log-collector/exception`,
        method: 'POST',
        data: JSON.stringify(errorReport),
        dataType: 'json',
        crossDomain: true,
        contentType: 'application/json; charset=UTF-8',
        async: true,
        headers: {
          // eslint-disable-next-line @typescript-eslint/naming-convention
          Authorization: `Bearer ${idToken}`,
        },
        success: (response: { saved: boolean }) => {
          if (response && typeof response === 'object' && response.saved) {
            console.log('%cFlowCrypt ERROR:' + Catch.CONSOLE_MSG, 'font-weight: bold;');
          } else {
            console.error('%cFlowCrypt EXCEPTION:' + Catch.CONSOLE_MSG, 'font-weight: bold;');
          }
        },
        error: () => {
          console.error('%cFlowCrypt FAILED:' + Catch.CONSOLE_MSG, 'font-weight: bold;');
        },
      });
    } catch (ajaxErr) {
      console.error(ajaxErr);
      console.error('%cFlowCrypt ISSUE:' + Catch.CONSOLE_MSG, 'font-weight: bold;');
    }
  }

  private static formExceptionFromThrown(thrown: unknown, errMsg?: string, url?: string, line?: number, col?: number, isManuallyCalled?: boolean): Error {
    let exception: Error;
    if (typeof thrown !== 'object') {
      exception = new Error(`THROWN_NON_OBJECT[${typeof thrown}]: ${String(thrown as unknown)}`);
    } else if (errMsg && url && typeof line !== 'undefined' && !col && !thrown && !isManuallyCalled) {
      exception = new Error(`LIMITED_ERROR: ${errMsg}`);
    } else if (thrown instanceof Error) {
      exception = thrown;
      if (thrown.hasOwnProperty('thrown')) {
        // this is created by custom async stack reporting in tooling/tsc-compiler.ts
        exception.stack += `\n\ne.thrown:\n${Catch.stringify((thrown as Error & { thrown: string }).thrown)}`;
      }
    } else {
      exception = new Error(`THROWN_OBJECT: ${errMsg}`);
      if (Catch.hasStack(thrown)) {
        exception.stack += `\n\nORIGINAL_THROWN_OBJECT_STACK:\n${thrown.stack}\n\n`;
      }
      exception.stack += `\n\nORIGINAL_ERR:\n${Catch.stringify(thrown)}`;
    }
    return exception;
  }

  private static getErrorLineAndCol(e: unknown) {
    try {
      const callerLine = (e as { stack: string }).stack.split('\n')[1];
      const matched = /\.js:([0-9]+):([0-9]+)\)?/.exec(callerLine);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return { line: Number(matched![1]), col: Number(matched![2]) };
    } catch {
      return { line: 1, col: 1 };
    }
  }

  private static formattedStackBlock(name: string, text: string) {
    return `\n\n### ${name} ###\n# ${text.split('\n').join('\n# ')}\n######################\n`;
  }

  private static nameAndDetailsAsException(name: string, details: unknown): Error {
    try {
      throw new Error(name);
    } catch (e) {
      (e as Error).stack += `\n\n\ndetails:\n${Catch.stringify(details)}`;
      return e as Error;
    }
  }

  private static isPromiseRejectionEvent(ev: unknown): ev is PromiseRejectionEvent {
    if (ev && typeof ev === 'object') {
      const eHasReason = ev.hasOwnProperty('reason') && typeof (ev as PromiseRejectionEvent).reason === 'object';
      const eHasPromise = ev.hasOwnProperty('promise') && Catch.isPromise((ev as PromiseRejectionEvent).promise);
      return eHasReason && eHasPromise;
    }
    return false;
  }
}

Catch.RUNTIME_ENVIRONMENT = Catch.environment();
onerror = Catch.onErrorInternalHandler as OnErrorEventHandler;
onunhandledrejection = Catch.onUnhandledRejectionInternalHandler;
