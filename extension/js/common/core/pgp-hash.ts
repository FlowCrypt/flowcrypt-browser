/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { openpgp } from './pgp.js';
import { Buf } from './buf.js';

export class PgpHash {

  private static cryptoHashSha256Loop = async (string: string, times = 100000) => {
    for (let i = 0; i < times; i++) {
      string = await PgpHash.sha256UtfStr(string);
    }
    return string;
  }

  static sha1UtfStr = async (string: string): Promise<string> => {
    return openpgp.util.Uint8Array_to_hex(await openpgp.crypto.hash.digest(openpgp.enums.hash.sha1, Buf.fromUtfStr(string)));
  }

  static sha256UtfStr = async (string: string) => {
    return openpgp.util.Uint8Array_to_hex(await openpgp.crypto.hash.digest(openpgp.enums.hash.sha256, Buf.fromUtfStr(string)));
  }

  static doubleSha1Upper = async (string: string) => {
    return (await PgpHash.sha1UtfStr(await PgpHash.sha1UtfStr(string))).toUpperCase();
  }

  static challengeAnswer = async (answer: string) => {
    return await PgpHash.cryptoHashSha256Loop(answer);
  }

}
