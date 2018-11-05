/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Value, Str, Dict, EmailProvider } from './common.js';
import { mnemonic } from './mnemonic.js';
import { Pgp } from './pgp.js';
import { SubscriptionInfo } from './api.js';
import { BrowserMsg } from './extension.js';
import { Product, PaymentMethod, ProductLevel } from './account.js';
import { Env } from './browser.js';
import { Catch } from './catch.js';

type SerializableTypes = FlatTypes | string[] | number[] | boolean[] | SubscriptionInfo;
type StoredAuthInfo = { acctEmail: string | null, uuid: string | null };
type StoredReplyDraftMeta = string; // draft_id
type StoredComposeDraftMeta = { recipients: string[], subject: string, date: number };
type StoredAdminCode = { date: number, codes: string[] };
type StoredAttestLog = { attempt: number, packet?: string, success: boolean, result: string };

export type KeyBackupMethod = 'file' | 'inbox' | 'none' | 'print';
export type DbContactFilter = { has_pgp?: boolean, substring?: string, limit?: number };
export type Contact = {
  email: string; name: string | null; pubkey: string | null; has_pgp: 0 | 1; searchable: string[];
  client: string | null; attested: boolean | null; fingerprint: string | null; longid: string | null; keywords: string | null;
  pending_lookup: number; last_use: number | null;
  date: number | null; /* todo - should be removed. email provider search seems to return this? */
};
export type KeyInfo = {
  public: string; private: string; fingerprint: string; longid: string; primary: boolean;
  decrypted?: OpenPGP.key.Key; keywords: string;
};
export type StorageType = 'session' | 'local';
export type FlatTypes = null | undefined | number | string | boolean;
export type ContactUpdate = {
  email?: string; name?: string | null; pubkey?: string; has_pgp?: 0 | 1; searchable?: string[];
  client?: string | null; attested?: boolean | null; fingerprint?: string | null; longid?: string | null; keywords?: string | null;
  pending_lookup?: number; last_use?: number | null;
  date?: number | null; /* todo - should be removed. email provider search seems to return this? */
};
export type Storable = FlatTypes | string[] | KeyInfo[] | Dict<StoredReplyDraftMeta> | Dict<StoredComposeDraftMeta> | Dict<StoredAdminCode>
  | SubscriptionAttempt | SubscriptionInfo | StoredAttestLog[];
export type Serializable = SerializableTypes | SerializableTypes[] | Dict<SerializableTypes> | Dict<SerializableTypes>[];

interface RawStore {
  [key: string]: Storable;
}

export interface SubscriptionAttempt extends Product {
  source: string | null;
}

export interface BaseStore extends RawStore {
}

export interface GlobalStore extends BaseStore {
  version?: number | null;
  account_emails?: string; // stringified array
  errors?: string[];
  settings_seen?: boolean;
  hidePassphrases?: boolean;
  cryptup_account_email?: string | null;
  cryptup_account_uuid?: string | null;
  cryptup_account_subscription?: SubscriptionInfo | null;
  dev_outlook_allow?: boolean;
  cryptup_subscription_attempt?: SubscriptionAttempt;
  admin_codes?: Dict<StoredAdminCode>;
  // following are not used anymore but may still be present in storage:
  // cryptup_account_verified?: boolean;
}

export interface AccountStore extends BaseStore {
  keys?: KeyInfo[];
  notification_setup_needed_dismissed?: boolean;
  email_provider?: EmailProvider;
  google_token_access?: string;
  google_token_expires?: number;
  google_token_scopes?: string[];
  google_token_refresh?: string;
  hide_message_password?: boolean; // is global?
  addresses?: string[];
  addresses_pks?: string[];
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
  attests_requested?: string[]; // attester names
  attests_processed?: string[]; // attester names
  key_backup_prompt?: number | false;
  successfully_received_at_leat_one_message?: boolean;
  notification_setup_done_seen?: boolean;
  attest_log?: StoredAttestLog[];
  picture?: string; // google image
  outgoing_language?: 'EN' | 'DE';
  // temporary
  tmp_submit_main?: boolean;
  tmp_submit_all?: boolean;
}

export class Subscription implements SubscriptionInfo {
  active: boolean | null = null;
  method: PaymentMethod | null = null;
  level: ProductLevel | null = null;
  expire: string | null = null;

  constructor(storedSubscription: { active: boolean | null, method: PaymentMethod | null, level: ProductLevel, expire?: string | null } | null) {
    if (storedSubscription) {
      this.active = storedSubscription.active;
      this.method = storedSubscription.method;
      this.level = storedSubscription.level;
      this.expire = storedSubscription.expire || null;
    }
  }

