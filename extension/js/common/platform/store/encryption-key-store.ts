/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { storageGet, storageSet } from '../../browser/chrome.js';
import { Buf } from '../../core/buf.js';
import { secureRandomBytes } from '../util.js';

const toArrayBufferStrict = (view: ArrayBufferView): ArrayBuffer => {
  const ab = new ArrayBuffer(view.byteLength);
  new Uint8Array(ab).set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return ab;
};

export class EncryptionKeyStore {
  private static key = 'cryptup_cryptokey' as const;

  public static async get(length?: number): Promise<ArrayBuffer> {
    const storageObj = await storageGet('local', [EncryptionKeyStore.key]);
    const value = storageObj[EncryptionKeyStore.key];
    if (!length || typeof value !== 'undefined') {
      const buf = Buf.fromBase64Str(value as string); // Buf extends Uint8Array
      return toArrayBufferStrict(buf);
    }
    const newKey = secureRandomBytes(length);
    await storageSet('local', { [EncryptionKeyStore.key]: new Buf(newKey).toBase64Str() });
    return toArrayBufferStrict(newKey);
  }
}
