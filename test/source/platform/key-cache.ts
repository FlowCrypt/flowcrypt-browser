/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Pubkey } from '../core/pgp-key';

export class KeyCache {

  public static setDecrypted = (k: Pubkey) => {
    // tests don't need this
  }

  public static getDecrypted = (longid: string): Pubkey | undefined => {
    return undefined; // tests don't need this
  }

  public static setArmored = (armored: string, k: Pubkey) => {
    // tests don't need this
  }

  public static getArmored = (armored: string): Pubkey | undefined => {
    return undefined; // tests don't need this
  }

}
