/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Value, Str, Dict } from '../core/common.js';
import { mnemonic } from '../core/mnemonic.js';
import { KeyInfo, Contact } from '../core/pgp-key.js';
import { SubscriptionInfo, PaymentMethod, FcUuidAuth, SubscriptionLevel } from '../api/backend.js';
import { BrowserMsg, BgNotReadyErr } from '../browser/browser-msg.js';
import { Catch, UnreportableError } from './catch.js';
import { storageLocalSet, storageLocalGet, storageLocalRemove } from '../api/chrome.js';
import { PgpClient } from '../api/keyserver.js';
import { GmailRes } from '../api/email_provider/gmail/gmail-parser.js';
import { GoogleAuth } from '../api/google-auth.js';
import { DomainRules } from '../rules.js';
import { Env } from '../browser/env.js';
import { Ui } from '../browser/ui.js';
import { PgpArmor } from '../core/pgp-armor.js';
import { PgpKey } from '../core/pgp-key.js';

// tslint:disable:no-null-keyword

let KEY_CACHE: { [longidOrArmoredKey: string]: OpenPGP.key.Key } = {};
let KEY_CACHE_WIPE_TIMEOUT: number;

type SerializableTypes = FlatTypes | string[] | number[] | boolean[] | SubscriptionInfo | DomainRules;
type StoredReplyDraftMeta = string; // draftId
type StoredComposeDraftMeta = { recipients: string[], subject: string, date: number };
type StoredAdminCode = { date: number, codes: string[] };
export type DbContactObjArg = {
  email: string,
  name?: string | null,
  client?: 'pgp' | 'cryptup' | PgpClient | null,
  pubkey?: string | null,
  pendingLookup?: boolean | number | null,
  lastUse?: number | null, // when was this contact last used to send an email
  lastSig?: number | null, // last pubkey signature (when was pubkey last updated by owner)
  lastCheck?: number | null; // when was the local copy of the pubkey last updated (or checked against Attester)
  expiresOn?: Date | null;
};
export type EmailProvider = 'gmail';
export type GoogleAuthScopesNames = [keyof typeof GoogleAuth.OAUTH.scopes, keyof typeof GoogleAuth.OAUTH.legacy_scopes][number];

export type Scopes = {
  openid: boolean;
  email: boolean;
  profile: boolean;
  compose: boolean;
  modify: boolean;
  readContacts: boolean;
  read: boolean;
  gmail: boolean;
};
export type KeyBackupMethod = 'file' | 'inbox' | 'none' | 'print';
export type DbContactFilter = { has_pgp?: boolean, substring?: string, limit?: number };
export type StorageType = 'session' | 'local';
export type FlatTypes = null | undefined | number | string | boolean;
export type ContactUpdate = {
  email?: string;
  name?: string | null;
  pubkey?: string;
  has_pgp?: 0 | 1;
  searchable?: string[];
  client?: string | null;
  fingerprint?: string | null;
  longid?: string | null;
  keywords?: string | null;
  pending_lookup?: number;
  last_use?: number | null;
  pubkey_last_sig?: number | null;
  pubkey_last_check?: number | null;
};
export type Storable = FlatTypes | string[] | KeyInfo[] | Dict<StoredReplyDraftMeta> | Dict<StoredComposeDraftMeta> | Dict<StoredAdminCode>
  | SubscriptionInfo | GmailRes.OpenId | DomainRules;
export type Serializable = SerializableTypes | SerializableTypes[] | Dict<SerializableTypes> | Dict<SerializableTypes>[];

export interface RawStore {
  [key: string]: Storable;
}

export type GlobalStore = {
  version?: number | null;
  account_emails?: string; // stringified array
  settings_seen?: boolean;
  hide_pass_phrases?: boolean;
  cryptup_account_email?: string | null; // todo - remove
  cryptup_account_uuid?: string | null; // todo - remove
  cryptup_account_subscription?: SubscriptionInfo | null; // todo - remove
  dev_outlook_allow?: boolean;
  admin_codes?: Dict<StoredAdminCode>;
};

