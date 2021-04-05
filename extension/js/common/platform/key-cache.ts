/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from './catch.js';
import { Key } from '../core/crypto/key.js';

let KEY_CACHE: { [longidOrArmoredKey: string]: Key } = {};
let KEY_CACHE_WIPE_TIMEOUT: number;

export class KeyCache {

  public static setDecrypted = (k: Key) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // todo - not yet used in browser extension, but planned to be enabled soon
    // Store.extendExpiry();
    // KEY_CACHE[keyLongid(k)] = k;
  }

  public static getDecrypted = (longid: string): Key | undefined => {
    KeyCache.extendExpiry();
    return KEY_CACHE[longid];
  }

  public static setArmored = (armored: string, k: Key) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // todo - not yet used in browser extension, but planned to be enabled soon
    // Store.extendExpiry();
    // KEY_CACHE[armored] = k;
  }

  public static getArmored = (armored: string): Key | undefined => {
    KeyCache.extendExpiry();
    return KEY_CACHE[armored];
  }

  public static wipe = () => {
    KEY_CACHE = {};
  }

  private static extendExpiry = () => {
    if (KEY_CACHE_WIPE_TIMEOUT) {
      clearTimeout(KEY_CACHE_WIPE_TIMEOUT);
    }
    KEY_CACHE_WIPE_TIMEOUT = Catch.setHandledTimeout(KeyCache.wipe, 2 * 60 * 1000);
  }

}
