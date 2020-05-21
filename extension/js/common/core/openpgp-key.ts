/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { Pubkey, PgpKey, PrvPacket } from './pgp-key.js';
import { opgp } from './pgp.js';
import { Catch } from '../platform/catch.js';
import { Str } from './common.js';

const internal = Symbol('internal public key');

export class OpenPGPKey {

  public static parse = async (text: string): Promise<Pubkey> => {
    const result = await opgp.key.readArmored(text);
    if (result.err) {
      throw new Error('Cannot parse OpenPGP key: ' + result.err + ' for: ' + text);
    }
    return await OpenPGPKey.wrap(result.keys[0], {} as Pubkey, text);
  }

  public static isPacketDecrypted = (pubkey: Pubkey, keyid: string) => {
    return OpenPGPKey.unwrap(pubkey).isPacketDecrypted({ bytes: keyid });
  }

  public static asPublicKey = async (pubkey: Pubkey): Promise<Pubkey> => {
    if (pubkey.type !== 'openpgp') {
      throw new Error('Unsupported key type: ' + pubkey.type);
    }
    if (pubkey.isPrivate) {
      return await OpenPGPKey.wrap(OpenPGPKey.unwrap(pubkey).toPublic(), {} as Pubkey);
    }
    return pubkey;
  }

  public static decryptKey = async (key: Pubkey, passphrase: string, optionalKeyid?: string, optionalBehaviorFlag?: 'OK-IF-ALREADY-DECRYPTED'): Promise<boolean> => {
    const prv = OpenPGPKey.unwrap(key);
    if (!prv.isPrivate()) {
      throw new Error("Nothing to decrypt in a public key");
    }
    const chosenPrvPackets = prv.getKeys(optionalKeyid ? { bytes: optionalKeyid } : undefined).map(k => k.keyPacket).filter(PgpKey.isPacketPrivate) as PrvPacket[];
    if (!chosenPrvPackets.length) {
      throw new Error(`No private key packets selected of ${prv.getKeys().map(k => k.keyPacket).filter(PgpKey.isPacketPrivate).length} prv packets available`);
    }
    for (const prvPacket of chosenPrvPackets) {
      if (prvPacket.isDecrypted()) {
        if (optionalBehaviorFlag === 'OK-IF-ALREADY-DECRYPTED') {
          continue;
        } else {
          throw new Error("Decryption failed - key packet was already decrypted");
        }
      }
      try {
        await prvPacket.decrypt(passphrase); // throws on password mismatch
      } catch (e) {
        if (e instanceof Error && e.message.toLowerCase().includes('incorrect key passphrase')) {
          return false;
        }
        throw e;
      }
    }
    await OpenPGPKey.wrap(prv, key);
    return true;
  }

  public static encryptKey = async (key: Pubkey, passphrase: string) => {
    const prv = await OpenPGPKey.unwrap(key);
    if (!passphrase || passphrase === 'undefined' || passphrase === 'null') {
      throw new Error(`Encryption passphrase should not be empty:${typeof passphrase}:${passphrase}`);
    }
    const secretPackets = prv.getKeys().map(k => k.keyPacket).filter(PgpKey.isPacketPrivate);
    const encryptedPacketCount = secretPackets.filter(p => !p.isDecrypted()).length;
    if (!secretPackets.length) {
      throw new Error(`No private key packets in key to encrypt. Is this a private key?`);
    }
    if (encryptedPacketCount) {
      throw new Error(`Cannot encrypt a key that has ${encryptedPacketCount} of ${secretPackets.length} private packets still encrypted`);
    }
    await prv.encrypt(passphrase);
    if (!prv.isFullyEncrypted()) {
      throw new Error('Expected key to be fully encrypted after prv.encrypt');
    }
    await OpenPGPKey.wrap(prv, key);
  }

  public static decrypt = async (message: OpenPGP.message.Message, privateKeys: Pubkey[], passwords?: string[]) => {
    return await message.decrypt(privateKeys.map(key => OpenPGPKey.unwrap(key)), passwords, undefined, false);
  }

  public static reformatKey = async (privateKey: Pubkey, passphrase: string, userIds: { email: string | undefined; name: string }[], expireSeconds: number) => {
    const origPrv = OpenPGPKey.unwrap(privateKey);
    const keyPair = await opgp.reformatKey({ privateKey: origPrv, passphrase, userIds, keyExpirationTime: expireSeconds });
    return await OpenPGPKey.wrap(keyPair.key, {} as Pubkey);
  }

  // TODO: should be private, will change when readMany is rewritten
  public static wrap = async (pubkey: OpenPGP.key.Key, pkey: Pubkey, armored?: string): Promise<Pubkey> => {
    // tslint:disable-next-line: no-null-keyword
    let exp: null | Date | number = null;
    try {
      exp = await pubkey.getExpirationTime('encrypt');
    } catch (e) {
      //
    }
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
    let lastModified: undefined | Date;
    try {
      lastModified = new Date(await PgpKey.lastSigOpenPGP(pubkey));
    } catch (e) {
      //
    }
    Object.assign(pkey, {
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
      lastModified,
      expiration: exp instanceof Date ? exp : undefined,
      created: pubkey.getCreationTime(),
      checkPassword: _text => Promise.resolve(false),
      fullyDecrypted: pubkey.isPublic() ? true /* public keys are always decrypted */ : pubkey.isFullyDecrypted(),
      fullyEncrypted: pubkey.isPublic() ? false /* public keys are never encrypted */ : pubkey.isFullyEncrypted(),
      isPublic: pubkey.isPublic(),
      isPrivate: pubkey.isPrivate(),
    } as Pubkey);
    pkey.checkPassword = async passphrase => PgpKey.decrypt(await OpenPGPKey.parse(pkey.unparsed), passphrase);
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
