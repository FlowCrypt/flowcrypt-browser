/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Value, Str, Dict } from '../core/common.js';
import { mnemonic } from '../core/mnemonic.js';
import { Pgp, KeyInfo, KeyInfosWithPassphrases, Contact } from '../core/pgp.js';
import { SubscriptionInfo, R } from '../api/api.js';
import { BrowserMsg, BgNotReadyError } from '../extension.js';
import { Product, PaymentMethod, ProductLevel } from '../account.js';
import { Env, Ui } from '../browser.js';
import { Catch, UnreportableError } from './catch.js';
import { storageLocalSet, storageLocalGet, storageLocalRemove } from '../api/chrome.js';

type SerializableTypes = FlatTypes | string[] | number[] | boolean[] | SubscriptionInfo;
type StoredAuthInfo = { acctEmail: string | null, uuid: string | null };
type StoredReplyDraftMeta = string; // draftId
type StoredComposeDraftMeta = { recipients: string[], subject: string, date: number };
type StoredAdminCode = { date: number, codes: string[] };
export type EmailProvider = 'gmail';

export type KeyBackupMethod = 'file' | 'inbox' | 'none' | 'print';
export type DbContactFilter = { has_pgp?: boolean, substring?: string, limit?: number };
export type StorageType = 'session' | 'local';
export type FlatTypes = null | undefined | number | string | boolean;
export type ContactUpdate = {
  email?: string; name?: string | null; pubkey?: string; has_pgp?: 0 | 1; searchable?: string[];
  client?: string | null; fingerprint?: string | null; longid?: string | null; keywords?: string | null;
  pending_lookup?: number; last_use?: number | null;
  date?: number | null; /* todo - should be removed. email provider search seems to return this? */
};
export type Storable = FlatTypes | string[] | KeyInfo[] | Dict<StoredReplyDraftMeta> | Dict<StoredComposeDraftMeta> | Dict<StoredAdminCode>
  | SubscriptionAttempt | SubscriptionInfo | R.OpenId;
export type Serializable = SerializableTypes | SerializableTypes[] | Dict<SerializableTypes> | Dict<SerializableTypes>[];

export interface RawStore {
  [key: string]: Storable;
}

export interface SubscriptionAttempt extends Product {
  source: string | undefined;
}

export type GlobalStore = {
  version?: number | null;
  account_emails?: string; // stringified array
  errors?: string[];
  settings_seen?: boolean;
  hide_pass_phrases?: boolean;
  cryptup_account_email?: string | null;
  cryptup_account_uuid?: string | null;
  cryptup_account_subscription?: SubscriptionInfo | null;
  dev_outlook_allow?: boolean;
  cryptup_subscription_attempt?: SubscriptionAttempt;
  admin_codes?: Dict<StoredAdminCode>;
};

export type GlobalIndex = 'version' | 'account_emails' | 'errors' | 'settings_seen' | 'hide_pass_phrases' |
  'cryptup_account_email' | 'cryptup_account_uuid' | 'cryptup_account_subscription' | 'dev_outlook_allow' |
  'cryptup_subscription_attempt' | 'admin_codes';

export type AccountStore = {
  keys?: KeyInfo[];
  notification_setup_needed_dismissed?: boolean;
  email_provider?: EmailProvider;
  google_token_access?: string;
  google_token_expires?: number;
  google_token_scopes?: string[]; // these are actuall scope urls the way the provider expects them
  google_token_refresh?: string;
  hide_message_password?: boolean; // is global?
  addresses?: string[];
  addresses_keyserver?: string[];
  email_footer?: string | null;
  drafts_reply?: Dict<StoredReplyDraftMeta>;
  drafts_compose?: Dict<StoredComposeDraftMeta>;
  pubkey_sent_to?: string[];
  full_name?: string;
  cryptup_enabled?: boolean;
  setup_done?: boolean;
  setup_simple?: boolean;
  is_newly_created_key?: boolean;
  key_backup_method?: KeyBackupMethod;
  key_backup_prompt?: number | false;
  successfully_received_at_leat_one_message?: boolean;
  notification_setup_done_seen?: boolean;
  picture?: string; // google image
  outgoing_language?: 'EN' | 'DE';
  setup_date?: number;
  openid?: R.OpenId;
  // temporary
  tmp_submit_main?: boolean;
  tmp_submit_all?: boolean;
};

