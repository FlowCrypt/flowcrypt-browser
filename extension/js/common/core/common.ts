/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Pgp } from './pgp.js';
import { FcAttLinkData } from './att.js';
import { MsgBlock } from './mime.js';

export type Dict<T> = { [key: string]: T; };
export type EmailProvider = 'gmail';

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
      name: undefined,
      full: emailStr,
    };
  }

  public static prettyPrint = (obj: any) => (typeof obj === 'object') ? JSON.stringify(obj, undefined, 2).replace(/ /g, '&nbsp;').replace(/\n/g, '<br>') : String(obj);

  public static normalizeSpaces = (str: string) => str.replace(RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32)).replace(/\n /g, '\n');

  public static normalizeDashes = (str: string) => str.replace(/^—–|—–$/gm, '-----');

  public static normalize = (str: string) => Str.normalizeSpaces(Str.normalizeDashes(str));

  public static numberFormat = (number: number) => {
    const nStr: string = number + '';
    const x = nStr.split('.');
    let x1 = x[0];
    const x2 = x.length > 1 ? '.' + x[1] : '';
    const rgx = /(\d+)(\d{3})/;
    while (rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  }

  // tslint:disable-next-line:max-line-length
  public static isEmailValid = (email: string) => /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i.test(email);

  public static monthName = (monthIndex: number) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][monthIndex];

  public static sloppyRandom = (length: number = 5) => {
    let id = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < length; i++) {
      id += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return id;
  }

  public static regexEscape = (toBeUsedInRegex: string) => toBeUsedInRegex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  public static asEscapedHtml = (text: string) => {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;').replace(/\n/g, '<br>');
  }

  public static htmlAttrEncode = (values: Dict<any>): string => Str.base64urlUtfEncode(JSON.stringify(values));

  public static htmlAttrDecode = (encoded: string): any => JSON.parse(Str.base64urlUtfDecode(encoded)); // tslint:disable-line:no-unsafe-any

  /**
   * used for 3rd party API calls - do not change w/o testing Gmail api attachments
   */
  public static base64urlEncode = (str: string) => (typeof str === 'undefined') ? str : btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  /**
   * // used for 3rd party API calls - do not change w/o testing Gmail api attachments
   */
  public static base64urlDecode = (str: string) => (typeof str === 'undefined') ? str : atob(str.replace(/-/g, '+').replace(/_/g, '/'));

  public static fromUint8 = (u8a: Uint8Array | string): string => {
    if (typeof u8a === 'string') {
      return u8a;
    }
    const chunkSize = 0x8000;
    const c = [];
    for (let i = 0; i < u8a.length; i += chunkSize) {
      c.push(String.fromCharCode.apply(undefined, u8a.subarray(i, i + chunkSize)));
    }
    return c.join('');
  }

  public static toUint8 = (raw: string | Uint8Array): Uint8Array => {
    if (raw instanceof Uint8Array) {
      return raw;
    }
    const rawLength = raw.length;
    const uint8 = new Uint8Array(new ArrayBuffer(rawLength));
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

  public static uint8AsUtf = (a: Uint8Array | number[]) => { // tom
    const length = a.length;
    let bytesLeftInChar = 0;
    let utf8string = '';
    let binaryChar = '';
    for (let i = 0; i < length; i++) {
      if (a[i] < 128) {
        if (bytesLeftInChar) { // utf-8 continuation byte missing, assuming the last character was an 8-bit ASCII character
          utf8string += String.fromCharCode(a[i - 1]);
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

  public static toHex = (str: string): string => {
    let r = '';
    for (let i = 0; i < str.length; i++) {
      const n = str.charCodeAt(i).toString(16);
      r += n.length < 2 ? `0${n}` : n;
    }
    return r;
  }

  public static fromHex = (hex: string): string => {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      const v = parseInt(hex.substr(i, 2), 16);
      if (v) {
        str += String.fromCharCode(v);
      }
    }
    return str;
  }

  private static isFcAttLinkData = (o: any): o is FcAttLinkData => {
    return o && typeof o === 'object' && typeof (o as FcAttLinkData).name !== 'undefined'
      && typeof (o as FcAttLinkData).size !== 'undefined' && typeof (o as FcAttLinkData).type !== 'undefined';
  }

  public static extractFcAtts = (decryptedContent: string, blocks: MsgBlock[]) => {
    if (Value.is('cryptup_file').in(decryptedContent)) {
      decryptedContent = decryptedContent.replace(/<a[^>]+class="cryptup_file"[^>]+>[^<]+<\/a>\n?/gm, foundLink => {
        const el = $(foundLink);
        const fcData = el.attr('cryptup-data');
        if (fcData) {
          const a = Str.htmlAttrDecode(fcData);
          if (Str.isFcAttLinkData(a)) {
            blocks.push(Pgp.internal.msgBlockAttObj('attachment', '', { type: a.type, name: a.name, length: a.size, url: el.attr('href') }));
          }
        }
        return '';
      });
    }
    return decryptedContent;
  }

  public static extractFcReplyToken = (decryptedContent: string) => { // todo - used exclusively on the web - move to a web package
    const fcTokenElement = $(`<div>${decryptedContent}</div>`).find('.cryptup_reply');
    if (fcTokenElement.length) {
      const fcData = fcTokenElement.attr('cryptup-data');
      if (fcData) {
        return Str.htmlAttrDecode(fcData);
      }
    }
  }

  public static stripFcTeplyToken = (decryptedContent: string) => decryptedContent.replace(/<div[^>]+class="cryptup_reply"[^>]+><\/div>/, '');

  public static stripPublicKeys = (decryptedContent: string, foundPublicKeys: string[]) => {
    let { blocks, normalized } = Pgp.armor.detectBlocks(decryptedContent); // tslint:disable-line:prefer-const
    for (const block of blocks) {
      if (block.type === 'publicKey') {
        foundPublicKeys.push(block.content);
        normalized = normalized.replace(block.content, '');
      }
    }
    return normalized;
  }

  public static intToHex = (intAsStr: string | number): string => { // http://stackoverflow.com/questions/18626844/convert-a-large-integer-to-a-hex-string-in-javascript (Collin Anderson)
    let dec = intAsStr.toString().split(''), sum = [], hex = [], i, s; // tslint:disable-line:prefer-const
    while (dec.length) {
      s = Number(dec.shift());
      for (i = 0; s || i < sum.length; i++) {
        s += (sum[i] || 0) * 10;
        sum[i] = s % 16;
        s = (s - sum[i]) / 16;
      }
    }
    while (sum.length) {
      hex.push(sum.pop()!.toString(16));
    }
    return hex.join('');
  }

  public static capitalize = (string: string): string => string.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

  public static toUtcTimestamp = (datetimeStr: string, asStr: boolean = false) => asStr ? String(Date.parse(datetimeStr)) : Date.parse(datetimeStr);

  public static datetimeToDate = (date: string) => date.substr(0, 10).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');

  private static base64urlUtfEncode = (str: string) => {
    // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    if (typeof str === 'undefined') {
      return str;
    }
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(String(p1), 16)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private static base64urlUtfDecode = (str: string) => {
    // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    if (typeof str === 'undefined') {
      return str;
    }
    // tslint:disable-next-line:no-unsafe-any
    return decodeURIComponent(Array.prototype.map.call(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  }

}

export class Value {

  public static arr = {
    unique: <T>(array: T[]): T[] => {
      const unique: T[] = [];
      for (const v of array) {
        if (!Value.is(v).in(unique)) {
          unique.push(v);
        }
      }
      return unique;
    },
    fromDomNodeList: (obj: NodeList | JQuery<HTMLElement>): Node[] => { // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
      const array = [];
      for (let i = obj.length >>> 0; i--;) { // iterate backwards ensuring that length is an UInt32
        array[i] = obj[i];
      }
      return array;
    },
    withoutKey: <T>(array: T[], i: number) => array.splice(0, i).concat(array.splice(i + 1, array.length)),
    withoutVal: <T>(array: T[], withoutVal: T) => {
      const result: T[] = [];
      for (const value of array) {
        if (value !== withoutVal) {
          result.push(value);
        }
      }
      return result;
    },
    contains: <T>(arr: T[] | string, value: T): boolean => Boolean(arr && typeof arr.indexOf === 'function' && (arr as any[]).indexOf(value) !== -1),
    sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
    average: (arr: number[]) => Value.arr.sum(arr) / arr.length,
    zeroes: (length: number): number[] => new Array(length).map(() => 0),
  };

  public static obj = {
    keyByValue: <T>(obj: Dict<T>, v: T) => {
      for (const k of Object.keys(obj)) {
        if (obj[k] === v) {
          return k;
        }
      }
      return undefined;
    },
  };

  public static int = {
    lousyRandom: (minVal: number, maxVal: number) => minVal + Math.round(Math.random() * (maxVal - minVal)),
    getFutureTimestampInMonths: (monthsToAdd: number) => new Date().getTime() + 1000 * 3600 * 24 * 30 * monthsToAdd,
    hoursAsMiliseconds: (h: number) => h * 1000 * 60 * 60,
  };

  public static noop = (): void => undefined;

  public static is = <T>(v: T) => ({ in: (arrayOrStr: T[] | string): boolean => Value.arr.contains(arrayOrStr, v) });  // Value.this(v).in(array_or_string)

}
