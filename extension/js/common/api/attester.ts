/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, ReqMethod } from './api.js';
import { Dict, Str } from '../core/common.js';

type PgpClient = 'flowcrypt' | 'pgp-other' | null;
export type PubkeySearchResult = { pubkey: string | null; pgpClient: PgpClient };

export namespace AttesterRes { // responses
  export type AttTestWelcome = { sent: boolean };
  export type AttInitialLegacySugmit = { saved: boolean };
  export type AttKeyserverDiagnosis = { hasPubkeyMissing: boolean, hasPubkeyMismatch: boolean, results: Dict<{ pubkey?: string, match: boolean }> };
}

export class Attester extends Api {

  private static jsonCall = (path: string, values?: Dict<any>, method: ReqMethod = 'POST'): Promise<any> => {
    return Api.apiCall('https://flowcrypt.com/attester/', path, values, 'JSON', undefined, { 'api-version': '3' }, 'json', method);
  }

  private static pubCall = (resource: string, method: ReqMethod = 'GET', data?: string | undefined): Promise<{ responseText: string, getResponseHeader: (n: string) => string | null }> => {
    return Api.apiCall('https://flowcrypt.com/attester/', resource, data, typeof data === 'string' ? 'TEXT' : undefined, undefined, undefined, 'xhr', method);
  }

  public static lookupEmail = async (email: string): Promise<PubkeySearchResult> => {
    try {
      const r = await Attester.pubCall(`pub/${email}`);
      return { pubkey: r.responseText, pgpClient: r.getResponseHeader('pgp-client') as PgpClient };
    } catch (e) {
      if (Api.err.isNotFound(e)) {
        return { pubkey: null, pgpClient: null }; // tslint:disable-line:no-null-keyword
      }
      throw e;
    }
  }

  public static lookupFingerprint = async (fingerprint: string) => {
    return await Attester.pubCall(`lookup/${fingerprint}`);
  }

  public static lookupEmails = async (emails: string[]): Promise<Dict<PubkeySearchResult>> => {
    const results: Dict<PubkeySearchResult> = {};
    await Promise.all(emails.map(async (email: string) => {
      results[email] = await Attester.lookupEmail(email);
    }));
    return results;
  }

  public static lookupLongid = (longid: string) => Attester.lookupEmail(longid); // the api accepts either email or longid

  public static replacePubkey = async (email: string, pubkey: string): Promise<string> => { // replace key assigned to a certain email with a different one
    const r = await Attester.pubCall(`pub/${email}`, 'POST', pubkey);
    return r.responseText;
  }

  public static updatePubkey = async (longid: string, pubkey: string): Promise<string> => { // update key with a newer version of the same key
    const r = await Attester.pubCall(`pub/${longid}`, 'PUT', pubkey);
    return r.responseText;
  }

  public static initialLegacySubmit = (email: string, pubkey: string): Promise<AttesterRes.AttInitialLegacySugmit> => {
    return Attester.jsonCall('initial/legacy_submit', { email: Str.parseEmail(email).email, pubkey: pubkey.trim() });
  }

  public static testWelcome = (email: string, pubkey: string): Promise<AttesterRes.AttTestWelcome> => {
    return Attester.jsonCall('test/welcome', { email, pubkey });
  }

}