export type AccountIndex = 'keys' | 'notification_setup_needed_dismissed' | 'email_provider' | 'google_token_access' | 'google_token_expires' | 'google_token_scopes' |
  'google_token_refresh' | 'hide_message_password' | 'addresses' | 'addresses_keyserver' | 'email_footer' | 'drafts_reply' | 'drafts_compose' |
  'pubkey_sent_to' | 'full_name' | 'cryptup_enabled' | 'setup_done' | 'setup_simple' | 'is_newly_created_key' | 'key_backup_method' |
  'key_backup_prompt' | 'successfully_received_at_leat_one_message' | 'notification_setup_done_seen' | 'picture' |
  'outgoing_language' | 'setup_date' | 'openid' | 'tmp_submit_main' | 'tmp_submit_all';

export class Subscription implements SubscriptionInfo {
  active?: boolean;
  method?: PaymentMethod;
  level?: ProductLevel;
  expire?: string;
  expired?: boolean;

  constructor(storedSubscriptionInfo: SubscriptionInfo | undefined) {
    if (storedSubscriptionInfo) {
      this.active = storedSubscriptionInfo.active || undefined;
      this.method = storedSubscriptionInfo.method || undefined;
      this.level = storedSubscriptionInfo.level;
      this.expire = storedSubscriptionInfo.expire || undefined;
      this.expired = storedSubscriptionInfo.expired || undefined;
    }
  }

  static updateSubscriptionGlobalStore = (gs: GlobalStore, stored: SubscriptionInfo, newest: SubscriptionInfo | null) => {
    if (newest) {
      if (newest.level !== stored.level || newest.method !== stored.method || newest.expire !== stored.expire || newest.active !== stored.active) {
        gs.cryptup_account_subscription = newest;
      }
    } else {
      if (stored.level || stored.expire || stored.active || stored.method) {
        gs.cryptup_account_subscription = undefined;
      }
    }
  }

}

export class StoreCorruptedError extends Error { }

export class StoreDeniedError extends Error { }

export class StoreFailedError extends Error { }

export class Store {

  // static [f: string]: Function; // https://github.com/Microsoft/TypeScript/issues/6480

  private static globalStorageScope: 'global' = 'global';
  private static dbQueryKeys = ['limit', 'substring', 'has_pgp'];

  static singleScopeRawIndex = (scope: string, key: string) => `cryptup_${scope.replace(/[^A-Za-z0-9]+/g, '').toLowerCase()}_${key}`;

  private static singleScopeRawIndexArr = (scope: string, keys: string[]) => keys.map(key => Store.singleScopeRawIndex(scope, key));

  private static manyScopesRawIndexArr = (scopes: string[], keys: string[]) => {
    const allResults: string[] = [];
    for (const scope of scopes) {
      allResults.push(...Store.singleScopeRawIndexArr(scope, keys));
    }
    return allResults;
  }

  private static buildSingleAccountStoreFromRawResults = (scope: string, storageObj: RawStore): AccountStore => {
    const accountStore: AccountStore = {};
    for (const k of Object.keys(storageObj)) {
      const fixedKey = k.replace(Store.singleScopeRawIndex(scope, ''), '');
      if (fixedKey !== k) { // the scope matches and was thus removed from the raw index
        accountStore[fixedKey as AccountIndex] = storageObj[k] as any;
      }
    }
    return accountStore;
  }

