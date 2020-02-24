/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

export class KeyCache {

  public static setDecrypted = (k: OpenPGP.key.Key) => {
    // tests don't need this
  }

  public static getDecrypted = (longid: string): OpenPGP.key.Key | undefined => {
    return undefined; // tests don't need this
  }

  public static setArmored = (armored: string, k: OpenPGP.key.Key) => {
    // tests don't need this
  }

  public static getArmored = (armored: string): OpenPGP.key.Key | undefined => {
    return undefined; // tests don't need this
  }

}
