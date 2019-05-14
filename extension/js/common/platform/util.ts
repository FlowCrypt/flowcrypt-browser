/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

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

export const normalizeLongId = (longid: string) => {
  let result = longid.trim().replace(/0x|\s|:|-/g, '').toUpperCase();

  if (result.length >= 16) {
    result = result.substring(result.length - 16, 16);

    if (result.match(/[A-F0-9]{16}/g)) {
      return result;
    }
  }

  return;
};