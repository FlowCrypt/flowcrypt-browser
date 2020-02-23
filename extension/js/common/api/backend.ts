/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ProgressCb, ProgressCbs, ReqFmt } from './api.js';
import { Dict } from '../core/common.js';
import { Att } from '../core/att.js';
import { BACKEND_API_HOST } from '../core/const.js';
import { BackendAuthErr } from './error/api-error-types.js';
import { Catch } from '../platform/catch.js';
import { DomainRules } from '../rules.js';
import { AcctStore } from '../platform/store/acct-store.js';

type ProfileUpdate = { alias?: string, name?: string, photo?: string, intro?: string, web?: string, phone?: string, default_message_expire?: number };

export type SubscriptionLevel = 'pro' | null;
export type FcUuidAuth = { account: string, uuid: string | undefined };
export type PaymentMethod = 'stripe' | 'group' | 'trial';
export type SubscriptionInfo = { active?: boolean | null; method?: PaymentMethod | null; level?: SubscriptionLevel; expire?: string | null; expired?: boolean };
export type AwsS3UploadItem = { baseUrl: string, fields: { key: string; file?: Att }, att: Att };

export namespace BackendRes {
  export type FcHelpFeedback = { sent: boolean };
  export type FcAccountLogin = { registered: boolean, verified: boolean };
  export type FcAccount$info = { alias: string, email: string, intro: string, name: string, photo: string, default_message_expire: number };
  export type FcAccountGet = { account: FcAccount$info, subscription: SubscriptionInfo, domain_org_rules: DomainRules };
  export type FcAccountUpdate = { result: FcAccount$info, updated: boolean };
  export type FcAccountSubscribe = { subscription: SubscriptionInfo };
  export type FcAccountCheck = { email: string | null, subscription: SubscriptionInfo | null };
  export type FcBlogPost = { title: string, date: string, url: string };
  export type FcMsgToken = { token: string };
  export type FcMsgUpload = { short: string, admin_code: string };
  export type FcLinkMsg = { expire: string, deleted: boolean, url: string, expired: boolean };
  export type FcLinkMe$profile = {
    alias: string | null, name: string | null, photo: string | null, intro: string | null, web: string | null,
    phone: string | null, token: string | null, subscription_level: string | null, subscription_method: string | null, email: string | null
  };
  export type ApirFcMsgExpiration = { updated: boolean };
}

export class Backend extends Api {

  public static url = (type: 'api' | 'me' | 'pubkey' | 'decrypt' | 'web', resource = '') => {
    return ({
      api: BACKEND_API_HOST,
      me: `https://flowcrypt.com/me/${resource}`,
      pubkey: `https://flowcrypt.com/pub/${resource}`,
      decrypt: `https://flowcrypt.com/${resource}`,
      web: 'https://flowcrypt.com/',
    } as Dict<string>)[type];
  }

  public static helpFeedback = async (acctEmail: string, message: string): Promise<BackendRes.FcHelpFeedback> => {
    return await Backend.request<BackendRes.FcHelpFeedback>('help/feedback', {
      email: acctEmail,
      message,
    });
  }

  public static helpUninstall = async (email: string, client: string): Promise<unknown> => {
    return await Backend.request('help/uninstall', {
      email,
      client,
      metrics: null,
    });
  }

  // public static loginWithVerificationEmail = async (account: string, uuid: string, token: string): Promise<{ verified: boolean, subscription: SubscriptionInfo }> => {
  //   const response = await Backend.request('account/login', {
  //     account,
  //     uuid,
  //     token: token || null, // tslint:disable-line:no-null-keyword
  //   }, undefined) as BackendRes.FcAccountLogin;
  //   if (response.registered !== true) {
  //     throw new Error('account_login did not result in successful registration');
  //   }
  //   await AcctStore.setAcct(account, { uuid, subscription: response.subscription });
  //   return { verified: response.verified === true, subscription: response.subscription };
  // }

