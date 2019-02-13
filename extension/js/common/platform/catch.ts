/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { VERSION } from '../core/const.js';
import { Store } from './store.js';

export class UnreportableError extends Error { }
export type ObjWithStack = { stack: string };

export class Catch {

  public static RUNTIME_ENVIRONMENT = 'undetermined';
  private static ORIG_ONERROR = window.onerror;
  private static CONSOLE_MSG = ' Please report errors above to human@flowcrypt.com. We fix errors VERY promptly.';
  private static IGNORE_ERR_MSG = [
    // happens in gmail window when reloaded extension + now reloading gmail
    'Invocation of form get(, function) doesn\'t match definition get(optional string or array or object keys, function callback)',
    // happens in gmail window when reloaded extension + now reloading gmail
    'Invocation of form set(, function) doesn\'t match definition set(object items, optional function callback)',
    // not sure when this one happens, but likely have to do with extnsion lifecycle as well
    'Invocation of form runtime.connect(null, ) doesn\'t match definition runtime.connect(optional string extensionId, optional object connectInfo)',
    // this is thrown often by gmail and cought by content script
    'TypeError: a is null',
    'TypeError: d is null',
    'TypeError: G is null',
    'TypeError: window.opener is null',
    // errors on other domains: https://bugzilla.mozilla.org/show_bug.cgi?id=363897
    'Script error.',
    // benign error https://github.com/WICG/ResizeObserver/issues/38#issuecomment-422126006 https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
    'ResizeObserver loop limit exceeded',
  ];

