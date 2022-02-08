/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal
// tslint:disable:no-null-keyword

'use strict';

import { Api, ProgressCb, ReqMethod } from '../shared/api.js';
import { AcctStore } from '../../platform/store/acct-store.js';
import { BackendRes, ProfileUpdate } from './flowcrypt-com-api.js';
import { Dict } from '../../core/common.js';
import { ErrorReport, UnreportableError } from '../../platform/catch.js';
import { ApiErr, BackendAuthErr } from '../shared/api-error.js';
import { FLAVOR, InMemoryStoreKeys } from '../../core/const.js';
import { Attachment } from '../../core/attachment.js';
import { Recipients } from '../email-provider/email-provider-api.js';
import { Buf } from '../../core/buf.js';
import { DomainRulesJson } from '../../org-rules.js';
import { InMemoryStore } from '../../platform/store/in-memory-store.js';

// todo - decide which tags to use
type EventTag = 'compose' | 'decrypt' | 'setup' | 'settings' | 'import-pub' | 'import-prv';

export namespace FesRes {
  export type ReplyToken = { replyToken: string };
  export type MessageUpload = { url: string };
  export type ServiceInfo = { vendor: string, service: string, orgId: string, version: string, apiVersion: string };
  export type ClientConfiguration = { clientConfiguration: DomainRulesJson };
}

/**
 * FlowCrypt Enterprise Server (FES) may be deployed on-prem by enterprise customers.
 * This gives them more control. All OrgRules, log collectors, etc (as implemented) would then be handled by the FES.
 * Once fully integrated, this will allow customers to be fully independent of flowcrypt.com/api
 */
// ts-prune-ignore-next
export class EnterpriseServer extends Api {

  public url: string;

  private domain: string;
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
    if (['gmail.com', 'yahoo.com', 'outlook.com', 'live.com', 'googlemail.com'].includes(this.domain)) {
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
  };

  public getServiceInfo = async (): Promise<FesRes.ServiceInfo> => {
    return await this.request<FesRes.ServiceInfo>('GET', `/api/`);
  };

  public fetchAndSaveOrgRules = async (): Promise<DomainRulesJson> => {
    const r = await this.request<FesRes.ClientConfiguration>('GET', `/api/${this.apiVersion}/client-configuration?domain=${this.domain}`);
    await AcctStore.set(this.acctEmail, { rules: r.clientConfiguration });
    return r.clientConfiguration;
  };

  public reportException = async (errorReport: ErrorReport): Promise<void> => {
    await this.request<void>('POST', `/api/${this.apiVersion}/log-collector/exception`, await this.authHdr(), errorReport);
  };

  public reportEvent = async (tags: EventTag[], message: string, details?: string): Promise<void> => {
    await this.request<void>('POST', `/api/${this.apiVersion}/log-collector/exception`,
      await this.authHdr(), { tags, message, details });
  };

  public webPortalMessageNewReplyToken = async (): Promise<FesRes.ReplyToken> => {
    const authHdr = await this.authHdr();
    return await this.request<FesRes.ReplyToken>('POST', `/api/${this.apiVersion}/message/new-reply-token`, authHdr, {});
  };

  public webPortalMessageUpload = async (
    encrypted: Uint8Array,
    associateReplyToken: string,
    from: string,
    recipients: Recipients,
    progressCb: ProgressCb
  ): Promise<FesRes.MessageUpload> => {
    const content = new Attachment({
      name: 'encrypted.asc',
      type: 'text/plain',
      data: encrypted
    });
    const details = new Attachment({
      name: 'details.json',
      type: 'application/json',
      data: Buf.fromUtfStr(JSON.stringify({
        associateReplyToken,
        from,
        to: recipients.to || [],
        cc: recipients.cc || [],
        bcc: recipients.bcc || []
      }))
    });
    const multipartBody = { content, details };
    const authHdr = await this.authHdr();
    return await EnterpriseServer.apiCall<FesRes.MessageUpload>(
      this.url, `/api/${this.apiVersion}/message`, multipartBody, 'FORM',
      { upload: progressCb }, authHdr, 'json', 'POST'
    );
  };

  public accountUpdate = async (profileUpdate: ProfileUpdate): Promise<BackendRes.FcAccountUpdate> => {
    console.log('profile update ignored', profileUpdate);
    throw new UnreportableError('Account update not implemented when using FlowCrypt Enterprise Server');
  };

  private authHdr = async (): Promise<Dict<string>> => {
    const idToken = await InMemoryStore.get(this.acctEmail, InMemoryStoreKeys.ID_TOKEN);
    if (idToken) {
      return { Authorization: `Bearer ${idToken}` };
    }
    // user will not actually see this message, they'll see a generic login prompt
    throw new BackendAuthErr('Missing id token, please re-authenticate');
  };

  private request = async <RT>(method: ReqMethod, path: string, headers: Dict<string> = {}, vals?: Dict<any>): Promise<RT> => {
    return await EnterpriseServer.apiCall(this.url, path, vals, method === 'GET' ? undefined : 'JSON', undefined, headers, 'json', method);
  };

}
