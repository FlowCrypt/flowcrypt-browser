/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { KeyInfo, TypedKeyInfo, ExtendedKeyInfo, KeyUtil, Key, KeyIdentity } from '../../core/crypto/key.js';
import { AcctStore } from './acct-store.js';
import { PassphraseStore } from './passphrase-store.js';
import { AbstractStore } from './abstract-store.js';
import { Assert } from '../../assert.js';

export type ParsedKeyInfo = { keyInfo: KeyInfo, key: Key };

/**
 * Local store of account private keys
 */
export class KeyStore extends AbstractStore {

  public static get = async (acctEmail: string, fingerprints?: string[]): Promise<KeyInfo[]> => {
    const stored = await AcctStore.get(acctEmail, ['keys']);
    const keys: KeyInfo[] = stored.keys || [];
    if (!fingerprints) {
      return keys;
    }
    // filters by primary fingerprint - subkey fingerprints are ignored
    // todo - could consider also filtering by subkey fingerprints, but need to think about impact
    return keys.filter(ki => fingerprints.includes(ki.fingerprints[0]));
  };

  public static getRequired = async (acctEmail: string): Promise<KeyInfo[]> => {
    const keys = await KeyStore.get(acctEmail);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(keys);
    return keys;
  };

  public static getTypedKeyInfos = async (acctEmail: string): Promise<TypedKeyInfo[]> => {
    const keys = await KeyStore.get(acctEmail);
    const kis: TypedKeyInfo[] = [];
    for (const ki of keys) {
      const type = KeyUtil.getKeyType(ki.private);
      const id = ki.fingerprints[0];
      if (type !== 'openpgp' && type !== 'x509') {
        continue;
      }
      kis.push({ ...ki, type, id });
    }
    return kis;
  };

  public static getAllWithOptionalPassPhrase = async (acctEmail: string): Promise<ExtendedKeyInfo[]> => {
    const keys = await KeyStore.getTypedKeyInfos(acctEmail);
    return await Promise.all(keys.map(async (ki) => { return { ...ki, passphrase: await PassphraseStore.get(acctEmail, ki) }; }));
  };

  public static add = async (acctEmail: string, newKey: string | Key) => {
    const keyinfos = await KeyStore.get(acctEmail);
    let updated = false;
    const prv: Key = (typeof newKey === 'string') ? await KeyUtil.parse(newKey) : newKey;
    if (!prv.fullyEncrypted) {
      throw new Error('Cannot import plain, unprotected key.');
    }
    for (const i in keyinfos) {
      if (prv.id === keyinfos[i].fingerprints[0]) { // replacing a key
        keyinfos[i] = await KeyUtil.keyInfoObj(prv);
        updated = true;
      }
    }
    if (!updated) {
      keyinfos.push(await KeyUtil.keyInfoObj(prv));
    }
    await KeyStore.set(acctEmail, keyinfos);
  };

  public static set = async (acctEmail: string, keyinfos: KeyInfo[]) => {
    await AcctStore.set(acctEmail, { keys: keyinfos });
  };

  public static remove = async (acctEmail: string, keyIdentity: KeyIdentity): Promise<void> => {
    const privateKeys = await KeyStore.getTypedKeyInfos(acctEmail);
    const filteredPrivateKeys = privateKeys.filter(ki => !KeyUtil.identityEquals(ki, keyIdentity));
    await KeyStore.set(acctEmail, filteredPrivateKeys);
  };

  public static getKeyInfosThatCurrentlyHavePassPhraseInSession = async (acctEmail: string): Promise<TypedKeyInfo[]> => {
    const keys = await KeyStore.getTypedKeyInfos(acctEmail);
    const result: TypedKeyInfo[] = [];
    for (const ki of keys) {
      if (! await PassphraseStore.get(acctEmail, ki, true) && await PassphraseStore.get(acctEmail, ki, false)) {
        result.push(ki);
      }
    }
    return result;
  };
}

export class KeyStoreUtil {

  public static parse = async (keyInfos: KeyInfo[]): Promise<ParsedKeyInfo[]> => {
    const parsed: ParsedKeyInfo[] = [];
    for (const keyInfo of keyInfos) {
      const key = await KeyUtil.parse(keyInfo.private);
      parsed.push({ keyInfo, key });
    }
    return parsed;
  };

  public static chooseMostUseful = (
    prvs: ParsedKeyInfo[], criteria: 'ONLY-FULLY-USABLE' | 'AT-LEAST-USABLE-BUT-EXPIRED' | 'EVEN-IF-UNUSABLE'
  ): ParsedKeyInfo | undefined => {
    const usablePrv = prvs.find(prv => prv.key.usableForEncryption && prv.key.usableForSigning)
      || prvs.find(prv => prv.key.usableForEncryption)
      || prvs.find(prv => prv.key.usableForSigning);
    if (usablePrv || criteria === 'ONLY-FULLY-USABLE') {
      return usablePrv;
    }
    const usableExpiredPrv =
      prvs.find(prv =>
        (prv.key.usableForEncryption || prv.key.usableForEncryptionButExpired)
        && (prv.key.usableForSigning || prv.key.usableForSigningButExpired)
      )
      || prvs.find(prv => prv.key.usableForEncryption || prv.key.usableForEncryptionButExpired)
      || prvs.find(prv => prv.key.usableForSigning || prv.key.usableForSigningButExpired);
    if (usableExpiredPrv || criteria === 'AT-LEAST-USABLE-BUT-EXPIRED') {
      return usableExpiredPrv;
    }
    // criteria === EVEN-IF-UNUSABLE
    return prvs.find(prv => !prv.key.revoked)
      || prvs[0];
  };

}
