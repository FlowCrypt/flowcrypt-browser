/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../core/buf.js';
import { requireMD5 } from './require.js';

/**
 * Functions which must be written differently to run in NodeJS versus in web browsers.
 *
 * If the code would be the same on both platforms, it does not belong here (or anywhere in platform/ directory)
 */

export const secureRandomBytes = (length: number): Uint8Array => {
  const secureRandomArray = new Uint8Array(length);
  window.crypto.getRandomValues(secureRandomArray);
  return secureRandomArray;
};

export const md5Encode = (binary: string | ArrayBuffer | SharedArrayBuffer): string => {
  const md5 = requireMD5();
  // tslint:disable-next-line: no-unsafe-any
  return md5.base64(binary);
};

export const base64encode = (binary: string): string => {
  return btoa(binary);
};

export const base64decode = (b64tr: string): string => {
  return atob(b64tr);
};

export const moveElementInArray = <T>(arr: Array<T>, oldIndex: number, newIndex: number) => {
  while (oldIndex < 0) {
    oldIndex += arr.length;
  }
  while (newIndex < 0) {
    newIndex += arr.length;
  }
  arr.splice(newIndex, 0, arr.splice(oldIndex, 1)[0]);
  return arr;
};

export const iso2022jpToUtf = (content: Buf) => {
  if (!TextDecoder) {
    throw new Error('Your browser is not supported (missing TextDecoder)');
  }
  const decoder = new TextDecoder('iso-2022-jp');
  return decoder.decode(content);
};
