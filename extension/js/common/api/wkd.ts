/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from './api.js';
import { ApiErr } from './error/api-error.js';
import { opgp } from '../core/pgp.js';
import { Buf } from '../core/buf.js';
import { Catch } from '../platform/catch.js';
import { PgpKey } from '../core/pgp-key.js';
import { PubkeySearchResult } from './pub-lookup.js';

// tslint:disable:no-null-keyword
// tslint:disable:no-direct-ajax

export class Wkd extends Api {

  constructor(private myOwnDomain: string) {
    super();
  }

  public lookupEmail = async (email: string): Promise<PubkeySearchResult> => {
    const parts = email.toLowerCase().split('@');
    if (parts.length > 2) {
      return { pubkey: null, pgpClient: null };
    }
    const [user, recipientDomain] = parts;
    const hu = opgp.util.encodeZBase32(await opgp.crypto.hash.digest(opgp.enums.hash.sha1, Buf.fromUtfStr(user)));
    const url = `https://${recipientDomain}/.well-known/openpgpkey/hu/${hu}`;
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
    console.info(`Loaded a public key for ${email} from WKD: ${url}`);
    let pubkey: string;
    try {
      pubkey = key.armor();
    } catch (e) {
      return { pubkey: null, pgpClient: null };
    }
    // if recipient uses same domain, we assume they use flowcrypt
    const pgpClient = this.myOwnDomain === recipientDomain ? 'flowcrypt' : 'pgp-other';
    return { pubkey, pgpClient };
  }

}