export type GlobalIndex = 'version' | 'account_emails' | 'settings_seen' | 'hide_pass_phrases' |
  'cryptup_account_email' | 'cryptup_account_uuid' | 'cryptup_account_subscription' | 'dev_outlook_allow' |
  'admin_codes';

export type SendAsAlias = {
  isPrimary: boolean;
  isDefault?: boolean;
  name?: string | null;
  footer?: string | null;
};

export type AccountStore = {
  keys?: KeyInfo[];
  notification_setup_needed_dismissed?: boolean;
  email_provider?: EmailProvider;
  google_token_access?: string;
  google_token_expires?: number;
  google_token_scopes?: string[]; // these are actuall scope urls the way the provider expects them
  google_token_refresh?: string;
  hide_message_password?: boolean; // is global?
  sendAs?: Dict<SendAsAlias>;
  addresses?: string[],
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
  use_rich_text?: boolean;
  openid?: GmailRes.OpenId;
  subscription?: SubscriptionInfo;
  uuid?: string;
  rules?: DomainRules;
  // temporary
  tmp_submit_main?: boolean;
  tmp_submit_all?: boolean;
};

export type PromiseCancellation = { cancel: boolean };

export class AccountStoreExtension {
  static getEmailAliasesIncludingPrimary = (acct: string, sendAs: Dict<SendAsAlias> | undefined) => {
    return sendAs ? Object.keys(sendAs) : [acct];
  }
}

export type AccountIndex = 'keys' | 'notification_setup_needed_dismissed' | 'email_provider' | 'google_token_access' | 'google_token_expires' | 'google_token_scopes' |
  'google_token_refresh' | 'hide_message_password' | 'addresses' | 'sendAs' | 'drafts_reply' | 'drafts_compose' |
  'pubkey_sent_to' | 'full_name' | 'cryptup_enabled' | 'setup_done' | 'setup_simple' | 'is_newly_created_key' | 'key_backup_method' |
  'key_backup_prompt' | 'successfully_received_at_leat_one_message' | 'notification_setup_done_seen' | 'picture' |
  'outgoing_language' | 'setup_date' | 'openid' | 'tmp_submit_main' | 'tmp_submit_all' | 'subscription' | 'uuid' | 'use_rich_text' | 'rules';

export class Subscription implements SubscriptionInfo {
  active?: boolean;
  method?: PaymentMethod;
  level?: SubscriptionLevel;
  expire?: string;
  expired?: boolean;

