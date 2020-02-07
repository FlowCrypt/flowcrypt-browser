/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ProgressCb, ProgressCbs, ReqFmt } from './api.js';
import { Dict, Value } from '../core/common.js';
import { Att } from '../core/att.js';
import { BACKEND_API_HOST } from '../core/const.js';
import { BackendAuthErr } from './error/api-error-types.js';
import { Catch } from '../platform/catch.js';
import { DomainRules } from '../rules.js';
import { Store } from '../platform/store.js';
import { Ui } from '../browser/ui.js';

type ProfileUpdate = { alias?: string, name?: string, photo?: string, intro?: string, web?: string, phone?: string, default_message_expire?: number };
type FcAuthToken = { account: string, token: string };
type FcMsgTokenAuth = { message_token_account: string, token: string };

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
  export type FcMsgPresignFiles = { approvals: { base_url: string, fields: { key: string } }[] };
  export type FcMsgConfirmFiles = { confirmed: string[], admin_codes: string[] };
  export type FcMsgToken = { token: string };
  export type FcMsgUpload = { short: string, admin_code: string };
  export type FcLinkMsg = { expire: string, deleted: boolean, url: string, expired: boolean };
  export type FcLinkMe$profile = {
    alias: string | null, name: string | null, photo: string | null, intro: string | null, web: string | null,
    phone: string | null, token: string | null, subscription_level: string | null, subscription_method: string | null, email: string | null
  };
  export type FcLinkMe = { profile: null | FcLinkMe$profile };
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
  //   await Store.setAcct(account, { uuid, subscription: response.subscription });
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
    await Store.setAcct(acctEmail, { uuid });
  }

  public static getSubscriptionWithoutLogin = async (acctEmail: string) => {
    const r = await Backend.request<BackendRes.FcAccountCheck>('account/check', {
      emails: [acctEmail],
    });
    await Store.setAcct(acctEmail, { subscription: r.subscription || undefined });
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
    await Store.setAcct(fcAuth.account, { rules: r.domain_org_rules, subscription: r.subscription });
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
    await Store.setAcct(fcAuth.account, { subscription: response.subscription });
    return response;
  }

  public static messagePresignFiles = async (fcAuth: FcUuidAuth | FcMsgTokenAuth | undefined, atts: Att[]): Promise<BackendRes.FcMsgPresignFiles> => {
    const response = await Backend.request<BackendRes.FcMsgPresignFiles>('message/presign_files', {
      lengths: atts.map(a => a.length),
      ...(fcAuth || {})
    });
    if (response.approvals && response.approvals.length === atts.length) {
      return response;
    }
    throw new Error('Could not verify that all files were uploaded properly, please try again.');
  }

  public static messageConfirmFiles = async (identifiers: string[]): Promise<BackendRes.FcMsgConfirmFiles> => {
    return await Backend.request<BackendRes.FcMsgConfirmFiles>('message/confirm_files', {
      identifiers,
    });
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

  public static messageReply = async (short: string, token: string, from: string, to: string, subject: string, message: string): Promise<unknown> => {
    return await Backend.request('message/reply', {
      short,
      token,
      from,
      to,
      subject,
      message,
    });
  }

  public static messageContact = async (sender: string, message: string, messageToken: FcAuthToken): Promise<unknown> => {
    return await Backend.request('message/contact', {
      message_token_account: messageToken.account,
      message_token: messageToken.token,
      sender,
      message,
    });
  }

  public static linkMessage = async (short: string): Promise<BackendRes.FcLinkMsg> => {
    return await Backend.request<BackendRes.FcLinkMsg>('link/message', {
      short,
    });
  }

  public static linkMe = async (alias: string): Promise<BackendRes.FcLinkMe> => {
    return await Backend.request<BackendRes.FcLinkMe>('link/me', {
      alias,
    });
  }

  public static retrieveBlogPosts = async (): Promise<BackendRes.FcBlogPost[]> => {
    return await Api.ajax({ url: 'https://flowcrypt.com/feed', dataType: 'json' }, Catch.stackTrace()) as BackendRes.FcBlogPost[]; // tslint:disable-line:no-direct-ajax
  }

  public static s3Upload = async (items: AwsS3UploadItem[], progressCb: ProgressCb) => {
    const progress = Value.arr.zeroes(items.length);
    if (!items.length) {
      return [];
    }
    const promises: Promise<void>[] = [];
    for (const i of items.keys()) {
      const fields = items[i].fields;
      fields.file = new Att({ name: 'encrypted_attachment', type: 'application/octet-stream', data: items[i].att.getData() });
      promises.push(Api.apiCall(items[i].baseUrl, '', fields, 'FORM', {
        upload: (singleFileProgress: number) => {
          progress[i] = singleFileProgress;
          Ui.event.prevent('spree', () => progressCb(Value.arr.average(progress), 0, 0))();
        }
      }));
    }
    return await Promise.all(promises);
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
