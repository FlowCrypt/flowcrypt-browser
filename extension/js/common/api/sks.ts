/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from './api.js';
import { Pgp } from '../core/pgp.js';
import { PubkeySearchResult } from './keyserver.js';

export class Sks extends Api {

  private static get = async (server: string, path: string): Promise<string | undefined> => {
    try {
      const { responseText } = await Api.apiCall(server, path, undefined, undefined, undefined, undefined, 'xhr', 'GET') as XMLHttpRequest;
      return responseText;
    } catch (e) {
      if (Api.err.isNotFound(e)) {
        return undefined;
      }
      throw e;
    }
  }

  public static lookupEmail = async (server: string, email: string): Promise<PubkeySearchResult> => {
    const index = await Sks.get(server, `pks/lookup?search=${encodeURIComponent(email)}&fingerprint=on&exact=on&options=mr&op=index`);
    if (!index) {
      return { pubkey: null, pgpClient: null }; // tslint:disable-line:no-null-keyword
    }
    const match = index.match(/^pub:[A-F0-9]{24}([A-F0-9]{16}):[0-9:]+:$/m); // in particular cannot end with :r, meaning revoked
    if (!match) {
      return { pubkey: null, pgpClient: null }; // tslint:disable-line:no-null-keyword
    }
    return await Sks.lookupLongid(server, match[1]);
  }

  public static lookupLongid = async (server: string, longid: string): Promise<PubkeySearchResult> => {
    const pubkey = await Sks.get(server, `pks/lookup?op=get&search=0x${longid}&options=mr`);
    if (!pubkey || !pubkey.includes(String(Pgp.armor.headers('publicKey').end))) {
      return { pubkey: null, pgpClient: null }; // tslint:disable-line:no-null-keyword
    }
    return { pubkey, pgpClient: 'pgp-other' };
  }

}
