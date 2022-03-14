/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:no-null-keyword

import { Key, KeyUtil, PubkeyInfo } from '../../core/crypto/key';

export class ContactStore {

  public static getPubkeyInfos = async (db: IDBDatabase | undefined, keys: (Key | string)[]): Promise<PubkeyInfo[]> => {
    const parsedKeys = await Promise.all(keys.map(async (key) => await KeyUtil.asPublicKey(typeof key === 'string' ? await KeyUtil.parse(key) : key)));
    // in the test ContactStore we consider all the pubkeys non-revoked
    return parsedKeys.map(key => { return { pubkey: key, revoked: false }; });
  };

}
