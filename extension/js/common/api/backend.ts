/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ReqFmt, ProgressCb } from './api.js';
import { Dict, Value } from '../core/common.js';
import { Store } from '../platform/store.js';
import { Catch } from '../platform/catch.js';
import { Att } from '../core/att.js';
import { Ui } from '../browser/ui.js';
import { Buf } from '../core/buf.js';
import { BackendAuthErr } from './error/api-error-types.js';

type SubscriptionLevel = 'pro' | null;
type ProfileUpdate = { alias?: string, name?: string, photo?: string, intro?: string, web?: string, phone?: string, default_message_expire?: number };
type FcAuthToken = { account: string, token: string };
type FcMsgTokenAuth = { message_token_account: string, token: string };

export type FcUuidAuth = { account: string, uuid: string | undefined };
export type PaymentMethod = 'stripe' | 'group' | 'trial';
export type ProductLevel = 'pro' | null;
export type ProductName = 'null' | 'trial' | 'advancedMonthly';
export type Product = { id: null | string, method: null | PaymentMethod, name: null | string, level: ProductLevel };
export type SubscriptionInfo = { active?: boolean | null; method?: PaymentMethod | null; level?: SubscriptionLevel; expire?: string | null; expired?: boolean };
export type AwsS3UploadItem = { baseUrl: string, fields: { key: string; file?: Att }, att: Att };

export namespace BackendRes {
  export type FcHelpFeedback = { sent: boolean };
  export type FcAccountLogin = { registered: boolean, verified: boolean, subscription: SubscriptionInfo };
  export type FcAccountUpdate$result = { alias: string, email: string, intro: string, name: string, photo: string, default_message_expire: number };
  export type FcAccountUpdate = { result: FcAccountUpdate$result, updated: boolean };
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

  private static request = (path: string, vals: Dict<any>, fmt: ReqFmt = 'JSON', addHeaders: Dict<string> = {}): Promise<any> => {
    return Backend.apiCall(Backend.url('api'), path, vals, fmt, undefined, { 'api-version': '3', ...addHeaders });
  }

  public static url = (type: string, variable = '') => {
    return ({
      'api': 'https://flowcrypt.com/api/',
      'me': 'https://flowcrypt.com/me/' + variable,
      'pubkey': 'https://flowcrypt.com/pub/' + variable,
      'decrypt': 'https://flowcrypt.com/' + variable,
      'web': 'https://flowcrypt.com/',
    } as Dict<string>)[type];
  }

  public static helpFeedback = (acctEmail: string, message: string): Promise<BackendRes.FcHelpFeedback> => {
    return Backend.request('help/feedback', {
      email: acctEmail,
      message,
    });
  }

