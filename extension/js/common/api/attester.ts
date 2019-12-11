/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, ReqMethod } from './api.js';
import { Dict, Str } from '../core/common.js';
import { PubkeySearchResult, PgpClient } from './keyserver.js';
import { ApiErr } from './error/api-error.js';

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

  public static lookupEmails = async (emails: string[]): Promise<Dict<PubkeySearchResult>> => {
    const results: Dict<PubkeySearchResult> = {};
    await Promise.all(emails.map(async (email: string) => {
      results[email] = await Attester.lookupEmail(email);
    }));
    return results;
  }

  public static lookupLongid = (longid: string) => {
    return Attester.lookupEmail(longid); // the api accepts either email or longid
  }

  public static replacePubkey = async (email: string, pubkey: string): Promise<string> => { // replace key assigned to a certain email with a different one
    const r = await Attester.pubCall(`pub/${email}`, 'POST', pubkey);
    return r.responseText;
  }

  public static updatePubkey = async (longid: string, pubkey: string): Promise<string> => { // update key with a newer version of the same key
    const r = await Attester.pubCall(`pub/${longid}`, 'PUT', pubkey);
    return r.responseText;
  }

  public static initialLegacySubmit = (email: string, pubkey: string): Promise<{ saved: boolean }> => {
    return Attester.jsonCall('initial/legacy_submit', { email: Str.parseEmail(email).email, pubkey: pubkey.trim() });
  }

  public static testWelcome = (email: string, pubkey: string): Promise<{ sent: boolean }> => {
    return Attester.jsonCall('test/welcome', { email, pubkey });
  }

}
