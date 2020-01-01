/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attester } from './attester.js';
import { Rules } from '../rules.js';
import { Sks } from './sks.js';

export type PgpClient = 'flowcrypt' | 'pgp-other' | null;
export type PubkeySearchResult = { pubkey: string | null; pgpClient: PgpClient };

/**
 * Look up public keys.
 *
 * Some users may have a preference to use their own keyserver. In such cases, results from their own keyserver will be preferred.
 */
export class Keyserver {

  public static lookupEmail = async (acctEmail: string, email: string): Promise<PubkeySearchResult> => {
    const customKs = await Keyserver.getCustomKeyserverByAcctEmail(acctEmail);
    if (customKs) {
      const res = await Sks.lookupEmail(customKs, email);
      if (res.pubkey) {
        return res;
      }
    }
    return await Attester.lookupEmail(email);
  }

  public static lookupLongid = async (acctEmail: string, longid: string): Promise<PubkeySearchResult> => {
    const customKs = await Keyserver.getCustomKeyserverByAcctEmail(acctEmail);
    if (customKs) {
      const res = await Sks.lookupLongid(customKs, longid);
      if (res.pubkey) {
        return res;
      }
    }
    return await Attester.lookupLongid(longid);
  }

  private static getCustomKeyserverByAcctEmail = async (acctEmail: string) => {
    const rules = await Rules.newInstance(acctEmail);
    return rules.canUseCustomKeyserver() ? rules.getCustomKeyserver() : undefined;
  }

}
