/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../../buf.js';

export class PgpHash {

  public static sha256UtfStr = async (string: string) => {
    const digest = await window.crypto.subtle.digest('sha256', Buf.fromUtfStr(string));
    return Buf.fromUint8(new Uint8Array(digest)).toHexStr();
  };

  public static challengeAnswer = async (answer: string) => {
    return await PgpHash.cryptoHashSha256Loop(answer);
  };

  private static cryptoHashSha256Loop = async (string: string, times = 100000) => {
    for (let i = 0; i < times; i++) {
      string = await PgpHash.sha256UtfStr(string);
    }
    return string;
  };

}