  static sessionGet = async (acctEmail: string, key: string): Promise<string | null> => {
    if (!Env.isBackgroundPage()) {
      // session in background page is separated from content script frames
      // must always go through background page to be consistent
      return await BrowserMsg.send.bg.await.storeSessionGet({ acctEmail, key });
    }
    return window.sessionStorage.getItem(Store.singleScopeRawIndex(acctEmail, key));
  }

  static sessionSet = async (acctEmail: string, key: string, value: string | undefined): Promise<void> => {
    if (!Env.isBackgroundPage()) {
      // session in background page is separated from content script frames
      // must always go through background page to be consistent
      return await BrowserMsg.send.bg.await.storeSessionSet({ acctEmail, key, value });
    }
    if (typeof value !== 'undefined') {
      sessionStorage.setItem(Store.singleScopeRawIndex(acctEmail, key), String(value));
    } else {
      sessionStorage.removeItem(Store.singleScopeRawIndex(acctEmail, key));
    }
  }

  static passphraseSave = async (storageType: StorageType, acctEmail: string, longid: string, passphrase: string | undefined) => {
    const storageKey: AccountIndex = `passphrase_${longid}` as AccountIndex;
    if (storageType === 'session') {
      await Store.sessionSet(acctEmail, storageKey, passphrase);
    } else {
      if (typeof passphrase === 'undefined') {
        await Store.remove(acctEmail, [storageKey]);
      } else {
        const toSave: AccountStore = {};
        toSave[storageKey] = passphrase;
        await Store.setAcct(acctEmail, toSave);
      }
    }
  }

  static passphraseGet = async (acctEmail: string, longid: string, ignoreSession: boolean = false): Promise<string | undefined> => {
    const storageKey = `passphrase_${longid}` as AccountIndex;
    const storage = await Store.getAcct(acctEmail, [storageKey as AccountIndex]);
    const found = storage[storageKey];
    if (typeof found === 'string') {
      return found;
    }
    const fromSession = await Store.sessionGet(acctEmail, storageKey);
    return fromSession && !ignoreSession ? fromSession : undefined;
  }

  static waitUntilPassphraseChanged = async (acctEmail: string, missingOrWrongPpKeyLongids: string[], interval = 1000) => {
    const missingOrWrongPassprases: Dict<string | undefined> = {};
    const passphrases = await Promise.all(missingOrWrongPpKeyLongids.map(longid => Store.passphraseGet(acctEmail, longid)));
    for (const i of missingOrWrongPpKeyLongids.keys()) {
      missingOrWrongPassprases[missingOrWrongPpKeyLongids[i]] = passphrases[i];
    }
    while (true) {
      await Ui.time.sleep(interval);
      const longidsMissingPp = Object.keys(missingOrWrongPassprases);
      const updatedPpArr = await Promise.all(longidsMissingPp.map(longid => Store.passphraseGet(acctEmail, longid)));
      for (let i = 0; i < longidsMissingPp.length; i++) {
        const missingOrWrongPp = missingOrWrongPassprases[longidsMissingPp[i]];
        const updatedPp = updatedPpArr[i];
        if (updatedPp !== missingOrWrongPp) {
          return;
        }
      }
    }
  }

  static keysGet = async (acctEmail: string, longids?: string[]) => {
    const stored = await Store.getAcct(acctEmail, ['keys']);
    const keys: KeyInfo[] = stored.keys || [];
    if (!longids) {
      return keys;
    }
    return keys.filter(ki => Value.is(ki.longid).in(longids) || (Value.is('primary').in(longids) && ki.primary));
  }

  static keysGetAllWithPassphrases = async (acctEmail: string): Promise<KeyInfosWithPassphrases> => {
    const keys = await Store.keysGet(acctEmail);
    const passphrases = (await Promise.all(keys.map(ki => Store.passphraseGet(acctEmail, ki.longid)))).filter(pp => typeof pp !== 'undefined') as string[];
    return { keys, passphrases };
  }

