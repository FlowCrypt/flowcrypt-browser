/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { base64decode, base64encode } from '../platform/util.js';

export class Buf extends Uint8Array {
  public static concat = (arrays: Uint8Array[]): Buf => {
    const result = new Uint8Array(arrays.reduce((totalLen, arr) => totalLen + arr.length, 0));
    let offset = 0;
    for (const array of arrays) {
      result.set(array, offset);
      offset += array.length;
    }
    return Buf.fromUint8(result);
  };

  public static with = (input: Uint8Array | Buf | string): Buf => {
    // utf8 string or Typed Array bytes
    if (input instanceof Buf) {
      return input;
    } else if (input instanceof Uint8Array) {
      return Buf.fromUint8(input);
    } else {
      return Buf.fromUtfStr(input);
    }
  };

  public static fromUint8 = (u8a: Uint8Array): Buf => {
    return new Buf(u8a);
  };

  public static fromRawBytesStr = (rawStr: string, start = 0, end = rawStr.length): Buf => {
    const buf = new Buf(end - start);
    for (let i = 0; i < end - start; i++) {
      buf[i] = rawStr.charCodeAt(i + start);
    }
    return buf;
  };

  public static fromUtfStr = (utfStr: string): Buf => {
    // adapted from https://github.com/feross/buffer/blob/master/index.js see https://github.com/feross/buffer/blob/master/LICENSE (MIT as of Jan 2018)
    let codePoint;
    const length = utfStr.length;
    let leadSurrogate: number | undefined;
    const bytes: number[] = [];
    for (let i = 0; i < length; ++i) {
      codePoint = utfStr.charCodeAt(i);
      if (codePoint > 0xd7ff && codePoint < 0xe000) {
        // is surrogate component
        if (!leadSurrogate) {
          // last char was a lead
          if (codePoint > 0xdbff) {
            // no lead yet
            bytes.push(0xef, 0xbf, 0xbd); // unexpected trail
            continue;
          } else if (i + 1 === length) {
            bytes.push(0xef, 0xbf, 0xbd);
            continue;
          }
          leadSurrogate = codePoint; // valid lead
          continue;
        }
        if (codePoint < 0xdc00) {
          // 2 leads in a row
          bytes.push(0xef, 0xbf, 0xbd);
          leadSurrogate = codePoint;
          continue;
        }
        codePoint = (((leadSurrogate - 0xd800) << 10) | (codePoint - 0xdc00)) + 0x10000; // valid surrogate pair
      } else if (leadSurrogate) {
        bytes.push(0xef, 0xbf, 0xbd);
      }
      leadSurrogate = undefined;
      // encode utf8
      if (codePoint < 0x80) {
        bytes.push(codePoint);
      } else if (codePoint < 0x800) {
        bytes.push((codePoint >> 0x6) | 0xc0, (codePoint & 0x3f) | 0x80);
      } else if (codePoint < 0x10000) {
        bytes.push((codePoint >> 0xc) | 0xe0, ((codePoint >> 0x6) & 0x3f) | 0x80, (codePoint & 0x3f) | 0x80);
      } else if (codePoint < 0x110000) {
        bytes.push((codePoint >> 0x12) | 0xf0, ((codePoint >> 0xc) & 0x3f) | 0x80, ((codePoint >> 0x6) & 0x3f) | 0x80, (codePoint & 0x3f) | 0x80);
      } else {
        throw new Error('Invalid code point');
      }
    }
    return new Buf(bytes);
  };

  public static fromBase64Str = (b64str: string): Buf => {
    return Buf.fromRawBytesStr(base64decode(b64str));
  };

  public static fromBase64UrlStr = (b64UrlStr: string): Buf => {
    return Buf.fromBase64Str(b64UrlStr.replace(/-/g, '+').replace(/_/g, '/'));
  };

  /** @deprecated use toUtfStr() instead */
  public toString = (mode: 'strict' | 'inform' | 'ignore' = 'inform'): string => {
    // mimic Buffer.toString()
    return this.toUtfStr(mode);
  };

  public toUtfStr = (mode: 'strict' | 'inform' | 'ignore' = 'inform'): string => {
    // tom
    const length = this.length;
    let bytesLeftInChar = 0;
    let utf8string = '';
    let binaryChar = '';
    for (let i = 0; i < length; i++) {
      if (this[i] < 128) {
        if (bytesLeftInChar) {
          // utf-8 continuation byte missing, assuming the last character was an 8-bit ASCII character
          utf8string += String.fromCharCode(this[i - 1]);
        }
        bytesLeftInChar = 0;
        binaryChar = '';
        utf8string += String.fromCharCode(this[i]);
      } else {
        if (!bytesLeftInChar) {
          // beginning of new multi-byte character
          if (this[i] >= 128 && this[i] < 192) {
            // 10xx xxxx
            utf8string += String.fromCharCode(this[i]); // extended 8-bit ASCII compatibility, european ASCII characters
          } else if (this[i] >= 192 && this[i] < 224) {
            // 110x xxxx
            bytesLeftInChar = 1;
            binaryChar = this[i].toString(2).substring(3);
          } else if (this[i] >= 224 && this[i] < 240) {
            // 1110 xxxx
            bytesLeftInChar = 2;
            binaryChar = this[i].toString(2).substring(4);
          } else if (this[i] >= 240 && this[i] < 248) {
            // 1111 0xxx
            bytesLeftInChar = 3;
            binaryChar = this[i].toString(2).substring(5);
          } else if (this[i] >= 248 && this[i] < 252) {
            // 1111 10xx
            bytesLeftInChar = 4;
            binaryChar = this[i].toString(2).substring(6);
          } else if (this[i] >= 252 && this[i] < 254) {
            // 1111 110x
            bytesLeftInChar = 5;
            binaryChar = this[i].toString(2).substring(7);
          } else {
            if (mode === 'strict' || mode === 'inform') {
              const e = new Error('Buf.toUtfStr: invalid utf-8 character beginning byte: ' + this[i]);
              if (mode === 'strict') {
                throw e;
              }
              console.info(e);
            }
          }
        } else {
          // continuation of a multi-byte character
          binaryChar += this[i].toString(2).substring(2);
          bytesLeftInChar--;
        }
        if (binaryChar && !bytesLeftInChar) {
          try {
            const codePoint = parseInt(binaryChar, 2);
            utf8string += codePoint >= 0x10000 ? String.fromCodePoint(codePoint) : String.fromCharCode(codePoint);
          } catch (e) {
            if (mode === 'inform') {
              console.log(e);
            } else if (mode === 'strict') {
              throw e;
            }
          }
          binaryChar = '';
        }
      }
    }
    return utf8string;
  };

  public toRawBytesStr = (): string => {
    const chunkSize = 0x8000;
    const length = this.length;
    const chars = [];
    for (let i = 0; i < length; i += chunkSize) {
      chars.push(String.fromCharCode.apply(undefined, Array.from(this.subarray(i, i + chunkSize))));
    }
    return chars.join('');
  };

  public toHexStr = (uppercaseFlag = true): string => {
    const chars: string[] = [];
    for (const v of this.values()) {
      let char = ('00' + v.toString(16)).slice(-2);
      if (uppercaseFlag) {
        char = char.toUpperCase();
      }
      chars.push(char);
    }
    return chars.join('');
  };

  public toBase64Str = (): string => {
    return base64encode(this.toRawBytesStr());
  };

  public toBase64UrlStr = (): string => {
    return this.toBase64Str().replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
}
