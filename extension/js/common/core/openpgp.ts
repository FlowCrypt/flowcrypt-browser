/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { Pubkey, PgpKey } from './pgp-key.js';
import { opgp } from './pgp.js';
import { Catch } from '../platform/catch.js';
import { PgpArmor } from './pgp-armor.js';

export class OpenPGPKey {

  public static parse = async (text: string): Promise<Pubkey> => {
    const result = await opgp.key.readArmored(text);
    if (result.err) {
      throw new Error('Cannot parse OpenPGP key: ' + result.err + ' for: ' + text);
    }
    const pubkey = result.keys[0];
    const exp = await pubkey.getExpirationTime('encrypt');
    const expired = () => {
      if (exp === Infinity || !exp) {
        return false;
      }
      if (exp instanceof Date) {
        return Date.now() > exp.getTime();
      }
      throw new Error(`Got unexpected value for expiration: ${exp}`);
    };
    const usableButExpired = await OpenPGPKey.usableButExpired(pubkey, exp, expired);
    let usableForEncryption = false;
    if (! await Catch.doesReject(pubkey.getEncryptionKey())) {
      usableForEncryption = true; // good key - cannot be expired
    } else {
      usableForEncryption = usableButExpired;
    }
    const emails = pubkey.users
      .map(user => user.userId)
      .filter(userId => userId !== null)
      .map((userId: OpenPGP.packet.Userid) => opgp.util.parseUserId(userId.userid).email || '')
      .filter(email => email)
      .map(email => email.toLowerCase());
    return {
      type: 'openpgp',
      id: pubkey.getFingerprint().toUpperCase(),
      unparsed: text,
      usableForEncryption,
      usableButExpired,
      usableForSigning: await Catch.doesReject(pubkey.getSigningKey()),
      emails,
      lastModified: new Date(await PgpKey.lastSigOpenPGP(pubkey)),
      expiration: exp instanceof Date ? exp : undefined,
      created: pubkey.getCreationTime(),
      checkPassword: passphrase => PgpKey.decrypt(pubkey, passphrase)
    };
  }

  public static asPublicKey = async (pubkey: Pubkey): Promise<Pubkey> => {
    if (pubkey.type !== 'openpgp') {
      throw new Error('Unsupported key type: ' + pubkey.type);
    }
    if (pubkey.unparsed.includes(PgpArmor.headers('privateKey').begin)) { // wrongly saving prv instead of pub
      Catch.report('Wrongly saving prv as contact - converting to pubkey');
      const key = await PgpKey.readAsOpenPGP(pubkey.unparsed);
      pubkey.unparsed = key.toPublic().armor();
    }
    return pubkey;
  }

  private static usableButExpired = async (key: OpenPGP.key.Key, exp: Date | number | null, expired: () => boolean): Promise<boolean> => {
    if (!key) {
      return false;
    }
    if (!await Catch.doesReject(key.getEncryptionKey())) {
      return false;
    }
    if (exp === null || typeof exp === 'number') {
      // If key does not expire (exp == Infinity) the encryption key should be available.
      return false;
    }
    const oneSecondBeforeExpiration = exp && expired() ? new Date(exp.getTime() - 1000) : undefined;
    if (typeof oneSecondBeforeExpiration === 'undefined') {
      return false;
    }
    try {
      await key.getEncryptionKey(undefined, oneSecondBeforeExpiration);
      return true;
    } catch (e) {
      return false;
    }
  }
}
