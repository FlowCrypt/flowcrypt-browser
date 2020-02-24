/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { KeyInfo, PgpKey } from '../../core/pgp-key.js';
import { AcctStore } from './acct-store.js';
import { PassphraseStore } from './passphrase-store.js';

/**
 * Local store of account private keys
 */
export class KeyStore extends AcctStore {

  public static keysGet = async (acctEmail: string, longids?: string[]): Promise<KeyInfo[]> => {
    const stored = await KeyStore.getAcct(acctEmail, ['keys']);
    const keys: KeyInfo[] = stored.keys || [];
    if (!longids) {
      return keys;
    }
    return keys.filter(ki => longids.includes(ki.longid) || (longids.includes('primary') && ki.primary));
  }

  public static keysGetAllWithPp = async (acctEmail: string): Promise<KeyInfo[]> => {
    const keys = await KeyStore.keysGet(acctEmail);
    for (const ki of keys) {
      ki.passphrase = await PassphraseStore.passphraseGet(acctEmail, ki.longid);
    }
    return keys;
  }

  public static keysAdd = async (acctEmail: string, newKeyArmored: string) => {
    const keyinfos = await KeyStore.keysGet(acctEmail);
    let updated = false;
    const prv = await PgpKey.read(newKeyArmored);
    if (!prv.isFullyEncrypted()) {
      throw new Error('Canot import plain, unprotected key.');
    }
    const newKeyLongid = await PgpKey.longid(prv);
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
      await KeyStore.setAcct(acctEmail, { keys: keyinfos });
    }
  }

  public static keysRemove = async (acctEmail: string, removeLongid: string): Promise<void> => {
    const privateKeys = await KeyStore.keysGet(acctEmail);
    const filteredPrivateKeys = privateKeys.filter(ki => ki.longid !== removeLongid);
    await KeyStore.setAcct(acctEmail, { keys: filteredPrivateKeys });
  }

  public static getKeyLongidsThatCurrentlyHavePassPhraseInSession = async (acctEmail: string): Promise<string[]> => {
    const keys = await KeyStore.keysGet(acctEmail);
    const result: string[] = [];
    for (const key of keys) {
      if (! await PassphraseStore.passphraseGet(acctEmail, key.longid, true) && await PassphraseStore.passphraseGet(acctEmail, key.longid, false)) {
        result.push(key.longid);
      }
    }
    return result;
  }

  public static keyInfoObj = async (prv: OpenPGP.key.Key, primary = false): Promise<KeyInfo> => {
    const longid = await PgpKey.longid(prv);
    if (!longid) {
      throw new Error('Store.keysObj: unexpectedly no longid');
    }
    const fingerprint = await PgpKey.fingerprint(prv);
    return { private: prv.armor(), public: prv.toPublic().armor(), primary, longid, fingerprint: fingerprint! };
  }

}
