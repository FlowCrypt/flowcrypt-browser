/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { base64encode, base64decode } from '../platform/util.js';

export type Dict<T> = { [key: string]: T; };

export class Str {

  public static parseEmail = (full: string, flag: 'VALIDATE' | 'DO-NOT-VALIDATE' = 'VALIDATE') => {
    let email: string | undefined;
    let name: string | undefined;
    if (full.includes('<') && full.includes('>')) {
      email = full.substr(full.indexOf('<') + 1, full.indexOf('>') - full.indexOf('<') - 1).replace(/["']/g, '').trim().toLowerCase();
      name = full.substr(0, full.indexOf('<')).replace(/["']/g, '').trim();
    } else {
      email = full.replace(/["']/g, '').trim().toLowerCase();
    }
    if (flag === 'VALIDATE' && !Str.isEmailValid(email)) {
      email = undefined;
    }
    return { email, name, full };
  }

  public static prettyPrint = (obj: any) => (typeof obj === 'object') ? JSON.stringify(obj, undefined, 2).replace(/ /g, '&nbsp;').replace(/\n/g, '<br />') : String(obj);

  public static normalizeSpaces = (str: string) => str.replace(RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32));

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

  public static isEmailValid = (email: string) => {
    if (email.indexOf(' ') !== -1) {
      return false;
    }
    return /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i.test(email);
  }

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
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;').replace(/\n/g, '<br />');
  }

  public static htmlAttrEncode = (values: Dict<any>): string => Str.base64urlUtfEncode(JSON.stringify(values));

  public static htmlAttrDecode = (encoded: string): any => {
    try {
      return JSON.parse(Str.base64urlUtfDecode(encoded)); // tslint:disable-line:no-unsafe-any
    } catch (e) {
      return undefined;
    }
  }

  public static capitalize = (string: string): string => string.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

  public static toUtcTimestamp = (datetimeStr: string, asStr: boolean = false) => asStr ? String(Date.parse(datetimeStr)) : Date.parse(datetimeStr);

  public static datetimeToDate = (date: string) => date.substr(0, 10).replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');

  public static fromDate = (date: Date) => date.toISOString().replace(/T/, ' ').replace(/:[^:]+$/, '');

  private static base64urlUtfEncode = (str: string) => {
    // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    if (typeof str === 'undefined') {
      return str;
    }
    return base64encode(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(String(p1), 16))))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private static base64urlUtfDecode = (str: string) => {
    // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    if (typeof str === 'undefined') {
      return str;
    }
    // tslint:disable-next-line:no-unsafe-any
    return decodeURIComponent(Array.prototype.map.call(base64decode(str.replace(/-/g, '+').replace(/_/g, '/')), (c: string) => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  }

}

export class Value {

  public static arr = {
    unique: <T>(array: T[]): T[] => {
      const unique: T[] = [];
      for (const v of array) {
        if (!unique.includes(v)) {
          unique.push(v);
        }
      }
      return unique;
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
    zeroes: (length: number): number[] => new Array(length).map(() => 0)
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

}
