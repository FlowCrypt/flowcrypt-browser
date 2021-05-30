/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../core/buf.js';

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

export const base64encode = (binary: string): string => {
  return btoa(binary);
};

export const base64decode = (b64tr: string): string => {
  return atob(b64tr);
};

export const blobToBase64 = async (blob: Blob) => {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result);
    };
    reader.onerror = () => {
      reject();
    };
    reader.readAsDataURL(blob);
  });
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
