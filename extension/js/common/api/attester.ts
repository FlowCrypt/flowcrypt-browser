/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, ReqMethod } from './api.js';
import { Dict, Str } from '../core/common.js';
import { PgpClient, PubkeySearchResult } from './pub-lookup.js';
import { ApiErr } from './error/api-error.js';
import { OrgRules } from '../org-rules.js';
import { BACKEND_API_HOST } from '../core/const.js';

type PubCallRes = { responseText: string, getResponseHeader: (n: string) => string | null };

export class Attester extends Api {

  constructor(
    private orgRules: OrgRules
  ) {
    super();
  }

  public lookupEmail = async (email: string): Promise<PubkeySearchResult> => {
    if (!this.orgRules.canLookupThisRecipientOnAttester(email)) {
      console.info(`Skipping attester lookup of ${email} because attester search on this domain is disabled.`);
      return { pubkey: null, pgpClient: null }; // tslint:disable-line:no-null-keyword
    }
    try {
      const r = await this.pubCall(`pub/${email}`);
      // when requested from the content script, `getResponseHeader` will be missing because it's not a real XMLHttpRequest we are getting back
      // because it had to go through background scripts, and objects are serialized when this happens
      // the proper fix would be to send back headers from bg along with response text, and parse it here
      if (!r.getResponseHeader) {
        return { pubkey: r.responseText, pgpClient: null }; // tslint:disable-line:no-null-keyword
      }
      return { pubkey: r.responseText, pgpClient: r.getResponseHeader('pgp-client') as PgpClient };
    } catch (e) {
      if (ApiErr.isNotFound(e)) {
        return { pubkey: null, pgpClient: null }; // tslint:disable-line:no-null-keyword
      }
      throw e;
    }
  }

  public lookupEmails = async (emails: string[]): Promise<Dict<PubkeySearchResult>> => {
    const results: Dict<PubkeySearchResult> = {};
    await Promise.all(emails.map(async (email: string) => {
      results[email] = await this.lookupEmail(email);
    }));
    return results;
  }

  public lookupFingerprint = async (fingerprintOrLongid: string) => {
    return await this.lookupEmail(fingerprintOrLongid); // the actual api accepts either email, fingerprint or longid
  }

  public replacePubkey = async (email: string, pubkey: string): Promise<string> => { // replace key assigned to a certain email with a different one
    if (!this.orgRules.canSubmitPubToAttester()) {
      throw new Error('Cannot replace pubkey at attester because your organisation rules forbid it');
    }
    const r = await this.pubCall(`pub/${email}`, 'POST', pubkey);
    return r.responseText;
  }

  public updatePubkey = async (longid: string, pubkey: string): Promise<string> => { // update key with a newer version of the same key
    if (!this.orgRules.canSubmitPubToAttester()) {
      throw new Error('Cannot update pubkey at attester because your organisation rules forbid it');
    }
    const r = await this.pubCall(`pub/${longid}`, 'PUT', pubkey);
    return r.responseText;
  }

  public initialLegacySubmit = async (email: string, pubkey: string): Promise<{ saved: boolean }> => {
    if (!this.orgRules.canSubmitPubToAttester()) {
      throw new Error('Cannot submit pubkey to attester because your organisation rules forbid it');
    }
    return await this.jsonCall<{ saved: boolean }>('initial/legacy_submit', { email: Str.parseEmail(email).email, pubkey: pubkey.trim() });
  }

  public testWelcome = async (email: string, pubkey: string): Promise<{ sent: boolean }> => {
    return await this.jsonCall<{ sent: boolean }>('test/welcome', { email, pubkey });
  }

  private jsonCall = async <RT>(path: string, values?: Dict<any>, method: ReqMethod = 'POST'): Promise<RT> => {
    return await Api.apiCall(BACKEND_API_HOST, path, values, 'JSON', undefined, { 'api-version': '3' }, 'json', method) as RT;
  }

  private pubCall = async (resource: string, method: ReqMethod = 'GET', data?: string | undefined): Promise<PubCallRes> => {
    return await Api.apiCall(BACKEND_API_HOST, resource, data, typeof data === 'string' ? 'TEXT' : undefined, undefined, undefined, 'xhr', method);
  }

}
