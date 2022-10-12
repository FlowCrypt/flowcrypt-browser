/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ProgressCb, ProgressCbs, ReqFmt } from '../shared/api.js';
import { Dict } from '../../core/common.js';
import { Attachment } from '../../core/attachment.js';
import { ClientConfigurationJson } from '../../client-configuration.js';
import { AcctStore } from '../../platform/store/acct-store.js';
import { FlowCryptWebsite } from '../flowcrypt-website.js';

export type ProfileUpdate = { alias?: string, name?: string, photo?: string, intro?: string, web?: string, phone?: string, default_message_expire?: number };

export namespace BackendRes {
  export type FcAccountLogin = { registered: boolean, verified: boolean };
  export type FcAccount$info = { alias?: string | null, default_message_expire: number };
  export type FcAccountGet = { account: FcAccount$info, domain_org_rules: ClientConfigurationJson };
  export type FcAccountUpdate = { result: FcAccount$info, updated: boolean };
  export type FcAccountCheck = { email: string | null };
  export type FcMsgToken = { token: string };
  export type FcMsgUpload = { url: string };
  export type FcLinkMsg = { expire: string, deleted: boolean, url: string, expired: boolean };
  export type FcLinkMe$profile = {
    alias: string | null, name: string | null, photo: string | null, intro: string | null, web: string | null,
    phone: string | null, token: string | null, email: string | null
  };
  export type ApirFcMsgExpiration = { updated: boolean };
}

export class FlowCryptComApi extends Api {

  private static getAuthorizationHeader = (idToken: string) => {
    return { Authorization: `Bearer ${idToken}` };
  };

  public static loginWithOpenid = async (idToken: string): Promise<void> => {
    const response = await FlowCryptComApi.request<BackendRes.FcAccountLogin>('account/login', {
      token: null, // tslint:disable-line:no-null-keyword
    }, undefined, this.getAuthorizationHeader(idToken));
    if (response.verified !== true) {
      throw new Error('account_login with id_token did not result in successful verificaion');
    }
  };

  public static accountUpdate = async (idToken: string, profileUpdate: ProfileUpdate): Promise<BackendRes.FcAccountUpdate> => {
    return await FlowCryptComApi.request<BackendRes.FcAccountUpdate>('account/update', {
      ...profileUpdate
    }, undefined,);
  };

  public static accountGetAndUpdateLocalStore = async (idToken: string): Promise<BackendRes.FcAccountGet> => {
    const r = await FlowCryptComApi.request<BackendRes.FcAccountGet>('account/get', {}, undefined, this.getAuthorizationHeader(idToken));
    await AcctStore.set(fcAuth.account, { rules: r.domain_org_rules });
    return r;
  };

  public static messageUpload = async (idToken: string, encryptedDataBinary: Uint8Array, progressCb: ProgressCb): Promise<BackendRes.FcMsgUpload> => {
    const content = new Attachment({ name: 'cryptup_encrypted_message.asc', type: 'text/plain', data: encryptedDataBinary });
    const rawResponse = await FlowCryptComApi.request<{ short: string }>('message/upload', { content }, 'FORM', undefined, { upload: progressCb, ...this.getAuthorizationHeader(idToken) });
    if (!rawResponse.short) {
      throw new Error('Unexpectedly missing message upload short id');
    }
    // careful - this API request returns `url` as well, but that is URL of the S3 object, not of web portal page
    // therefore we are constructing URL ourselves to point to web portal
    return { url: `https://flowcrypt.com/${rawResponse.short}` };
  };

  public static messageToken = async (idToken: string): Promise<BackendRes.FcMsgToken> => {
    return await FlowCryptComApi.request<BackendRes.FcMsgToken>('message/token', {}, undefined, this.getAuthorizationHeader(idToken));
  };

  private static request = async <RT>(path: string, vals: Dict<any>, fmt: ReqFmt = 'JSON', addHeaders: Dict<string> = {}, progressCbs?: ProgressCbs): Promise<RT> => {
    return await FlowCryptComApi.apiCall(FlowCryptWebsite.url('api'), path, vals, fmt, progressCbs, { 'api-version': '3', ...addHeaders });
  };

}
