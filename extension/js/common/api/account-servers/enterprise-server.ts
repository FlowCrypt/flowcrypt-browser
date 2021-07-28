/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ProgressCb, ReqMethod } from '../shared/api.js';
import { AcctStore } from '../../platform/store/acct-store.js';
import { BackendRes, ProfileUpdate } from './flowcrypt-com-api.js';
import { Dict } from '../../core/common.js';
import { ErrorReport, UnreportableError } from '../../platform/catch.js';
import { ApiErr } from '../shared/api-error.js';
import { FLAVOR } from '../../core/const.js';
import { Attachment } from '../../core/attachment.js';

// todo - decide which tags to use
type EventTag = 'compose' | 'decrypt' | 'setup' | 'settings' | 'import-pub' | 'import-prv';

export namespace FesRes {
  export type AccessToken = { accessToken: string };
  export type ReplyToken = { replyToken: string };
  export type MessageUpload = { url: string };
  export type ServiceInfo = { vendor: string, service: string, orgId: string, version: string, apiVersion: string }
}

/**
 * FlowCrypt Enterprise Server (FES) may be deployed on-prem by enterprise customers.
 * This gives them more control. All OrgRules, log collectors, etc (as implemented) would then be handled by the FES.
 * Once fully integrated, this will allow customers to be fully independent of flowcrypt.com/api
 *
 * WIP - currently unused
 */
// ts-prune-ignore-next
export class EnterpriseServer extends Api {

  public url: string

  private domain: string
  private apiVersion = 'v1';
  private domainsThatUseLaxFesCheckEvenOnEnterprise = ['dmFsZW8uY29t'];

  constructor(private acctEmail: string) {
    super();
    this.domain = acctEmail.toLowerCase().split('@').pop()!;
    this.url = `https://fes.${this.domain}`;
  }

  /**
   * This is run during user/extension setup to figure out if this extension should be using FES or not.
   */
  public isFesInstalledAndAvailable = async (): Promise<boolean> => {
    if (['gmail.com', 'yahoo.com', 'outlook.com', 'live.com'].includes(this.domain)) {
      // no FES expected on fes.gmail.com and similar
      return false;
    }
    try {
      // regardless if this is enterprise or consumer flavor, if FES is available, return yes
      return (await this.getServiceInfo()).service === 'enterprise-server';
    } catch (e) { // FES not available
      if (ApiErr.isNotFound(e)) {
        return false; // a 404 returned where FES should be is an affirmative no - FES will not be used
      }
      if (FLAVOR === 'consumer') {
        // this is a consumer flavor. Consumers are not expected to run FES, therefore
        //   a server not responding (or returning an error) is considered as no FES
        return false;
      } else if (this.domainsThatUseLaxFesCheckEvenOnEnterprise.includes(btoa(this.domain)) && ApiErr.isNetErr(e)) {
        // on some domains we don't expect FES running. This allows even enterprise flavor
        //   extension to skip FES integration on these domains.
        return false;
      } else if (this.domain.endsWith('.test')) {
        // enterprise flavor on a test domain should not require FES running (to satisfy tests)
        return false;
      } else {
        throw e;
      }
    }
  }

  public getServiceInfo = async (): Promise<FesRes.ServiceInfo> => {
    return await this.request<FesRes.ServiceInfo>('GET', `/api/`);
  }

  public getAccessTokenAndUpdateLocalStore = async (idToken: string): Promise<void> => {
    const response = await this.request<FesRes.AccessToken>('GET', `/api/${this.apiVersion}/account/access-token`, { Authorization: `Bearer ${idToken}` });
    await AcctStore.set(this.acctEmail, { fesAccessToken: response.accessToken });
  }

  public getAccountAndUpdateLocalStore = async (): Promise<BackendRes.FcAccountGet> => {
    const r = await this.request<BackendRes.FcAccountGet>('GET', `/api/${this.apiVersion}/account/`, await this.authHdr());
    await AcctStore.set(this.acctEmail, { rules: r.domain_org_rules });
    return r;
  }

  public reportException = async (errorReport: ErrorReport): Promise<void> => {
    await this.request<void>('POST', `/api/${this.apiVersion}/log-collector/exception`, await this.authHdr(), errorReport);
  }

  public reportEvent = async (tags: EventTag[], message: string, details?: string): Promise<void> => {
    await this.request<void>('POST', `/api/${this.apiVersion}/log-collector/exception`, await this.authHdr(), { tags, message, details });
  }

  public webPortalMessageNewReplyToken = async (): Promise<FesRes.ReplyToken> => {
    return await this.request<FesRes.ReplyToken>('POST', `/api/${this.apiVersion}/message/new-reply-token`, await this.authHdr());
  }

  public webPortalMessageUpload = async (encrypted: Uint8Array, progressCb: ProgressCb): Promise<FesRes.MessageUpload> => {
    const content = new Attachment({ name: 'cryptup_encrypted_message.asc', type: 'text/plain', data: encrypted });
    return await EnterpriseServer.apiCall<FesRes.MessageUpload>(this.url, `/api/${this.apiVersion}/message`, { content },
      'FORM', { upload: progressCb }, await this.authHdr(), 'json', 'POST');
  }

  public accountUpdate = async (profileUpdate: ProfileUpdate): Promise<BackendRes.FcAccountUpdate> => {
    console.log('profile update ignored', profileUpdate);
    throw new UnreportableError('Account update not implemented when using FlowCrypt Enterprise Server');
  }

  private authHdr = async (): Promise<Dict<string>> => {
    const { fesAccessToken } = await AcctStore.get(this.acctEmail, ['fesAccessToken']);
    return { Authorization: `Bearer ${fesAccessToken}` };
  }

  private request = async <RT>(method: ReqMethod, path: string, headers: Dict<string> = {}, vals?: Dict<any>): Promise<RT> => {
    return await EnterpriseServer.apiCall(this.url, path, vals, method === 'GET' ? undefined : 'JSON', undefined, headers, 'json', method);
  }

}