  expired() {
    return this.level && this.expire && !this.active;
  }
}

export class StoreDbCorruptedError extends Error { }

export class StoreDbDeniedError extends Error { }

export class StoreDbFailedError extends Error { }

export class Store {

  // static [f: string]: Function; // https://github.com/Microsoft/TypeScript/issues/6480

  private static globalStorageScope = 'global';
  private static dbQueryKeys = ['limit', 'substring', 'has_pgp'];

  static index(acctkeyOrList: string | string[], key: string | string[]) {
    if (Array.isArray(acctkeyOrList)) {
      let allResults: string[] = [];
      for (const acctKey of acctkeyOrList) {
        allResults = allResults.concat(Store.index(acctKey, key));
      }
      return allResults;
    } else {
      const prefix = 'cryptup_' + acctkeyOrList.replace(/[^A-Za-z0-9]+/g, '').toLowerCase() + '_';
      if (Array.isArray(key)) {
        return key.map(k => prefix + k);
      } else {
        return prefix + key;
      }
    }
  }

  private static acctStorageObjKeysToOrig(acctOrAccts: string | string[], storageObj: RawStore): BaseStore | Dict<BaseStore> {
    if (typeof acctOrAccts === 'string') {
      const fixedKeysObj: BaseStore = {};
      for (const k of Object.keys(storageObj)) {
        const fixedKey = k.replace(Store.index(acctOrAccts as string, '') as string, ''); // checked it's a string above
        if (fixedKey !== k) {
          fixedKeysObj[fixedKey] = storageObj[k];
        }
      }
      return fixedKeysObj;
    } else {
      const resultsByAcct: Dict<BaseStore> = {};
      for (const account of acctOrAccts) {
        resultsByAcct[account] = Store.acctStorageObjKeysToOrig(account, storageObj) as BaseStore;
      }
      return resultsByAcct;
    }
  }

  static async sessionGet(acctEmail: string, key: string): Promise<string | null> {
    if (Env.isBackgroundPage()) {
      return window.sessionStorage.getItem(Store.index(acctEmail, key) as string);
    } else {
      return await BrowserMsg.sendAwait(null, 'session_get', { acctEmail, key });
    }
  }

  static async sessionSet(acctEmail: string, key: string, value: string | undefined): Promise<void> {
    if (Env.isBackgroundPage()) {
      if (typeof value !== 'undefined') {
        sessionStorage.setItem(Store.index(acctEmail, key) as string, String(value));
      } else {
        sessionStorage.removeItem(Store.index(acctEmail, key) as string);
      }
    } else {
      await BrowserMsg.sendAwait(null, 'session_set', { acctEmail, key, value });
    }
  }

  static async passphraseSave(storageType: StorageType, acctEmail: string, longid: string, passphrase: string | undefined) {
    const storageKey = 'passphrase_' + longid;
    if (storageType === 'session') {
      await Store.sessionSet(acctEmail, storageKey, passphrase);
    } else {
      if (typeof passphrase === 'undefined') {
        await Store.remove(acctEmail, [storageKey]);
      } else {
        const toSave: Dict<string> = {};
        toSave[storageKey] = passphrase;
        await Store.set(acctEmail, toSave);
      }
    }
  }

  static async passphraseGet(acctEmail: string, longid: string, ignoreSession: boolean = false): Promise<string | null> {
    const storageKey = 'passphrase_' + longid;
    const storage = await Store.getAcct(acctEmail, [storageKey]);
    if (typeof storage[storageKey] === 'string') {
      return storage[storageKey] as string; // checked above
    } else {
      const fromSession = await Store.sessionGet(acctEmail, storageKey);
      return fromSession && !ignoreSession ? fromSession : null;
    }
  }

  static async keysGet(acctEmail: string, longids: string[] | null = null) {
    const stored = await Store.getAcct(acctEmail, ['keys']);
    const keys: KeyInfo[] = stored.keys || [];
    if (!longids) {
      return keys;
    }
    return keys.filter(ki => Value.is(ki.longid).in(longids) || (Value.is('primary').in(longids) && ki.primary));
  }

  private static keysObj(armoredPrv: string, primary = false): KeyInfo {
    const longid = Pgp.key.longid(armoredPrv)!;
    if (!longid) {
      throw new Error('Store.keysObj: unexpectedly no longid');
    }
    return { // todo - should we not be checking longid!==null? or is it checked before calling this?
      private: armoredPrv,
      public: Pgp.key.read(armoredPrv).toPublic().armor(),
      primary,
      longid,
      fingerprint: Pgp.key.fingerprint(armoredPrv)!,
      keywords: mnemonic(longid)!,
    };
  }

