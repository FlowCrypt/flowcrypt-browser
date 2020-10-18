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
    if (parts.length !== 2) {
      return { pubkey: null, pgpClient: null };
    }
    const [user, recipientDomain] = parts;
    if (!user || !recipientDomain) {
      return { pubkey: null, pgpClient: null };
    }
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
    const binary = await this.urlLookup(advancedUrl, userPart) || await this.urlLookup(directUrl, userPart);
    const { keys: [key], errs } = await KeyUtil.readMany(binary!);
    if (errs.length || !key || !key.emails.some(x => x.toLowerCase() === email.toLowerCase())) {
      return { pubkey: null, pgpClient: null };
    }
    // if recipient uses same domain, we assume they use flowcrypt
    const pgpClient = this.myOwnDomain === recipientDomain ? 'flowcrypt' : 'pgp-other';
    try {
      const pubkey = KeyUtil.armor(key);
      return { pubkey, pgpClient };
    } catch (e) {
      return { pubkey: null, pgpClient: null };
    }
  }

  private urlLookup = async (methodUrlBase: string, userPart: string): Promise<Buf | undefined> => {
    try {
      await Wkd.download(`${methodUrlBase}/policy`, undefined, 4);
    } catch (e) {
      return;
    }
    try {
      const r = await Wkd.download(`${methodUrlBase}/${userPart}`, undefined, 4);
      if (r.length) {
        console.info(`Loaded WKD url ${methodUrlBase}/${userPart} and will try to extract Public Keys`);
      }
      return r;
    } catch (e) {
      if (!ApiErr.isNotFound(e)) {
        Catch.report(`Wkd.lookupEmail error retrieving key ${methodUrlBase}/${userPart}: ${String(e)}`);
      }
      return;
    }
  }

}