  public static rewrapErr = (e: any, message: string) => {
    const newErr = new Error(`${message}::${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
    newErr.stack += `\n\n${Catch.stringify(e)}`;
    return newErr;
  }

  public static stringify = (e: any) => {
    if (e instanceof Error) {
      return `[typeof:Error:${e.name}] ${e.message}\n\n${e.stack}`;
    }
    if (typeof e === 'string') {
      return `[typeof:string] ${e}`;
    }
    try {
      return `[typeof:${(typeof e)}:${String(e)}] ${JSON.stringify(e)}`;
    } catch (cannotStringify) {
      return `[unstringifiable typeof:${(typeof e)}:${String(e)}]`;
    }
  }

  public static hasStack = (e: any): e is ObjWithStack => {
    return e && typeof e === 'object' && typeof (e as ObjWithStack).stack === 'string' && Boolean((e as ObjWithStack).stack);
  }

  public static onErrorInternalHandler = (errMsg: string | undefined, url: string, line: number, col: number, originalErr: any, isManuallyCalled: boolean) => {
    if (errMsg && Catch.IGNORE_ERR_MSG.indexOf(errMsg) !== -1) {
      return;
    }
    let exception: Error;
    if (typeof originalErr !== 'object') {
      exception = new Error(`THROWN_NON_OBJECT[${typeof originalErr}]: ${String(originalErr)}`);
    } else if (errMsg && url && typeof line !== 'undefined' && !col && !originalErr && !isManuallyCalled) {
      exception = new Error(`LIMITED_ERROR: ${errMsg}`);
    } else if (originalErr instanceof Error) {
      exception = originalErr;
      if (originalErr.hasOwnProperty('thrown')) { // this is created by custom async stack reporting in tooling/tsc-compiler.ts
        exception.stack += `\n\ne.thrown:\n${Catch.stringify((originalErr as any).thrown)}`;
      }
    } else {
      exception = new Error(`THROWN_OBJECT: ${errMsg}`);
      if (Catch.hasStack(originalErr)) {
        exception.stack += `\n\nORIGINAL_THROWN_OBJECT_STACK:\n${originalErr.stack}\n\n`;
      }
      exception.stack += `\n\nORIGINAL_ERR:\n${Catch.stringify(originalErr)}`;
    }
    if (Catch.IGNORE_ERR_MSG.indexOf(exception.message) !== -1) {
      return;
    }
    console.error(originalErr);
    if (exception !== originalErr) {
      console.error(exception);
    }
    console.log(`%c[${exception.message}]\n${exception.stack}`, 'color: #F00; font-weight: bold;');
    if (isManuallyCalled !== true && Catch.ORIG_ONERROR && Catch.ORIG_ONERROR !== (Catch.onErrorInternalHandler as ErrorEventHandler)) {
      // @ts-ignore
      const args: any = Array.from(arguments);
      Catch.ORIG_ONERROR.apply(undefined, args as any); // Call any previously assigned handler
    }
    if (exception instanceof UnreportableError) {
      return;
    }
    if ((exception.stack || '').indexOf('PRIVATE') !== -1) {
      exception.stack = '~censored:PRIVATE';
    }
    try {
      $.ajax({
        url: 'https://flowcrypt.com/api/help/error',
        method: 'POST',
        data: JSON.stringify({
          name: exception.name.substring(0, 50),
          message: exception.message.substring(0, 200),
          url: (url || '').substring(0, 100),
          line: line || 0,
          col: col || 0,
          trace: exception.stack || '',
          version: VERSION,
          environment: Catch.RUNTIME_ENVIRONMENT,
        }),
        dataType: 'json',
        crossDomain: true,
        contentType: 'application/json; charset=UTF-8',
        async: true,
        success: (response: { saved: boolean }) => {
          if (response && typeof response === 'object' && response.saved === true) {
            console.log('%cFlowCrypt ERROR:' + Catch.CONSOLE_MSG, 'font-weight: bold;');
          } else {
            console.error('%cFlowCrypt EXCEPTION:' + Catch.CONSOLE_MSG, 'font-weight: bold;');
          }
        },
        error: (req, status, error) => {
          console.error('%cFlowCrypt FAILED:' + Catch.CONSOLE_MSG, 'font-weight: bold;');
        },
      });
    } catch (ajaxErr) {
      console.error(ajaxErr);
      console.error('%cFlowCrypt ISSUE:' + Catch.CONSOLE_MSG, 'font-weight: bold;');
    }
    try {
      Store.saveError(exception);
    } catch (storageErr) {
      console.error(`failed to locally log error ${String(exception)} because: ${String(storageErr)}`);
    }
    return true;
  }

  private static getErrorLineAndCol = (e: any) => {
    try {
      const callerLine = e.stack!.split('\n')[1]; // tslint:disable-line:no-unsafe-any
      const matched = callerLine.match(/\.js:([0-9]+):([0-9]+)\)?/); // tslint:disable-line:no-unsafe-any
      return { line: Number(matched![1]), col: Number(matched![2]) }; // tslint:disable-line:no-unsafe-any
    } catch (lineErr) {
      return { line: 0, col: 0 };
    }
  }

  public static handleErr = (e: any) => {
    const { line, col } = Catch.getErrorLineAndCol(e);
    Catch.onErrorInternalHandler(e instanceof Error ? e.message : String(e), window.location.href, line, col, e, true);
  }

  private static nameAndDetailsAsException = (name: string, details: any): Error => {
    try {
      throw new Error(name);
    } catch (e) {
      (e as Error).stack += `\n\n\ndetails:\n${Catch.stringify(details)}`;
      return e as Error;
    }
  }

  public static report = (name: string, details?: any) => {
    Catch.handleErr(Catch.nameAndDetailsAsException(name, details));
  }

  public static log = (name: string, details?: any) => {
    const e = Catch.nameAndDetailsAsException(`Catch.log: ${name}`, details);
    try {
      Store.saveError(e, name);
    } catch (storageErr) {
      console.error(`failed to locally log "${String(name)}" because "${String(storageErr)}"`);
    }
  }

  public static isPromise = (v: any): v is Promise<any> => {
    return v && typeof v === 'object' && typeof (v as Promise<any>).then === 'function' && typeof (v as Promise<any>).catch === 'function';
  }

  public static try = (code: Function) => () => { // tslint:disable-line:ban-types // returns a function
    try {
      const r = code();
      if (Catch.isPromise(r)) {
        r.catch(Catch.handleErr);
      }
    } catch (codeErr) {
      Catch.handleErr(codeErr);
    }
  }

  public static browser = () => {  // http://stackoverflow.com/questions/4825498/how-can-i-find-out-which-browser-a-user-is-using
    if (/Firefox[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return { name: 'firefox', v: Number(RegExp.$1) };
    } else if (/MSIE (\d+\.\d+);/.test(navigator.userAgent)) {
      return { name: 'ie', v: Number(RegExp.$1) };
    } else if (/Chrome[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return { name: 'chrome', v: Number(RegExp.$1) };
    } else if (/Opera[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return { name: 'opera', v: Number(RegExp.$1) };
    } else if (/Safari[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return { name: 'safari', v: Number(RegExp.$1) };
    } else {
      return { name: 'unknown', v: undefined };
    }
  }

  public static environment = (url = window.location.href): string => {
    const browserName = Catch.browser().name;
    let env = 'unknown';
    if (url.indexOf('bnjglocicd') !== -1) {
      env = 'ex:prod';
    } else if (url.indexOf('gjdhkacdgd') !== -1 || url.indexOf('gggocmadhd') !== -1) {
      env = 'ex:dev';
    } else if (url.indexOf('gjdhkacdgd') !== -1) { // in case it differs in the future
      env = 'ex:test';
    } else if (url.indexOf('mefaeofbcc') !== -1) {
      env = 'ex:stable';
    } else if (/chrome-extension:\/\/[a-z]{32}\/.+/.test(url)) {
      env = 'ex:fork';
    } else if (/moz-extension:\/\/.+/.test(url)) {
      env = 'ex';
    } else if (url.indexOf('l.flowcrypt.com') !== -1 || url.indexOf('127.0.0.1') !== -1) {
      env = 'web:local';
    } else if (url.indexOf('cryptup.org') !== -1 || url.indexOf('flowcrypt.com') !== -1) {
      env = 'web:prod';
    } else if (url.indexOf('mail.google.com') !== -1) {
      env = 'ex:script:gmail';
    } else if (url.indexOf('inbox.google.com') !== -1) {
      env = 'ex:script:inbox';
    }
    return browserName + ':' + env;
  }

  public static test = (type: 'error' | 'object' = 'error') => {
    if (type === 'error') {
      throw new Error('intentional error for debugging');
    } else {
      throw { what: 'intentional thrown object for debugging' };
    }
  }

  public static stackTrace = (): string => {
    try {
      Catch.test();
    } catch (e) {
      // return stack after removing first 3 lines plus url
      return `${((e as Error).stack || '').split('\n').splice(3).join('\n')}\n\nurl: ${window.location.href}\n`;
    }
    return ''; // make ts happy - this will never happen
  }

  private static isPromiseRejectionEvent = (ev: any): ev is PromiseRejectionEvent => {
    if (ev && typeof ev === 'object') {
      const eHasReason = (ev as {}).hasOwnProperty('reason') && typeof (ev as PromiseRejectionEvent).reason === 'object';
      const eHasPromise = (ev as {}).hasOwnProperty('promise') && Catch.isPromise((ev as PromiseRejectionEvent).promise);
      return eHasReason && eHasPromise;
    }
    return false;
  }

  public static onUnhandledRejectionInternalHandler = (e: any) => {
    if (Catch.isPromiseRejectionEvent(e)) {
      Catch.handleErr(e.reason);
    } else {
      const str = Catch.stringify(e);
      if (str.match(/^\[typeof:object:\[object (PromiseRejectionEvent|CustomEvent|ProgressEvent)\]\] \{"isTrusted":(?:true|false)\}$/)) {
        return; // unrelated to FlowCrypt, has to do with JS-initiated clicks/events
      }
      const { line, col } = Catch.getErrorLineAndCol(e);
      const msg = e instanceof Error ? e.message : String(e);
      Catch.onErrorInternalHandler(`REJECTION: ${msg}`, window.location.href, line, col, e, true);
    }
  }

  public static setHandledInterval = (cb: () => void, ms: number): number => {
    return window.setInterval(Catch.try(cb), ms); // error-handled: else setInterval will silently swallow errors
  }

  public static setHandledTimeout = (cb: () => void, ms: number): number => {
    return window.setTimeout(Catch.try(cb), ms); // error-handled: else setTimeout will silently swallow errors
  }

}

Catch.RUNTIME_ENVIRONMENT = Catch.environment();
window.onerror = (Catch.onErrorInternalHandler as ErrorEventHandler);
window.onunhandledrejection = Catch.onUnhandledRejectionInternalHandler;
