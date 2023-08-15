/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Bm } from './browser/browser-msg.js';
import { Buf } from './core/buf.js';
import { EncryptionKeyStore } from './platform/store/encryption-key-store.js';
import { secureRandomBytes } from './platform/util.js';

export interface SymEncryptedMessage {
  to: string;
  uid: string;
  encryptedData: ArrayBuffer;
  propagateToParent?: boolean;
}

export class SymmetricMessageEncryption {
  private static cryptoKey: CryptoKey | undefined;
  public static generateIV = (): string => {
    return Buf.fromUint8(secureRandomBytes(12)).toBase64Str(); // 96 bit
  };
  public static encrypt = async (msg: Bm.RawWithWindowExtensions): Promise<SymEncryptedMessage> => {
    if (!SymmetricMessageEncryption.cryptoKey) {
      SymmetricMessageEncryption.cryptoKey = await SymmetricMessageEncryption.fromBytes(await EncryptionKeyStore.get(32));
    }
    const iv = Buf.fromBase64Str(msg.uid);
    const data = Buf.with(JSON.stringify(msg));
    const encryptedData = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      SymmetricMessageEncryption.cryptoKey,
      data
    );
    return { to: msg.to, uid: msg.uid, encryptedData };
  };
  public static decrypt = async (msg: SymEncryptedMessage): Promise<Bm.RawWithWindowExtensions> => {
    if (!SymmetricMessageEncryption.cryptoKey) {
      SymmetricMessageEncryption.cryptoKey = await SymmetricMessageEncryption.fromBytes(await EncryptionKeyStore.get());
    }
    const iv = Buf.fromBase64Str(msg.uid);
    const decryptedBytes = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      SymmetricMessageEncryption.cryptoKey,
      msg.encryptedData
    );
    const bm: Bm.RawWithWindowExtensions = JSON.parse(new Buf(decryptedBytes).toUtfStr());
    return bm;
  };
  private static fromBytes = async (encryptionKeyBuffer: ArrayBuffer) => {
    return await crypto.subtle.importKey(
      'raw', // Format of the input key material
      encryptionKeyBuffer, // ArrayBuffer containing the key material
      {
        // Key algorithm parameters
        name: 'AES-GCM',
        length: new Uint8Array(encryptionKeyBuffer).length * 8, // Key length in bits
      },
      false, // Whether the key is extractable (can be exported)
      ['encrypt', 'decrypt'] // Key usages
    );
  };
}
