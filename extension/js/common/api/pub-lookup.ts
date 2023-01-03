/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attester } from './key-server/attester.js';
import { KeyManager } from './key-server/key-manager.js';
import { Sks } from './key-server/sks.js';
import { Wkd } from './key-server/wkd.js';
import { ClientConfiguration } from '../client-configuration.js';

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
  public keyManager: KeyManager | undefined; // key manager is a flowcrypt-provided internal company private and public key server
  public internalSks: Sks | undefined; // this is an internal company pubkey server that has SKS-like interface

  public constructor(private clientConfiguration: ClientConfiguration) {
    const internalSksUrl = this.clientConfiguration.getCustomSksPubkeyServer();
    this.attester = new Attester(clientConfiguration);
    this.wkd = new Wkd(this.clientConfiguration.domainName, this.clientConfiguration.usesKeyManager());
    if (internalSksUrl) {
      this.internalSks = new Sks(internalSksUrl);
    }
  }

  public lookupEmail = async (email: string): Promise<PubkeysSearchResult> => {
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
    return await this.attester.lookupEmail(email);
  };
}
