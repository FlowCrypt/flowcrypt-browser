/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attester } from './attester.js';
import { OrgRules } from '../org-rules.js';
import { Sks } from './sks.js';
import { KeyManager } from './key-manager.js';

export type PgpClient = 'flowcrypt' | 'pgp-other' | null;
export type PubkeySearchResult = { pubkey: string | null; pgpClient: PgpClient };

/**
 * Look up public keys.
 *
 * Some orgs may have a preference to use their own keyserver. In such cases, results from their own keyserver will be preferred.
 */
export class PubLookup {

  public attester: Attester; // attester is a publicly available public key server
  public keyManager: KeyManager | undefined; // key manager is a flowcrypt-provided internal company private and public key server
  public internalSks: Sks | undefined; // this is an internal company pubkey server that has SKS-like interface

  constructor(
    private orgRules: OrgRules
  ) {
    const privateKeyManagerUrl = orgRules.getKeyManagerUrlForPublicKeys();
    const internalSksUrl = this.orgRules.getCustomSksPubkeyServer();
    this.attester = new Attester(orgRules);
    if (privateKeyManagerUrl) {
      this.keyManager = new KeyManager(privateKeyManagerUrl);
    }
    if (internalSksUrl) {
      this.internalSks = new Sks(internalSksUrl);
    }
  }

  public lookupEmail = async (email: string): Promise<PubkeySearchResult> => {
    if (this.keyManager) {
      const res = await this.keyManager.lookupPublicKey(email);
      if (res.publicKeys.length) {
        return { pubkey: res.publicKeys[0].publicKey, pgpClient: 'flowcrypt' };
      }
    }
    if (this.internalSks) {
      const res = await this.internalSks.lookupEmail(email);
      if (res.pubkey) {
        return res;
      }
    }
    return await this.attester.lookupEmail(email);
  }

  public lookupFingerprint = async (fingerprintOrLongid: string): Promise<PubkeySearchResult> => {
    if (this.keyManager) {
      const res = await this.keyManager.lookupPublicKey(fingerprintOrLongid);
      if (res.publicKeys.length) {
        return { pubkey: res.publicKeys[0].publicKey, pgpClient: 'flowcrypt' };
      }
    }
    if (this.internalSks) {
      const res = await this.internalSks.lookupFingerprint(fingerprintOrLongid);
      if (res.pubkey) {
        return res;
      }
    }
    return await this.attester.lookupFingerprint(fingerprintOrLongid);
  }

}
