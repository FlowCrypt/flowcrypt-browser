/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Key } from '../core/crypto/key';

export class KeyCache {

  public static setDecrypted = (k: Key) => {
    // tests don't need this
  }

  public static getDecrypted = (longid: string): Key | undefined => {
    return undefined; // tests don't need this
  }

  public static setArmored = (armored: string, k: Key) => {
    // tests don't need this
  }

  public static getArmored = (armored: string): Key | undefined => {
    return undefined; // tests don't need this
  }

}
