/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Serializable } from './store.js';
import { FcWindow } from './extension.js';
import { Dict, StandardError, Value } from './common.js';
import { Env } from './browser.js';

const VERSION = '[BUILD_REPLACEABLE_VERSION]';

export class UnreportableError extends Error { }

export class Catch {

  public static RUNTIME_VERSION = VERSION;
  public static RUNTIME_ENVIRONMENT = 'undetermined';
  private static ORIG_ONERROR = window.onerror;

  public static onErr = (errMsg: string | undefined, url: string, line: number, col: number, err: string | Error | Dict<Serializable>, isManuallyCalled: boolean) => {
    if (typeof err === 'string') {
      errMsg = err;
      err = { name: 'thrown_string', message: errMsg, stack: errMsg };
    }
    if (errMsg && url && typeof line !== 'undefined' && !col && !err && !isManuallyCalled) { // safari has limited support
      err = { name: 'safari_error', message: errMsg, stack: errMsg };
    }
    if (typeof errMsg === 'undefined' && line === 0 && col === 0 && isManuallyCalled && typeof err === 'object' && !(err instanceof Error)) {
      let stringified;
      try { // this sometimes happen with unhandled Promise.then(_, reject)
        stringified = JSON.stringify(err);
      } catch (cannot) {
        stringified = 'typeof: ' + (typeof err) + '\n' + String(err);
      }
      err = { name: 'thrown_object', message: err.message || '(unknown)', stack: stringified };
      errMsg = 'thrown_object';
    }
    let userLogMsg = ' Please report errors above to human@flowcrypt.com. I fix errors VERY promptly.';
    let ignoredErrs = [
      // happens in gmail window when reloaded extension + now reloading gmail
      'Invocation of form get(, function) doesn\'t match definition get(optional string or array or object keys, function callback)',
      // happens in gmail window when reloaded extension + now reloading gmail
      'Invocation of form set(, function) doesn\'t match definition set(object items, optional function callback)',
      'Invocation of form runtime.connect(null, ) doesn\'t match definition runtime.connect(optional string extensionId, optional object connectInfo)',
    ];
    if (!err) {
      return;
    }
    if (err instanceof Error && ignoredErrs.indexOf(err.message) !== -1) {
      return true;
    }
    if (err instanceof Error && err.stack) {
      console.log('%c[' + errMsg + ']\n' + err.stack, 'color: #F00; font-weight: bold;');
    } else {
      console.error(err);
      console.log('%c' + errMsg, 'color: #F00; font-weight: bold;');
    }
    if (isManuallyCalled !== true && Catch.ORIG_ONERROR && Catch.ORIG_ONERROR !== (Catch.onErr as ErrorEventHandler)) {
      Catch.ORIG_ONERROR.apply(null, arguments); // Call any previously assigned handler
    }
    if (err instanceof Error && (err.stack || '').indexOf('PRIVATE') !== -1) {
      return;
    }
    if (err instanceof UnreportableError) {
      return;
    }
    try {
      $.ajax({
        url: 'https://flowcrypt.com/api/help/error',
        method: 'POST',
        data: JSON.stringify({
          name: ((err as Error).name || '').substring(0, 50), // todo - remove cast & debug
          message: (errMsg || '').substring(0, 200),
          url: (url || '').substring(0, 100),
          line: line || 0,
          col: col || 0,
          trace: (err as Error).stack || '', // todo - remove cast & debug
          version: Catch.RUNTIME_VERSION,
          environment: Catch.RUNTIME_ENVIRONMENT,
        }),
        dataType: 'json',
        crossDomain: true,
        contentType: 'application/json; charset=UTF-8',
        async: true,
        success: (response) => {
          if (response.saved === true) {
            console.log('%cFlowCrypt ERROR:' + userLogMsg, 'font-weight: bold;');
          } else {
            console.log('%cFlowCrypt EXCEPTION:' + userLogMsg, 'font-weight: bold;');
          }
        },
        error: (req, status, error) => {
          console.log('%cFlowCrypt FAILED:' + userLogMsg, 'font-weight: bold;');
        },
      });
    } catch (ajaxErr) {
      console.log(ajaxErr.message);
      console.log('%cFlowCrypt ISSUE:' + userLogMsg, 'font-weight: bold;');
    }
    try {
      Store.saveError(err, errMsg);
    } catch (storageErr) {
      console.error('failed to locally log error "' + String(errMsg) + '" because: ' + storageErr.message);
    }
    return true;
  }

