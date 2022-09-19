/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { StorageType, AbstractStore } from './abstract-store.js';
import { AccountIndex, AcctStore, AcctStoreDict } from './acct-store.js';
import { PromiseCancellation, Dict } from '../../core/common.js';
import { Ui } from '../../browser/ui.js';
import { InMemoryStore } from './in-memory-store.js';
import { ClientConfiguration } from '../../client-configuration.js';

/**
 * Local or session store of pass phrases
 */
export class PassphraseStore extends AbstractStore {

  // if we implement (and migrate) password storage to use KeyIdentity instead of longid, we'll have `keyInfo: KeyIdentity` here
  public static get = async (acctEmail: string, keyInfo: { longid: string }, ignoreSession: boolean = false): Promise<string | undefined> => {
    return (await PassphraseStore.getMany(acctEmail, [keyInfo], ignoreSession))[0];
  };

  // if we implement (and migrate) password storage to use KeyIdentity instead of longid, we'll have `keyInfo: KeyIdentity` here
  public static getMany = async (acctEmail: string, keyInfos: { longid: string }[], ignoreSession: boolean = false): Promise<(string | undefined)[]> => {
    const storageIndexes = keyInfos.map(keyInfo => PassphraseStore.getIndex(keyInfo.longid));
    return await PassphraseStore.getByIndexes(acctEmail, storageIndexes, ignoreSession);
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

  private static getByIndexes = async (acctEmail: string, storageIndexes: AccountIndex[], ignoreSession: boolean = false): Promise<(string | undefined)[]> => {
    const storage = await AcctStore.get(acctEmail, storageIndexes);
    const results = await Promise.all(storageIndexes.map(async storageIndex => {
      const found = storage[storageIndex];
      if (typeof found === 'string') {
        return found;
      }
      if (ignoreSession) {
        return undefined;
      }
      return await InMemoryStore.get(acctEmail, storageIndex) ?? undefined;
    }));
    return results;
  };

  private static setByIndex = async (storageType: StorageType, acctEmail: string, storageIndex: AccountIndex, passphrase: string | undefined): Promise<void> => {
    const clientConfiguration = await ClientConfiguration.newInstance(acctEmail);
    if (storageType === 'session') {
      return await InMemoryStore.set(acctEmail, storageIndex, passphrase, Date.now() + clientConfiguration.getInMemoryPassPhraseSessionExpirationMs());
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
