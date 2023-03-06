/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ClientConfiguration } from '../client-configuration.js';
import { Attester } from './key-server/attester.js';
import { KeysOpenpgpOrg } from './key-server/keys-openpgp-org.js';
import { Sks } from './key-server/sks.js';
import { Wkd } from './key-server/wkd.js';

export type PubkeySearchResult = { pubkey: string | null };
export type PubkeysSearchResult = { pubkeys: string[] };

/**
 * Look up public keys.
 *
 * Some orgs may have a preference to use their own keyserver.
 * In such cases, results from their own keyserver will be preferred.
 */
export class PubLookup {
  public attester: Attester; // attester is a publicly available public key server
  public wkd: Wkd;
  public keysOpenpgpOrg: KeysOpenpgpOrg; // keys.openpgp.org
  public internalSks: Sks | undefined; // this is an internal company pubkey server that has SKS-like interface

  public constructor(private clientConfiguration: ClientConfiguration) {
    const internalSksUrl = this.clientConfiguration.getCustomSksPubkeyServer();
    this.attester = new Attester(clientConfiguration);
    this.keysOpenpgpOrg = new KeysOpenpgpOrg(clientConfiguration);
    this.wkd = new Wkd(this.clientConfiguration.domainName, this.clientConfiguration.usesKeyManager());
    if (internalSksUrl) {
      this.internalSks = new Sks(internalSksUrl);
    }
  }

  /**
   * Look up public keys from email address from various sources
   * @param email Email Address
   * - Skip keys.openpgp.org search when we are loading public keys we already have just to keep them fresh and we already have at least one valid key for that email address in local contacts
   * - Added this logic to avoid 429 rate limit errors for keys.openpgp.org
   * @param skipOpenpgpOrg
   * @returns PubkeysSearchResult
   */
  public lookupEmail = async (email: string, skipOpenpgpOrg = false): Promise<PubkeysSearchResult> => {
    const wkdRes = await this.wkd.lookupEmail(email);
    if (wkdRes.pubkeys.length) {
      return wkdRes;
    }
    if (this.internalSks) {
      const res = await this.internalSks.lookupEmail(email);
      if (res.pubkey) {
        return { pubkeys: [res.pubkey] };
      }
    }
    const attesterRes = await this.attester.lookupEmail(email);
    if (attesterRes.pubkeys.length || skipOpenpgpOrg) {
      return attesterRes;
    }
    return await this.keysOpenpgpOrg.lookupEmail(email);
  };
}