  private static keysObj = async (armoredPrv: string, primary = false): Promise<KeyInfo> => {
    const longid = await Pgp.key.longid(armoredPrv)!;
    if (!longid) {
      throw new Error('Store.keysObj: unexpectedly no longid');
    }
    const prv = await Pgp.key.read(armoredPrv);
    const fingerprint = await Pgp.key.fingerprint(armoredPrv);
    return { private: armoredPrv, public: prv.toPublic().armor(), primary, longid, fingerprint: fingerprint!, keywords: mnemonic(longid)! };
  }

  static keysAdd = async (acctEmail: string, newKeyArmored: string) => { // todo: refactor setup.js -> backup.js flow so that keys are never saved naked, then re-enable naked key check
    const keyinfos = await Store.keysGet(acctEmail);
    let updated = false;
    const newKeyLongid = await Pgp.key.longid(newKeyArmored);
    if (newKeyLongid) {
      for (const i in keyinfos) {
        if (newKeyLongid === keyinfos[i].longid) { // replacing a key
          keyinfos[i] = await Store.keysObj(newKeyArmored, keyinfos[i].primary);
          updated = true;
        }
      }
      if (!updated) {
        keyinfos.push(await Store.keysObj(newKeyArmored, keyinfos.length === 0));
      }
      await Store.setAcct(acctEmail, { keys: keyinfos });
    }
  }

  static keysRemove = async (acctEmail: string, removeLongid: string): Promise<void> => {
    const privateKeys = await Store.keysGet(acctEmail);
    const filteredPrivateKeys = privateKeys.filter(ki => ki.longid !== removeLongid);
    await Store.setAcct(acctEmail, { keys: filteredPrivateKeys });
  }

  static setAcct = async (acctEmail: string, values: AccountStore): Promise<void> => {
    if (Env.isContentScript()) {
      // extension storage can be disallowed in rare cases for content scripts throwing 'Error: Access to extension API denied.'
      // always go through bg script to avoid such errors
      return await BrowserMsg.send.bg.await.storeAcctSet({ acctEmail, values });
    }
    const storageUpdate: RawStore = {};
    for (const key of Object.keys(values)) {
      const index = Store.singleScopeRawIndex(acctEmail, key);
      storageUpdate[index] = values[key as AccountIndex];
    }
    await storageLocalSet(storageUpdate);
  }

  static setGlobal = async (values: GlobalStore): Promise<void> => {
    if (Env.isContentScript()) {
      // extension storage can be disallowed in rare cases for content scripts throwing 'Error: Access to extension API denied.'
      // always go through bg script to avoid such errors
      return await BrowserMsg.send.bg.await.storeGlobalSet({ values });
    }
    const storageUpdate: RawStore = {};
    for (const key of Object.keys(values)) {
      const index = Store.singleScopeRawIndex(Store.globalStorageScope, key);
      storageUpdate[index] = values[key as GlobalIndex];
    }
    await storageLocalSet(storageUpdate);
  }

  static getGlobal = async (keys: GlobalIndex[]): Promise<GlobalStore> => {
    if (Env.isContentScript()) {
      // extension storage can be disallowed in rare cases for content scripts throwing 'Error: Access to extension API denied.'
      // always go through bg script to avoid such errors
      return await BrowserMsg.send.bg.await.storeGlobalGet({ keys });
    }
    const storageObj = await storageLocalGet(Store.singleScopeRawIndexArr(Store.globalStorageScope, keys)) as RawStore;
    return Store.buildSingleAccountStoreFromRawResults(Store.globalStorageScope, storageObj) as GlobalStore;
  }

  static saveError = (err: any, errMsg?: string) => {
    Store.getGlobal(['errors']).then(s => {
      if (typeof s.errors === 'undefined') {
        s.errors = [];
      }
      if (err instanceof Error) {
        s.errors.unshift(err.stack || errMsg || String(err));
      } else {
        s.errors.unshift(errMsg || String(err));
      }
      Store.setGlobal(s).catch(console.error);
    }).catch(console.error);
  }