  public static helpUninstall = (email: string, client: string): Promise<unknown> => {
    return Backend.request('help/uninstall', {
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

  public static loginWithOpenid = async (acctEmail: string, uuid: string, idToken: string): Promise<{ verified: boolean, subscription: SubscriptionInfo }> => {
    const response = await Backend.request('account/login', {
      account: acctEmail,
      uuid,
      token: null, // tslint:disable-line:no-null-keyword
    }, undefined, { Authorization: `Bearer ${idToken}` }) as BackendRes.FcAccountLogin;
    if (response.registered !== true) {
      throw new Error('account_login with id_token did not result in successful registration');
    }
    if (response.verified !== true) {
      throw new Error('account_login with id_token did not result in successful verificaion');
    }
    await Store.setAcct(acctEmail, { uuid, subscription: response.subscription });
    return { verified: true, subscription: response.subscription };
  }

  public static getSubscriptionWithoutLogin = async (acctEmail: string) => {
    const r = await Backend.request('account/check', {
      emails: [acctEmail],
    }) as BackendRes.FcAccountCheck;
    await Store.setAcct(acctEmail, { subscription: r.subscription || undefined });
    return r;
  }

  public static accountUpdate = async (fcAuth: FcUuidAuth, profileUpdate: ProfileUpdate = {}): Promise<BackendRes.FcAccountUpdate> => {
    Backend.throwIfMissingUuid(fcAuth);
    const r = await Backend.request('account/update', {
      ...fcAuth,
      ...profileUpdate
    }) as BackendRes.FcAccountUpdate;
    return r;
  }

  public static accountGet = (fcAuth: FcUuidAuth) => {
    return Backend.accountUpdate(fcAuth, {});
  }

  public static accountSubscribe = async (fcAuth: FcUuidAuth, product: string, method: string, paymentSourceToken?: string): Promise<BackendRes.FcAccountSubscribe> => {
    Backend.throwIfMissingUuid(fcAuth);
    const response = await Backend.request('account/subscribe', {
      ...fcAuth,
      method,
      source: paymentSourceToken || null, // tslint:disable-line:no-null-keyword
      product,
    }) as BackendRes.FcAccountSubscribe;
    await Store.setAcct(fcAuth.account, { subscription: response.subscription });
    return response;
  }

  public static messagePresignFiles = async (fcAuth: FcUuidAuth | FcMsgTokenAuth | undefined, atts: Att[]): Promise<BackendRes.FcMsgPresignFiles> => {
    const response = await Backend.request('message/presign_files', {
      lengths: atts.map(a => a.length),
      ...(fcAuth || {})
    }) as BackendRes.FcMsgPresignFiles;
    if (response.approvals && response.approvals.length === atts.length) {
      return response;
    }
    throw new Error('Could not verify that all files were uploaded properly, please try again.');
  }

  public static messageConfirmFiles = (identifiers: string[]): Promise<BackendRes.FcMsgConfirmFiles> => {
    return Backend.request('message/confirm_files', {
      identifiers,
    });
  }

  /**
   * todo - DEPRECATE THIS. Send as JSON to message/store
   */
  public static messageUpload = async (fcAuth: FcUuidAuth | undefined, encryptedDataArmored: string): Promise<BackendRes.FcMsgUpload> => {
    const content = new Att({ name: 'cryptup_encrypted_message.asc', type: 'text/plain', data: Buf.fromUtfStr(encryptedDataArmored) });
    return await Backend.request('message/upload', { content, ...(fcAuth || {}) }, 'FORM') as BackendRes.FcMsgUpload;
  }

  public static messageToken = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcMsgToken> => {
    Backend.throwIfMissingUuid(fcAuth);
    return await Backend.request('message/token', { ...fcAuth }) as BackendRes.FcMsgToken;
  }

  public static messageExpiration = async (fcAuth: FcUuidAuth, adminCodes: string[], addDays?: number): Promise<BackendRes.ApirFcMsgExpiration> => {
    Backend.throwIfMissingUuid(fcAuth);
    return await Backend.request('message/expiration', {
      ...fcAuth,
      admin_codes: adminCodes,
      add_days: addDays || null, // tslint:disable-line:no-null-keyword
    }) as BackendRes.ApirFcMsgExpiration;
  }

  public static messageReply = (short: string, token: string, from: string, to: string, subject: string, message: string): Promise<unknown> => {
    return Backend.request('message/reply', {
      short,
      token,
      from,
      to,
      subject,
      message,
    });
  }

  public static messageContact = (sender: string, message: string, messageToken: FcAuthToken): Promise<unknown> => {
    return Backend.request('message/contact', {
      message_token_account: messageToken.account,
      message_token: messageToken.token,
      sender,
      message,
    });
  }

  public static linkMessage = (short: string): Promise<BackendRes.FcLinkMsg> => {
    return Backend.request('link/message', {
      short,
    });
  }

  public static linkMe = (alias: string): Promise<BackendRes.FcLinkMe> => {
    return Backend.request('link/me', {
      alias,
    });
  }

  public static retrieveBlogPosts = async (): Promise<BackendRes.FcBlogPost[]> => {
    return Api.ajax({ url: 'https://flowcrypt.com/feed', dataType: 'json' }, Catch.stackTrace()); // tslint:disable-line:no-direct-ajax
  }

  public static s3Upload = (items: AwsS3UploadItem[], progressCb: ProgressCb) => {
    const progress = Value.arr.zeroes(items.length);
    const promises: Promise<void>[] = [];
    if (!items.length) {
      return Promise.resolve(promises);
    }
    for (const i of items.keys()) {
      const fields = items[i].fields;
      fields.file = new Att({ name: 'encrypted_attachment', type: 'application/octet-stream', data: items[i].att.getData() });
      promises.push(Api.apiCall(items[i].baseUrl, '', fields, 'FORM', {
        upload: (singleFileProgress: number) => {
          progress[i] = singleFileProgress;
          Ui.event.prevent('spree', () => progressCb(Value.arr.average(progress)))();
        }
      }));
    }
    return Promise.all(promises);
  }

  private static throwIfMissingUuid = (fcAuth: FcUuidAuth) => {
    if (!fcAuth.uuid) {
      throw new BackendAuthErr('Please log into FlowCrypt account first');
    }
  }

}
