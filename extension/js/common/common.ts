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

  public static runtime_id = (orig=false) => {
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

  public static is_extension = () => Env.runtime_id() !== null;

  public static url_param_require = {
    string: (values: UrlParams, name: string): string => Ui.abort_and_render_error_on_url_param_type_mismatch(values, name, 'string') as string,
    oneof: (values: UrlParams, name: string, allowed: UrlParam[]): string => Ui.abort_and_render_error_on_url_param_value_mismatch(values, name, allowed) as string,
  };

  public static urlParams = (expected_keys: string[], string:string|null=null) => {
    let url = (string || window.location.search.replace('?', ''));
    let value_pairs = url.split('?').pop()!.split('&'); // str.split('?') string[].length will always be >= 1
    let url_data: UrlParams = {};
    for (let value_pair of value_pairs) {
      let pair = value_pair.split('=');
      if (Value.is(pair[0]).in(expected_keys)) {
        url_data[pair[0]] = typeof Env.URL_PARAM_DICT[pair[1]] !== 'undefined' ? Env.URL_PARAM_DICT[pair[1]] : decodeURIComponent(pair[1]);
      }
    }
    return url_data;
  }

  public static urlCreate = (link: string, params: UrlParams) => {
    for (let key of Object.keys(params)) {
      let value = params[key];
      if (typeof value !== 'undefined') {
        let transformed = Value.obj.key_by_value(Env.URL_PARAM_DICT, value);
        link += (!Value.is('?').in(link) ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(String(typeof transformed !== 'undefined' ? transformed : value));
      }
    }
    return link;
  }

  public static key_codes = () => {
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

  public static handle_error = (error_msg: string|undefined, url: string, line: number, col: number, err: string|Error|Dict<Serializable>, is_manually_called: boolean) => {
    if (typeof err === 'string') {
      error_msg = err;
      err = { name: 'thrown_string', message: error_msg, stack: error_msg };
    }
    if (error_msg && url && typeof line !== 'undefined' && !col && !err && !is_manually_called) { // safari has limited support
      err = { name: 'safari_error', message: error_msg, stack: error_msg };
    }
    if (typeof error_msg === 'undefined' && line === 0 && col === 0 && is_manually_called && typeof err === 'object' && !(err instanceof Error)) {
      let stringified;
      try { // this sometimes happen with unhandled Promise.then(_, reject)
        stringified = JSON.stringify(err);
      } catch (cannot) {
        stringified = 'typeof: ' + (typeof err) + '\n' + String(err);
      }
      err = { name: 'thrown_object', message: err.message || '(unknown)', stack: stringified};
      error_msg = 'thrown_object';
    }
    let user_log_msg = ' Please report errors above to human@flowcrypt.com. I fix errors VERY promptly.';
    let ignored_errs = [
      'Invocation of form get(, function) doesn\'t match definition get(optional string or array or object keys, function callback)', // happens in gmail window when reloaded extension + now reloading gmail
      'Invocation of form set(, function) doesn\'t match definition set(object items, optional function callback)', // happens in gmail window when reloaded extension + now reloading gmail
      'Invocation of form runtime.connect(null, ) doesn\'t match definition runtime.connect(optional string extensionId, optional object connectInfo)',
    ];
    if (!err) {
      return;
    }
    if (err instanceof Error && ignored_errs.indexOf(err.message) !== -1) {
      return true;
    }
    if (err instanceof Error && err.stack) {
      console.log('%c[' + error_msg + ']\n' + err.stack, 'color: #F00; font-weight: bold;');
    } else {
      console.error(err);
      console.log('%c' + error_msg, 'color: #F00; font-weight: bold;');
    }
    if (is_manually_called !== true && Catch.ORIG_ONERROR && Catch.ORIG_ONERROR !== (Catch.handle_error as ErrorEventHandler)) {
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
          message: (error_msg || '').substring(0, 200),
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
            console.log('%cFlowCrypt ERROR:' + user_log_msg, 'font-weight: bold;');
          } else {
            console.log('%cFlowCrypt EXCEPTION:' + user_log_msg, 'font-weight: bold;');
          }
        },
        error: (XMLHttpRequest, status, error) => {
          console.log('%cFlowCrypt FAILED:' + user_log_msg, 'font-weight: bold;');
        },
      });
    } catch (ajax_err) {
      console.log(ajax_err.message);
      console.log('%cFlowCrypt ISSUE:' + user_log_msg, 'font-weight: bold;');
    }
    try {
      if (typeof Store.getAccount === 'function' && typeof Store.set === 'function') {
        Store.get_global(['errors']).then(s => {
          if (typeof s.errors === 'undefined') {
            s.errors = [];
          }
          if(err instanceof Error) {
            s.errors.unshift(err.stack || error_msg || String(err));
          } else {
            s.errors.unshift(error_msg || String(err));
          }
          Store.set(null, s).catch(console.error);
        }).catch(console.error);
      }
    } catch (storage_err) {
      console.log('failed to locally log error "' + String(error_msg) + '" because: ' + storage_err.message);
    }
    return true;
  }

  public static handle_exception = (exception: any) => {
    let line, col;
    try {
      let caller_line = exception.stack!.split('\n')[1]; // will be catched below
      let matched = caller_line.match(/\.js:([0-9]+):([0-9]+)\)?/);
      line = Number(matched![1]); // will be catched below
      col = Number(matched![2]); // will be catched below
    } catch (line_err) {
      line = 0;
      col = 0;
    }
    Catch.handle_error(exception.message, window.location.href, line, col, exception, true);
  }

  public static report = (name: string, details:Error|Serializable|StandardError|PromiseRejectionEvent=undefined) => {
    try {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(name);
    } catch (e) {
      if (typeof details !== 'string') {
        try {
          details = JSON.stringify(details);
        } catch (stringify_error) {
          details = '(could not stringify details "' + String(details) + '" in Catch.report because: ' + stringify_error.message + ')';
        }
      }
      e.stack = e.stack + '\n\n\ndetails: ' + details;
      Catch.handle_exception(e);
    }
  }

  public static log = (name: string, details:Serializable|Error|Dict<Serializable>=undefined) => {
    name = 'Catch.log: ' + name;
    console.log(name);
    try {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(name);
    } catch (e_local) {
      let e = e_local as Error;
      if (typeof details !== 'string') {
        try {
          details = JSON.stringify(details);
        } catch (stringify_error) {
          details = '(could not stringify details "' + String(details) + '" in Catch.log because: ' + stringify_error.message + ')';
        }
      }
      e.stack = e.stack + '\n\n\ndetails: ' + details;
      try {
        Store.get_global(['errors']).then(s => {
          if (typeof s.errors === 'undefined') {
            s.errors = [];
          }
          s.errors.unshift(e.stack || name);
          Store.set(null, s).catch(console.error);
        }).catch(console.error);
      } catch (storage_err) {
        console.log('failed to locally log info "' + String(name) + '" because: ' + storage_err.message);
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
    } catch (code_err) {
      Catch.handle_exception(code_err);
    }
  }

  public static environment = (url=window.location.href): string => {
    let browser_name = Env.browser().name;
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
    return browser_name + ':' + env;
  }

  public static test = () => {
    // @ts-ignore - intentional exception
    this_will_fail();
  }

  public static promise_error_alert = (note: string) => (error: Error) => { // returns a function
    console.log(error);
    alert(note);
  }

  public static stack_trace = (): string => {
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
        Catch.handle_exception((e as PromiseRejectionEvent).reason); // actual exception that happened in Promise, unhandled
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

  public static set_timeout = (cb: () => void, ms: number): number => {
    return window.setTimeout(Catch.try(cb), ms); // error-handled: else setTimeout will silently swallow errors
  }

}

Catch.RUNTIME_ENVIRONMENT = Catch.environment();
(window as FcWindow).onerror = (Catch.handle_error as ErrorEventHandler);
(window as FcWindow).onunhandledrejection = Catch.rejection;

export class Str {

  public static parseEmail = (email_string: string) => {
    if (Value.is('<').in(email_string) && Value.is('>').in(email_string)) {
      return {
        email: email_string.substr(email_string.indexOf('<') + 1, email_string.indexOf('>') - email_string.indexOf('<') - 1).replace(/["']/g, '').trim().toLowerCase(),
        name: email_string.substr(0, email_string.indexOf('<')).replace(/["']/g, '').trim(),
        full: email_string,
      };
    }
    return {
      email: email_string.replace(/["']/g, '').trim().toLowerCase(),
      name: null,
      full: email_string,
    };
  }

  public static pretty_print = (obj: any) => (typeof obj === 'object') ? JSON.stringify(obj, null, 2).replace(/ /g, '&nbsp;').replace(/\n/g, '<br>') : String(obj);

  public static normalize_spaces = (str: string) => str.replace(RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32)).replace(/\n /g, '\n');

  public static normalize_dashes = (str: string) => str.replace(/^—–|—–$/gm, '-----');

  public static normalize = (str: string) => Str.normalize_spaces(Str.normalize_dashes(str));

  public static number_format = (number: number) => { // http://stackoverflow.com/questions/3753483/javascript-thousand-separator-string-format
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

  public static month_name = (month_index: number) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month_index];

  public static random = (length:number=5) => {
    let id = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < length; i++) {
      id += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return id;
  }

  public static regex_escape = (to_be_used_in_regex: string) => to_be_used_in_regex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  public static html_attr_encode = (values: Dict<any>): string => Str.base64url_utf_encode(JSON.stringify(values));

  public static html_attr_decode = (encoded: string): FlowCryptAttLinkData|any => JSON.parse(Str.base64url_utf_decode(encoded));

  public static base64urlEncode = (str: string) => (typeof str === 'undefined') ? str : btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // used for 3rd party API calls - do not change w/o testing Gmail api attachments

  public static base64urlDecode = (str: string) => (typeof str === 'undefined') ? str : atob(str.replace(/-/g, '+').replace(/_/g, '/')); // used for 3rd party API calls - do not change w/o testing Gmail api attachments

  public static from_uint8 = (u8a: Uint8Array|string): string => {
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

  public static to_uint8 = (raw: string|Uint8Array): Uint8Array => {
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

  public static from_equal_sign_notation_as_utf = (str: string): string => {
    return str.replace(/(=[A-F0-9]{2})+/g, equal_sign_utf_part => {
      return Str.uint8_as_utf(equal_sign_utf_part.replace(/^=/, '').split('=').map((two_hex_digits) => parseInt(two_hex_digits, 16)));
    });
  }

  public static uint8_as_utf = (a: Uint8Array|number[]) => { // tom
    let length = a.length;
    let bytes_left_in_char = 0;
    let utf8_string = '';
    let binary_char = '';
    for (let i = 0; i < length; i++) {
      if (a[i] < 128) {
        if (bytes_left_in_char) { // utf-8 continuation byte missing, assuming the last character was an 8-bit ASCII character
          utf8_string += String.fromCharCode(a[i-1]);
        }
        bytes_left_in_char = 0;
        binary_char = '';
        utf8_string += String.fromCharCode(a[i]);
      } else {
        if (!bytes_left_in_char) { // beginning of new multi-byte character
          if (a[i] >= 128 && a[i] < 192) { // 10xx xxxx
            utf8_string += String.fromCharCode(a[i]); // extended 8-bit ASCII compatibility, european ASCII characters
          } else if (a[i] >= 192 && a[i] < 224) { // 110x xxxx
            bytes_left_in_char = 1;
            binary_char = a[i].toString(2).substr(3);
          } else if (a[i] >= 224 && a[i] < 240) { // 1110 xxxx
            bytes_left_in_char = 2;
            binary_char = a[i].toString(2).substr(4);
          } else if (a[i] >= 240 && a[i] < 248) { // 1111 0xxx
            bytes_left_in_char = 3;
            binary_char = a[i].toString(2).substr(5);
          } else if (a[i] >= 248 && a[i] < 252) { // 1111 10xx
            bytes_left_in_char = 4;
            binary_char = a[i].toString(2).substr(6);
          } else if (a[i] >= 252 && a[i] < 254) { // 1111 110x
            bytes_left_in_char = 5;
            binary_char = a[i].toString(2).substr(7);
          } else {
            console.log('Str.uint8_as_utf: invalid utf-8 character beginning byte: ' + a[i]);
          }
        } else { // continuation of a multi-byte character
          binary_char += a[i].toString(2).substr(2);
          bytes_left_in_char--;
        }
        if (binary_char && !bytes_left_in_char) {
          utf8_string += String.fromCharCode(parseInt(binary_char, 2));
          binary_char = '';
        }
      }
    }
    return utf8_string;
  }

  public static to_hex = (s: string): string => { // http://phpjs.org/functions/bin2hex/, Kevin van Zonneveld (http://kevin.vanzonneveld.net), Onno Marsman, Linuxworld, ntoniazzi
    let o = '';
    s += '';
    for (let i = 0; i < s.length; i++) {
      let n = s.charCodeAt(i).toString(16);
      o += n.length < 2 ? '0' + n : n;
    }
    return o;
  }

  public static from_hex = (hex: string): string => {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      let v = parseInt(hex.substr(i, 2), 16);
      if (v) {
        str += String.fromCharCode(v);
      }
    }
    return str;
  }

  public static extract_fc_atts = (decrypted_content: string, fc_attachments: Att[]) => {
    if (Value.is('cryptup_file').in(decrypted_content)) {
      decrypted_content = decrypted_content.replace(/<a[^>]+class="cryptup_file"[^>]+>[^<]+<\/a>\n?/gm, found_link => {
        let element = $(found_link);
        let fc_data = element.attr('cryptup-data');
        if (fc_data) {
          let a: FlowCryptAttLinkData = Str.html_attr_decode(fc_data);
          if(a && typeof a === 'object' && typeof a.name !== 'undefined' && typeof a.size !== 'undefined' && typeof a.type !== 'undefined') {
            fc_attachments.push(new Att({type: a.type, name: a.name, length: a.size, url: element.attr('href')}));
          }
        }
        return '';
      });
    }
    return decrypted_content;
  }

  public static extract_fc_reply_token = (decrypted_content: string) => { // todo - used exclusively on the web - move to a web package
    let fc_token_element = $(Ui.e('div', {html: decrypted_content})).find('.cryptup_reply');
    if (fc_token_element.length) {
      let fc_data = fc_token_element.attr('cryptup-data');
      if (fc_data) {
        return Str.html_attr_decode(fc_data);
      }
    }
  }

  public static strip_fc_reply_token = (decrypted_content: string) => decrypted_content.replace(/<div[^>]+class="cryptup_reply"[^>]+><\/div>/, '');

  public static strip_public_keys = (decrypted_content: string, found_public_keys: string[]) => {
    let {blocks, normalized} = Pgp.armor.detect_blocks(decrypted_content);
    for (let block of blocks) {
      if (block.type === 'public_key') {
        found_public_keys.push(block.content);
        normalized = normalized.replace(block.content, '');
      }
    }
    return normalized;
  }

  public static int_to_hex = (int_as_string: string|number): string => { // http://stackoverflow.com/questions/18626844/convert-a-large-integer-to-a-hex-string-in-javascript (Collin Anderson)
    let dec = int_as_string.toString().split(''), sum = [], hex = [], i, s;
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

  public static to_utc_timestamp = (datetime_string: string, as_string:boolean=false) => as_string ? String(Date.parse(datetime_string)) : Date.parse(datetime_string);

  public static datetime_to_date = (date: string) => Xss.htmlEscape(date.substr(0, 10));

  private static base64url_utf_encode = (str: string) => { // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    return (typeof str === 'undefined') ? str : btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private static base64url_utf_decode = (str: string) => { // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
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
    from_dom_node_list: (obj: NodeList|JQuery<HTMLElement>): Node[] => { // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
      let array = [];
      for (let i = obj.length >>> 0; i--;) { // iterate backwards ensuring that length is an UInt32
        array[i] = obj[i];
      }
      return array;
    },
    without_key: <T>(array: T[], i: number) => array.splice(0, i).concat(array.splice(i + 1, array.length)),
    without_value: <T>(array: T[], without_value: T) => {
      let result: T[] = [];
      for (let value of array) {
        if (value !== without_value) {
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
    key_by_value: <T>(obj: Dict<T>, v: T) => {
      for (let k of Object.keys(obj)) {
        if (obj[k] === v) {
          return k;
        }
      }
    },
  };

  public static int = {
    random: (min_value: number, max_value: number) => min_value + Math.round(Math.random() * (max_value - min_value)),
    get_future_timestamp_in_months: (months_to_add: number) => new Date().getTime() + 1000 * 3600 * 24 * 30 * months_to_add,
    hours_as_miliseconds: (h: number) =>  h * 1000 * 60 * 60,
  };

  public static noop = (): void => undefined;

  public static is = (v: FlatTypes) => ({in: (array_or_str: FlatTypes[]|string): boolean => Value.arr.contains(array_or_str, v)});  // Value.this(v).in(array_or_string)

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