  constructor(storedSubscriptionInfo: SubscriptionInfo | undefined | null) {
    if (storedSubscriptionInfo) {
      this.active = storedSubscriptionInfo.active || undefined;
      this.method = storedSubscriptionInfo.method || undefined;
      this.level = storedSubscriptionInfo.level;
      this.expire = storedSubscriptionInfo.expire || undefined;
      this.expired = storedSubscriptionInfo.expired || undefined;
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

  static singleScopeRawIndex = (scope: string, key: string) => {
    return `cryptup_${scope.replace(/[^A-Za-z0-9]+/g, '').toLowerCase()}_${key}`;
  }

  private static singleScopeRawIndexArr = (scope: string, keys: string[]) => {
    return keys.map(key => Store.singleScopeRawIndex(scope, key));
  }

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

  static getScopes = async (acctEmail: string): Promise<Scopes> => {
    const { google_token_scopes } = await Store.getAcct(acctEmail, ['google_token_scopes']);
    const result: { [key in GoogleAuthScopesNames]: boolean } = {
      email: false, openid: false, profile: false, compose: false,
      modify: false, readContacts: false, gmail: false, read: false
    };
    if (google_token_scopes) {
      for (const key of Object.keys({ ...GoogleAuth.OAUTH.scopes, ...GoogleAuth.OAUTH.legacy_scopes })) {
        const scopeName = key as GoogleAuthScopesNames;
        if (scopeName in GoogleAuth.OAUTH.scopes) {
          result[scopeName] = google_token_scopes.includes(GoogleAuth.OAUTH.scopes[scopeName as keyof typeof GoogleAuth.OAUTH.scopes]);
        } else if (scopeName in GoogleAuth.OAUTH.legacy_scopes) {
          result[scopeName] = google_token_scopes.includes(GoogleAuth.OAUTH.legacy_scopes[scopeName as keyof typeof GoogleAuth.OAUTH.legacy_scopes]);
        }
      }
    }
    return result;
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
    if (typeof value !== 'undefined') { // pass phrases may be stored in session for reuse
      sessionStorage.setItem(Store.singleScopeRawIndex(acctEmail, key), String(value)); // lgtm [js/clear-text-storage-of-sensitive-data]
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
        // @ts-ignore - this is too dynamic for TS
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

  static getKeysCurrentlyInSession = async (acctEmail: string) => {
    const keys = await Store.keysGet(acctEmail);
    const result: Array<KeyInfo> = [];
    for (const key of keys) {
      // Check if passpharse in the session
      if (!(await Store.passphraseGet(acctEmail, key.longid, true)) &&
        await Store.passphraseGet(acctEmail, key.longid, false)) {
        result.push(key);
      }
    }
    return result;
  }

  static waitUntilPassphraseChanged = async (
    acctEmail: string, missingOrWrongPpKeyLongids: string[], interval = 1000, cancellation: PromiseCancellation = { cancel: false }
  ): Promise<boolean> => {
    const missingOrWrongPassprases: Dict<string | undefined> = {};
    const passphrases = await Promise.all(missingOrWrongPpKeyLongids.map(longid => Store.passphraseGet(acctEmail, longid)));
    for (const i of missingOrWrongPpKeyLongids.keys()) {
      missingOrWrongPassprases[missingOrWrongPpKeyLongids[i]] = passphrases[i];
    }
    while (!cancellation.cancel) {
      await Ui.time.sleep(interval);
      const longidsMissingPp = Object.keys(missingOrWrongPassprases);
      const updatedPpArr = await Promise.all(longidsMissingPp.map(longid => Store.passphraseGet(acctEmail, longid)));
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

  static keysGet = async (acctEmail: string, longids?: string[]) => {
    const stored = await Store.getAcct(acctEmail, ['keys']);
    const keys: KeyInfo[] = stored.keys || [];
    if (!longids) {
      return keys;
    }
    return keys.filter(ki => longids.includes(ki.longid) || (longids.includes('primary') && ki.primary));
  }

  static keysGetAllWithPp = async (acctEmail: string): Promise<KeyInfo[]> => {
    const keys = await Store.keysGet(acctEmail);
    for (const ki of keys) {
      ki.passphrase = await Store.passphraseGet(acctEmail, ki.longid);
    }
    return keys;
  }

  private static keysObj = async (armoredPrv: string, primary = false): Promise<KeyInfo> => {
    const longid = await PgpKey.longid(armoredPrv)!;
    if (!longid) {
      throw new Error('Store.keysObj: unexpectedly no longid');
    }
    const prv = await PgpKey.read(armoredPrv);
    const fingerprint = await PgpKey.fingerprint(armoredPrv);
    return { private: armoredPrv, public: prv.toPublic().armor(), primary, longid, fingerprint: fingerprint!, keywords: mnemonic(longid)! };
  }

  static keysAdd = async (acctEmail: string, newKeyArmored: string) => { // todo: refactor setup.js -> backup.js flow so that keys are never saved naked, then re-enable naked key check
    const keyinfos = await Store.keysGet(acctEmail);
    let updated = false;
    const newKeyLongid = await PgpKey.longid(newKeyArmored);
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

  static getAcct = async (acctEmail: string, keys: AccountIndex[]): Promise<AccountStore> => {
    if (Env.isContentScript()) {
      // extension storage can be disallowed in rare cases for content scripts throwing 'Error: Access to extension API denied.'
      // go through bg script to avoid such errors
      for (let i = 0; i < 10; i++) { // however backend may not be immediately ready to respond - retry
        try {
          return await BrowserMsg.send.bg.await.storeAcctGet({ acctEmail, keys });
        } catch (e) {
          if (!(e instanceof BgNotReadyErr) || i === 9) {
            throw e;
          }
          await Ui.time.sleep(300);
        }
      }
      throw new BgNotReadyErr('this should never happen');
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
        if (!acctEmails.includes(acctEmail.toLowerCase())) {
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
    if (!acctEmails.includes(acctEmail) && acctEmail) {
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

  static authInfo = async (acctEmail: string): Promise<FcUuidAuth> => {
    const { uuid } = await Store.getAcct(acctEmail, ['uuid']);
    return { account: acctEmail, uuid };
  }

  static subscription = async (acctEmail: string): Promise<Subscription> => {
    const { subscription } = await Store.getAcct(acctEmail, ['subscription']);
    return new Subscription(subscription);
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

  static dbOpen = async (): Promise<IDBDatabase> => {
    return await new Promise((resolve, reject) => {
      let openDbReq: IDBOpenDBRequest;
      openDbReq = indexedDB.open('cryptup', 3);
      openDbReq.onupgradeneeded = (event) => {
        let contacts: IDBObjectStore;
        if (event.oldVersion < 1) {
          contacts = openDbReq.result.createObjectStore('contacts', { keyPath: 'email' }); // tslint:disable-line:no-unsafe-any
          contacts.createIndex('search', 'searchable', { multiEntry: true });
          contacts.createIndex('index_has_pgp', 'has_pgp');
          contacts.createIndex('index_pending_lookup', 'pending_lookup');
        }
        if (event.oldVersion < 2) {
          contacts = openDbReq.transaction!.objectStore('contacts');
          contacts.createIndex('index_longid', 'longid'); // longid of the first public key packet, no subkeys
        }
        if (event.oldVersion < 3) {
          contacts = openDbReq.transaction!.objectStore('contacts');
          contacts.createIndex('index_longids', 'longids', { multiEntry: true }); // longids of all public key packets in armored pubkey
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
          if (!index.includes(normalized)) {
            index.push(Store.dbIndex(hasPgp, normalized));
          }
        }
      }
    }
    return index;
  }

  private static storablePgpClient = (rawPgpClient: 'pgp' | 'cryptup' | PgpClient | null): 'pgp' | 'cryptup' | null => {
    if (rawPgpClient === 'flowcrypt') {
      return 'cryptup';
    } else if (rawPgpClient === 'pgp-other') {
      return 'pgp';
    } else {
      return rawPgpClient;
    }
  }

  static dbContactObj = async ({ email, name, client, pubkey, pendingLookup, lastUse, lastCheck, lastSig, expiresOn }: DbContactObjArg): Promise<Contact> => {
    const expiresOnMs = Number(expiresOn) || undefined;
    // @ts-ignore - if openpgp is mising, relay op through background process
    if (typeof openpgp === 'undefined') {
      return await BrowserMsg.send.bg.await.db({ f: 'dbContactObj', args: [{ email, name, client, pubkey, pendingLookup, lastUse, lastSig, lastCheck, expiresOnMs }] }) as Contact;
    } else {
      const validEmail = Str.parseEmail(email).email;
      if (!validEmail) {
        throw new Error(`Cannot save contact because email is not valid: ${email}`);
      }
      if (!pubkey) {
        return {
          email,
          name: name || null,
          pending_lookup: (pendingLookup ? 1 : 0),
          pubkey: null,
          has_pgp: 0, // number because we use it for sorting
          searchable: Store.dbCreateSearchIndexList(email, name || null, false),
          client: null,
          fingerprint: null,
          longid: null,
          longids: [],
          keywords: null,
          last_use: lastUse || null,
          pubkey_last_sig: null,
          pubkey_last_check: null,
          expiresOn: null
        };
      }
      const k = await PgpKey.read(pubkey);
      if (!k) {
        throw new Error(`Could not read pubkey as valid OpenPGP key for: ${email}`);
      }
      const keyDetails = await PgpKey.details(k);
      if (!lastSig) {
        lastSig = await PgpKey.lastSig(k);
      }
      return {
        email: validEmail,
        name: name || null,
        pubkey: keyDetails.public,
        has_pgp: 1, // number because we use it for sorting
        searchable: Store.dbCreateSearchIndexList(email, name || null, true),
        client: Store.storablePgpClient(client || 'pgp'),
        fingerprint: keyDetails.ids[0].fingerprint,
        longid: keyDetails.ids[0].longid,
        longids: keyDetails.ids.map(id => id.longid),
        keywords: keyDetails.ids[0].keywords,
        pending_lookup: 0,
        last_use: lastUse || null,
        pubkey_last_sig: lastSig || null,
        pubkey_last_check: lastCheck || null,
        expiresOn: expiresOnMs || null
      };
    }
  }

  static dbContactSave = async (db: IDBDatabase | undefined, contact: Contact | Contact[]): Promise<void> => {
    if (!db) { // relay op through background process
      await BrowserMsg.send.bg.await.db({ f: 'dbContactSave', args: [contact] });
      return;
    }
    if (Array.isArray(contact)) {
      await Promise.all(contact.map(oneContact => Store.dbContactSave(db, oneContact)));
      return;
    }
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('contacts', 'readwrite');
      const contactsTable = tx.objectStore('contacts');
      contactsTable.put(contact);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(Store.errCategorize(tx.error));
    });
  }

  static dbContactUpdate = async (db: IDBDatabase | undefined, email: string | string[], update: ContactUpdate): Promise<void> => {
    if (!db) { // relay op through background process
      await BrowserMsg.send.bg.await.db({ f: 'dbContactUpdate', args: [email, update] });
      return;
    }
    if (Array.isArray(email)) {
      await Promise.all(email.map(oneEmail => Store.dbContactUpdate(db, oneEmail, update)));
      return;
    }
    let [contact] = await Store.dbContactGet(db, [email]);
    if (!contact) { // updating a non-existing contact, insert it first
      await Store.dbContactSave(db, await Store.dbContactObj({ email }));
      [contact] = await Store.dbContactGet(db, [email]);
      if (!contact) {
        throw new Error('contact not found right after inserting it');
      }
    }
    if (update.pubkey && update.pubkey.includes(PgpArmor.headers('privateKey').begin)) { // wrongly saving prv instead of pub
      Catch.report('Wrongly saving prv as contact - converting to pubkey');
      const key = await PgpKey.read(update.pubkey);
      update.pubkey = key.toPublic().armor();
    }
    for (const k of Object.keys(update)) {
      // @ts-ignore - may be saving any of the provided values - could do this one by one while ensuring proper types
      contact[k] = update[k];
    }
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('contacts', 'readwrite');
      const contactsTable = tx.objectStore('contacts');
      contactsTable.put(contact);
      tx.oncomplete = Catch.try(resolve);
      tx.onabort = () => reject(Store.errCategorize(tx.error));
    });
  }

  static dbContactGet = async (db: undefined | IDBDatabase, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    if (!db) { // relay op through background process
      return await BrowserMsg.send.bg.await.db({ f: 'dbContactGet', args: [emailOrLongid] }) as (Contact | undefined)[];
    }
    if (emailOrLongid.length === 1) {
      // contacts imported before August 2019 may have only primary longid recorded, in index_longid (string)
      // contacts imported after August 2019 have both index_longid (string) and index_longids (string[] containing all subkeys)
      // below we search contact by first trying to only search by primary longid
      // (or by email - such searches are not affected by longid indexing)
      const contact = await Store.dbContactInternalGetOne(db, emailOrLongid[0], false);
      if (contact || !/^[A-F0-9]{16}$/.test(emailOrLongid[0])) {
        // if we found something, return it
        // or if we were searching by email, return found contact or nothing
        return [contact];
      } else {
        // not found any key by primary longid, and searching by longid -> search by any subkey longid
        // it may not find pubkeys imported before August 2019, re-importing such pubkeys will make them findable
        return [await Store.dbContactInternalGetOne(db, emailOrLongid[0], true)];
      }
    } else {
      const results: (Contact | undefined)[] = [];
      for (const singleEmailOrLongid of emailOrLongid) {
        const [contact] = await Store.dbContactGet(db, [singleEmailOrLongid]);
        results.push(contact);
      }
      return results;
    }
  }

  private static dbContactInternalGetOne = async (db: IDBDatabase, emailOrLongid: string, searchSubkeyLongids: boolean): Promise<Contact | undefined> => {
    return await new Promise((resolve, reject) => {
      let tx: IDBRequest;
      if (!/^[A-F0-9]{16}$/.test(emailOrLongid)) { // email
        tx = db.transaction('contacts', 'readonly').objectStore('contacts').get(emailOrLongid);
      } else if (searchSubkeyLongids) { // search all longids
        tx = db.transaction('contacts', 'readonly').objectStore('contacts').index('index_longids').get(emailOrLongid);
      } else { // search primary longid
        tx = db.transaction('contacts', 'readonly').objectStore('contacts').index('index_longid').get(emailOrLongid);
      }
      tx.onsuccess = Catch.try(() => resolve(tx.result || undefined)); // tslint:disable-line:no-unsafe-any
      tx.onerror = () => reject(Store.errCategorize(tx.error || new Error('Unknown db error')));
    });
  }

  static dbContactSearch = async (db: IDBDatabase | undefined, query: DbContactFilter): Promise<Contact[]> => {
    if (!db) { // relay op through background process
      return await BrowserMsg.send.bg.await.db({ f: 'dbContactSearch', args: [query] }) as Contact[];
    }
    for (const key of Object.keys(query)) {
      if (!Store.dbQueryKeys.includes(key)) {
        throw new Error('dbContactSearch: unknown key: ' + key);
      }
    }
    query.substring = Store.normalizeString(query.substring || '');
    if (typeof query.has_pgp === 'undefined' && query.substring) {
      const resultsWithPgp = await Store.dbContactSearch(db, { substring: query.substring, limit: query.limit, has_pgp: true });
      if (query.limit && resultsWithPgp.length === query.limit) {
        return resultsWithPgp;
      } else {
        const limit = query.limit ? query.limit - resultsWithPgp.length : undefined;
        const resultsWithoutPgp = await Store.dbContactSearch(db, { substring: query.substring, limit, has_pgp: false });
        return resultsWithPgp.concat(resultsWithoutPgp);
      }
    }
    return await new Promise((resolve, reject) => {
      const contacts = db.transaction('contacts', 'readonly').objectStore('contacts');
      let search: IDBRequest;
      if (typeof query.has_pgp === 'undefined') { // any query.has_pgp value
        search = contacts.openCursor(); // no substring, already covered in `typeof query.has_pgp === 'undefined' && query.substring` above
      } else { // specific query.has_pgp value
        if (query.substring) {
          search = contacts.index('search').openCursor(IDBKeyRange.only(Store.dbIndex(query.has_pgp, query.substring)));
        } else {
          search = contacts.index('index_has_pgp').openCursor(IDBKeyRange.only(Number(query.has_pgp)));
        }
      }
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
    });
  }

  static decryptedKeyCacheSet = (k: OpenPGP.key.Key) => {
    // todo - not yet used in browser extension, but planned to be enabled soon
    // Store.keyCacheRenewExpiry();
    // KEY_CACHE[keyLongid(k)] = k;
  }

  static decryptedKeyCacheGet = (longid: string): OpenPGP.key.Key | undefined => {
    Store.keyCacheRenewExpiry();
    return KEY_CACHE[longid];
  }

  static armoredKeyCacheSet = (armored: string, k: OpenPGP.key.Key) => {
    // todo - not yet used in browser extension, but planned to be enabled soon
    // Store.keyCacheRenewExpiry();
    // KEY_CACHE[armored] = k;
  }

  static armoredKeyCacheGet = (armored: string): OpenPGP.key.Key | undefined => {
    Store.keyCacheRenewExpiry();
    return KEY_CACHE[armored];
  }

  static keyCacheWipe = () => {
    KEY_CACHE = {};
  }

  private static keyCacheRenewExpiry = () => {
    if (KEY_CACHE_WIPE_TIMEOUT) {
      clearTimeout(KEY_CACHE_WIPE_TIMEOUT);
    }
    KEY_CACHE_WIPE_TIMEOUT = Catch.setHandledTimeout(Store.keyCacheWipe, 2 * 60 * 1000);
  }

}
