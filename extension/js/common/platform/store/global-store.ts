/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserMsg } from '../../browser/browser-msg.js';
import { Env } from '../../browser/env.js';
import { RawStore, AbstractStore } from './abstract-store.js';
import { Dict, Value } from '../../core/common.js';
import { storageLocalSet, storageLocalGet, storageLocalRemove } from '../../api/chrome.js';
import { Catch } from '../catch.js';

export type StoredAdminCode = { date: number, codes: string[] };

export type GlobalStoreDict = {
  version?: number | null;
  account_emails?: string; // stringified array
  settings_seen?: boolean;
  hide_pass_phrases?: boolean;
  dev_outlook_allow?: boolean;
  admin_codes?: Dict<StoredAdminCode>;
  install_mobile_app_notification_dismissed?: boolean;
};

export type GlobalIndex = 'version' | 'account_emails' | 'settings_seen' | 'hide_pass_phrases' |
  'dev_outlook_allow' | 'admin_codes' | 'install_mobile_app_notification_dismissed';

/**
 * Locally stored data that is not associated with any email account
 */
export class GlobalStore extends AbstractStore {

  private static globalStorageScope: 'global' = 'global';

  public static set = async (values: GlobalStoreDict): Promise<void> => {
    if (Env.isContentScript()) {
      // extension storage can be disallowed in rare cases for content scripts throwing 'Error: Access to extension API denied.'
      // always go through bg script to avoid such errors
      return await BrowserMsg.send.bg.await.storeGlobalSet({ values });
    }
    const storageUpdate: RawStore = {};
    for (const key of Object.keys(values)) {
      const index = GlobalStore.singleScopeRawIndex(GlobalStore.globalStorageScope, key);
      storageUpdate[index] = values[key as GlobalIndex];
    }
    await storageLocalSet(storageUpdate);
  }

  public static get = async (keys: GlobalIndex[]): Promise<GlobalStoreDict> => {
    if (Env.isContentScript()) {
      // extension storage can be disallowed in rare cases for content scripts throwing 'Error: Access to extension API denied.'
      // always go through bg script to avoid such errors
      return await BrowserMsg.send.bg.await.storeGlobalGet({ keys });
    }
    const storageObj = await storageLocalGet(GlobalStore.singleScopeRawIndexArr(GlobalStore.globalStorageScope, keys)) as RawStore;
    return GlobalStore.buildSingleAccountStoreFromRawResults(GlobalStore.globalStorageScope, storageObj) as GlobalStore;
  }

  public static remove = async (keys: string[]) => {
    await storageLocalRemove(GlobalStore.singleScopeRawIndexArr(GlobalStore.globalStorageScope, keys));
  }

  public static acctEmailsGet = async (): Promise<string[]> => {
    const storage = await GlobalStore.get(['account_emails']);
    const acctEmails: string[] = [];
    if (typeof storage.account_emails !== 'undefined') {
      for (const acctEmail of JSON.parse(storage.account_emails) as string[]) {
        if (!acctEmails.includes(acctEmail.toLowerCase())) {
          acctEmails.push(acctEmail.toLowerCase());
        }
      }
    }
    return acctEmails;
  }

  public static acctEmailsAdd = async (acctEmail: string): Promise<void> => { // todo: concurrency issues with another tab loaded at the same time
    if (!acctEmail) {
      throw new Error(`attempting to save empty acctEmail: ${acctEmail}`);
    }
    if (acctEmail.match(/[A-Z]/)) {
      Catch.report(`attempting to save acctEmail that wasn't lowercased: ${acctEmail}`);
      acctEmail = acctEmail.toLowerCase();
    }
    const acctEmails = await GlobalStore.acctEmailsGet();
    if (!acctEmails.includes(acctEmail) && acctEmail) {
      acctEmails.push(acctEmail);
      await GlobalStore.set({ account_emails: JSON.stringify(acctEmails) });
      BrowserMsg.send.bg.updateUninstallUrl();
    }
  }

  public static acctEmailsRemove = async (acctEmail: string): Promise<void> => { // todo: concurrency issues with another tab loaded at the same time
    const acctEmails = await GlobalStore.acctEmailsGet();
    await GlobalStore.set({ account_emails: JSON.stringify(Value.arr.withoutVal(acctEmails, acctEmail)) });
    BrowserMsg.send.bg.updateUninstallUrl();
  }
}
