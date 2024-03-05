/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { storageLocalGet, storageLocalSet } from '../../browser/chrome.js';
import { Buf } from '../../core/buf.js';
import { secureRandomBytes } from '../util.js';

export class EncryptionKeyStore {
  private static key = 'cryptup_cryptokey' as const;

  public static get = async (length?: number): Promise<Buf> => {
    const storageObj = await storageLocalGet([EncryptionKeyStore.key]);
    const value = storageObj[EncryptionKeyStore.key];
    if (typeof value === 'string') {
      return Buf.fromBase64Str(value);
    } else if (!length) {
      throw new Error('Failed to read the crypto key from local storage!');
    }
    const newKey = new Buf(secureRandomBytes(length));
    await storageLocalSet({ [EncryptionKeyStore.key]: newKey.toBase64Str() });
    return newKey;
  };
}
