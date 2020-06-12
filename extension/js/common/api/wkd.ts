/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from './api.js';
import { ApiErr } from './error/api-error.js';
import { opgp } from '../core/crypto/pgp/openpgpjs-custom.js';
import { Buf } from '../core/buf.js';
import { Catch } from '../platform/catch.js';
import { PgpKey } from '../core/crypto/pubkey.js';
import { PubkeySearchResult } from './pub-lookup.js';

// tslint:disable:no-null-keyword
// tslint:disable:no-direct-ajax

export class Wkd extends Api {

  // https://datatracker.ietf.org/doc/draft-koch-openpgp-webkey-service/?include_text=1
  // https://www.sektioneins.de/en/blog/18-11-23-gnupg-wkd.html
  // https://metacode.biz/openpgp/web-key-directory

  constructor(private myOwnDomain: string) {
    super();
  }

  public lookupEmail = async (email: string): Promise<PubkeySearchResult> => {
    const parts = email.toLowerCase().split('@');
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
    const hu = opgp.util.encodeZBase32(await opgp.crypto.hash.digest(opgp.enums.hash.sha1, Buf.fromUtfStr(user)));
    // todo - could also search on `https://openpgpkey.{domain}/.well-known/openpgpkey/{domain}/hu/{hu}?l={user}`
    const url = `https://${recipientDomain}/.well-known/openpgpkey/hu/${hu}?l=${encodeURIComponent(user)}`;
    let binary: Buf;
    try {
      binary = await Wkd.download(url, undefined, 4);
    } catch (e) {
      if (ApiErr.isNotFound(e) || ApiErr.isNetErr(e)) {
        return { pubkey: null, pgpClient: null };
      }
      Catch.report(`Wkd.lookupEmail err: ${String(e)}`);
      return { pubkey: null, pgpClient: null };
    }
    const { keys: [key], errs } = await PgpKey.readMany(binary);
    if (errs.length || !key) {
      return { pubkey: null, pgpClient: null };
    }
    console.info(`Loaded Public Key from WKD for ${email}: ${url}`);
    let pubkey: string;
    try {
      pubkey = PgpKey.armor(key);
    } catch (e) {
      return { pubkey: null, pgpClient: null };
    }
    // if recipient uses same domain, we assume they use flowcrypt
    const pgpClient = this.myOwnDomain === recipientDomain ? 'flowcrypt' : 'pgp-other';
    return { pubkey, pgpClient };
  }

}
