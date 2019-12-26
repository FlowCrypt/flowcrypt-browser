/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api } from './api.js';
import { ApiErr } from './error/api-error.js';
import { PgpArmor } from '../core/pgp-armor.js';
import { PubkeySearchResult } from './keyserver.js';

export class Sks extends Api {

  private static MR_VERSION_1 = 'info:1:';

  private static get = async (server: string, path: string): Promise<string | undefined> => {
    try {
      const { responseText } = await Api.apiCall(server, path, undefined, undefined, undefined, undefined, 'xhr', 'GET') as XMLHttpRequest;
      return responseText;
    } catch (e) {
      if (ApiErr.isNotFound(e)) {
        return undefined;
      }
      throw e;
    }
  }

  // https://tools.ietf.org/html/draft-shaw-openpgp-hkp-00#section-5.1
  public static lookupEmail = async (server: string, email: string): Promise<PubkeySearchResult> => {
    const index = await Sks.get(server, `pks/lookup?search=${encodeURIComponent(email)}&fingerprint=on&exact=on&options=mr&op=index`);
    if (!index || !index.startsWith(Sks.MR_VERSION_1)) {
      return { pubkey: null, pgpClient: null }; // tslint:disable-line:no-null-keyword
    }
    const foundUidsByLongid: { [longid: string]: string[] } = {};
    let currentLongid = '';
    for (const line of index.split('\n').map(l => l.trim()).filter(l => !l.startsWith(Sks.MR_VERSION_1))) {
      if (line.startsWith('pub:')) {
        const match = line.match(/^pub:[A-F0-9]{24}([A-F0-9]{16}):[0-9:]+:$/); // in particular cannot end with :r, meaning revoked
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
      return { pubkey: null, pgpClient: null }; // tslint:disable-line:no-null-keyword
    }
    for (const longid of Object.keys(foundUidsByLongid)) {
      for (const uid of foundUidsByLongid[longid]) {
        if (uid.includes(email)) {
          return await Sks.lookupLongid(server, longid); // try to find first pubkey where uid matches what we search for
        }
      }
    }
    return await Sks.lookupLongid(server, Object.keys(foundUidsByLongid)[0]); // else return the first pubkey
  }

  public static lookupLongid = async (server: string, longid: string): Promise<PubkeySearchResult> => {
    const pubkey = await Sks.get(server, `pks/lookup?op=get&search=0x${longid}&options=mr`);
    if (!pubkey || !pubkey.includes(String(PgpArmor.headers('publicKey').end))) {
      return { pubkey: null, pgpClient: null }; // tslint:disable-line:no-null-keyword
    }
    return { pubkey, pgpClient: 'pgp-other' };
  }

}
