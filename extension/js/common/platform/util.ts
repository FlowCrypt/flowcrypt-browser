/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

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
// tslint:disable:no-unsafe-any
export const compareObjects = (object1: { [key: string]: any }, object2: { [key: string]: any }) => {
  const keysObject1 = Object.keys(object1).sort();
  const keysObject2 = Object.keys(object2).sort();
  if (keysObject1.length !== keysObject2.length) { // Not the same (different keys length)
    return false;
  }
  if (keysObject1.join('') !== keysObject2.join('')) { // Not the same (different key names)
    return false;
  }
  for (const key of keysObject1) {
    if (object1[key] instanceof Array) {
      if (!(object2[key] instanceof Array)) {
        return false;
      }
      if (compareObjects(object1[key], object2[key]) === false) {
        return false;
      }
    } else if (object1[key] instanceof Date) {
      if (!(object2[key] instanceof Date)) {
        return false;
      }
      if (('' + object1[key]) !== ('' + object2[key])) {
        return false;
      }
    } else if (object1[key] instanceof Function) {
      if (!(object2[key] instanceof Function)) {
        return false;
      }
    } else if (object1[key] instanceof Object) {
      if (!(object2[key] instanceof Object)) {
        return false;
      }
      if (object1[key] === object1) { // references to itself?
        if (object2[key] !== object2) {
          return false;
        }
      } else if (compareObjects(object1[key], object2[key]) === false) {
        return false;
      }
    } else if (object1[key] !== object2[key]) {
      return false;
    }
  }
  return true;
};
// tslint:enable:no-unsafe-any