  static getAcct = async (acctEmail: string, keys: AccountIndex[]): Promise<AccountStore> => {
    if (Env.isContentScript()) {
      // extension storage can be disallowed in rare cases for content scripts throwing 'Error: Access to extension API denied.'
      // go through bg script to avoid such errors
      for (let i = 0; i < 10; i++) { // however backend may not be immediately ready to respond - retry
        try {
          return await BrowserMsg.send.bg.await.storeAcctGet({ acctEmail, keys });
        } catch (e) {
          if (!(e instanceof BgNotReadyError) || i === 9) {
            throw e;
          }
          await Ui.time.sleep(300);
        }
      }
      throw new BgNotReadyError('this should never happen');
    }
    const storageObj = await storageLocalGet(Store.singleScopeRawIndexArr(acctEmail, keys)) as RawStore;
    return Store.buildSingleAccountStoreFromRawResults(acctEmail, storageObj) as AccountStore;
  }

  static getAccounts = async (acctEmails: string[], keys: string[]): Promise<Dict<AccountStore>> => {
    const storageObj = await storageLocalGet(Store.manyScopesRawIndexArr(acctEmails, keys)) as RawStore;
    const resultsByAcct: Dict<AccountStore> = {};
    for (const account of acctEmails) {
      resultsByAcct[account] = Store.buildSingleAccountStoreFromRawResults(account, storageObj);
    }
    return resultsByAcct;
  }

  static remove = async (acctEmail: string, keys: string[]) => {
    await storageLocalRemove(Store.singleScopeRawIndexArr(acctEmail, keys));
  }

  static removeGlobal = async (keys: string[]) => {
    await storageLocalRemove(Store.singleScopeRawIndexArr(Store.globalStorageScope, keys));
  }

  static acctEmailsGet = async (): Promise<string[]> => {
    const storage = await Store.getGlobal(['account_emails']);
    const acctEmails: string[] = [];
    if (typeof storage.account_emails !== 'undefined') {
      for (const acctEmail of JSON.parse(storage.account_emails) as string[]) {
        if (!Value.is(acctEmail.toLowerCase()).in(acctEmails)) {
          acctEmails.push(acctEmail.toLowerCase());
        }
      }
    }
    return acctEmails;
  }

  static acctEmailsAdd = async (acctEmail: string): Promise<void> => { // todo: concurrency issues with another tab loaded at the same time
    if (!acctEmail) {
      throw new Error(`attempting to save empty acctEmail: ${acctEmail}`);
    }
    if (acctEmail.match(/[A-Z]/)) {
      Catch.report(`attempting to save acctEmail that wasn't lowercased: ${acctEmail}`);
      acctEmail = acctEmail.toLowerCase();
    }
    const acctEmails = await Store.acctEmailsGet();
    if (!Value.is(acctEmail).in(acctEmails) && acctEmail) {
      acctEmails.push(acctEmail);
      await Store.setGlobal({ account_emails: JSON.stringify(acctEmails) });
      BrowserMsg.send.bg.updateUninstallUrl();
    }
  }

  static acctEmailsRemove = async (acctEmail: string): Promise<void> => { // todo: concurrency issues with another tab loaded at the same time
    const acctEmails = await Store.acctEmailsGet();
    await Store.setGlobal({ account_emails: JSON.stringify(Value.arr.withoutVal(acctEmails, acctEmail)) });
    BrowserMsg.send.bg.updateUninstallUrl();
  }

  static authInfo = async (): Promise<StoredAuthInfo> => {
    const storage = await Store.getGlobal(['cryptup_account_email', 'cryptup_account_uuid']);
    return { acctEmail: storage.cryptup_account_email || null, uuid: storage.cryptup_account_uuid || null }; // tslint:disable-line:no-null-keyword
  }

