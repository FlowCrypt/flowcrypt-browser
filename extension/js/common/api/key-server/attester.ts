/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, ReqMethod } from './../shared/api.js';
import { Dict, Str } from '../../core/common.js';
import { PubkeysSearchResult } from './../pub-lookup.js';
import { AjaxErr, ApiErr } from '../shared/api-error.js';
import { ClientConfiguration } from "../../client-configuration";
import { ATTESTER_API_HOST } from '../../core/const.js';
import { MsgBlockParser } from '../../core/msg-block-parser.js';

type PubCallRes = { responseText: string, getResponseHeader: (n: string) => string | null };

export class Attester extends Api {

  constructor(
    private clientConfiguration: ClientConfiguration
  ) {
    super();
  }

  public lookupEmail = async (email: string): Promise<PubkeysSearchResult> => {
    if (!this.clientConfiguration.canLookupThisRecipientOnAttester(email)) {
      console.info(`Skipping attester lookup of ${email} because attester search on this domain is disabled.`);
      return { pubkeys: [] };
    }
    const results = await Promise.all([
      this.doLookupLdap(email),  // get from recipient-specific LDAP server, if any, relayed through flowcrypt.com
      this.doLookup(email),  // get from flowcrypt.com public keyserver database
      this.doLookupLdap(email, 'keyserver.pgp.com'), // get from keyserver.pgp.com, relayed through flowcrypt.com
    ]);
    for (const result of results) {
      if (result.pubkeys.length) {
        return result;
      }
    }
    return { pubkeys: [] };
  };

  public doLookupLdap = async (email: string, server?: string): Promise<PubkeysSearchResult> => {
    const ldapServer = server ?? `keys.${Str.getDomainFromEmailAddress(email)}`;
    try {
      const r = await this.pubCall(`ldap-relay?server=${ldapServer}&search=${email}`);
      return this.getPubKeysSearchResult(r);
    } catch (e) {
      // treat error 500 as error 404 on this particular endpoint
      // https://github.com/FlowCrypt/flowcrypt-browser/pull/4627#issuecomment-1222624065
      if (ApiErr.isNotFound(e) || (e as AjaxErr).status === 500) {
        return { pubkeys: [] };
      }
      throw e;
    }
  };

  private getPubKeysSearchResult = async (r: PubCallRes): Promise<PubkeysSearchResult> => {
    const { blocks } = MsgBlockParser.detectBlocks(r.responseText);
    const pubkeys = blocks.filter((block) => block.type === 'publicKey').map((block) => block.content.toString());
    return { pubkeys };
  };

  public lookupEmails = async (emails: string[]): Promise<Dict<PubkeysSearchResult>> => {
    const results: Dict<PubkeysSearchResult> = {};
    await Promise.all(emails.map(async (email: string) => {
      results[email] = await this.lookupEmail(email);
    }));
    return results;
  };

  /**
   * Set or replace public key with idToken as an auth mechanism
   * Used during setup
   * Can only be used for primary email because idToken does not contain info about aliases
   */
  public submitPrimaryEmailPubkey = async (email: string, pubkey: string, idToken: string): Promise<void> => {
    if (!this.clientConfiguration.canSubmitPubToAttester()) {
      throw new Error('Cannot replace pubkey at attester because your organisation rules forbid it');
    }
    await this.pubCall(`pub/${email}`, 'POST', pubkey, { authorization: `Bearer ${idToken}` });
  };

  /**
   * Request to replace pubkey that will be verified by clicking email
   * Used when user manually chooses to replace key
   * Can also be used for aliases
   */
  public replacePubkey = async (email: string, pubkey: string): Promise<string> => {
    if (!this.clientConfiguration.canSubmitPubToAttester()) {
      throw new Error('Cannot replace pubkey at attester because your organisation rules forbid it');
    }
    const r = await this.pubCall(`pub/${email}`, 'POST', pubkey);
    return r.responseText;
  };

  /**
   * Update pubkey with a newer version of the same pubkey
   * Does not need email verification, fingerprints compared, last signatures compared
   */
  public updatePubkey = async (longid: string, pubkey: string): Promise<string> => {
    if (!this.clientConfiguration.canSubmitPubToAttester()) {
      throw new Error('Cannot update pubkey at attester because your organisation rules forbid it');
    }
    const r = await this.pubCall(`pub/${longid}`, 'PUT', pubkey);
    return r.responseText;
  };

  /**
   * Looking to deprecate this, but still used for some customers
   */
  public initialLegacySubmit = async (email: string, pubkey: string): Promise<{ saved: boolean }> => {
    if (!this.clientConfiguration.canSubmitPubToAttester()) {
      throw new Error('Cannot submit pubkey to attester because your organisation rules forbid it');
    }
    return await this.jsonCall<{ saved: boolean }>('initial/legacy_submit', { email: Str.parseEmail(email).email, pubkey: pubkey.trim() });
  };

  public testWelcome = async (email: string, pubkey: string): Promise<{ sent: boolean }> => {
    return await this.jsonCall<{ sent: boolean }>('test/welcome', { email, pubkey });
  };

  private jsonCall = async <RT>(path: string, values?: Dict<any>, method: ReqMethod = 'POST'): Promise<RT> => {
    return await Api.apiCall(ATTESTER_API_HOST, path, values, 'JSON', undefined, { 'api-version': '3' }, 'json', method) as RT;
  };

  private pubCall = async (resource: string, method: ReqMethod = 'GET', data?: string | undefined, hdrs?: Dict<string>): Promise<PubCallRes> => {
    return await Api.apiCall(ATTESTER_API_HOST, resource, data, typeof data === 'string' ? 'TEXT' : undefined, undefined, hdrs, 'xhr', method);
  };

  private doLookup = async (email: string): Promise<PubkeysSearchResult> => {
    try {
      const r = await this.pubCall(`pub/${email}`);
      return this.getPubKeysSearchResult(r);
    } catch (e) {
      if (ApiErr.isNotFound(e)) {
        return { pubkeys: [] };
      }
      throw e;
    }
  };

}
