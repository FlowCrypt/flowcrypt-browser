/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from './../shared/api.js';
import { ApiErr } from '../shared/api-error.js';
import { opgp } from '../../core/crypto/pgp/openpgpjs-custom.js';
import { Buf } from '../../core/buf.js';
import { Catch } from '../../platform/catch.js';
import { PubkeySearchResult } from './../pub-lookup.js';
import { KeyUtil } from '../../core/crypto/key.js';

// tslint:disable:no-null-keyword
// tslint:disable:no-direct-ajax

export class Wkd extends Api {

  // https://datatracker.ietf.org/doc/draft-koch-openpgp-webkey-service/?include_text=1
  // https://www.sektioneins.de/en/blog/18-11-23-gnupg-wkd.html
  // https://metacode.biz/openpgp/web-key-directory

  public port: number | undefined;
  private protocol: string;

  constructor(private myOwnDomain: string, protocol = 'https') {
    super();
    this.protocol = protocol;
  }

  public lookupEmail = async (email: string): Promise<PubkeySearchResult> => {
    const parts = email.split('@');
    if (parts.length > 2) {
      return { pubkey: null, pgpClient: null };
    }
    const [user, recipientDomain] = parts;
    if (!opgp) {
      // pgp_block.htm does not have openpgp loaded
      // the particular usecase (auto-loading pubkeys to verify signatures) is not that important,
      //    the user typically gets the key loaded from composing anyway
      // the proper fix would be to run encodeZBase32 through background scripts
      return { pubkey: null, pgpClient: null };
    }
    const directDomain = recipientDomain.toLowerCase();
    const advancedDomainPrefix = (directDomain === 'localhost') ? '' : 'openpgpkey.';
    const hu = opgp.util.encodeZBase32(await opgp.crypto.hash.digest(opgp.enums.hash.sha1, Buf.fromUtfStr(user.toLowerCase())));
    const directHost = (typeof this.port === 'undefined') ? directDomain : `${directDomain}:${this.port}`;
    const advancedHost = `${advancedDomainPrefix}${directHost}`;
    const userPart = `hu/${hu}?l=${encodeURIComponent(user)}`;
    const advancedUrl = `${this.protocol}://${advancedHost}/.well-known/openpgpkey/${directDomain}`;
    const directUrl = `${this.protocol}://${directHost}/.well-known/openpgpkey`;
    let binary: Buf;
    let validUrl: string;
    for (const url of [advancedUrl, directUrl]) {
      try {
        await Wkd.download(`${url}/policy`, undefined, 4);
        console.info(`Policy found: ${url}/policy`);
        validUrl = url;
        break;
      } catch (e) {
        if (ApiErr.isNotFound(e) || ApiErr.isNetErr(e)) {
          continue;
        }
        Catch.report(`Wkd.lookupEmail error retrieving policy file ${url}/policy: ${String(e)}`);
        return { pubkey: null, pgpClient: null };
      }
    }
    try {
      binary = await Wkd.download(`${validUrl!}/${userPart}`, undefined, 4);
    } catch (e) {
      Catch.report(`Wkd.lookupEmail error retrieving key ${validUrl!}/${userPart}: ${String(e)}`);
      return { pubkey: null, pgpClient: null };
    }
    const { keys: [key], errs } = await KeyUtil.readMany(binary!);
    if (errs.length || !key || !key.emails.some(x => x.toLowerCase() === email.toLowerCase())) {
      return { pubkey: null, pgpClient: null };
    }
    console.info(`Loaded Public Key from WKD for ${email}: ${validUrl!}`);
    let pubkey: string;
    try {
      pubkey = KeyUtil.armor(key);
    } catch (e) {
      return { pubkey: null, pgpClient: null };
    }
    // if recipient uses same domain, we assume they use flowcrypt
    const pgpClient = this.myOwnDomain === recipientDomain ? 'flowcrypt' : 'pgp-other';
    return { pubkey, pgpClient };
  }

}
