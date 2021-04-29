/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { KeyInfo, KeyInfoWithOptionalPp, KeyUtil, Key } from '../../core/crypto/key.js';
import { AcctStore } from './acct-store.js';
import { PassphraseStore } from './passphrase-store.js';
import { AbstractStore } from './abstract-store.js';
import { Assert } from '../../assert.js';

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
  }

  public static getFirstOptional = async (acctEmail: string): Promise<KeyInfo | undefined> => {
    const stored = await AcctStore.get(acctEmail, ['keys']);
    const keys: KeyInfo[] = stored.keys || [];
    return keys[0];
  }

  public static getFirstRequired = async (acctEmail: string): Promise<KeyInfo> => {
    const key = await KeyStore.getFirstOptional(acctEmail);
    Assert.abortAndRenderErrorIfKeyinfoEmpty(key);
    return key as KeyInfo;
  }

  public static getAllWithOptionalPassPhrase = async (acctEmail: string): Promise<KeyInfoWithOptionalPp[]> => {
    const keys = await KeyStore.get(acctEmail);
    const withPp: KeyInfoWithOptionalPp[] = [];
    for (const ki of keys) {
      const parsed = await KeyUtil.parse(ki.private);
      withPp.push({ ...ki, type: parsed.type, passphrase: await PassphraseStore.get(acctEmail, ki.fingerprints[0]) });
    }
    return withPp;
  }

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
  }

  public static set = async (acctEmail: string, keyinfos: KeyInfo[]) => {
    await AcctStore.set(acctEmail, { keys: keyinfos });
  }

  public static remove = async (acctEmail: string, removeFingerprint: string): Promise<void> => {
    const privateKeys = await KeyStore.get(acctEmail);
    const filteredPrivateKeys = privateKeys.filter(ki => ki.fingerprints[0] !== removeFingerprint);
    await KeyStore.set(acctEmail, filteredPrivateKeys);
  }

  /**
   * todo - switch to fingerprints
   */
  public static getLongidsThatCurrentlyHavePassPhraseInSession = async (acctEmail: string): Promise<string[]> => {
    const keys = await KeyStore.get(acctEmail);
    const result: string[] = [];
    for (const key of keys) {
      if (! await PassphraseStore.get(acctEmail, key.fingerprints[0], true) && await PassphraseStore.get(acctEmail, key.fingerprints[0], false)) {
        result.push(key.longid);
      }
    }
    return result;
  }
}
