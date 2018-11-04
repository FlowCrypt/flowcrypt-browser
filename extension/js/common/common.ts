/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />

'use strict';

const VERSION = '[BUILD_REPLACEABLE_VERSION]';

import { Store, FlatTypes, Serializable } from './store.js';
import { Pgp } from './pgp.js';
import { FcWindow } from './extension.js';
import { Xss, Ui, WebMailName } from './browser.js';
import { Att, FlowCryptAttLinkData } from './att.js';
import { StandardError } from './api.js';

declare const openpgp: typeof OpenPGP;

export type Dict<T> = { [key: string]: T; };
export type UrlParam = string|number|null|undefined|boolean|string[];
export type UrlParams = Dict<UrlParam>;
export type EmailProvider = 'gmail';
export interface JQS extends JQueryStatic { featherlight: Function; } // tslint:disable-line:ban-types

export class UnreportableError extends Error {}

export class Env {

  private static URL_PARAM_DICT: Dict<boolean|null> = {'___cu_true___': true, '___cu_false___': false, '___cu_null___': null};

  public static browser = () => {  // http://stackoverflow.com/questions/4825498/how-can-i-find-out-which-browser-a-user-is-using
    if (/Firefox[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return {name: 'firefox', v: Number(RegExp.$1)};
    } else if (/MSIE (\d+\.\d+);/.test(navigator.userAgent)) {
      return {name: 'ie', v: Number(RegExp.$1)};
    } else if (/Chrome[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return {name: 'chrome', v: Number(RegExp.$1)};
    } else if (/Opera[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return {name: 'opera', v: Number(RegExp.$1)};
    } else if (/Safari[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return {name: 'safari', v: Number(RegExp.$1)};
    } else {
      return {name: 'unknown', v: null};
    }
  }

  public static runtimeId = (orig=false) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      if (orig === true) {
        return chrome.runtime.id;
      } else {
        return chrome.runtime.id.replace(/[^a-z0-9]/gi, '');
      }
    }
    return null;
  }

  public static isBackgroundPage = () => Boolean(window.location && Value.is('background_page.htm').in(window.location.href));

  public static isExtension = () => Env.runtimeId() !== null;

  public static urlParamRequire = {
    string: (values: UrlParams, name: string): string => Ui.abortAndRenderErrOnUrlParamTypeMismatch(values, name, 'string') as string,
    oneof: (values: UrlParams, name: string, allowed: UrlParam[]): string => Ui.abortAndRenderErrOnUrlParamValMismatch(values, name, allowed) as string,
  };

  private static snakeCaseToCamelCase = (s: string) => s.replace(/_[a-z]/g, boundary => boundary[1].toUpperCase());

  private static camelCaseToSnakeCase = (s: string) => s.replace(/[a-z][A-Z]/g, boundary => `${boundary[0]}_${boundary[1].toLowerCase()}`);

  private static findAndProcessUrlParam = (expectedParamName: string, rawParamNameDict: Dict<string>, rawParms: Dict<string>): UrlParam => {
    if(typeof rawParamNameDict[expectedParamName] === 'undefined') {
      return undefined; // param name not found in param name dict
    }
    let rawValue = rawParms[rawParamNameDict[expectedParamName]];
    if(typeof rawValue === 'undefined') {
      return undefined; // original param name not found in raw params
    }
    if(typeof Env.URL_PARAM_DICT[rawValue] !== 'undefined') {
      return Env.URL_PARAM_DICT[rawValue]; // raw value was converted using a value dict to get proper: true, false, undefined, null
    }
    return decodeURIComponent(rawValue);
  }

  /**
   * will convert result to desired format: camelCase or snake_case, based on what was supplied in expectedKeys
   */
  public static urlParams = (expectedKeys: string[], string:string|null=null) => {
    let url = (string || window.location.search.replace('?', ''));
    let valuePairs = url.split('?').pop()!.split('&'); // str.split('?') string[].length will always be >= 1
    let rawParms: Dict<string> = {};
    let rawParamNameDict: Dict<string> = {};
    for (let valuePair of valuePairs) {
      let pair = valuePair.split('=');
      rawParms[pair[0]] = pair[1];
      rawParamNameDict[pair[0]] = pair[0];
      rawParamNameDict[Env.snakeCaseToCamelCase(pair[0])] = pair[0];
      rawParamNameDict[Env.camelCaseToSnakeCase(pair[0])] = pair[0];
    }
    let processedParams: UrlParams = {};
    for (let expectedKey of expectedKeys) {
      processedParams[expectedKey] = Env.findAndProcessUrlParam(expectedKey, rawParamNameDict, rawParms);
    }
    return processedParams;
  }

  public static urlCreate = (link: string, params: UrlParams) => {
    for (let key of Object.keys(params)) {
      let value = params[key];
      if (typeof value !== 'undefined') {
        let transformed = Value.obj.keyByValue(Env.URL_PARAM_DICT, value);
        link += (!Value.is('?').in(link) ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(String(typeof transformed !== 'undefined' ? transformed : value));
      }
    }
    return link;
  }

  public static keyCodes = () => {
    return { a: 97, r: 114, A: 65, R: 82, f: 102, F: 70, backspace: 8, tab: 9, enter: 13, comma: 188, };
  }

  public static webmails = async (): Promise<WebMailName[]> => {
    return ['gmail', 'inbox']; // async because storage may be involved in the future
  }

}

export class Catch {

  public static RUNTIME_VERSION = VERSION;
  public static RUNTIME_ENVIRONMENT = 'undetermined';
  private static ORIG_ONERROR = window.onerror;

  public static onErr = (errMsg: string|undefined, url: string, line: number, col: number, err: string|Error|Dict<Serializable>, isManuallyCalled: boolean) => {
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
      err = { name: 'thrown_object', message: err.message || '(unknown)', stack: stringified};
      errMsg = 'thrown_object';
    }
    let userLogMsg = ' Please report errors above to human@flowcrypt.com. I fix errors VERY promptly.';
    let ignoredErrs = [
      'Invocation of form get(, function) doesn\'t match definition get(optional string or array or object keys, function callback)', // happens in gmail window when reloaded extension + now reloading gmail
      'Invocation of form set(, function) doesn\'t match definition set(object items, optional function callback)', // happens in gmail window when reloaded extension + now reloading gmail
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
      if (typeof Store.getAcct === 'function' && typeof Store.set === 'function') {
        Store.getGlobal(['errors']).then(s => {
          if (typeof s.errors === 'undefined') {
            s.errors = [];
          }
          if(err instanceof Error) {
            s.errors.unshift(err.stack || errMsg || String(err));
          } else {
            s.errors.unshift(errMsg || String(err));
          }
          Store.set(null, s).catch(console.error);
        }).catch(console.error);
      }
    } catch (storageErr) {
      console.log('failed to locally log error "' + String(errMsg) + '" because: ' + storageErr.message);
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

  public static report = (name: string, details:Error|Serializable|StandardError|PromiseRejectionEvent=undefined) => {
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

  public static log = (name: string, details:Serializable|Error|Dict<Serializable>=undefined) => {
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
        Store.getGlobal(['errors']).then(s => {
          if (typeof s.errors === 'undefined') {
            s.errors = [];
          }
          s.errors.unshift(e.stack || name);
          Store.set(null, s).catch(console.error);
        }).catch(console.error);
      } catch (storageErr) {
        console.log('failed to locally log info "' + String(name) + '" because: ' + storageErr.message);
      }
    }
  }

  public static version = (format='original') => {
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

  public static environment = (url=window.location.href): string => {
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
    this_will_fail();
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

  public static rejection = (e: PromiseRejectionEvent|StandardError|Error) => {
    if(!(e instanceof UnreportableError)) {
      if (e && typeof e === 'object' && e.hasOwnProperty('reason') && typeof (e as PromiseRejectionEvent).reason === 'object' && (e as PromiseRejectionEvent).reason && (e as PromiseRejectionEvent).reason.message) {
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

export class Str {

  public static parseEmail = (emailStr: string) => {
    if (Value.is('<').in(emailStr) && Value.is('>').in(emailStr)) {
      return {
        email: emailStr.substr(emailStr.indexOf('<') + 1, emailStr.indexOf('>') - emailStr.indexOf('<') - 1).replace(/["']/g, '').trim().toLowerCase(),
        name: emailStr.substr(0, emailStr.indexOf('<')).replace(/["']/g, '').trim(),
        full: emailStr,
      };
    }
    return {
      email: emailStr.replace(/["']/g, '').trim().toLowerCase(),
      name: null,
      full: emailStr,
    };
  }

  public static prettyPrint = (obj: any) => (typeof obj === 'object') ? JSON.stringify(obj, null, 2).replace(/ /g, '&nbsp;').replace(/\n/g, '<br>') : String(obj);

  public static normalizeSpaces = (str: string) => str.replace(RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32)).replace(/\n /g, '\n');

  public static normalizeDashes = (str: string) => str.replace(/^—–|—–$/gm, '-----');

  public static normalize = (str: string) => Str.normalizeSpaces(Str.normalizeDashes(str));

  public static numberFormat = (number: number) => { // http://stackoverflow.com/questions/3753483/javascript-thousand-separator-string-format
    let nStr: string = number + '';
    let x = nStr.split('.');
    let x1 = x[0];
    let x2 = x.length > 1 ? '.' + x[1] : '';
    let rgx = /(\d+)(\d{3})/;
    while(rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  }

  public static isEmailValid = (email: string) => /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i.test(email);

  public static monthName = (monthIndex: number) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][monthIndex];

  public static random = (length:number=5) => {
    let id = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < length; i++) {
      id += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return id;
  }

  public static regexEscape = (toBeUsedInRegex: string) => toBeUsedInRegex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  public static htmlAttrEncode = (values: Dict<any>): string => Str.base64urlUtfEncode(JSON.stringify(values));

  public static htmlAttrDecode = (encoded: string): FlowCryptAttLinkData|any => JSON.parse(Str.base64urlUtfDecode(encoded));

  public static base64urlEncode = (str: string) => (typeof str === 'undefined') ? str : btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // used for 3rd party API calls - do not change w/o testing Gmail api attachments

  public static base64urlDecode = (str: string) => (typeof str === 'undefined') ? str : atob(str.replace(/-/g, '+').replace(/_/g, '/')); // used for 3rd party API calls - do not change w/o testing Gmail api attachments

  public static fromUint8 = (u8a: Uint8Array|string): string => {
    if(typeof u8a === 'string') {
      return u8a;
    }
    let CHUNK_SZ = 0x8000;
    let c = [];
    for (let i = 0; i < u8a.length; i += CHUNK_SZ) {
      c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
    }
    return c.join('');
  }

  public static toUint8 = (raw: string|Uint8Array): Uint8Array => {
    if(raw instanceof Uint8Array) {
      return raw;
    }
    let rawLength = raw.length;
    let uint8 = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++) {
      uint8[i] = raw.charCodeAt(i);
    }
    return uint8;
  }

  public static fromEqualSignNotationAsUtf = (str: string): string => {
    return str.replace(/(=[A-F0-9]{2})+/g, equalSignUtfPart => {
      return Str.uint8AsUtf(equalSignUtfPart.replace(/^=/, '').split('=').map((twoHexDigits) => parseInt(twoHexDigits, 16)));
    });
  }

  public static uint8AsUtf = (a: Uint8Array|number[]) => { // tom
    let length = a.length;
    let bytesLeftInChar = 0;
    let utf8string = '';
    let binaryChar = '';
    for (let i = 0; i < length; i++) {
      if (a[i] < 128) {
        if (bytesLeftInChar) { // utf-8 continuation byte missing, assuming the last character was an 8-bit ASCII character
          utf8string += String.fromCharCode(a[i-1]);
        }
        bytesLeftInChar = 0;
        binaryChar = '';
        utf8string += String.fromCharCode(a[i]);
      } else {
        if (!bytesLeftInChar) { // beginning of new multi-byte character
          if (a[i] >= 128 && a[i] < 192) { // 10xx xxxx
            utf8string += String.fromCharCode(a[i]); // extended 8-bit ASCII compatibility, european ASCII characters
          } else if (a[i] >= 192 && a[i] < 224) { // 110x xxxx
            bytesLeftInChar = 1;
            binaryChar = a[i].toString(2).substr(3);
          } else if (a[i] >= 224 && a[i] < 240) { // 1110 xxxx
            bytesLeftInChar = 2;
            binaryChar = a[i].toString(2).substr(4);
          } else if (a[i] >= 240 && a[i] < 248) { // 1111 0xxx
            bytesLeftInChar = 3;
            binaryChar = a[i].toString(2).substr(5);
          } else if (a[i] >= 248 && a[i] < 252) { // 1111 10xx
            bytesLeftInChar = 4;
            binaryChar = a[i].toString(2).substr(6);
          } else if (a[i] >= 252 && a[i] < 254) { // 1111 110x
            bytesLeftInChar = 5;
            binaryChar = a[i].toString(2).substr(7);
          } else {
            console.log('Str.uint8_as_utf: invalid utf-8 character beginning byte: ' + a[i]);
          }
        } else { // continuation of a multi-byte character
          binaryChar += a[i].toString(2).substr(2);
          bytesLeftInChar--;
        }
        if (binaryChar && !bytesLeftInChar) {
          utf8string += String.fromCharCode(parseInt(binaryChar, 2));
          binaryChar = '';
        }
      }
    }
    return utf8string;
  }

  public static toHex = (s: string): string => { // http://phpjs.org/functions/bin2hex/, Kevin van Zonneveld (http://kevin.vanzonneveld.net), Onno Marsman, Linuxworld, ntoniazzi
    let o = '';
    s += '';
    for (let i = 0; i < s.length; i++) {
      let n = s.charCodeAt(i).toString(16);
      o += n.length < 2 ? '0' + n : n;
    }
    return o;
  }

  public static fromHex = (hex: string): string => {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      let v = parseInt(hex.substr(i, 2), 16);
      if (v) {
        str += String.fromCharCode(v);
      }
    }
    return str;
  }

  public static extractFcAtts = (decryptedContent: string, fcAtts: Att[]) => {
    if (Value.is('cryptup_file').in(decryptedContent)) {
      decryptedContent = decryptedContent.replace(/<a[^>]+class="cryptup_file"[^>]+>[^<]+<\/a>\n?/gm, foundLink => {
        let element = $(foundLink);
        let fcData = element.attr('cryptup-data');
        if (fcData) {
          let a: FlowCryptAttLinkData = Str.htmlAttrDecode(fcData);
          if(a && typeof a === 'object' && typeof a.name !== 'undefined' && typeof a.size !== 'undefined' && typeof a.type !== 'undefined') {
            fcAtts.push(new Att({type: a.type, name: a.name, length: a.size, url: element.attr('href')}));
          }
        }
        return '';
      });
    }
    return decryptedContent;
  }

  public static extractFcReplyToken = (decryptedContent: string) => { // todo - used exclusively on the web - move to a web package
    let fcTokenElement = $(Ui.e('div', {html: decryptedContent})).find('.cryptup_reply');
    if (fcTokenElement.length) {
      let fcData = fcTokenElement.attr('cryptup-data');
      if (fcData) {
        return Str.htmlAttrDecode(fcData);
      }
    }
  }

  public static stripFcTeplyToken = (decryptedContent: string) => decryptedContent.replace(/<div[^>]+class="cryptup_reply"[^>]+><\/div>/, '');

  public static stripPublicKeys = (decryptedContent: string, foundPublicKeys: string[]) => {
    let {blocks, normalized} = Pgp.armor.detectBlocks(decryptedContent);
    for (let block of blocks) {
      if (block.type === 'publicKey') {
        foundPublicKeys.push(block.content);
        normalized = normalized.replace(block.content, '');
      }
    }
    return normalized;
  }

  public static intToHex = (intAsStr: string|number): string => { // http://stackoverflow.com/questions/18626844/convert-a-large-integer-to-a-hex-string-in-javascript (Collin Anderson)
    let dec = intAsStr.toString().split(''), sum = [], hex = [], i, s;
    while(dec.length) {
      s = Number(dec.shift());
      for(i = 0; s || i < sum.length; i++) {
        s += (sum[i] || 0) * 10;
        sum[i] = s % 16;
        s = (s - sum[i]) / 16;
      }
    }
    while(sum.length) {
      hex.push(sum.pop()!.toString(16));
    }
    return hex.join('');
  }

  public static capitalize = (string: string): string => string.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

  public static toUtcTimestamp = (datetimeStr: string, asStr:boolean=false) => asStr ? String(Date.parse(datetimeStr)) : Date.parse(datetimeStr);

  public static datetimeToDate = (date: string) => Xss.htmlEscape(date.substr(0, 10));

  private static base64urlUtfEncode = (str: string) => { // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    return (typeof str === 'undefined') ? str : btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private static base64urlUtfDecode = (str: string) => { // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    return (typeof str === 'undefined') ? str : decodeURIComponent(Array.prototype.map.call(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  }

}

export class Value {

  public static arr = {
    unique: <T extends FlatTypes>(array: T[]): T[] => {
      let unique: T[] = [];
      for (let v of array) {
        if (!Value.is(v).in(unique)) {
          unique.push(v);
        }
      }
      return unique;
    },
    fromDomNodeList: (obj: NodeList|JQuery<HTMLElement>): Node[] => { // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
      let array = [];
      for (let i = obj.length >>> 0; i--;) { // iterate backwards ensuring that length is an UInt32
        array[i] = obj[i];
      }
      return array;
    },
    withoutKey: <T>(array: T[], i: number) => array.splice(0, i).concat(array.splice(i + 1, array.length)),
    withoutVal: <T>(array: T[], withoutVal: T) => {
      let result: T[] = [];
      for (let value of array) {
        if (value !== withoutVal) {
          result.push(value);
        }
      }
      return result;
    },
    contains: <T>(arr: T[]|string, value: T): boolean => Boolean(arr && typeof arr.indexOf === 'function' && (arr as any[]).indexOf(value) !== -1),
    sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
    average: (arr: number[]) => Value.arr.sum(arr) / arr.length,
    zeroes: (length: number): number[] => new Array(length).map(() => 0),
  };

  public static obj = {
    keyByValue: <T>(obj: Dict<T>, v: T) => {
      for (let k of Object.keys(obj)) {
        if (obj[k] === v) {
          return k;
        }
      }
    },
  };

  public static int = {
    lousyRandom: (minVal: number, maxVal: number) => minVal + Math.round(Math.random() * (maxVal - minVal)),
    getFutureTimestampInMonths: (monthsToAdd: number) => new Date().getTime() + 1000 * 3600 * 24 * 30 * monthsToAdd,
    hoursAsMiliseconds: (h: number) =>  h * 1000 * 60 * 60,
  };

  public static noop = (): void => undefined;

  public static is = (v: FlatTypes) => ({in: (arrayOrStr: FlatTypes[]|string): boolean => Value.arr.contains(arrayOrStr, v)});  // Value.this(v).in(array_or_string)

}

(( /* EXTENSIONS AND CONFIG */ ) => {

  if (typeof openpgp === 'object' && openpgp && typeof openpgp.config === 'object') {
    openpgp.config.versionstring = `FlowCrypt ${Catch.version() || ''} Gmail Encryption`;
    openpgp.config.commentstring = 'Seamlessly send and receive encrypted email';
    // openpgp.config.require_uid_self_cert = false;
  }

  String.prototype.repeat = String.prototype.repeat || function(count) {
    if (this == null) {
      throw new TypeError('can\'t convert ' + this + ' to object');
    }
    let str = '' + this;
    count = +count;
    if (count !== count) {
      count = 0;
    }
    if (count < 0) {
      throw new RangeError('repeat count must be non-negative');
    }
    if (count === Infinity) {
      throw new RangeError('repeat count must be less than infinity');
    }
    count = Math.floor(count);
    if (str.length === 0 || count === 0) {
      return '';
    }
    // Ensuring count is a 31-bit integer allows us to heavily optimize the
    // main part. But anyway, most current (August 2014) browsers can't handle
    // strings 1 << 28 chars or longer, so:
    if (str.length * count >= 1 << 28) {
      throw new RangeError('repeat count must not overflow maximum string size');
    }
    let rpt = '';
    for (;;) {
      if ((count & 1) === 1) {
        rpt += str;
      }
      count >>>= 1;
      if (count === 0) {
        break;
      }
      str += str;
    }
    // Could we try:
    // return Array(count + 1).join(this);
    return rpt;
  };

})();