  public static handleException = (exception: any) => {
    let line, col;
    try {
      let callerLine = exception.stack!.split('\n')[1]; // will be catched below
      let matched = callerLine.match(/\.js:([0-9]+):([0-9]+)\)?/);
      line = Number(matched![1]); // will be catched below
      col = Number(matched![2]); // will be catched below
    } catch (lineErr) {
      line = 0;
      col = 0;
    }
    Catch.onErr(exception.message, window.location.href, line, col, exception, true);
  }

  public static report = (name: string, details: Error | Serializable | StandardError | PromiseRejectionEvent = undefined) => {
    try {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(name);
    } catch (e) {
      if (typeof details !== 'string') {
        try {
          details = JSON.stringify(details);
        } catch (stringifyErr) {
          details = '(could not stringify details "' + String(details) + '" in Catch.report because: ' + stringifyErr.message + ')';
        }
      }
      e.stack = e.stack + '\n\n\ndetails: ' + details;
      Catch.handleException(e);
    }
  }

  public static log = (name: string, details: Serializable | Error | Dict<Serializable> = undefined) => {
    name = 'Catch.log: ' + name;
    console.log(name);
    try {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(name);
    } catch (localErr) {
      let e = localErr as Error;
      if (typeof details !== 'string') {
        try {
          details = JSON.stringify(details);
        } catch (stringifyError) {
          details = '(could not stringify details "' + String(details) + '" in Catch.log because: ' + stringifyError.message + ')';
        }
      }
      e.stack = e.stack + '\n\n\ndetails: ' + details;
      try {
        Store.saveError(localErr, name);
      } catch (storageErr) {
        console.error('failed to locally log info "' + String(name) + '" because: ' + storageErr.message);
      }
    }
  }

  public static version = (format = 'original') => {
    if (format === 'int') {
      return Number(Catch.RUNTIME_VERSION.replace(/\./g, ''));
    } else {
      return Catch.RUNTIME_VERSION;
    }
  }

  public static try = (code: Function) => () => { // tslint:disable-line:ban-types // returns a function
    try {
      let r = code();
      if (r && typeof r === 'object' && typeof r.then === 'function' && typeof r.catch === 'function') { // a promise - async catching
        r.catch(Catch.rejection);
      }
    } catch (codeErr) {
      Catch.handleException(codeErr);
    }
  }

  public static environment = (url = window.location.href): string => {
    let browserName = Env.browser().name;
    let env = 'unknown';
    if (url.indexOf('bnjglocicd') !== -1) {
      env = 'ex:prod';
    } else if (url.indexOf('gjdhkacdgd') !== -1) {
      env = 'ex:dev';
    } else if (url.indexOf('gjdhkacdgd') !== -1) { // in case it differs in the future
      env = 'ex:test';
    } else if (url.indexOf('l.flowcrypt.com') !== -1 || url.indexOf('127.0.0.1') !== -1) {
      env = 'web:local';
    } else if (url.indexOf('cryptup.org') !== -1 || url.indexOf('flowcrypt.com') !== -1) {
      env = 'web:prod';
    } else if (/chrome-extension:\/\/[a-z]{32}\/.+/.test(url)) {
      env = 'ex:fork';
    } else if (url.indexOf('mail.google.com') !== -1) {
      env = 'ex:script:gmail';
    } else if (url.indexOf('inbox.google.com') !== -1) {
      env = 'ex:script:inbox';
    } else if (/moz-extension:\/\/.+/.test(url)) {
      env = 'ex';
    }
    return browserName + ':' + env;
  }

  public static test = () => {
    // @ts-ignore - intentional exception
    thisWillFail();
  }

  public static promiseErrAlert = (note: string) => (error: Error) => { // returns a function
    console.log(error);
    alert(note);
  }

  public static stackTrace = (): string => {
    try {
      Catch.test();
    } catch (e) {
      return e.stack.split('\n').splice(3).join('\n'); // return stack after removing first 3 lines
    }
    return ''; // make ts happy - this will never happen
  }

  public static rejection = (e: PromiseRejectionEvent | StandardError | Error) => {
    if (!(e instanceof UnreportableError)) {
      let eHasReason = e && typeof e === 'object' && e.hasOwnProperty('reason') && typeof (e as PromiseRejectionEvent).reason === 'object';
      if (eHasReason && (e as PromiseRejectionEvent).reason && (e as PromiseRejectionEvent).reason.message) {
        Catch.handleException((e as PromiseRejectionEvent).reason); // actual exception that happened in Promise, unhandled
      } else if (!Value.is(JSON.stringify(e)).in(['{"isTrusted":false}', '{"isTrusted":true}'])) {  // unrelated to FlowCrypt, has to do with JS-initiated clicks/events
        if (typeof e === 'object' && typeof (e as StandardError).stack === 'string' && (e as StandardError).stack) { // thrown object that has a stack attached
          let stack = (e as StandardError).stack;
          delete (e as StandardError).stack;
          Catch.report('unhandled_promise_reject_object with stack', `${JSON.stringify(e)}\n\n${stack}`);
        } else {
          Catch.report('unhandled_promise_reject_object', e); // some x that was called with reject(x) and later not handled
        }
      }
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
(window as FcWindow).onerror = (Catch.onErr as ErrorEventHandler);
(window as FcWindow).onunhandledrejection = Catch.rejection;
