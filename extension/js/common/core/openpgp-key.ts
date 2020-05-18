/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { Pubkey, PgpKey } from './pgp-key.js';
import { opgp } from './pgp.js';
import { Catch } from '../platform/catch.js';
import { PgpArmor } from './pgp-armor.js';
import { Str } from './common.js';

const internal = Symbol('internal public key');

export class OpenPGPKey {

  public static parse = async (text: string): Promise<Pubkey> => {
    const result = await opgp.key.readArmored(text);
    if (result.err) {
      throw new Error('Cannot parse OpenPGP key: ' + result.err + ' for: ' + text);
    }
    return await OpenPGPKey.wrap(result.keys[0], text);
  }

  public static isPacketDecrypted = (pubkey: Pubkey, keyid: string) => {
    return OpenPGPKey.unwrap(pubkey).isPacketDecrypted({ bytes: keyid });
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

  public static decrypt = async (message: OpenPGP.message.Message, privateKeys: Pubkey[], passwords?: string[]) => {
    return await message.decrypt(privateKeys.map(key => OpenPGPKey.unwrap(key)), passwords, undefined, false);
  }

  public static reformatKey = async (privateKey: Pubkey, passphrase: string, userIds: { email: string | undefined; name: string }[], expireSeconds: number) => {
    const origPrv = OpenPGPKey.unwrap(privateKey);
    const keyPair = await opgp.reformatKey({ privateKey: origPrv, passphrase, userIds, keyExpirationTime: expireSeconds });
    return await OpenPGPKey.wrap(keyPair.key);
  }

  // TODO: should be private, will change when readMany is rewritten
  public static wrap = async (pubkey: OpenPGP.key.Key, armored?: string): Promise<Pubkey> => {
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
    const pkey: Pubkey = {
      type: 'openpgp',
      id: pubkey.getFingerprint().toUpperCase(),
      ids: (await Promise.all(pubkey.getKeyIds().map(({ bytes }) => PgpKey.longid(bytes)))).filter(Boolean) as string[],
      unparsed: armored || pubkey.armor(),
      usableForEncryption,
      usableButExpired,
      usableForSigning: await Catch.doesReject(pubkey.getSigningKey()),
      emails,
      // tslint:disable-next-line: no-unsafe-any
      identities: pubkey.users.map(u => u.userId).filter(u => !!u && u.userid && Str.parseEmail(u.userid).email).map(u => u!.userid).filter(Boolean) as string[],
      lastModified: new Date(await PgpKey.lastSigOpenPGP(pubkey)),
      expiration: exp instanceof Date ? exp : undefined,
      created: pubkey.getCreationTime(),
      checkPassword: _text => Promise.resolve(false),
      fullyDecrypted: pubkey.isFullyDecrypted(),
      fullyEncrypted: pubkey.isFullyEncrypted(),
      isPublic: pubkey.isPublic(),
      isPrivate: pubkey.isPrivate(),
    };
    pkey.checkPassword = passphrase => PgpKey.decrypt(pkey, passphrase);
    (pkey as any)[internal] = pubkey;
    return pkey;
  }

  private static unwrap = (pubkey: Pubkey) => {
    if (pubkey.type !== 'openpgp') {
      throw new Error('Unsupported key type: ' + pubkey.type);
    }
    return ((pubkey as any)[internal] as OpenPGP.key.Key);
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
