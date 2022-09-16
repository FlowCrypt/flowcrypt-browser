/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../../buf.js';

export class PgpHash {

  public static sha256UtfStr = async (string: string) => {
    const digest = await window.crypto.subtle.digest('SHA-256', Buf.fromUtfStr(string));
    console.log(`digest: ${digest}`);
    return Buf.fromUint8(new Uint8Array(digest)).toHexStr(false);
  };

  public static challengeAnswer = async (answer: string) => {
    return await PgpHash.cryptoHashSha256Loop(answer);
  };

  private static cryptoHashSha256Loop = async (string: string, times = 100000) => {
    console.log(`cryptoHashSha256Loop start`);
    for (let i = 0; i < times; i++) {
      string = await PgpHash.sha256UtfStr(string);
    }
    console.log(`cryptoHashSha256Loop start ${string}`);
    return string;
  };

}
