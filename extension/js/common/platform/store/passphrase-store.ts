/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { StorageType, AbstractStore } from './abstract-store.js';
import { AccountIndex, AcctStore, AcctStoreDict } from './acct-store.js';
import { PromiseCancellation, Dict } from '../../core/common.js';
import { Ui } from '../../browser/ui.js';
import { OpenPGPKey } from '../../core/crypto/pgp/openpgp-key.js';
import { InMemoryStore } from './in-memory-store.js';

/**
 * Local or session store of pass phrases
 */
export class PassphraseStore extends AbstractStore {

  /**
   * todo - make it only accept fingerprints
   */
  public static set = async (storageType: StorageType, acctEmail: string, fingerprintOrLongid: string, passphrase: string | undefined) => {
    const longid = fingerprintOrLongid.length === 40 ? OpenPGPKey.fingerprintToLongid(fingerprintOrLongid) : fingerprintOrLongid;
    const storageIndex = PassphraseStore.getIndex(longid);
    if (storageType === 'session') {
      return await InMemoryStore.set(acctEmail, storageIndex, passphrase);
    } else {
      if (typeof passphrase === 'undefined') {
        await AcctStore.remove(acctEmail, [storageIndex]);
      } else {
        const toSave: AcctStoreDict = {};
        toSave[storageIndex] = passphrase as any;
        await AcctStore.set(acctEmail, toSave);
      }
    }
  }

  /**
   * todo - make it only accept fingerprints
   */
  public static get = async (acctEmail: string, fingerprintOrLongid: string, ignoreSession: boolean = false): Promise<string | undefined> => {
    const longid = fingerprintOrLongid.length === 40 ? OpenPGPKey.fingerprintToLongid(fingerprintOrLongid) : fingerprintOrLongid;
    const storageIndex = PassphraseStore.getIndex(longid);
    const storage = await AcctStore.get(acctEmail, [storageIndex]);
    const found = storage[storageIndex];
    if (typeof found === 'string') {
      return found;
    }
    if (ignoreSession) {
      return undefined;
    }
    return await InMemoryStore.get(acctEmail, storageIndex) ?? undefined;
  }

  /**
   * todo - make it only accept fingerprints
   */
  public static waitUntilPassphraseChanged = async (
    acctEmail: string, missingOrWrongPpKeyLongids: string[], interval = 1000, cancellation: PromiseCancellation = { cancel: false }
  ): Promise<boolean> => {
    const missingOrWrongPassprases: Dict<string | undefined> = {};
    const passphrases = await Promise.all(missingOrWrongPpKeyLongids.map(longid => PassphraseStore.get(acctEmail, longid)));
    for (const i of missingOrWrongPpKeyLongids.keys()) {
      missingOrWrongPassprases[missingOrWrongPpKeyLongids[i]] = passphrases[i];
    }
    while (!cancellation.cancel) {
      await Ui.time.sleep(interval);
      const longidsMissingPp = Object.keys(missingOrWrongPassprases);
      const updatedPpArr = await Promise.all(longidsMissingPp.map(longid => PassphraseStore.get(acctEmail, longid)));
      for (let i = 0; i < longidsMissingPp.length; i++) {
        const missingOrWrongPp = missingOrWrongPassprases[longidsMissingPp[i]];
        const updatedPp = updatedPpArr[i];
        if (updatedPp !== missingOrWrongPp) {
          return true;
        }
      }
    }
    return false;
  }

  private static getIndex = (longid: string): AccountIndex => {
    return `passphrase_${longid}` as AccountIndex;
  }

}
