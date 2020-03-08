/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { KeyInfo } from '../../core/pgp-key.js';
import { Dict } from '../../core/common.js';
import { SubscriptionInfo } from '../../api/backend.js';
import { DomainRulesJson } from '../../org-rules.js';
import { GmailRes } from '../../api/email-provider/gmail/gmail-parser.js';
import { AcctStoreDict, AccountIndex, StoredReplyDraftMeta, StoredComposeDraftMeta } from './acct-store.js';
import { UnreportableError, Catch } from '../catch.js';
import { StoredAdminCode } from './global-store.js';

type SerializableTypes = FlatTypes | string[] | number[] | boolean[] | SubscriptionInfo | DomainRulesJson;
export type StorageType = 'session' | 'local';
export type FlatTypes = null | undefined | number | string | boolean;
export type Storable = FlatTypes | string[] | KeyInfo[] | Dict<StoredReplyDraftMeta> | Dict<StoredComposeDraftMeta> | Dict<StoredAdminCode>
  | SubscriptionInfo | GmailRes.OpenId | DomainRulesJson;
export type Serializable = SerializableTypes | SerializableTypes[] | Dict<SerializableTypes> | Dict<SerializableTypes>[];

export interface RawStore {
  [key: string]: Storable;
}

export class StoreCorruptedError extends Error { }
export class StoreDeniedError extends Error { }
export class StoreFailedError extends Error { }

export abstract class AbstractStore {

  public static singleScopeRawIndex = (scope: string, key: string) => {
    return `cryptup_${scope.replace(/[^A-Za-z0-9]+/g, '').toLowerCase()}_${key}`;
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

  protected static buildSingleAccountStoreFromRawResults = (scope: string, storageObj: RawStore): AcctStoreDict => {
    const accountStore: AcctStoreDict = {};
    for (const k of Object.keys(storageObj)) {
      const fixedKey = k.replace(AbstractStore.singleScopeRawIndex(scope, ''), '');
      if (fixedKey !== k) { // the scope matches and was thus removed from the raw index
        accountStore[fixedKey as AccountIndex] = storageObj[k] as any;
      }
    }
    return accountStore;
  }

  protected static singleScopeRawIndexArr = (scope: string, keys: string[]) => {
    return keys.map(key => AbstractStore.singleScopeRawIndex(scope, key));
  }

  protected static manyScopesRawIndexArr = (scopes: string[], keys: string[]) => {
    const allResults: string[] = [];
    for (const scope of scopes) {
      allResults.push(...AbstractStore.singleScopeRawIndexArr(scope, keys));
    }
    return allResults;
  }

}
