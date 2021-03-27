/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ProgressCb, ProgressCbs, ReqFmt } from '../shared/api.js';
import { Dict } from '../../core/common.js';
import { Attachment } from '../../core/attachment.js';
import { BackendAuthErr } from '../shared/api-error.js';
import { DomainRulesJson } from '../../org-rules.js';
import { AcctStore } from '../../platform/store/acct-store.js';
import { FlowCryptWebsite } from '../flowcrypt-website.js';

export type ProfileUpdate = { alias?: string, name?: string, photo?: string, intro?: string, web?: string, phone?: string, default_message_expire?: number };
export type SubscriptionLevel = 'pro' | null;
export type FcUuidAuth = { account: string, uuid: string | undefined };
export type SubscriptionInfo = { level?: SubscriptionLevel; expired?: boolean };

export namespace BackendRes {
  export type FcAccountLogin = { registered: boolean, verified: boolean };
  export type FcAccount$info = { alias: string, email: string, intro: string, name: string, photo: string, default_message_expire: number };
  export type FcAccountGet = { account: FcAccount$info, subscription: SubscriptionInfo, domain_org_rules: DomainRulesJson };
  export type FcAccountUpdate = { result: FcAccount$info, updated: boolean };
  export type FcAccountSubscribe = { subscription: SubscriptionInfo };
  export type FcAccountCheck = { email: string | null, subscription: SubscriptionInfo | null };
  export type FcMsgToken = { token: string };
  export type FcMsgUpload = { short: string, admin_code: string };
  export type FcLinkMsg = { expire: string, deleted: boolean, url: string, expired: boolean };
  export type FcLinkMe$profile = {
    alias: string | null, name: string | null, photo: string | null, intro: string | null, web: string | null,
    phone: string | null, token: string | null, subscription_level: string | null, subscription_method: string | null, email: string | null
  };
  export type ApirFcMsgExpiration = { updated: boolean };
}

export class FlowCryptComApi extends Api {

  public static loginWithOpenid = async (acctEmail: string, uuid: string, idToken: string): Promise<void> => {
    const response = await FlowCryptComApi.request<BackendRes.FcAccountLogin>('account/login', {
      account: acctEmail,
      uuid,
      token: null, // tslint:disable-line:no-null-keyword
    }, undefined, { Authorization: `Bearer ${idToken}` });
    if (response.verified !== true) {
      throw new Error('account_login with id_token did not result in successful verificaion');
    }
    await AcctStore.set(acctEmail, { uuid });
  }

  public static accountUpdate = async (fcAuth: FcUuidAuth, profileUpdate: ProfileUpdate): Promise<BackendRes.FcAccountUpdate> => {
    FlowCryptComApi.throwIfMissingUuid(fcAuth);
    return await FlowCryptComApi.request<BackendRes.FcAccountUpdate>('account/update', {
      ...fcAuth,
      ...profileUpdate
    });
  }

  public static accountGetAndUpdateLocalStore = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcAccountGet> => {
    FlowCryptComApi.throwIfMissingUuid(fcAuth);
    const r = await FlowCryptComApi.request<BackendRes.FcAccountGet>('account/get', fcAuth);
    await AcctStore.set(fcAuth.account, { rules: r.domain_org_rules });
    return r;
  }

  public static messageUpload = async (fcAuth: FcUuidAuth | undefined, encryptedDataBinary: Uint8Array, progressCb: ProgressCb): Promise<BackendRes.FcMsgUpload> => {
    const content = new Attachment({ name: 'cryptup_encrypted_message.asc', type: 'text/plain', data: encryptedDataBinary });
    return await FlowCryptComApi.request<BackendRes.FcMsgUpload>('message/upload', { content, ...(fcAuth || {}) }, 'FORM', undefined, { upload: progressCb });
  }

  public static messageToken = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcMsgToken> => {
    FlowCryptComApi.throwIfMissingUuid(fcAuth);
    return await FlowCryptComApi.request<BackendRes.FcMsgToken>('message/token', { ...fcAuth });
  }

  public static messageExpiration = async (fcAuth: FcUuidAuth, adminCodes: string[], addDays?: number): Promise<BackendRes.ApirFcMsgExpiration> => {
    FlowCryptComApi.throwIfMissingUuid(fcAuth);
    return await FlowCryptComApi.request<BackendRes.ApirFcMsgExpiration>('message/expiration', {
      ...fcAuth,
      admin_codes: adminCodes,
      add_days: addDays || null, // tslint:disable-line:no-null-keyword
    });
  }

  public static linkMessage = async (short: string): Promise<BackendRes.FcLinkMsg> => {
    return await FlowCryptComApi.request<BackendRes.FcLinkMsg>('link/message', {
      short,
    });
  }

  private static request = async <RT>(path: string, vals: Dict<any>, fmt: ReqFmt = 'JSON', addHeaders: Dict<string> = {}, progressCbs?: ProgressCbs): Promise<RT> => {
    return await FlowCryptComApi.apiCall(FlowCryptWebsite.url('api'), path, vals, fmt, progressCbs, { 'api-version': '3', ...addHeaders });
  }

  private static throwIfMissingUuid = (fcAuth: FcUuidAuth) => {
    if (!fcAuth.uuid) {
      throw new BackendAuthErr('Please log into FlowCrypt account first');
    }
  }

}
