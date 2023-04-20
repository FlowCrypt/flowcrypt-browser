/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { StorageType, AbstractStore } from './abstract-store.js';
import { AccountIndex, AcctStore, AcctStoreDict } from './acct-store.js';
import { PromiseCancellation, Dict } from '../../core/common.js';
import { Time } from '../../browser/time.js';
import { InMemoryStore } from './in-memory-store.js';
import { ClientConfiguration } from '../../client-configuration.js';

/**
 * Local or session store of pass phrases
 */
export class PassphraseStore extends AbstractStore {
  // if we implement (and migrate) password storage to use KeyIdentity instead of longid, we'll have `keyInfo: KeyIdentity` here
  public static get = async (acctEmail: string, keyInfo: { longid: string }, ignoreSession = false): Promise<string | undefined> => {
    return (await PassphraseStore.getMany(acctEmail, [keyInfo], ignoreSession))[0]?.value;
  };

  // if we implement (and migrate) password storage to use KeyIdentity instead of longid, we'll have `keyInfo: KeyIdentity` here
  public static getMany = async (
    acctEmail: string,
    keyInfos: { longid: string }[],
    ignoreSession = false
  ): Promise<({ value: string; source: StorageType } | undefined)[]> => {
    const storageIndexes = keyInfos.map(keyInfo => PassphraseStore.getIndex(keyInfo.longid));
    return await PassphraseStore.getByIndexes(acctEmail, storageIndexes, ignoreSession);
  };

  public static removeMany = async (acctEmail: string, keyInfos: { longid: string }[]) => {
    const storageIndexes = keyInfos.map(keyInfo => PassphraseStore.getIndex(keyInfo.longid));
    await Promise.all([
      AcctStore.remove(acctEmail, storageIndexes), // remove from local storage
      ...storageIndexes.map(storageIndex => InMemoryStore.set(acctEmail, storageIndex, undefined)), // remove from session
    ]);
  };

  // if we implement (and migrate) password storage to use KeyIdentity instead of longid, we'll have `keyInfo: KeyIdentity` here
  public static set = async (storageType: StorageType, acctEmail: string, keyInfo: { longid: string }, passphrase: string | undefined): Promise<void> => {
    const storageIndex = PassphraseStore.getIndex(keyInfo.longid);
    await PassphraseStore.setByIndex(storageType, acctEmail, storageIndex, passphrase);
  };

  public static waitUntilPassphraseChanged = async (
    acctEmail: string,
    missingOrWrongPpKeyLongids: string[],
    interval = 1000,
    cancellation: PromiseCancellation = { cancel: false }
  ): Promise<boolean> => {
    const missingOrWrongPassprases: Dict<string | undefined> = {};
    const passphrases = await Promise.all(missingOrWrongPpKeyLongids.map(longid => PassphraseStore.get(acctEmail, { longid })));
    for (const i of missingOrWrongPpKeyLongids.keys()) {
      missingOrWrongPassprases[missingOrWrongPpKeyLongids[i]] = passphrases[i];
    }
    while (!cancellation.cancel) {
      await Time.sleep(interval);
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

  private static getByIndexes = async (
    acctEmail: string,
    storageIndexes: AccountIndex[],
    ignoreSession = false
  ): Promise<({ value: string; source: StorageType } | undefined)[]> => {
    const storage = await AcctStore.get(acctEmail, storageIndexes);
    const results = await Promise.all(
      storageIndexes.map(async storageIndex => {
        const found = storage[storageIndex];
        if (typeof found === 'string') {
          return { value: found, source: 'local' as StorageType };
        }
        if (ignoreSession) {
          return undefined;
        }
        const value = await InMemoryStore.get(acctEmail, storageIndex);
        if (typeof value === 'undefined') {
          return undefined;
        }
        return { value, source: 'session' as StorageType };
      })
    );
    return results;
  };

  private static setByIndex = async (
    storageType: StorageType,
    acctEmail: string,
    storageIndex: AccountIndex,
    passphrase: string | undefined
  ): Promise<void> => {
    const clientConfiguration = await ClientConfiguration.newInstance(acctEmail);
    if (storageType === 'session') {
      return await InMemoryStore.set(acctEmail, storageIndex, passphrase, Date.now() + clientConfiguration.getInMemoryPassPhraseSessionExpirationMs());
    } else {
      if (typeof passphrase === 'undefined') {
        await AcctStore.remove(acctEmail, [storageIndex]);
      } else {
        const toSave: AcctStoreDict = {};
        (toSave as Dict<unknown>)[storageIndex] = passphrase;
        await AcctStore.set(acctEmail, toSave);
      }
    }
  };
}
