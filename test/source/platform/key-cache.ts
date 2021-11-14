/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Key } from '../core/crypto/key';

export class KeyCache {

  public static setDecrypted = (k: Key) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // tests don't need this
  };

  public static getDecrypted = (longid: string): Key | undefined => { // eslint-disable-line @typescript-eslint/no-unused-vars
    return undefined; // tests don't need this
  };

  public static setArmored = (armored: string, k: Key) => { // eslint-disable-line @typescript-eslint/no-unused-vars
    // tests don't need this
  };

  public static getArmored = (armored: string): Key | undefined => { // eslint-disable-line @typescript-eslint/no-unused-vars
    return undefined; // tests don't need this
  };

}
