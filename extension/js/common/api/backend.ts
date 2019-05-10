/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal

'use strict';

import { Api, ReqFmt, ProgressCb } from './api.js';
import { Dict, Value } from '../core/common.js';
import { PaymentMethod } from '../account.js';
import { Store, GlobalStore, Subscription } from '../platform/store.js';
import { Catch } from '../platform/catch.js';
import { Att } from '../core/att.js';
import { Ui } from '../browser.js';
import { Buf } from '../core/buf.js';
import { Pgp } from '../core/pgp.js';

type FcAuthToken = { account: string, token: string };
type FcAuthMethods = 'uuid' | FcAuthToken | null;
type SubscriptionLevel = 'pro' | null;
type ProfileUpdate = { alias?: string, name?: string, photo?: string, intro?: string, web?: string, phone?: string, default_message_expire?: number };

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

  private static call = (path: string, vals: Dict<any>, fmt: ReqFmt = 'JSON'): Promise<any> => {
    return Backend.apiCall(Backend.url('api'), path, vals, fmt, undefined, { 'api-version': '3' });
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

  public static helpFeedback = (acctEmail: string, message: string): Promise<BackendRes.FcHelpFeedback> => Backend.call('help/feedback', {
    email: acctEmail,
    message,
  })

  public static helpUninstall = (email: string, client: string): Promise<unknown> => Backend.call('help/uninstall', {
    email,
    client,
    metrics: null, // tslint:disable-line:no-null-keyword
  })

  public static accountLogin = async (acctEmail: string, token?: string): Promise<{ verified: boolean, subscription: SubscriptionInfo }> => {
    const authInfo = await Store.authInfo();
    const uuid = authInfo.uuid || await Pgp.hash.sha1UtfStr(Pgp.password.random());
    const account = authInfo.acctEmail || acctEmail;
    const response = await Backend.call('account/login', {
      account,
      uuid,
      token: token || null, // tslint:disable-line:no-null-keyword
    }) as BackendRes.FcAccountLogin;
    if (response.registered !== true) {
      throw new Error('account_login did not result in successful registration');
    }
    await Store.setGlobal({ cryptup_account_email: account, cryptup_account_uuid: uuid, cryptup_account_subscription: response.subscription });
    return { verified: response.verified === true, subscription: response.subscription };
  }

  public static accountCheck = (emails: string[]) => Backend.call('account/check', {
    emails,
  }) as Promise<BackendRes.FcAccountCheck>

  public static accountCheckSync = async () => { // callbacks true on updated, false not updated, null for could not fetch
    const emails = await Store.acctEmailsGet();
    if (emails.length) {
      const response = await Backend.accountCheck(emails);
      const authInfo = await Store.authInfo();
      const subscription = await Store.subscription();
      const globalStoreUpdate: GlobalStore = {};
      if (response.email) {
        if (response.email !== authInfo.acctEmail) {
          // will fail auth when used on server, user will be prompted to verify this new device when that happens
          globalStoreUpdate.cryptup_account_email = response.email;
          globalStoreUpdate.cryptup_account_uuid = await Pgp.hash.sha1UtfStr(Pgp.password.random());
        }
      } else {
        if (authInfo.acctEmail) {
          globalStoreUpdate.cryptup_account_email = undefined;
          globalStoreUpdate.cryptup_account_uuid = undefined;
        }
      }
      Subscription.updateSubscriptionGlobalStore(globalStoreUpdate, subscription, response.subscription);
      if (Object.keys(globalStoreUpdate).length) {
        Catch.log('updating account subscription from ' + subscription.level + ' to ' + (response.subscription ? response.subscription.level : undefined), response);
        await Store.setGlobal(globalStoreUpdate);
        return true;
      } else {
        return false;
      }
    }
    return undefined;
  }

  public static accountUpdate = async (profileUpdate: ProfileUpdate = {}): Promise<BackendRes.FcAccountUpdate> => {
    const { acctEmail: account, uuid } = await Store.authInfo();
    return await Backend.call('account/update', { account, uuid, ...profileUpdate }) as BackendRes.FcAccountUpdate;
  }

  public static accountSubscribe = async (product: string, method: string, paymentSourceToken?: string): Promise<BackendRes.FcAccountSubscribe> => {
    const authInfo = await Store.authInfo();
    const response = await Backend.call('account/subscribe', {
      account: authInfo.acctEmail,
      uuid: authInfo.uuid,
      method,
      source: paymentSourceToken || null, // tslint:disable-line:no-null-keyword
      product,
    }) as BackendRes.FcAccountSubscribe;
    await Store.setGlobal({ cryptup_account_subscription: response.subscription });
    return response;
  }

  public static messagePresignFiles = async (atts: Att[], authMethod?: FcAuthMethods): Promise<BackendRes.FcMsgPresignFiles> => {
    let response: BackendRes.FcMsgPresignFiles;
    const lengths = atts.map(a => a.length);
    if (!authMethod) {
      response = await Backend.call('message/presign_files', {
        lengths,
      }) as BackendRes.FcMsgPresignFiles;
    } else if (authMethod === 'uuid') {
      const authInfo = await Store.authInfo();
      response = await Backend.call('message/presign_files', {
        account: authInfo.acctEmail,
        uuid: authInfo.uuid,
        lengths,
      }) as BackendRes.FcMsgPresignFiles;
    } else {
      response = await Backend.call('message/presign_files', {
        message_token_account: authMethod.account,
        message_token: authMethod.token,
        lengths,
      }) as BackendRes.FcMsgPresignFiles;
    }
    if (response.approvals && response.approvals.length === atts.length) {
      return response;
    }
    throw new Error('Could not verify that all files were uploaded properly, please try again.');
  }

  public static messageConfirmFiles = (identifiers: string[]): Promise<BackendRes.FcMsgConfirmFiles> => Backend.call('message/confirm_files', {
    identifiers,
  })

  public static messageUpload = async (encryptedDataArmored: string, authMethod?: FcAuthMethods): Promise<BackendRes.FcMsgUpload> => { // todo - DEPRECATE THIS. Send as JSON to message/store
    if (encryptedDataArmored.length > 100000) {
      throw new Error('Message text should not be more than 100 KB. You can send very long texts as attachments.');
    }
    const content = new Att({ name: 'cryptup_encrypted_message.asc', type: 'text/plain', data: Buf.fromUtfStr(encryptedDataArmored) });
    if (!authMethod) {
      return await Backend.call('message/upload', { content }, 'FORM') as BackendRes.FcMsgUpload;
    } else {
      const authInfo = await Store.authInfo();
      return await Backend.call('message/upload', { account: authInfo.acctEmail, uuid: authInfo.uuid, content }, 'FORM') as BackendRes.FcMsgUpload;
    }
  }

  public static messageToken = async (): Promise<BackendRes.FcMsgToken> => {
    const authInfo = await Store.authInfo();
    return await Backend.call('message/token', { account: authInfo.acctEmail, uuid: authInfo.uuid }) as BackendRes.FcMsgToken;
  }

  public static messageExpiration = async (adminCodes: string[], addDays?: number): Promise<BackendRes.ApirFcMsgExpiration> => {
    const authInfo = await Store.authInfo();
    return await Backend.call('message/expiration', {
      account: authInfo.acctEmail,
      uuid: authInfo.uuid,
      admin_codes: adminCodes,
      add_days: addDays || null, // tslint:disable-line:no-null-keyword
    }) as BackendRes.ApirFcMsgExpiration;
  }

  public static messageReply = (short: string, token: string, from: string, to: string, subject: string, message: string): Promise<unknown> => Backend.call('message/reply', {
    short,
    token,
    from,
    to,
    subject,
    message,
  })

  public static messageContact = (sender: string, message: string, messageToken: FcAuthToken): Promise<unknown> => Backend.call('message/contact', {
    message_token_account: messageToken.account,
    message_token: messageToken.token,
    sender,
    message,
  })

  public static linkMessage = (short: string): Promise<BackendRes.FcLinkMsg> => Backend.call('link/message', {
    short,
  })

  public static linkMe = (alias: string): Promise<BackendRes.FcLinkMe> => Backend.call('link/me', {
    alias,
  })

  public static retreiveBlogPosts = async (): Promise<BackendRes.FcBlogPost[]> => {
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
      fields.file = new Att({ name: 'encrpted_attachment', type: 'application/octet-stream', data: items[i].att.getData() });
      promises.push(Api.apiCall(items[i].baseUrl, '', fields, 'FORM', {
        upload: (singleFileProgress: number) => {
          progress[i] = singleFileProgress;
          Ui.event.prevent('spree', () => progressCb(Value.arr.average(progress)))();
        }
      }));
    }
    return Promise.all(promises);
  }

}
