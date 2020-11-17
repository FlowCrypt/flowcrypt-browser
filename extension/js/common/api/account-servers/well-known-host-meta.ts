/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../../core/buf.js';
import { FLAVOR } from '../../core/const.js';
import { OrgRules } from '../../org-rules.js';
import { Catch } from '../../platform/catch.js';
import { AcctStore } from '../../platform/store/acct-store.js';
import { Api } from '../shared/api.js';
import { ApiErr } from '../shared/api-error.js';
import { FesRes, EnterpriseServer } from './enterprise-server.js';

type HostMetaResponse = { links?: { rel?: string, href?: string }[] }

export class WellKnownHostMeta extends Api {

  private domain: string;
  private hostMetaUrl: string;
  private fesRel = 'https://flowcrypt.com/fes';
  private laxCheck = ['dmFsZW8uY29t'];

  constructor(private acctEmail: string) {
    super();
    this.domain = acctEmail.toLowerCase().split('@').pop()!;
    const local = acctEmail.toLowerCase().split('@')[0]!;
    // useful for mocked tests. Also customer could serve meta file dynamically based on user (but no customer did yet)
    this.hostMetaUrl = `https://${this.domain}/.well-known/host-meta.json?local=${local}`;
  }

  public fetchAndCacheFesUrl = async (): Promise<string | undefined> => {
    if (OrgRules.isPublicEmailProviderDomain(this.domain)) {
      await this.setFesUrlToCache(undefined);
      return undefined;
    }
    const responseBuf = await this.attemptToFetchFesUrlIgnoringErrorsOnConsumerFlavor();
    if (responseBuf) {
      const hostMetaResponse = this.parseBufAsHostMetaResponseIgnoringErrorsOnConsumerFlavor(responseBuf);
      const fesUrl = hostMetaResponse?.links?.find(link => link.rel === this.fesRel)?.href;
      await this.setFesUrlToCache(fesUrl);
      return fesUrl;
    }
    const standardFesUrl = `https://fes.${this.domain}`;
    const fesServiceInfo = await this.tryCallingFesDirectlyIgnoringErrorsOnConsumerFlavor(standardFesUrl);
    if (fesServiceInfo && fesServiceInfo.service === 'enterprise-server') {
      await this.setFesUrlToCache(standardFesUrl);
      return standardFesUrl;
    }
    await this.setFesUrlToCache(undefined);
    return undefined;
  }

  public getFesUrlFromCache = async (): Promise<string | undefined> => {
    const { fesUrl } = await AcctStore.get(this.acctEmail, ['fesUrl']);
    return fesUrl;
  }

  private tryCallingFesDirectlyIgnoringErrorsOnConsumerFlavor = async (fesUrl: string): Promise<FesRes.ServiceInfo | undefined> => {
    const fes = new EnterpriseServer(fesUrl, this.acctEmail);
    try {
      return await fes.getServiceInfo();
    } catch (e) {
      if (FLAVOR === 'consumer' || ApiErr.isNotFound(e)) {
        return;
      } else if (this.laxCheck.includes(btoa(this.domain)) && ApiErr.isNetErr(e)) {
        return undefined; // cannot reach server for enterprises where we don't expect to find it
      } else {
        throw e; // strict enterprise
      }
    }
  }

  private setFesUrlToCache = async (fesUrl: string | undefined): Promise<void> => {
    if (fesUrl) {
      await AcctStore.set(this.acctEmail, { fesUrl });
    } else {
      await AcctStore.remove(this.acctEmail, ['fesUrl']);
    }
  }

  private parseBufAsHostMetaResponseIgnoringErrorsOnConsumerFlavor = (response: Buf): HostMetaResponse | undefined => {
    try {
      const parsed = JSON.parse(response.toUtfStr('strict'));
      if (this.isHostMetaResponse(parsed)) {
        return parsed;
      } else {
        if (FLAVOR === 'enterprise') {
          throw Error(`unexpected json structure`);
        } else {
          return undefined;
        }
      }
    } catch (e) {
      if (FLAVOR === 'enterprise') {
        throw Catch.rewrapErr(e, `Enterprise host meta file at ${this.hostMetaUrl} has wrong format`);
      } else { // consumer
        return undefined;
      }
    }
  }

  private attemptToFetchFesUrlIgnoringErrorsOnConsumerFlavor = async (): Promise<Buf | undefined> => {
    try {
      const r = await Api.download(this.hostMetaUrl, undefined, 10);
      if (!r.length) {
        if (!r.length && FLAVOR === 'enterprise') {
          throw Error(`Enterprise host meta url ${this.hostMetaUrl} returned empty 200 response`);
        } else { // consumer
          return undefined;
        }
      }
      return r;
    } catch (e) {
      if (FLAVOR === 'enterprise') { // stricter processing because cannot afford to NOT fetch this information if it's there
        if (ApiErr.isNotFound(e)) { // we positively checked that it's not there
          return undefined;
        }
        throw e;
      } else { // 'consumer' - more lax processing because we are querying a server that may not be expecting to be queried this way
        if (ApiErr.isNotFound(e) || ApiErr.isBadReq(e) || ApiErr.isServerErr(e) || ApiErr.isNetErr(e) || ApiErr.isAuthErr(e)) {
          return undefined;
        }
        Catch.reportErr(Catch.rewrapErr(e, '(silently ignored) failed to retrieve host-meta file for unknown reason on consumer version'));
        return undefined;
      }
    }
  }

  private isHostMetaResponse = (obj: any): obj is HostMetaResponse => {
    if (!obj || typeof obj !== 'object') {
      return false;
    }
    if (!(obj as HostMetaResponse).links) {
      return true; // "properly structured", just no info in it
    }
    if (!Array.isArray((obj as HostMetaResponse).links)) {
      return false; // not properly structured, supposed to be an optional array
    }
    if (!(obj as HostMetaResponse).links!.length) {
      return true; // empty array ok
    }
    for (const item of (obj as HostMetaResponse).links!) {
      if (typeof item.rel !== 'undefined' && typeof item.rel !== 'string') {
        return false;
      }
    }
    return true;
  }
}
