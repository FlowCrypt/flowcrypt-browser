/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export class Buf extends Uint8Array {
  public static concat = (arrays: Uint8Array[]): Buf => {
    const result = new Buf(arrays.reduce((totalLen, arr) => totalLen + arr.length, 0));
    let offset = 0;
    for (const array of arrays) {
      result.set(array, offset);
      offset += array.length;
    }
    return result;
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
    const bytes = new TextEncoder().encode(utfStr);
    return new Buf(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  };

  public static fromBase64Str = (b64str: string): Buf => {
    const bytes = Uint8Array.fromBase64(b64str, { lastChunkHandling: 'loose' });
    return new Buf(bytes.buffer, bytes.byteOffset, bytes.byteLength);
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
    const hex = this.toHex();
    return uppercaseFlag ? hex.toUpperCase() : hex;
  };

  public toBase64Str = (): string => {
    return this.toBase64();
  };

  public toBase64UrlStr = (): string => {
    return this.toBase64({ alphabet: 'base64url', omitPadding: true });
  };
}
