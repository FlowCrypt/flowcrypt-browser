/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { GoogleOAuth } from '../../api/authentication/google/google-oauth.js';
import { ApiErr } from '../../api/shared/api-error.js';
import { AuthenticationConfiguration } from '../../authentication-configuration.js';
import { BrowserMsg } from '../../browser/browser-msg.js';
import { storageGet, storageRemove, storageSet } from '../../browser/chrome.js';
import { ClientConfigurationJson } from '../../client-configuration.js';
import { Dict } from '../../core/common.js';
import { InMemoryStoreKeys } from '../../core/const.js';
import { KeyInfoWithIdentity, StoredKeyInfo } from '../../core/crypto/key.js';
import { AbstractStore, RawStore } from './abstract-store.js';
import { InMemoryStore } from './in-memory-store.js';

export type EmailProvider = 'gmail';
type GoogleAuthScopesNames = [keyof typeof GoogleOAuth.OAUTH.scopes, keyof typeof GoogleOAuth.OAUTH.legacy_scopes][number];

export type Scopes = {
  openid: boolean;
  email: boolean;
  profile: boolean;
  compose: boolean;
  modify: boolean;
  readContacts: boolean;
  readOtherContacts: boolean;
  gmail: boolean;
};

export type AccountIndex =
  | 'keys'
  | 'notification_setup_needed_dismissed'
  | 'email_provider'
  | 'google_token_refresh'
  | 'hide_message_password'
  | 'sendAs'
  | 'pubkey_sent_to'
  | 'full_name'
  | 'cryptup_enabled'
  | 'setup_done'
  | 'notification_setup_done_seen'
  | 'picture'
  | 'outgoing_language'
  | 'setup_date'
  | 'use_rich_text'
  | 'rules'
  | 'fesUrl'
  | 'failedPassphraseAttempts'
  | 'lastUnsuccessfulPassphraseAttempt'
  | 'authentication';

export type SendAsAlias = {
  isPrimary: boolean;
  isDefault?: boolean;
  name?: string | null;
  footer?: string | null;
};

/* eslint-disable @typescript-eslint/naming-convention */
export type AcctStoreDict = {
  keys?: (StoredKeyInfo | KeyInfoWithIdentity)[]; // todo - migrate to KeyInfoWithIdentity only
  notification_setup_needed_dismissed?: boolean;
  email_provider?: EmailProvider;
  google_token_refresh?: string;
  hide_message_password?: boolean; // is global?
  sendAs?: Dict<SendAsAlias>;
  addresses?: string[];
  pubkey_sent_to?: string[];
  full_name?: string;
  cryptup_enabled?: boolean;
  setup_done?: boolean;
  notification_setup_done_seen?: boolean;
  picture?: string; // google image
  outgoing_language?: 'EN' | 'DE';
  setup_date?: number;
  use_rich_text?: boolean;
  rules?: ClientConfigurationJson;
  fesUrl?: string; // url where FlowCrypt External Service is deployed
  failedPassphraseAttempts?: number;
  lastUnsuccessfulPassphraseAttempt?: number;
  authentication?: AuthenticationConfiguration;
};
/* eslint-enable @typescript-eslint/naming-convention */

/**
 * Local storage of data related to a particular email account
 */
export class AcctStore extends AbstractStore {
  public static async get(acctEmail: string, keys: AccountIndex[]): Promise<AcctStoreDict> {
    const storageObj = (await storageGet('local', AcctStore.singleScopeRawIndexArr(acctEmail, keys))) as RawStore;
    const result = AcctStore.buildSingleAccountStoreFromRawResults(acctEmail, storageObj) as AcctStoreDict;
    return AcctStore.fixAcctStorageResult(acctEmail, result, keys);
  }

  public static async getAccounts(acctEmails: string[], keys: string[]): Promise<Dict<AcctStoreDict>> {
    const storageObj = (await storageGet('local', AcctStore.manyScopesRawIndexArr(acctEmails, keys))) as RawStore;
    const resultsByAcct: Dict<AcctStoreDict> = {};
    for (const account of acctEmails) {
      resultsByAcct[account] = AcctStore.buildSingleAccountStoreFromRawResults(account, storageObj);
    }
    return resultsByAcct;
  }

  public static async set(acctEmail: string, values: AcctStoreDict): Promise<void> {
    const indexedUpdateFields: RawStore = {};
    const indexedRemoveFields: string[] = [];
    for (const key of Object.keys(values)) {
      const index = AcctStore.singleScopeRawIndex(acctEmail, key);
      if (typeof values[key as AccountIndex] !== 'undefined') {
        indexedUpdateFields[index] = values[key as AccountIndex];
      } else {
        indexedRemoveFields.push(index);
      }
    }
    if (Object.keys(indexedUpdateFields).length) {
      await storageSet('local', indexedUpdateFields);
    }
    if (indexedRemoveFields.length) {
      await storageRemove('local', indexedRemoveFields);
    }
  }

  public static async remove(acctEmail: string, keys: AccountIndex[]) {
    await storageRemove('local', AcctStore.singleScopeRawIndexArr(acctEmail, keys));
  }

  public static async getScopes(acctEmail: string): Promise<Scopes> {
    const accessToken = await InMemoryStore.getUntilAvailable(acctEmail, InMemoryStoreKeys.GOOGLE_TOKEN_ACCESS);
    // const { google_token_scopes } = await AcctStore.get(acctEmail, ['google_token_scopes']);
    const result: { [key in GoogleAuthScopesNames]: boolean } = {
      email: false,
      openid: false,
      profile: false,
      compose: false,
      modify: false,
      readContacts: false,
      readOtherContacts: false,
      gmail: false,
    };
    if (!accessToken) {
      return result;
    }
    let allowedScopes: string[] = [];
    try {
      const { scope } = await GoogleOAuth.getTokenInfo(accessToken);
      allowedScopes = scope.split(' ');
    } catch (e) {
      if (ApiErr.isAuthErr(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded('broadcast', { acctEmail });
      }
    }
    for (const key of Object.keys({ ...GoogleOAuth.OAUTH.scopes, ...GoogleOAuth.OAUTH.legacy_scopes })) {
      const scopeName = key as GoogleAuthScopesNames;
      if (scopeName in GoogleOAuth.OAUTH.scopes) {
        result[scopeName] = allowedScopes.includes(GoogleOAuth.OAUTH.scopes[scopeName as keyof typeof GoogleOAuth.OAUTH.scopes]);
      } else if (scopeName in GoogleOAuth.OAUTH.legacy_scopes) {
        result[scopeName] = allowedScopes.includes(GoogleOAuth.OAUTH.legacy_scopes[scopeName as keyof typeof GoogleOAuth.OAUTH.legacy_scopes]);
      }
    }
    return result;
  }

  private static fixAcctStorageResult(acctEmail: string, acctStore: AcctStoreDict, keys: AccountIndex[]): AcctStoreDict {
    if (keys.includes('sendAs') && !acctStore.sendAs) {
      const sendAs = new Map<string, SendAsAlias>([[acctEmail, { isPrimary: true, isDefault: true }]]);
      acctStore.sendAs = Object.fromEntries(sendAs);
    }
    return acctStore;
  }
}
