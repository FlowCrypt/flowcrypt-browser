/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Key, KeyInfo, KeyUtil } from '../../core/crypto/key.js';
import { AcctStore } from './acct-store.js';
import { PassphraseStore } from './passphrase-store.js';
import { AbstractStore } from './abstract-store.js';

/**
 * Local store of account private keys
 */
export class KeyStore extends AbstractStore {

  public static keyInfoObj = async (prv: Key): Promise<KeyInfo> => { return await KeyUtil.keyInfoObj(prv); }

  public static get = async (acctEmail: string, fingerprints?: string[]): Promise<KeyInfo[]> => {
    const stored = await AcctStore.get(acctEmail, ['keys']);
    const keys: KeyInfo[] = stored.keys || [];
    if (!fingerprints) {
      return keys;
    }
    return keys.filter(ki => fingerprints.includes(ki.fingerprint));
  }

  public static getFirst = async (acctEmail: string): Promise<KeyInfo> => {
    const keys = await KeyStore.get(acctEmail);
    return keys[0];
  }

  public static getAllWithPp = async (acctEmail: string): Promise<KeyInfo[]> => {
    const keys = await KeyStore.get(acctEmail);
    for (const ki of keys) {
      ki.passphrase = await PassphraseStore.get(acctEmail, ki.fingerprint);
    }
    return keys;
  }

  public static add = async (acctEmail: string, newKeyArmored: string) => {
    const keyinfos = await KeyStore.get(acctEmail);
    let updated = false;
    const prv = await KeyUtil.parse(newKeyArmored);
    if (!prv.fullyEncrypted) {
      throw new Error('Cannot import plain, unprotected key.');
    }
    for (const i in keyinfos) {
      if (prv.id === keyinfos[i].fingerprint) { // replacing a key
        keyinfos[i] = await KeyStore.keyInfoObj(prv);
        updated = true;
      }
    }
    if (!updated) {
      keyinfos.push(await KeyStore.keyInfoObj(prv));
    }
    await KeyStore.set(acctEmail, keyinfos);
  }

  public static set = async (acctEmail: string, keyinfos: KeyInfo[]) => {
    await AcctStore.set(acctEmail, { keys: keyinfos });
  }

  public static remove = async (acctEmail: string, removeFingerprint: string): Promise<void> => {
    const privateKeys = await KeyStore.get(acctEmail);
    const filteredPrivateKeys = privateKeys.filter(ki => ki.fingerprint !== removeFingerprint);
    await KeyStore.set(acctEmail, filteredPrivateKeys);
  }

  /**
   * todo - switch to fingerprints
   */
  public static getLongidsThatCurrentlyHavePassPhraseInSession = async (acctEmail: string): Promise<string[]> => {
    const keys = await KeyStore.get(acctEmail);
    const result: string[] = [];
    for (const key of keys) {
      if (! await PassphraseStore.get(acctEmail, key.fingerprint, true) && await PassphraseStore.get(acctEmail, key.fingerprint, false)) {
        result.push(key.longid);
      }
    }
    return result;
  }
}
