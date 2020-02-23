/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { StorageType } from './abstract-store.js';
import { AccountIndex, AcctStore, AcctStoreDict } from './acct-store.js';
import { SessionStore } from './session-store.js';
import { PromiseCancellation, Dict } from '../../core/common.js';
import { Ui } from '../../browser/ui.js';

export class PassphraseStore extends AcctStore {

  public static passphraseSave = async (storageType: StorageType, acctEmail: string, longid: string, passphrase: string | undefined) => {
    const storageKey: AccountIndex = `passphrase_${longid}` as AccountIndex;
    if (storageType === 'session') {
      await SessionStore.sessionSet(acctEmail, storageKey, passphrase);
    } else {
      if (typeof passphrase === 'undefined') {
        await PassphraseStore.remove(acctEmail, [storageKey]);
      } else {
        const toSave: AcctStoreDict = {};
        // @ts-ignore - this is too dynamic for TS
        toSave[storageKey] = passphrase;
        await PassphraseStore.setAcct(acctEmail, toSave);
      }
    }
  }

  public static passphraseGet = async (acctEmail: string, longid: string, ignoreSession: boolean = false): Promise<string | undefined> => {
    const storageKey = `passphrase_${longid}` as AccountIndex;
    const storage = await PassphraseStore.getAcct(acctEmail, [storageKey as AccountIndex]);
    const found = storage[storageKey];
    if (typeof found === 'string') {
      return found;
    }
    const fromSession = await SessionStore.sessionGet(acctEmail, storageKey);
    return fromSession && !ignoreSession ? fromSession : undefined;
  }

  public static waitUntilPassphraseChanged = async (
    acctEmail: string, missingOrWrongPpKeyLongids: string[], interval = 1000, cancellation: PromiseCancellation = { cancel: false }
  ): Promise<boolean> => {
    const missingOrWrongPassprases: Dict<string | undefined> = {};
    const passphrases = await Promise.all(missingOrWrongPpKeyLongids.map(longid => PassphraseStore.passphraseGet(acctEmail, longid)));
    for (const i of missingOrWrongPpKeyLongids.keys()) {
      missingOrWrongPassprases[missingOrWrongPpKeyLongids[i]] = passphrases[i];
    }
    while (!cancellation.cancel) {
      await Ui.time.sleep(interval);
      const longidsMissingPp = Object.keys(missingOrWrongPassprases);
      const updatedPpArr = await Promise.all(longidsMissingPp.map(longid => PassphraseStore.passphraseGet(acctEmail, longid)));
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

}
