/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { storageLocalGet, storageLocalSet } from '../../browser/chrome.js';
import { Buf } from '../../core/buf.js';
import { secureRandomBytes } from '../util.js';

export class EncryptionKeyStore {
  private static key = 'cryptup_cryptokey' as const;

  public static get = async (length?: number): Promise<ArrayBuffer> => {
    const storageObj = await storageLocalGet([EncryptionKeyStore.key]);
    const value = storageObj[EncryptionKeyStore.key];
    if (!length || typeof value !== 'undefined') {
      return Buf.fromBase64Str(value as string);
    }
    const newKey = secureRandomBytes(length);
    await storageLocalSet({ [EncryptionKeyStore.key]: new Buf(newKey).toBase64Str() });
    return newKey;
  };
}