  public static loginWithOpenid = async (acctEmail: string, uuid: string, idToken: string): Promise<void> => {
    const response = await Backend.request<BackendRes.FcAccountLogin>('account/login', {
      account: acctEmail,
      uuid,
      token: null, // tslint:disable-line:no-null-keyword
    }, undefined, { Authorization: `Bearer ${idToken}` });
    if (response.registered !== true) {
      throw new Error('account_login with id_token did not result in successful registration');
    }
    if (response.verified !== true) {
      throw new Error('account_login with id_token did not result in successful verificaion');
    }
    await AcctStore.setAcct(acctEmail, { uuid });
  }

  public static getSubscriptionWithoutLogin = async (acctEmail: string) => {
    const r = await Backend.request<BackendRes.FcAccountCheck>('account/check', {
      emails: [acctEmail],
    });
    await AcctStore.setAcct(acctEmail, { subscription: r.subscription || undefined });
    return r;
  }

  public static accountUpdate = async (fcAuth: FcUuidAuth, profileUpdate: ProfileUpdate): Promise<BackendRes.FcAccountUpdate> => {
    Backend.throwIfMissingUuid(fcAuth);
    return await Backend.request<BackendRes.FcAccountUpdate>('account/update', {
      ...fcAuth,
      ...profileUpdate
    });
  }

  public static accountGetAndUpdateLocalStore = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcAccountGet> => {
    Backend.throwIfMissingUuid(fcAuth);
    const r = await Backend.request<BackendRes.FcAccountGet>('account/get', fcAuth);
    await AcctStore.setAcct(fcAuth.account, { rules: r.domain_org_rules, subscription: r.subscription });
    return r;
  }

  public static accountSubscribe = async (fcAuth: FcUuidAuth, product: string, method: string, paymentSourceToken?: string): Promise<BackendRes.FcAccountSubscribe> => {
    Backend.throwIfMissingUuid(fcAuth);
    const response = await Backend.request<BackendRes.FcAccountSubscribe>('account/subscribe', {
      ...fcAuth,
      method,
      source: paymentSourceToken || null, // tslint:disable-line:no-null-keyword
      product,
    });
    await AcctStore.setAcct(fcAuth.account, { subscription: response.subscription });
    return response;
  }

  public static messageUpload = async (fcAuth: FcUuidAuth | undefined, encryptedDataBinary: Uint8Array, progressCb: ProgressCb): Promise<BackendRes.FcMsgUpload> => {
    const content = new Att({ name: 'cryptup_encrypted_message.asc', type: 'text/plain', data: encryptedDataBinary });
    return await Backend.request<BackendRes.FcMsgUpload>('message/upload', { content, ...(fcAuth || {}) }, 'FORM', undefined, { upload: progressCb });
  }

  public static messageToken = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcMsgToken> => {
    Backend.throwIfMissingUuid(fcAuth);
    return await Backend.request<BackendRes.FcMsgToken>('message/token', { ...fcAuth });
  }

  public static messageExpiration = async (fcAuth: FcUuidAuth, adminCodes: string[], addDays?: number): Promise<BackendRes.ApirFcMsgExpiration> => {
    Backend.throwIfMissingUuid(fcAuth);
    return await Backend.request<BackendRes.ApirFcMsgExpiration>('message/expiration', {
      ...fcAuth,
      admin_codes: adminCodes,
      add_days: addDays || null, // tslint:disable-line:no-null-keyword
    });
  }

  public static linkMessage = async (short: string): Promise<BackendRes.FcLinkMsg> => {
    return await Backend.request<BackendRes.FcLinkMsg>('link/message', {
      short,
    });
  }

  public static retrieveBlogPosts = async (): Promise<BackendRes.FcBlogPost[]> => {
    return await Api.ajax({ url: 'https://flowcrypt.com/feed', dataType: 'json' }, Catch.stackTrace()) as BackendRes.FcBlogPost[]; // tslint:disable-line:no-direct-ajax
  }

  private static request = async <RT>(path: string, vals: Dict<any>, fmt: ReqFmt = 'JSON', addHeaders: Dict<string> = {}, progressCbs?: ProgressCbs): Promise<RT> => {
    return await Backend.apiCall(Backend.url('api'), path, vals, fmt, progressCbs, { 'api-version': '3', ...addHeaders });
  }

  private static throwIfMissingUuid = (fcAuth: FcUuidAuth) => {
    if (!fcAuth.uuid) {
      throw new BackendAuthErr('Please log into FlowCrypt account first');
    }
  }

}
