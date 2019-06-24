/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export type Contact = {
  email: string; name: string | null; pubkey: string | null; has_pgp: 0 | 1; searchable: string[];
  client: string | null; attested: boolean | null; fingerprint: string | null; longid: string | null; keywords: string | null;
  pending_lookup: number; last_use: number | null;
  date: number | null; /* todo - should be removed. email provider search seems to return this? */
};

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

}
