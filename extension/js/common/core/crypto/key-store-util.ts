/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Key, KeyInfoWithIdentity, KeyUtil } from './key.js';

export type ParsedKeyInfo = { keyInfo: KeyInfoWithIdentity, key: Key };

export class KeyStoreUtil {

  public static parse = async (keyInfos: KeyInfoWithIdentity[]): Promise<ParsedKeyInfo[]> => {
    const parsed: ParsedKeyInfo[] = [];
    for (const keyInfo of keyInfos) {
      const key = await KeyUtil.parse(keyInfo.private);
      parsed.push({ keyInfo, key });
    }
    return parsed;
  };

  public static chooseMostUseful = (
    prvs: ParsedKeyInfo[], criteria: 'ONLY-FULLY-USABLE' | 'AT-LEAST-USABLE-BUT-EXPIRED' | 'EVEN-IF-UNUSABLE'
  ): ParsedKeyInfo | undefined => {
    const usablePrv = prvs.find(prv => prv.key.usableForEncryption && prv.key.usableForSigning)
      || prvs.find(prv => prv.key.usableForEncryption)
      || prvs.find(prv => prv.key.usableForSigning);
    if (usablePrv || criteria === 'ONLY-FULLY-USABLE') {
      return usablePrv;
    }
    const usableExpiredPrv = prvs.find(prv => (prv.key.usableForEncryption || prv.key.usableForEncryptionButExpired)
      && (prv.key.usableForSigning || prv.key.usableForSigningButExpired)
    )
      || prvs.find(prv => prv.key.usableForEncryption || prv.key.usableForEncryptionButExpired)
      || prvs.find(prv => prv.key.usableForSigning || prv.key.usableForSigningButExpired);
    if (usableExpiredPrv || criteria === 'AT-LEAST-USABLE-BUT-EXPIRED') {
      return usableExpiredPrv;
    }
    // criteria === EVEN-IF-UNUSABLE
    return prvs.find(prv => !prv.key.revoked)
      || prvs[0];
  };

}
