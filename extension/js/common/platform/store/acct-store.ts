/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Env } from '../../browser/env.js';
import { GoogleAuth } from '../../api/email-provider/gmail/google-auth.js';
import { KeyInfo } from '../../core/crypto/key.js';
import { Dict } from '../../core/common.js';
import { GmailRes } from '../../api/email-provider/gmail/gmail-parser.js';
import { DomainRulesJson } from '../../org-rules.js';
import { BrowserMsg, BgNotReadyErr } from '../../browser/browser-msg.js';
import { Ui } from '../../browser/ui.js';
import { storageLocalGet, storageLocalSet, storageLocalRemove } from '../../browser/chrome.js';
import { AbstractStore } from './abstract-store.js';
import { RawStore } from './abstract-store.js';
import { FcUuidAuth } from '../../api/account-servers/flowcrypt-com-api.js';

export type EmailProvider = 'gmail';
type GoogleAuthScopesNames = [keyof typeof GoogleAuth.OAUTH.scopes, keyof typeof GoogleAuth.OAUTH.legacy_scopes][number];

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

export type AccountIndex = 'keys' | 'notification_setup_needed_dismissed' | 'email_provider' | 'google_token_access' | 'google_token_expires' | 'google_token_scopes' |
  'google_token_refresh' | 'hide_message_password' | 'sendAs' |
  'pubkey_sent_to' | 'full_name' | 'cryptup_enabled' | 'setup_done' |
  'successfully_received_at_leat_one_message' | 'notification_setup_done_seen' | 'picture' |
  'outgoing_language' | 'setup_date' | 'openid' | 'tmp_submit_main' | 'tmp_submit_all' | 'uuid' | 'use_rich_text' | 'rules' |
  'fesUrl' | 'fesAccessToken';

export type SendAsAlias = {
  isPrimary: boolean;
  isDefault?: boolean;
  name?: string | null;
  footer?: string | null;
};

export type AcctStoreDict = {
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
  pubkey_sent_to?: string[];
  full_name?: string;
  cryptup_enabled?: boolean;
  setup_done?: boolean;
  successfully_received_at_leat_one_message?: boolean;
  notification_setup_done_seen?: boolean;
  picture?: string; // google image
  outgoing_language?: 'EN' | 'DE';
  setup_date?: number;
  use_rich_text?: boolean;
  openid?: GmailRes.OpenId;
  uuid?: string;
  rules?: DomainRulesJson;
  fesUrl?: string; // url where FlowCrypt Enterprise Server is deployed
  fesAccessToken?: string;
  // temporary
  tmp_submit_main?: boolean;
  tmp_submit_all?: boolean;
};

/**
 * Local storage of data related to a particular email account
 */
export class AcctStore extends AbstractStore {

  public static get = async (acctEmail: string, keys: AccountIndex[]): Promise<AcctStoreDict> => {
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
    const storageObj = await storageLocalGet(AcctStore.singleScopeRawIndexArr(acctEmail, keys)) as RawStore;
    const result = AcctStore.buildSingleAccountStoreFromRawResults(acctEmail, storageObj) as AcctStoreDict;
    return AcctStore.fixAcctStorageResult(acctEmail, result, keys);
  }

  public static getAccounts = async (acctEmails: string[], keys: string[]): Promise<Dict<AcctStoreDict>> => {
    const storageObj = await storageLocalGet(AcctStore.manyScopesRawIndexArr(acctEmails, keys)) as RawStore;
    const resultsByAcct: Dict<AcctStoreDict> = {};
    for (const account of acctEmails) {
      resultsByAcct[account] = AcctStore.buildSingleAccountStoreFromRawResults(account, storageObj);
    }
    return resultsByAcct;
  }

  public static set = async (acctEmail: string, values: AcctStoreDict): Promise<void> => {
    if (Env.isContentScript()) {
      // extension storage can be disallowed in rare cases for content scripts throwing 'Error: Access to extension API denied.'
      // always go through bg script to avoid such errors
      return await BrowserMsg.send.bg.await.storeAcctSet({ acctEmail, values });
    }
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
      await storageLocalSet(indexedUpdateFields);
    }
    if (indexedRemoveFields.length) {
      await storageLocalRemove(indexedRemoveFields);
    }
  }

  public static authInfo = async (acctEmail: string): Promise<FcUuidAuth> => {
    const { uuid } = await AcctStore.get(acctEmail, ['uuid']);
    return { account: acctEmail, uuid };
  }

  public static remove = async (acctEmail: string, keys: AccountIndex[]) => {
    await storageLocalRemove(AcctStore.singleScopeRawIndexArr(acctEmail, keys));
  }

  public static getScopes = async (acctEmail: string): Promise<Scopes> => {
    const { google_token_scopes } = await AcctStore.get(acctEmail, ['google_token_scopes']);
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

  private static fixAcctStorageResult = (acctEmail: string, acctStore: AcctStoreDict, keys: AccountIndex[]): AcctStoreDict => {
    if (keys.includes('sendAs') && !acctStore.sendAs) {
      acctStore.sendAs = { [acctEmail]: { isPrimary: true, isDefault: true } };
    }
    return acctStore;
  }

}
