/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from './../shared/api.js';
import { ApiErr } from '../shared/api-error.js';
import { KeyUtil } from '../../core/crypto/key.js';
import { PgpArmor } from '../../core/crypto/pgp/pgp-armor.js';
import { PubkeySearchResult } from './../pub-lookup.js';
import { Str, Url } from '../../core/common.js';

export class Sks extends Api {
  private static MR_VERSION_1 = 'info:1:';
  private url: string;

  public constructor(url: string) {
    super();
    this.url = Url.removeTrailingSlash(url);
  }

  /**
   * https://tools.ietf.org/html/draft-shaw-openpgp-hkp-00#section-5.1
   *
   * Todo - extract full fingerprint, not just longid
   */
  public lookupEmail = async (email: string): Promise<PubkeySearchResult> => {
    const index = await this.get(`/pks/lookup?search=${encodeURIComponent(email)}&fingerprint=on&exact=on&options=mr&op=index`);
    if (!index?.startsWith(Sks.MR_VERSION_1)) {
      return { pubkey: null }; // eslint-disable-line no-null/no-null
    }
    const foundUidsByLongid: { [longid: string]: string[] } = {};
    let currentLongid = '';
    for (const line of index
      .split('\n')
      .map(l => l.trim())
      .filter(l => !l.startsWith(Sks.MR_VERSION_1))) {
      if (line.startsWith('pub:')) {
        const match = /^pub:[A-F0-9]{24}([A-F0-9]{16}):[0-9:]+:$/.exec(line); // in particular cannot end with :r, meaning revoked
        if (!match) {
          currentLongid = '';
        } else {
          currentLongid = match[1];
          foundUidsByLongid[currentLongid] = [];
        }
      } else if (line.startsWith('uid:') && currentLongid) {
        foundUidsByLongid[currentLongid].push(line.replace('uid:', '').split(':')[0].toLowerCase());
      }
    }
    if (!Object.keys(foundUidsByLongid).length) {
      return { pubkey: null }; // eslint-disable-line no-null/no-null
    }
    const lowerEmail = email.toLowerCase();
    for (const longid of Object.keys(foundUidsByLongid)) {
      for (const uid of foundUidsByLongid[longid]) {
        const parsedEmail = Str.parseEmail(uid, 'DO-NOT-VALIDATE').email;
        if (parsedEmail === lowerEmail) {
          return await this.lookupFingerprint(longid, email);
        }
      }
    }
    return { pubkey: null }; // eslint-disable-line no-null/no-null
  };

  public lookupFingerprint = async (fingerprintOrLongid: string, expectedEmail?: string): Promise<PubkeySearchResult> => {
    if (fingerprintOrLongid.includes('@')) {
      throw new Error('Expected fingerprint or longid, got email');
    }
    const pubkey = await this.get(`/pks/lookup?op=get&search=0x${fingerprintOrLongid}&options=mr`);
    if (!pubkey?.includes(String(PgpArmor.headers('publicKey').end))) {
      return { pubkey: null }; // eslint-disable-line no-null/no-null
    }
    if (expectedEmail) {
      const parsed = await KeyUtil.parse(pubkey);
      const hasMatchingEmail = parsed.users.some(u => u.email === expectedEmail.toLowerCase());
      if (!hasMatchingEmail) {
        return { pubkey: null }; // eslint-disable-line no-null/no-null
      }
    }
    return { pubkey };
  };

  private get = async (path: string): Promise<string | undefined> => {
    try {
      const responseText = await Api.apiCall(this.url, path, undefined, undefined, undefined, 'text');
      return responseText;
    } catch (e) {
      if (ApiErr.isNotFound(e)) {
        return undefined;
      }
      throw e;
    }
  };
}
