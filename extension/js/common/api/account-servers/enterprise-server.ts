/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ReqMethod } from '../shared/api.js';
import { AcctStore } from '../../platform/store/acct-store.js';
import { FlowCryptComApi } from './flowcrypt-com-api.js';
import { Dict } from '../../core/common.js';

// todo - decide which tags to use
type EventTag = 'compose' | 'decrypt' | 'setup' | 'settings' | 'import-pub' | 'import-prv';

namespace FesRes {
  export type AccessToken = { accessToken: string };
}

/**
 * FlowCrypt Enterprise Server (FES) may be deployed on-prem by enterprise customers.
 * This gives them more control. All OrgRules, log collectors, etc (as implemented) would then be handled by the FES.
 * Once fully integrated, this will allow customers to be fully independent of flowcrypt.com/api
 *
 * WIP - currently unused, unfinished
 */
// ts-prune-ignore-next
export class EnterpriseServer extends Api {

  private fesUrl: string

  constructor(fesUrl: string, private acctEmail: string) {
    super();
    this.fesUrl = fesUrl.replace(/\/$/, '');
  }

  public loginWithOpenid = async (idToken: string): Promise<void> => {
    const response = await this.request<FesRes.AccessToken>('GET', '/api/account/access-token', { Authorization: `Bearer ${idToken}` });
    await AcctStore.set(this.acctEmail, { fesAccessToken: response.accessToken });
  }

  public reportException = async (/* e: any */): Promise<void> => {
    throw Error('EnterpriseServer.reportException not implemented');
    // const formattedException = Catch.formatExceptionForReport(...)
    // await this.request<void>('POST', '/api/log-collector/exception', await this.authHdr());
  }

  public reportEvent = async (tags: EventTag[], message: string, details?: string): Promise<void> => {
    await this.request<void>('POST', '/api/log-collector/exception', await this.authHdr(), { tags, message, details });
  }

  // public accountUpdate = async (fcAuth: FcUuidAuth, profileUpdate: ProfileUpdate): Promise<BackendRes.FcAccountUpdate> => {
  //   // noop
  // }

  // public accountGetAndUpdateLocalStore = async (fcAuth: FcUuidAuth): Promise<BackendRes.FcAccountGet> => {
  //   FlowCryptComApi.throwIfMissingUuid(fcAuth);
  //   const r = await FlowCryptComApi.request<BackendRes.FcAccountGet>('account/get', fcAuth);
  //   await AcctStore.set(fcAuth.account, { rules: r.domain_org_rules, subscription: r.subscription });
  //   return r;
  // }

  private authHdr = async (): Promise<Dict<string>> => {
    const { fesAccessToken } = await AcctStore.get(this.acctEmail, ['fesAccessToken']);
    return { Authorization: `Bearer ${fesAccessToken}` };
  }

  private request = async <RT>(method: ReqMethod, path: string, headers: Dict<string> = {}, vals?: Dict<any>): Promise<RT> => {
    return await FlowCryptComApi.apiCall(this.fesUrl, path, vals, 'JSON', undefined, headers, 'json', method);
  }

}
