
/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

export interface PrvKeyInfo {
  private: string;
  longid: string;
  decrypted?: OpenPGP.key.Key;
}

export interface KeyInfo extends PrvKeyInfo {
  public: string;
  fingerprint: string;
  primary: boolean;
}

export type KeyInfosWithPassphrases = { keys: PrvKeyInfo[]; passphrases: string[]; };
