/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { base64encode, base64decode } from '../platform/util.js';

export class Buf extends Uint8Array {

  public static fromUint8 = (u8a: Uint8Array) => {
    return new Buf(u8a);
  }

  public static fromRawBytesStr = (rawStr: string): Buf => {
    const length = rawStr.length;
    const buf = new Buf(length);
    for (let i = 0; i < length; i++) {
      buf[i] = rawStr.charCodeAt(i);
    }
    return buf;
  }

  public static fromUtfStr = (utfStr: string): Buf => {
    // adapted from https://github.com/feross/buffer/blob/master/index.js see https://github.com/feross/buffer/blob/master/LICENSE (MIT as of Jan 2018)
    let codePoint;
    const length = utfStr.length;
    let leadSurrogate: number | undefined;
    const bytes: number[] = [];
    for (let i = 0; i < length; ++i) {
      codePoint = utfStr.charCodeAt(i);
      if (codePoint > 0xD7FF && codePoint < 0xE000) { // is surrogate component
        if (!leadSurrogate) { // last char was a lead
          if (codePoint > 0xDBFF) { // no lead yet
            bytes.push(0xEF, 0xBF, 0xBD); // unexpected trail
            continue;
          } else if (i + 1 === length) {
            bytes.push(0xEF, 0xBF, 0xBD);
            continue;
          }
          leadSurrogate = codePoint; // valid lead
          continue;
        }
        if (codePoint < 0xDC00) { // 2 leads in a row
          bytes.push(0xEF, 0xBF, 0xBD);
          leadSurrogate = codePoint;
          continue;
        }
        codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000; // valid surrogate pair
      } else if (leadSurrogate) {
        bytes.push(0xEF, 0xBF, 0xBD);
      }
      leadSurrogate = undefined;
      // encode utf8
      if (codePoint < 0x80) {
        bytes.push(codePoint);
      } else if (codePoint < 0x800) {
        bytes.push(codePoint >> 0x6 | 0xC0, codePoint & 0x3F | 0x80);
      } else if (codePoint < 0x10000) {
        bytes.push(codePoint >> 0xC | 0xE0, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
      } else if (codePoint < 0x110000) {
        bytes.push(codePoint >> 0x12 | 0xF0, codePoint >> 0xC & 0x3F | 0x80, codePoint >> 0x6 & 0x3F | 0x80, codePoint & 0x3F | 0x80);
      } else {
        throw new Error('Invalid code point');
      }
    }
    return new Buf(bytes);
  }

  public static fromBase64Str = (b64str: string): Buf => {
    return Buf.fromRawBytesStr(base64decode(b64str));
  }

  public static fromBase64UrlStr = (b64UrlStr: string): Buf => {
    return Buf.fromBase64Str(b64UrlStr.replace(/-/g, '+').replace(/_/g, '/'));
  }

  public toUtfStr = (mode: 'strict' | 'inform' | 'ignore' = 'inform'): string => { // tom
    const length = this.length;
    let bytesLeftInChar = 0;
    let utf8string = '';
    let binaryChar = '';
    for (let i = 0; i < length; i++) {
      if (this[i] < 128) {
        if (bytesLeftInChar) { // utf-8 continuation byte missing, assuming the last character was an 8-bit ASCII character
          utf8string += String.fromCharCode(this[i - 1]);
        }
        bytesLeftInChar = 0;
        binaryChar = '';
        utf8string += String.fromCharCode(this[i]);
      } else {
        if (!bytesLeftInChar) { // beginning of new multi-byte character
          if (this[i] >= 128 && this[i] < 192) { // 10xx xxxx
            utf8string += String.fromCharCode(this[i]); // extended 8-bit ASCII compatibility, european ASCII characters
          } else if (this[i] >= 192 && this[i] < 224) { // 110x xxxx
            bytesLeftInChar = 1;
            binaryChar = this[i].toString(2).substr(3);
          } else if (this[i] >= 224 && this[i] < 240) { // 1110 xxxx
            bytesLeftInChar = 2;
            binaryChar = this[i].toString(2).substr(4);
          } else if (this[i] >= 240 && this[i] < 248) { // 1111 0xxx
            bytesLeftInChar = 3;
            binaryChar = this[i].toString(2).substr(5);
          } else if (this[i] >= 248 && this[i] < 252) { // 1111 10xx
            bytesLeftInChar = 4;
            binaryChar = this[i].toString(2).substr(6);
          } else if (this[i] >= 252 && this[i] < 254) { // 1111 110x
            bytesLeftInChar = 5;
            binaryChar = this[i].toString(2).substr(7);
          } else {
            if (mode === 'strict' || mode === 'inform') {
              const e = new Error('Buf.toUtfStr: invalid utf-8 character beginning byte: ' + this[i]);
              if (mode === 'strict') {
                throw e;
              }
              console.log(e);
            }
          }
        } else { // continuation of a multi-byte character
          binaryChar += this[i].toString(2).substr(2);
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

  public toRawBytesStr = (): string => {
    const chunkSize = 0x8000;
    const length = this.length;
    const chars = [];
    for (let i = 0; i < length; i += chunkSize) {
      chars.push(String.fromCharCode.apply(undefined, this.subarray(i, i + chunkSize)));
    }
    return chars.join('');
  }

  public toBase64Str = (): string => {
    return base64encode(this.toRawBytesStr());
  }

  public toBase64UrlStr = (): string => {
    return this.toBase64Str().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  public toString = this.toUtfStr; // mimic Node api

}
