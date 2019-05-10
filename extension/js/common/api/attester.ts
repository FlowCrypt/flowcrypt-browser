/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, ReqMethod } from './api.js';
import { Dict, Str, Value } from '../core/common.js';
import { Store } from '../platform/store.js';
import { Pgp } from '../core/pgp.js';

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

  public static attester = {
    lookupEmail: (email: string): Promise<PubkeySearchResult> => {
      return Attester.call('lookup/email', { email: Str.parseEmail(email).email });
    },
    lookupEmails: async (emails: string[]): Promise<Dict<PubkeySearchResult>> => {
      const results: Dict<PubkeySearchResult> = {};
      await Promise.all(emails.map(async (email: string) => {
        results[email] = await Attester.attester.lookupEmail(email);
      }));
      return results;
    },
    initialLegacySubmit: (email: string, pubkey: string): Promise<AttesterRes.AttInitialLegacySugmit> => Attester.call('initial/legacy_submit', {
      email: Str.parseEmail(email).email,
      pubkey: pubkey.trim(),
      // attest: false,
    }),
    testWelcome: (email: string, pubkey: string): Promise<AttesterRes.AttTestWelcome> => Attester.call('test/welcome', {
      email,
      pubkey,
    }),
    diagnoseKeyserverPubkeys: async (acctEmail: string): Promise<AttesterRes.AttKeyserverDiagnosis> => {
      const diagnosis: AttesterRes.AttKeyserverDiagnosis = { hasPubkeyMissing: false, hasPubkeyMismatch: false, results: {} };
      const { addresses } = await Store.getAcct(acctEmail, ['addresses']);
      const storedKeys = await Store.keysGet(acctEmail);
      const storedKeysLongids = storedKeys.map(ki => ki.longid);
      const results = await Attester.attester.lookupEmails(Value.arr.unique([acctEmail].concat(addresses || [])));
      for (const email of Object.keys(results)) {
        const pubkeySearchResult = results[email];
        if (!pubkeySearchResult.pubkey) {
          diagnosis.hasPubkeyMissing = true;
          diagnosis.results[email] = { pubkey: undefined, match: false };
        } else {
          let match = true;
          if (!storedKeysLongids.includes(String(await Pgp.key.longid(pubkeySearchResult.pubkey)))) {
            diagnosis.hasPubkeyMismatch = true;
            match = false;
          }
          diagnosis.results[email] = { pubkey: pubkeySearchResult.pubkey, match };
        }
      }
      return diagnosis;
    },
  };

}