  static async keysAdd(acctEmail: string, newKeyArmored: string) { // todo: refactor setup.js -> backup.js flow so that keys are never saved naked, then re-enable naked key check
    const keyinfos = await Store.keysGet(acctEmail);
    let updated = false;
    const newKeyLongid = Pgp.key.longid(newKeyArmored);
    if (newKeyLongid) {
      for (const i in keyinfos) {
        if (newKeyLongid === keyinfos[i].longid) { // replacing a key
          keyinfos[i] = Store.keysObj(newKeyArmored, keyinfos[i].primary);
          updated = true;
        }
      }
      if (!updated) {
        keyinfos.push(Store.keysObj(newKeyArmored, keyinfos.length === 0));
      }
      await Store.set(acctEmail, { keys: keyinfos });
    }
  }

  static async keysRemove(acctEmail: string, removeLongid: string): Promise<void> {
    const privateKeys = await Store.keysGet(acctEmail);
    const filteredPrivateKeys = privateKeys.filter(ki => ki.longid !== removeLongid);
    await Store.set(acctEmail, { keys: filteredPrivateKeys });
  }

  private static globalStorageIndexIfNull(account: string[] | string | null): string[] | string {
    return (account === null) ? Store.globalStorageScope : account;
  }

  static set(acctEmail: string | null, values: BaseStore): Promise<void> {
    const storageUpdate: Dict<any> = {};
    for (const key of Object.keys(values)) {
      storageUpdate[Store.index(Store.globalStorageIndexIfNull(acctEmail), key) as string] = values[key];
    }
    return new Promise(resolve => chrome.storage.local.set(storageUpdate, () => resolve()));
  }

  static getGlobal(keys: string[]): Promise<GlobalStore> {
    return new Promise(resolve => {
      chrome.storage.local.get(Store.index(Store.globalStorageScope, keys) as string[], (storageObj: RawStore) => {
        resolve(Store.acctStorageObjKeysToOrig(Store.globalStorageScope, storageObj) as GlobalStore);
      });
    });
  }

  static saveError(err: any, errMsg?: string) {
    Store.getGlobal(['errors']).then(s => {
      if (typeof s.errors === 'undefined') {
        s.errors = [];
      }
      if (err instanceof Error) {
        s.errors.unshift(err.stack || errMsg || String(err));
      } else {
        s.errors.unshift(errMsg || String(err));
      }
      Store.set(null, s).catch(console.error);
    }).catch(console.error);
  }

  static getAcct(acctEmail: string, keys: string[]): Promise<AccountStore> {
    return new Promise(resolve => {
      chrome.storage.local.get(Store.index(acctEmail, keys) as string[], (storageObj: RawStore) => {
        resolve(Store.acctStorageObjKeysToOrig(acctEmail, storageObj) as AccountStore);
      });
    });
  }

  static getAccounts(acctEmails: string[], keys: string[]): Promise<Dict<AccountStore>> {
    return new Promise(resolve => {
      chrome.storage.local.get(Store.index(acctEmails, keys) as string[], (storageObj: RawStore) => {
        resolve(Store.acctStorageObjKeysToOrig(acctEmails, storageObj) as Dict<AccountStore>);
      });
    });
  }

  static async remove(acctEmail: string | null, keys: string[]) {
    return new Promise(resolve => chrome.storage.local.remove(Store.index(Store.globalStorageIndexIfNull(acctEmail), keys), () => resolve()));
  }

  static async acctEmailsGet(): Promise<string[]> {
    const storage = await Store.getGlobal(['account_emails']);
    const acctEmails: string[] = [];
    if (typeof storage.account_emails !== 'undefined') {
      for (const acctEmail of JSON.parse(storage.account_emails)) {
        if (!Value.is(acctEmail.toLowerCase()).in(acctEmails)) {
          acctEmails.push(acctEmail.toLowerCase());
        }
      }
    }
    return acctEmails;
  }

  static async acctEmailsAdd(acctEmail: string): Promise<void> { // todo: concurrency issues with another tab loaded at the same time
    if (!acctEmail) {
      Catch.report('attempting to save empty acctEmail: ' + acctEmail);
    }
    const acctEmails = await Store.acctEmailsGet();
    if (!Value.is(acctEmail).in(acctEmails) && acctEmail) {
      acctEmails.push(acctEmail);
      await Store.set(null, { account_emails: JSON.stringify(acctEmails) });
      await BrowserMsg.sendAwait(null, 'update_uninstall_url');
    }
  }