  static subscription = async (): Promise<Subscription> => {
    const s = await Store.getGlobal(['cryptup_account_email', 'cryptup_account_uuid', 'cryptup_account_subscription']);
    if (s.cryptup_account_email && s.cryptup_account_uuid && s.cryptup_account_subscription && s.cryptup_account_subscription.level) {
      return new Subscription(s.cryptup_account_subscription || undefined);
    } else {
      return new Subscription(undefined);
    }
  }

  /* db */

  private static normalizeString = (str: string) => {
    return str.normalize('NFKD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
  }

  public static errCategorize = (err: any): Error => {
    let message: string;
    if (err instanceof Error) {
      message = err.message;
    } else if (err instanceof DOMException) { // db errors
      message = err.message;
    } else if (err && typeof err === 'object' && typeof (err as { message: string }).message === 'string') { // chrome.runtime.lastError
      message = (err as { message: string }).message;
    } else {
      message = String(err);
    }
    if (/Internal error opening backing store for indexedDB.open/.test(message)) {
      return new StoreCorruptedError(`db: ${message}`);
    } else if (/A mutation operation was attempted on a database that did not allow mutations/.test(message)) {
      return new StoreDeniedError(`db: ${message}`);
    } else if (/The operation failed for reasons unrelated to the database itself and not covered by any other error code/.test(message)) {
      return new StoreFailedError(`db: ${message}`);
    } else if (/IO error: .+: Unable to create sequential file/.test(message)) {
      return new StoreCorruptedError(`storage.local: ${message}`);
    } else if (/IO error: .+LOCK: No further details/.test(message)) {
      return new StoreFailedError(`storage.local: ${message}`);
    } else if (/The browser is shutting down/.test(message)) {
      return new UnreportableError(message);
    } else {
      Catch.reportErr(err instanceof Error ? err : new Error(message));
      return new StoreFailedError(message);
    }
  }

  static dbOpen = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      let openDbReq: IDBOpenDBRequest;
      openDbReq = indexedDB.open('cryptup', 2);
      openDbReq.onupgradeneeded = (event) => {
        let contacts: IDBObjectStore;
        if (event.oldVersion < 1) {
          contacts = openDbReq.result.createObjectStore('contacts', { keyPath: 'email', }); // tslint:disable-line:no-unsafe-any
          contacts.createIndex('search', 'searchable', { multiEntry: true, });
          contacts.createIndex('index_has_pgp', 'has_pgp');
          contacts.createIndex('index_pending_lookup', 'pending_lookup');
        }
        if (event.oldVersion < 2) {
          contacts = openDbReq.transaction!.objectStore('contacts'); // todo - added ! after ts3 upgrade - investigate
          contacts.createIndex('index_longid', 'longid');
        }
      };
      openDbReq.onsuccess = () => resolve(openDbReq.result as IDBDatabase);
      openDbReq.onblocked = () => reject(Store.errCategorize(openDbReq.error));
      openDbReq.onerror = () => reject(Store.errCategorize(openDbReq.error));
    });
  }

  private static dbIndex = (hasPgp: boolean, substring: string) => {
    if (!substring) {
      throw new Error('db_index has to include substring');
    }
    return (hasPgp ? 't:' : 'f:') + substring;
  }

  private static dbCreateSearchIndexList = (email: string, name: string | null, hasPgp: boolean) => {
    email = email.toLowerCase();
    name = name ? name.toLowerCase() : '';
    const parts = [email, name];
    parts.push(...email.split(/[^a-z0-9]/));
    parts.push(...name.split(/[^a-z0-9]/));
    const index: string[] = [];
    for (const part of parts) {
      if (part) {
        let substring = '';
        for (const letter of part.split('')) {
          substring += letter;
          const normalized = Store.normalizeString(substring);
          if (!Value.is(normalized).in(index)) {
            index.push(Store.dbIndex(hasPgp, normalized));
          }
        }
      }
    }
    return index;
  }

  static dbContactObj = async (email: string, name?: string, client?: string, pubkey?: string, pendingLookup?: boolean | number, lastUse?: number): Promise<Contact> => {
    const fingerprint = pubkey ? await Pgp.key.fingerprint(pubkey) : undefined;
    email = Str.parseEmail(email).email;
    if (!Str.isEmailValid(email)) {
      throw new Error(`Cannot save contact because email is not valid: ${email}`);
    }
    return {
      email,
      name: name || null, // tslint:disable-line:no-null-keyword
      pubkey: pubkey || null, // tslint:disable-line:no-null-keyword
      has_pgp: pubkey ? 1 : 0, // number because we use it for sorting
      searchable: Store.dbCreateSearchIndexList(email, name || null, Boolean(pubkey)), // tslint:disable-line:no-null-keyword
      client: pubkey ? (client || null) : null, // tslint:disable-line:no-null-keyword
      fingerprint: fingerprint || null, // tslint:disable-line:no-null-keyword
      longid: fingerprint ? (await Pgp.key.longid(fingerprint) || null) : null, // tslint:disable-line:no-null-keyword
      keywords: fingerprint ? mnemonic(await Pgp.key.longid(fingerprint) || '') || null : null, // tslint:disable-line:no-null-keyword
      pending_lookup: pubkey ? 0 : (pendingLookup ? 1 : 0),
      last_use: lastUse || null, // tslint:disable-line:no-null-keyword
      date: null, // tslint:disable-line:no-null-keyword
    };
  }

  static dbContactSave = (db: IDBDatabase | undefined, contact: Contact | Contact[]): Promise<void> => new Promise(async (resolve, reject) => {
    if (!db) { // relay op through background process
      // todo - currently will silently swallow errors
      BrowserMsg.send.bg.await.db({ f: 'dbContactSave', args: [contact] }).then(resolve).catch(Catch.reportErr);
    } else {
      if (Array.isArray(contact)) {
        for (const singleContact of contact) {
          await Store.dbContactSave(db, singleContact);
        }
        resolve();
      } else {
        const tx = db.transaction('contacts', 'readwrite');
        const contactsTable = tx.objectStore('contacts');
        contactsTable.put(contact);
        tx.oncomplete = () => resolve();
        tx.onabort = () => reject(Store.errCategorize(tx.error));
      }
    }
  })

  static dbContactUpdate = (db: IDBDatabase | undefined, email: string | string[], update: ContactUpdate): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      if (!db) { // relay op through background process
        // todo - currently will silently swallow errors
        BrowserMsg.send.bg.await.db({ f: 'dbContactUpdate', args: [email, update] }).then(resolve).catch(Catch.reportErr);
      } else {
        if (Array.isArray(email)) {
          for (const singleEmail of email) {
            await Store.dbContactUpdate(db, singleEmail, update);
          }
          resolve();
        } else {
          let [contact] = await Store.dbContactGet(db, [email]);
          if (!contact) { // updating a non-existing contact, insert it first
            await Store.dbContactSave(db, await Store.dbContactObj(email, undefined, undefined, undefined, false, undefined));
            [contact] = await Store.dbContactGet(db, [email]);
            if (!contact) {
              reject(new Error('contact not found right after inserting it'));
              return;
            }
          }
          for (const k of Object.keys(update)) {
            // @ts-ignore - may be saving any of the provided values - could do this one by one while ensuring proper types
            contact[k] = update[k];
          }
          const tx = db.transaction('contacts', 'readwrite');
          const contactsTable = tx.objectStore('contacts');
          contactsTable.put(await Store.dbContactObj(
            email,
            contact.name || undefined,
            contact.client || undefined,
            contact.pubkey || undefined,
            contact.pending_lookup,
            contact.last_use || undefined
          ));
          tx.oncomplete = Catch.try(resolve);
          tx.onabort = () => reject(Store.errCategorize(tx.error));
        }
      }
    });
  }

  static dbContactGet = (db: undefined | IDBDatabase, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    return new Promise(async (resolve, reject) => {
      if (!db) { // relay op through background process
        // todo - currently will silently swallow errors
        BrowserMsg.send.bg.await.db({ f: 'dbContactGet', args: [emailOrLongid] }).then(resolve).catch(Catch.reportErr);
      } else {
        if (emailOrLongid.length === 1) {
          let tx: IDBRequest;
          if (!(/^[A-F0-9]{16}$/g).test(emailOrLongid[0])) { // email
            tx = db.transaction('contacts', 'readonly').objectStore('contacts').get(emailOrLongid[0]);
          } else { // longid
            tx = db.transaction('contacts', 'readonly').objectStore('contacts').index('index_longid').get(emailOrLongid[0]);
          }
          tx.onsuccess = Catch.try(() => resolve([tx.result !== undefined ? tx.result : undefined])); // tslint:disable-line:no-unsafe-any
          tx.onerror = () => reject(Store.errCategorize(tx.error!)); // todo - added ! after ts3 upgrade - investigate
        } else {
          const results: (Contact | undefined)[] = [];
          for (const singleEmailOrLongid of emailOrLongid) {
            const [contact] = await Store.dbContactGet(db, [singleEmailOrLongid]);
            results.push(contact);
          }
          resolve(results);
        }
      }
    });
  }

  static dbContactSearch = (db: IDBDatabase | undefined, query: DbContactFilter): Promise<Contact[]> => {
    return new Promise(async (resolve, reject) => {
      if (!db) { // relay op through background process
        // todo - currently will silently swallow errors
        BrowserMsg.send.bg.await.db({ f: 'dbContactSearch', args: [query] }).then(resolve).catch(Catch.reportErr);
      } else {
        for (const key of Object.keys(query)) {
          if (!Value.is(key).in(Store.dbQueryKeys)) {
            throw new Error('dbContactSearch: unknown key: ' + key);
          }
        }
        const contacts = db.transaction('contacts', 'readonly').objectStore('contacts');
        let search: IDBRequest | undefined;
        if (typeof query.has_pgp === 'undefined') { // any query.has_pgp value
          query.substring = Store.normalizeString(query.substring || '');
          if (query.substring) {
            const resultsWithPgp = await Store.dbContactSearch(db, { substring: query.substring, limit: query.limit, has_pgp: true });
            if (query.limit && resultsWithPgp.length === query.limit) {
              resolve(resultsWithPgp);
            } else {
              const resultsWithoutPgp = await Store.dbContactSearch(db, { substring: query.substring, limit: query.limit ? query.limit - resultsWithPgp.length : undefined, has_pgp: false });
              resolve(resultsWithPgp.concat(resultsWithoutPgp));
            }
          } else {
            search = contacts.openCursor();
          }
        } else { // specific query.has_pgp value
          if (query.substring) {
            search = contacts.index('search').openCursor(IDBKeyRange.only(Store.dbIndex(query.has_pgp, query.substring)));
          } else {
            search = contacts.index('index_has_pgp').openCursor(IDBKeyRange.only(Number(query.has_pgp)));
          }
        }
        if (typeof search !== 'undefined') {
          const found: Contact[] = [];
          search.onsuccess = Catch.try(() => {
            const cursor = search!.result; // checked it above
            if (!cursor || found.length === query.limit) {
              resolve(found);
            } else {
              found.push(cursor.value); // tslint:disable-line:no-unsafe-any
              cursor.continue(); // tslint:disable-line:no-unsafe-any
            }
          });
          search.onerror = () => reject(Store.errCategorize(search!.error!)); // todo - added ! after ts3 upgrade - investigate
        }
      }
    });
  }

}
