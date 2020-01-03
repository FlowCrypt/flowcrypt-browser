/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Contact } from '../core/pgp-key';

export interface PrvKeyInfo {
  private: string;
  longid: string;
  decrypted?: OpenPGP.key.Key;
}

export interface KeyInfo extends PrvKeyInfo {
  public: string;
  fingerprint: string;
  primary: boolean;
  keywords: string;
}

export type KeyInfosWithPassphrases = { keys: PrvKeyInfo[]; passphrases: string[]; };

export class Store {

  static dbContactGet = async (db: void, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    return [];
  }

  static decryptedKeyCacheSet = (k: OpenPGP.key.Key) => {
    // tests don't need this
  }

  static decryptedKeyCacheGet = (longid: string): OpenPGP.key.Key | undefined => {
    return undefined; // tests don't need this
  }

  static armoredKeyCacheSet = (armored: string, k: OpenPGP.key.Key) => {
    // tests don't need this
  }

  static armoredKeyCacheGet = (armored: string): OpenPGP.key.Key | undefined => {
    return undefined; // tests don't need this
  }

}