  static async acctEmailsRemove(acctEmail: string): Promise<void> { // todo: concurrency issues with another tab loaded at the same time
    const acctEmails = await Store.acctEmailsGet();
    await Store.set(null, { account_emails: JSON.stringify(Value.arr.withoutVal(acctEmails, acctEmail)) });
    await BrowserMsg.sendAwait(null, 'update_uninstall_url');
  }

  static async authInfo(): Promise<StoredAuthInfo> {
    const storage = await Store.getGlobal(['cryptup_account_email', 'cryptup_account_uuid']);
    return { acctEmail: storage.cryptup_account_email || null, uuid: storage.cryptup_account_uuid || null };
  }

  static async subscription(): Promise<Subscription> {
    const s = await Store.getGlobal(['cryptup_account_email', 'cryptup_account_uuid', 'cryptup_account_subscription']);
    if (s.cryptup_account_email && s.cryptup_account_uuid && s.cryptup_account_subscription && s.cryptup_account_subscription.level) {
      return new Subscription(s.cryptup_account_subscription);
    } else {
      return new Subscription(null);
    }
  }

  /* db */

  private static normalizeString(str: string) {
    return str.normalize('NFKD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
  }

  private static dbErrCategorize(exception: Error, errStack: string): Error {
    exception.stack = errStack.replace(/^Error/, String(exception));
    if (exception.message === 'Internal error opening backing store for indexedDB.open.') {
      return new StoreDbCorruptedError(exception.message);
    } else if (exception.message === 'A mutation operation was attempted on a database that did not allow mutations.') {
      return new StoreDbDeniedError(exception.message);
    } else if (exception.message === 'The operation failed for reasons unrelated to the database itself and not covered by any other error code.') {
      return new StoreDbFailedError(exception.message);
    } else {
      Catch.handleException(exception);
      return new StoreDbDeniedError(exception.message);
    }
  }

  static dbOpen(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      let openDbReq: IDBOpenDBRequest;
      openDbReq = indexedDB.open('cryptup', 2);
      openDbReq.onupgradeneeded = (event) => {
        let contacts;
        if (event.oldVersion < 1) {
          contacts = openDbReq.result.createObjectStore('contacts', { keyPath: 'email', });
          contacts.createIndex('search', 'searchable', { multiEntry: true, });
          contacts.createIndex('index_has_pgp', 'has_pgp');
          contacts.createIndex('index_pending_lookup', 'pending_lookup');
        }
        if (event.oldVersion < 2) {
          contacts = openDbReq.transaction!.objectStore('contacts'); // todo - added ! after ts3 upgrade - investigate
          contacts.createIndex('index_longid', 'longid');
        }
      };
      openDbReq.onsuccess = () => resolve(openDbReq.result);
      const stackFill = String((new Error()).stack);
      openDbReq.onblocked = () => reject(Store.dbErrCategorize(openDbReq.error!, stackFill)); // todo - added ! after ts3 upgrade - investigate
      openDbReq.onerror = () => reject(Store.dbErrCategorize(openDbReq.error!, stackFill)); // todo - added ! after ts3 upgrade - investigate
    });
  }

  private static dbIndex(hasPgp: boolean, substring: string) {
    if (!substring) {
      throw new Error('db_index has to include substring');
    }
    return (hasPgp ? 't:' : 'f:') + substring;
  }

  private static dbCreateSearchIndexList(email: string, name: string | null, hasPgp: boolean) {
    email = email.toLowerCase();
    name = name ? name.toLowerCase() : '';
    let parts = [email, name];
    parts = parts.concat(email.split(/[^a-z0-9]/));
    parts = parts.concat(name.split(/[^a-z0-9]/));
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

  static dbContactObj(email: string, name?: string, client?: string, pubkey?: string, attested?: boolean, pendingLookup?: boolean | number, lastUse?: number): Contact {
    const fingerprint = pubkey ? Pgp.key.fingerprint(pubkey) : null;
    email = Str.parseEmail(email).email;
    if (!Str.isEmailValid(email)) {
      throw new Error(`Cannot save contact because email is not valid: ${email}`);
    }
    return {
      email,
      name: name || null,
      pubkey: pubkey || null,
      has_pgp: pubkey ? 1 : 0, // number because we use it for sorting
      searchable: Store.dbCreateSearchIndexList(email, name || null, Boolean(pubkey)),
      client: pubkey ? (client || null) : null,
      attested: pubkey ? Boolean(attested) : null,
      fingerprint,
      longid: fingerprint ? Pgp.key.longid(fingerprint) : null,
      keywords: fingerprint ? mnemonic(Pgp.key.longid(fingerprint)!) : null,
      pending_lookup: pubkey ? 0 : (pendingLookup ? 1 : 0),
      last_use: lastUse || null,
      date: null,
    };
  }

  static dbContactSave = (db: IDBDatabase | null, contact: Contact | Contact[]): Promise<void> => new Promise(async (resolve, reject) => {
    if (db === null) { // relay op through background process
      // todo - currently will silently swallow errors
      BrowserMsg.sendAwait(null, 'db', { f: 'dbContactSave', args: [contact] }).then(resolve).catch(Catch.rejection);
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
        const stackFill = String((new Error()).stack);
        tx.onabort = () => reject(Store.dbErrCategorize(tx.error, stackFill));
      }
    }
  })

  static dbContactUpdate(db: IDBDatabase | null, email: string | string[], update: ContactUpdate): Promise<void> {
    return new Promise(async (resolve, reject) => {
      if (db === null) { // relay op through background process
        // todo - currently will silently swallow errors
        BrowserMsg.sendAwait(null, 'db', { f: 'dbContactUpdate', args: [email, update] }).then(resolve).catch(Catch.rejection);
      } else {
        if (Array.isArray(email)) {
          for (const singleEmail of email) {
            await Store.dbContactUpdate(db, singleEmail, update);
          }
          resolve();
        } else {
          let [contact] = await Store.dbContactGet(db, [email]);
          if (contact === null) { // updating a non-existing contact, insert it first
            await Store.dbContactSave(db, Store.dbContactObj(email, undefined, undefined, undefined, undefined, false, undefined));
            [contact] = await Store.dbContactGet(db, [email]);
            if (contact === null) { // todo - temporary. If no such errors show by end of June 2018, remove this.
              reject({ message: 'contact not found right after inserting it', internal: 'missing_contact', code: null });
              return;
            }
          }
          for (const k of Object.keys(update)) {
            // @ts-ignore - may be saving any of the provided values - could do this one by one while ensuring proper types
            contact[k] = update[k];
          }
          const tx = db.transaction('contacts', 'readwrite');
          const contactsTable = tx.objectStore('contacts');
          contactsTable.put(Store.dbContactObj(
            email,
            contact.name || undefined,
            contact.client || undefined,
            contact.pubkey || undefined,
            contact.attested || undefined,
            contact.pending_lookup,
            contact.last_use || undefined
          ));
          tx.oncomplete = Catch.try(resolve);
          const stackFill = String((new Error()).stack);
          tx.onabort = () => reject(Store.dbErrCategorize(tx.error, stackFill));
        }
      }
    });
  }

  static dbContactGet(db: null | IDBDatabase, emailOrLongid: string[]): Promise<(Contact | null)[]> {
    return new Promise(async (resolve, reject) => {
      if (db === null) { // relay op through background process
        // todo - currently will silently swallow errors
        BrowserMsg.sendAwait(null, 'db', { f: 'dbContactGet', args: [emailOrLongid] }).then(resolve).catch(Catch.rejection);
      } else {
        if (emailOrLongid.length === 1) {
          let tx: IDBRequest;
          if (!(/^[A-F0-9]{16}$/g).test(emailOrLongid[0])) { // email
            tx = db.transaction('contacts', 'readonly').objectStore('contacts').get(emailOrLongid[0]);
          } else { // longid
            tx = db.transaction('contacts', 'readonly').objectStore('contacts').index('index_longid').get(emailOrLongid[0]);
          }
          tx.onsuccess = Catch.try(() => resolve([tx.result !== undefined ? tx.result : null]));
          const stackFill = String((new Error()).stack);
          tx.onerror = () => reject(Store.dbErrCategorize(tx.error!, stackFill)); // todo - added ! after ts3 upgrade - investigate
        } else {
          const results: (Contact | null)[] = [];
          for (const singleEmailOrLongid of emailOrLongid) {
            const [contact] = await Store.dbContactGet(db, [singleEmailOrLongid]);
            results.push(contact);
          }
          resolve(results);
        }
      }
    });
  }

  static dbContactSearch(db: IDBDatabase | null, query: DbContactFilter): Promise<Contact[]> {
    return new Promise(async (resolve, reject) => {
      if (db === null) { // relay op through background process
        // todo - currently will silently swallow errors
        BrowserMsg.sendAwait(null, 'db', { f: 'dbContactSearch', args: [query] }).then(resolve).catch(Catch.rejection);
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
              found.push(cursor.value);
              cursor.continue();
            }
          });
          const stackFill = String((new Error()).stack);
          search.onerror = () => reject(Store.dbErrCategorize(search!.error!, stackFill)); // todo - added ! after ts3 upgrade - investigate
        }
      }
    });
  }

}
