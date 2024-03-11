/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { BrowserMsg } from '../../browser/browser-msg.js';
import { GmailRes } from '../../../common/api/email-provider/gmail/gmail-parser.js';
import { RawStore, AbstractStore } from './abstract-store.js';
import { Dict, Value } from '../../core/common.js';
import { storageLocalSet, storageLocalGet, storageLocalRemove } from '../../browser/chrome.js';
import { Catch } from '../catch.js';

export type LocalDraft = GmailRes.GmailDraftGet & { timestamp: number; acctEmail: string };

/* eslint-disable @typescript-eslint/naming-convention */
export type GlobalStoreDict = {
  version?: number | null;
  account_emails?: string; // stringified array
  settings_seen?: boolean;
  hide_pass_phrases?: boolean;
  dev_outlook_allow?: boolean;
  install_mobile_app_notification_dismissed?: boolean;
  key_info_store_fingerprints_added?: boolean;
  contact_store_x509_fingerprints_and_longids_updated?: boolean;
  contact_store_opgp_revoked_flags_updated?: boolean;
  contact_store_searchable_pruned?: boolean;
  local_drafts?: Dict<LocalDraft>;
};
/* eslint-enable @typescript-eslint/naming-convention */

export type GlobalIndex =
  | 'version'
  | 'account_emails'
  | 'settings_seen'
  | 'hide_pass_phrases'
  | 'dev_outlook_allow'
  | 'install_mobile_app_notification_dismissed'
  | 'key_info_store_fingerprints_added'
  | 'contact_store_x509_fingerprints_and_longids_updated'
  | 'contact_store_opgp_revoked_flags_updated'
  | 'contact_store_searchable_pruned'
  | 'local_drafts';

/**
 * Locally stored data that is not associated with any email account
 */
export class GlobalStore extends AbstractStore {
  private static globalStorageScope = 'global' as const;

  public static async set(values: GlobalStoreDict): Promise<void> {
    const storageUpdate: RawStore = {};
    for (const key of Object.keys(values)) {
      const index = GlobalStore.singleScopeRawIndex(GlobalStore.globalStorageScope, key);
      storageUpdate[index] = values[key as GlobalIndex];
    }
    await storageLocalSet(storageUpdate);
  }

  public static async get(keys: GlobalIndex[]): Promise<GlobalStoreDict> {
    const storageObj = (await storageLocalGet(GlobalStore.singleScopeRawIndexArr(GlobalStore.globalStorageScope, keys))) as RawStore;
    return GlobalStore.buildSingleAccountStoreFromRawResults(GlobalStore.globalStorageScope, storageObj) as GlobalStore;
  }

  public static async remove(keys: string[]) {
    await storageLocalRemove(GlobalStore.singleScopeRawIndexArr(GlobalStore.globalStorageScope, keys));
  }

  public static async acctEmailsGet(): Promise<string[]> {
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

  public static async acctEmailsAdd(acctEmail: string): Promise<void> {
    // todo: concurrency issues with another tab loaded at the same time
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
      await GlobalStore.set({
        account_emails: JSON.stringify(acctEmails), // eslint-disable-line @typescript-eslint/naming-convention
      });
      BrowserMsg.send.bg.updateUninstallUrl();
    }
  }

  public static async acctEmailsRemove(acctEmail: string): Promise<void> {
    // todo: concurrency issues with another tab loaded at the same time
    const acctEmails = await GlobalStore.acctEmailsGet();
    await GlobalStore.set({ account_emails: JSON.stringify(Value.arr.withoutVal(acctEmails, acctEmail)) }); // eslint-disable-line @typescript-eslint/naming-convention
    BrowserMsg.send.bg.updateUninstallUrl();
  }
}
