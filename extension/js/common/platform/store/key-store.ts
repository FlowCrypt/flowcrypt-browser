/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { KeyInfo, Key, KeyUtil } from '../../core/crypto/key.js';
import { AcctStore } from './acct-store.js';
import { PassphraseStore } from './passphrase-store.js';
import { AbstractStore } from './abstract-store.js';
import { PgpKey } from '../../core/crypto/pgp/openpgp-key.js';

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
    return keys.filter(ki => {
      if (fingerprints.includes('primary') && ki.primary) {
        return true;
      }
      if (fingerprints.includes(ki.fingerprint)) {
        return true;
      }
      return false;
    });
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
    const newKeyLongid = await PgpKey.longid(await KeyUtil.parse(newKeyArmored));
    if (newKeyLongid) {
      for (const i in keyinfos) {
        if (newKeyLongid === keyinfos[i].longid) { // replacing a key
          keyinfos[i] = await KeyStore.keyInfoObj(prv, keyinfos[i].primary);
          updated = true;
        }
      }
      if (!updated) {
        keyinfos.push(await KeyStore.keyInfoObj(prv, keyinfos.length === 0));
      }
      await AcctStore.set(acctEmail, { keys: keyinfos });
    }
  }

  public static remove = async (acctEmail: string, removeFingerprint: string): Promise<void> => {
    const privateKeys = await KeyStore.get(acctEmail);
    const filteredPrivateKeys = privateKeys.filter(ki => ki.fingerprint !== removeFingerprint);
    await AcctStore.set(acctEmail, { keys: filteredPrivateKeys });
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

  public static keyInfoObj = async (prv: Key, primary = false): Promise<KeyInfo> => {
    const longid = await PgpKey.longid(prv);
    if (!longid) {
      throw new Error('Store.keysObj: unexpectedly no longid');
    }
    const fingerprint = await PgpKey.fingerprint(prv);
    const pubArmor = KeyUtil.armor(await KeyUtil.asPublicKey(prv));
    return { private: KeyUtil.armor(prv), public: pubArmor, primary, longid, fingerprint: fingerprint! };
  }

}
