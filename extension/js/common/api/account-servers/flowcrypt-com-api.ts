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
  export type FcAccount$info = { alias?: string | null, default_message_expire: number };
  export type FcAccountGet = { account: FcAccount$info, subscription: SubscriptionInfo, domain_org_rules: DomainRulesJson };
  export type FcAccountUpdate = { result: FcAccount$info, updated: boolean };
  export type FcAccountSubscribe = { subscription: SubscriptionInfo };
  export type FcAccountCheck = { email: string | null, subscription: SubscriptionInfo | null };
  export type FcMsgToken = { token: string };
  export type FcMsgUpload = { url: string };
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
    const rawResponse = await FlowCryptComApi.request<{ short: string }>('message/upload', { content, ...(fcAuth || {}) }, 'FORM', undefined, { upload: progressCb });
    if (!rawResponse.short) {
      throw new Error('Unexpectedly missing message upload short id');
    }
    // careful - this API request returns `url` as well, but that is URL of the S3 object, not of web portal page
    // therefore we are constructing URL ourselves to point to web portal
    return { url: `https://flowcrypt.com/${rawResponse.short}` };
  }

  public static messageToken = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcMsgToken> => {
    FlowCryptComApi.throwIfMissingUuid(fcAuth);
    return await FlowCryptComApi.request<BackendRes.FcMsgToken>('message/token', { ...fcAuth });
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
