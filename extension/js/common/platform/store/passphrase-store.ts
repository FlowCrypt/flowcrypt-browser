/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { StorageType, AbstractStore } from './abstract-store.js';
import { AccountIndex, AcctStore, AcctStoreDict } from './acct-store.js';
import { PromiseCancellation, Dict } from '../../core/common.js';
import { Ui } from '../../browser/ui.js';
import { InMemoryStore } from './in-memory-store.js';

/**
 * Local or session store of pass phrases
 */
export class PassphraseStore extends AbstractStore {

  // if we implement (and migrate) password storage to use KeyIdentity instead of longid, we'll have `keyInfo: KeyIdentity` here
  public static get = async (acctEmail: string, keyInfo: { longid: string }, ignoreSession: boolean = false): Promise<string | undefined> => {
    const storageIndex = PassphraseStore.getIndex(keyInfo.longid);
    return await PassphraseStore.getByIndex(acctEmail, storageIndex, ignoreSession);
  };

  // if we implement (and migrate) password storage to use KeyIdentity instead of longid, we'll have `keyInfo: KeyIdentity` here
  public static set = async (storageType: StorageType, acctEmail: string, keyInfo: { longid: string }, passphrase: string | undefined): Promise<void> => {
    const storageIndex = PassphraseStore.getIndex(keyInfo.longid);
    await PassphraseStore.setByIndex(storageType, acctEmail, storageIndex, passphrase);
  };

  public static waitUntilPassphraseChanged = async (
    acctEmail: string, missingOrWrongPpKeyLongids: string[], interval = 1000, cancellation: PromiseCancellation = { cancel: false }
  ): Promise<boolean> => {
    const missingOrWrongPassprases: Dict<string | undefined> = {};
    const passphrases = await Promise.all(missingOrWrongPpKeyLongids.map(longid => PassphraseStore.get(acctEmail, { longid })));
    for (const i of missingOrWrongPpKeyLongids.keys()) {
      missingOrWrongPassprases[missingOrWrongPpKeyLongids[i]] = passphrases[i];
    }
    while (!cancellation.cancel) {
      await Ui.time.sleep(interval);
      const longidsMissingPp = Object.keys(missingOrWrongPassprases);
      const updatedPpArr = await Promise.all(longidsMissingPp.map(longid => PassphraseStore.get(acctEmail, { longid })));
      for (let i = 0; i < longidsMissingPp.length; i++) {
        const missingOrWrongPp = missingOrWrongPassprases[longidsMissingPp[i]];
        const updatedPp = updatedPpArr[i];
        if (updatedPp !== missingOrWrongPp) {
          return true;
        }
      }
    }
    return false;
  };

  private static getIndex = (longid: string): AccountIndex => {
    return `passphrase_${longid}` as unknown as AccountIndex;
  };

  private static getByIndex = async (acctEmail: string, storageIndex: AccountIndex, ignoreSession: boolean = false): Promise<string | undefined> => {
    const storage = await AcctStore.get(acctEmail, [storageIndex]);
    const found = storage[storageIndex];
    if (typeof found === 'string') {
      return found;
    }
    if (ignoreSession) {
      return undefined;
    }
    const res = await InMemoryStore.get(acctEmail, storageIndex) ?? undefined;
    return res;
  };

  private static setByIndex = async (storageType: StorageType, acctEmail: string, storageIndex: AccountIndex, passphrase: string | undefined): Promise<void> => {
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
  };

}
