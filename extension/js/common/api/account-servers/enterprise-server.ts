/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ReqMethod } from '../shared/api.js';
import { AcctStore } from '../../platform/store/acct-store.js';
import { BackendRes, FlowCryptComApi, ProfileUpdate } from './flowcrypt-com-api.js';
import { Dict } from '../../core/common.js';
import { ErrorReport, UnreportableError } from '../../platform/catch.js';

// todo - decide which tags to use
type EventTag = 'compose' | 'decrypt' | 'setup' | 'settings' | 'import-pub' | 'import-prv';

export namespace FesRes {
  export type AccessToken = { accessToken: string };
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

  private fesUrl: string
  private apiVersion = 'v1';

  constructor(fesUrl: string, private acctEmail: string) {
    super();
    this.fesUrl = fesUrl.replace(/\/$/, '');
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
    await AcctStore.set(this.acctEmail, { rules: r.domain_org_rules, subscription: r.subscription });
    return r;
  }

  public reportException = async (errorReport: ErrorReport): Promise<void> => {
    await this.request<void>('POST', `/api/${this.apiVersion}/log-collector/exception`, await this.authHdr(), errorReport);
  }

  public reportEvent = async (tags: EventTag[], message: string, details?: string): Promise<void> => {
    await this.request<void>('POST', `/api/${this.apiVersion}/log-collector/exception`, await this.authHdr(), { tags, message, details });
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
    return await FlowCryptComApi.apiCall(this.fesUrl, path, vals, method === 'GET' ? undefined : 'JSON', undefined, headers, 'json', method);
  }

}
