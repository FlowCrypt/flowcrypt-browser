/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attester } from './attester.js';
import { Rules } from '../rules.js';
import { Sks } from './sks.js';

export type PgpClient = 'flowcrypt' | 'pgp-other' | null;
export type PubkeySearchResult = { pubkey: string | null; pgpClient: PgpClient };

/**
 * Look up public keys.
 *
 * Some orgs may have a preference to use their own keyserver. In such cases, results from their own keyserver will be preferred.
 */
export class Keyserver {

  public attester: Attester;

  constructor(
    private rules: Rules
  ) {
    this.attester = new Attester(rules);
  }

  public lookupEmail = async (email: string): Promise<PubkeySearchResult> => {
    const customKs = await this.rules.getCustomKeyserver();
    if (customKs) {
      const res = await Sks.lookupEmail(customKs, email);
      if (res.pubkey) {
        return res;
      }
    }
    return await this.attester.lookupEmail(email);
  }

  public lookupLongid = async (longid: string): Promise<PubkeySearchResult> => {
    const customKs = await this.rules.getCustomKeyserver();
    if (customKs) {
      const res = await Sks.lookupLongid(customKs, longid);
      if (res.pubkey) {
        return res;
      }
    }
    return await this.attester.lookupLongid(longid);
  }

}
