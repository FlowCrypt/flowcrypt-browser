/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, ReqMethod } from './api.js';
import { Dict, Str } from '../core/common.js';

export type PubkeySearchResult = { pubkey: string | null; has_cryptup: boolean | null; };

export namespace AttesterRes { // responses
  export type AttTestWelcome = { sent: boolean };
  export type AttInitialLegacySugmit = { saved: boolean };
  export type AttKeyserverDiagnosis = { hasPubkeyMissing: boolean, hasPubkeyMismatch: boolean, results: Dict<{ pubkey?: string, match: boolean }> };
}

export class Attester extends Api {

  private static call = (path: string, values?: Dict<any>, method: ReqMethod = 'POST'): Promise<any> => {
    return Api.apiCall('https://flowcrypt.com/attester/', path, values, 'JSON', undefined, { 'api-version': '3' }, 'json', method);
  }

  public static lookupEmail = (email: string): Promise<PubkeySearchResult> => {
    return Attester.call('lookup/email', { email: Str.parseEmail(email).email });
  }

  public static lookupEmails = async (emails: string[]): Promise<Dict<PubkeySearchResult>> => {
    const results: Dict<PubkeySearchResult> = {};
    await Promise.all(emails.map(async (email: string) => {
      results[email] = await Attester.lookupEmail(email);
    }));
    return results;
  }
  public static initialLegacySubmit = (email: string, pubkey: string): Promise<AttesterRes.AttInitialLegacySugmit> => {
    return Attester.call('initial/legacy_submit', { email: Str.parseEmail(email).email, pubkey: pubkey.trim() });
  }

  public static testWelcome = (email: string, pubkey: string): Promise<AttesterRes.AttTestWelcome> => {
    return Attester.call('test/welcome', { email, pubkey });
  }

}
