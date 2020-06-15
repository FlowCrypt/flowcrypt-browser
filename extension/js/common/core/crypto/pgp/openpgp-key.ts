/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { Key, PrvPacket, KeyAlgo, KeyUtil, KeyDetails$ids, KeyDetails } from '../key.js';
import { opgp } from './openpgpjs-custom.js';
import { Catch } from '../../../platform/catch.js';
import { Str } from '../../common.js';
import { PgpHash } from './pgp-hash.js';
import { Buf } from '../../buf.js';
import { PgpMsgMethod } from './pgp-msg.js';

const internal = Symbol('internal public key');

// todo - OpenPGPKey and PgpKey should be merged into one

export class OpenPGPKey {

  public static parse = async (text: string): Promise<Key> => {
    const result = await opgp.key.readArmored(text);
    if (result.err) {
      throw new Error('Cannot parse OpenPGP key: ' + result.err + ' for: ' + text);
    }
    return await OpenPGPKey.wrap(result.keys[0], {} as Key, text);
  }

  public static isPacketDecrypted = (pubkey: Key, keyid: string) => {
    return OpenPGPKey.unwrap(pubkey).isPacketDecrypted({ bytes: keyid });
  }

  public static asPublicKey = async (pubkey: Key): Promise<Key> => {
    if (pubkey.type !== 'openpgp') {
      throw new Error('Unsupported key type: ' + pubkey.type);
    }
    if (pubkey.isPrivate) {
      return await OpenPGPKey.wrap(OpenPGPKey.unwrap(pubkey).toPublic(), {} as Key);
    }
    return pubkey;
  }

  public static decryptKey = async (key: Key, passphrase: string, optionalKeyid?: string, optionalBehaviorFlag?: 'OK-IF-ALREADY-DECRYPTED'): Promise<boolean> => {
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

  public static encryptKey = async (key: Key, passphrase: string) => {
    const prv = OpenPGPKey.unwrap(key);
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

  public static decrypt = async (message: OpenPGP.message.Message, privateKeys: Key[], passwords?: string[]) => {
    return await message.decrypt(privateKeys.map(key => OpenPGPKey.unwrap(key)), passwords, undefined, false);
  }

  public static encrypt: PgpMsgMethod.Encrypt = async ({ pubkeys, signingPrv, pwd, data, filename, armor, date }) => {
    const message = opgp.message.fromBinary(data, filename, date);
    const options: OpenPGP.EncryptOptions = { armor, message, date };
    let usedChallenge = false;
    if (pubkeys) {
      options.publicKeys = [];
      for (const pubkey of pubkeys) {
        const { keys: publicKeys } = await opgp.key.readArmored(KeyUtil.armor(pubkey));
        options.publicKeys.push(...publicKeys);
        // TODO: Investigate why unwrapping doesn't work - probably the object
        // came from the background page so it wasn't properly deserialized
        // options.publicKeys.push(OpenPGPKey.unwrap(pubkey));
      }
    }
    if (pwd) {
      options.passwords = [await PgpHash.challengeAnswer(pwd)];
      usedChallenge = true;
    }
    if (!pubkeys && !usedChallenge) {
      throw new Error('no-pubkeys-no-challenge');
    }
    if (signingPrv) {
      const openPgpPrv = OpenPGPKey.unwrap(signingPrv);
      if (typeof openPgpPrv.isPrivate !== 'undefined' && openPgpPrv.isPrivate()) { // tslint:disable-line:no-unbound-method - only testing if exists
        options.privateKeys = [openPgpPrv];
      }
    }
    const result = await opgp.encrypt(options);
    if (typeof result.data === 'string') {
      return { data: Buf.fromUtfStr(result.data), signature: result.signature, type: 'openpgp' };
    } else {
      return result as unknown as OpenPGP.EncryptBinaryResult;
    }
  }

  public static isWithoutSelfCertifications = async (key: Key) => {
    const k = OpenPGPKey.unwrap(key);
    return await Catch.doesReject(k.verifyPrimaryKey(), ['No self-certifications']);
  }

  public static reformatKey = async (privateKey: Key, passphrase: string, userIds: { email: string | undefined; name: string }[], expireSeconds: number) => {
    const origPrv = OpenPGPKey.unwrap(privateKey);
    const keyPair = await opgp.reformatKey({ privateKey: origPrv, passphrase, userIds, keyExpirationTime: expireSeconds });
    return await OpenPGPKey.wrap(keyPair.key, {} as Key);
  }

  // TODO: should be private, will change when readMany is rewritten
  public static wrap = async (pubkey: OpenPGP.key.Key, pkey: Key, raw?: string): Promise<Key> => {
    let exp: null | Date | number;
    try {
      exp = await pubkey.getExpirationTime('encrypt');
    } catch (e) {
      // tslint:disable-next-line: no-null-keyword
      exp = null;
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
    const emails = pubkey.users
      .map(user => user.userId)
      .filter(userId => userId !== null)
      .map((userId: OpenPGP.packet.Userid) => {
        try {
          return opgp.util.parseUserId(userId.userid).email || '';
        } catch (e) {
          // ignore bad user IDs
        }
        return '';
      })
      .map(email => email.trim())
      .filter(email => email)
      .map(email => email.toLowerCase());
    let lastModified: undefined | Date;
    try {
      lastModified = new Date(await PgpKey.lastSigOpenPGP(pubkey));
    } catch (e) {
      //
    }
    const fingerprint = pubkey.getFingerprint();
    if (!fingerprint) {
      throw new Error('Key does not have a fingerprint and cannot be parsed.');
    }
    Object.assign(pkey, {
      type: 'openpgp',
      id: fingerprint.toUpperCase(),
      ids: (await Promise.all(pubkey.getKeyIds().map(({ bytes }) => PgpKey.longid(bytes)))).filter(Boolean) as string[],
      usableForEncryption: ! await Catch.doesReject(pubkey.getEncryptionKey()),
      usableButExpired: await OpenPGPKey.usableButExpired(pubkey, exp, expired),
      usableForSigning: await Catch.doesReject(pubkey.getSigningKey()),
      // valid emails extracted from uids
      emails,
      // full uids that have valid emails in them
      // tslint:disable-next-line: no-unsafe-any
      identities: pubkey.users.map(u => u.userId).filter(u => !!u && u.userid && Str.parseEmail(u.userid).email).map(u => u!.userid).filter(Boolean) as string[],
      lastModified,
      expiration: exp instanceof Date ? exp : undefined,
      created: pubkey.getCreationTime(),
      checkPassPhrase: _text => Promise.resolve(false), // this is assigned right below
      fullyDecrypted: pubkey.isPublic() ? true /* public keys are always decrypted */ : pubkey.isFullyDecrypted(),
      fullyEncrypted: pubkey.isPublic() ? false /* public keys are never encrypted */ : pubkey.isFullyEncrypted(),
      isPublic: pubkey.isPublic(),
      isPrivate: pubkey.isPrivate(),
    } as Key);
    pkey.checkPassPhrase = async passphrase => PgpKey.decrypt(await OpenPGPKey.parse(OpenPGPKey.armor(pkey)), passphrase);
    const extensions = pkey as unknown as { raw: string, [internal]: OpenPGP.key.Key };
    extensions[internal] = pubkey;
    extensions.raw = raw || pubkey.armor();
    return pkey;
  }

  /**
   * Returns signed data if detached=false, armored
   * Returns signature if detached=true, armored
   */
  public static sign = async (signingPrivate: Key, data: string, detached = false): Promise<string> => {
    const signingPrv = OpenPGPKey.unwrap(signingPrivate);
    const message = opgp.cleartext.fromText(data);
    const signRes = await opgp.sign({ message, armor: true, privateKeys: [signingPrv], detached });
    if (detached) {
      if (typeof signRes.signature !== 'string') {
        throw new Error('signRes.signature unexpectedly not a string when creating detached signature');
      }
      return signRes.signature;
    }
    return await opgp.stream.readToEnd((signRes as OpenPGP.SignArmorResult).data);
  }

  public static revoke = async (key: Key): Promise<string | undefined> => {
    let prv = OpenPGPKey.unwrap(key);
    if (! await prv.isRevoked()) {
      prv = await prv.revoke({});
    }
    const certificate = await prv.getRevocationCertificate();
    if (!certificate) {
      return undefined;
    } else if (typeof certificate === 'string') {
      return certificate;
    } else {
      return await opgp.stream.readToEnd(certificate);
    }
  }

  public static armor = (pubkey: Key): string => {
    if (pubkey.type !== 'openpgp') {
      throw new Error('Unsupported key type: ' + pubkey.type);
    }
    const extensions = pubkey as unknown as { raw: string };
    if (!extensions.raw) {
      throw new Error('Object has type == "openpgp" but no raw key.');
    }
    return extensions.raw;
  }

  private static unwrap = (pubkey: Key) => {
    if (pubkey.type !== 'openpgp') {
      throw new Error('Unsupported key type: ' + pubkey.type);
    }
    const raw = (pubkey as unknown as { [internal]: OpenPGP.key.Key })[internal];
    if (!raw) {
      throw new Error('Object has type == "openpgp" but no internal key.');
    }
    return raw;
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

export class PgpKey {

  public static create = async (
    userIds: { name: string, email: string }[], variant: KeyAlgo, passphrase: string, expireInMonths: number | undefined
  ): Promise<{ private: string, public: string }> => {
    const opt: OpenPGP.KeyOptions = { userIds, passphrase };
    if (variant === 'curve25519') {
      opt.curve = 'curve25519';
    } else if (variant === 'rsa2048') {
      opt.numBits = 2048;
    } else {
      opt.numBits = 4096;
    }
    if (expireInMonths) {
      opt.keyExpirationTime = 60 * 60 * 24 * 30 * expireInMonths; // seconds from now
    }
    const k = await opgp.generateKey(opt);
    return { public: k.publicKeyArmored, private: k.privateKeyArmored };
  }

  public static isPacketPrivate = (p: OpenPGP.packet.AnyKeyPacket): p is PrvPacket => {
    return p.tag === opgp.enums.packet.secretKey || p.tag === opgp.enums.packet.secretSubkey;
  }

  public static decrypt = async (key: Key, passphrase: string, optionalKeyid?: string, optionalBehaviorFlag?: 'OK-IF-ALREADY-DECRYPTED'): Promise<boolean> => {
    // TODO: Delegate to appropriate key type
    return await OpenPGPKey.decryptKey(key, passphrase, optionalKeyid, optionalBehaviorFlag);
  }

  public static encrypt = async (key: Key, passphrase: string) => {
    // TODO: Delegate to appropriate key type
    return await OpenPGPKey.encryptKey(key, passphrase);
  }

  public static reformatKey = async (privateKey: Key, passphrase: string, userIds: { email: string | undefined; name: string }[], expireSeconds: number) => {
    // TODO: Delegate to appropriate key type
    return await OpenPGPKey.reformatKey(privateKey, passphrase, userIds, expireSeconds);
  }

  public static isPacketDecrypted = (pubkey: Key, keyId: string) => {
    // TODO: Delegate to appropriate key type
    return OpenPGPKey.isPacketDecrypted(pubkey, keyId);
  }

  public static fingerprint = async (key: Key | OpenPGP.key.Key): Promise<string | undefined> => {
    if ('id' in key) {
      return key.id;
    }
    return key.getFingerprint().toUpperCase();
  }

  public static longid = async (keyOrFingerprintOrBytesOrLongid: string | Key | undefined | OpenPGP.key.Key): Promise<string | undefined> => {
    if (!keyOrFingerprintOrBytesOrLongid) {
      return undefined;
    } else if (typeof keyOrFingerprintOrBytesOrLongid === 'string' && keyOrFingerprintOrBytesOrLongid.length === 8) {
      return opgp.util.str_to_hex(keyOrFingerprintOrBytesOrLongid).toUpperCase(); // in binary form
    } else if (typeof keyOrFingerprintOrBytesOrLongid === 'string' && keyOrFingerprintOrBytesOrLongid.length === 16) {
      return keyOrFingerprintOrBytesOrLongid.toUpperCase(); // already a longid
    } else if (typeof keyOrFingerprintOrBytesOrLongid === 'string' && /^[a-fA-F0-9]+$/.test(keyOrFingerprintOrBytesOrLongid)) {
      // this case catches all hexadecimal strings and shortens them to 16 characters
      // it's used for both OpenPGP fingerprints and S/MIME serial numbers that can vary in length
      return keyOrFingerprintOrBytesOrLongid.substr(-16).toUpperCase(); // was a fingerprint
    } else if (typeof keyOrFingerprintOrBytesOrLongid === 'string' && keyOrFingerprintOrBytesOrLongid.length === 49) {
      return keyOrFingerprintOrBytesOrLongid.replace(/ /g, '').substr(-16); // spaced fingerprint
    } else if (typeof keyOrFingerprintOrBytesOrLongid === 'string') {
      return await PgpKey.longid(await KeyUtil.parse(keyOrFingerprintOrBytesOrLongid));
    } else if ('getFingerprint' in keyOrFingerprintOrBytesOrLongid) {
      return await PgpKey.longid(keyOrFingerprintOrBytesOrLongid.getFingerprint().toUpperCase());
    }
    return await PgpKey.longid(keyOrFingerprintOrBytesOrLongid.id);
  }

  public static longids = async (keyIds: string[]) => {
    const longids: string[] = [];
    for (const id of keyIds) {
      const longid = await PgpKey.longid(id);
      if (longid) {
        longids.push(longid);
      }
    }
    return longids;
  }

  public static details = async (k: OpenPGP.key.Key): Promise<KeyDetails> => {
    const keys = k.getKeys();
    const algoInfo = k.primaryKey.getAlgorithmInfo();
    const algo = { algorithm: algoInfo.algorithm, bits: algoInfo.bits, curve: (algoInfo as any).curve, algorithmId: opgp.enums.publicKey[algoInfo.algorithm] };
    const created = k.primaryKey.created.getTime() / 1000;
    const ids: KeyDetails$ids[] = [];
    for (const key of keys) {
      const fingerprint = key.getFingerprint().toUpperCase();
      if (fingerprint) {
        const longid = await PgpKey.longid(fingerprint);
        if (longid) {
          const shortid = longid.substr(-8);
          ids.push({ fingerprint, longid, shortid });
        }
      }
    }
    return {
      private: k.isPrivate() ? k.armor() : undefined,
      isFullyDecrypted: k.isPrivate() ? k.isFullyDecrypted() : undefined,
      isFullyEncrypted: k.isPrivate() ? k.isFullyEncrypted() : undefined,
      // TODO this is not yet optimal as it armors and then parses the key again
      public: await KeyUtil.parse(k.toPublic().armor()),
      users: k.getUserIds(),
      ids,
      algo,
      created,
    };
  }

  /**
   * Get latest self-signature date, in utc millis.
   * This is used to figure out how recently was key updated, and if one key is newer than other.
   */
  public static lastSigOpenPGP = async (key: OpenPGP.key.Key): Promise<number> => {
    await key.getExpirationTime(); // will force all sigs to be verified
    const allSignatures: OpenPGP.packet.Signature[] = [];
    for (const user of key.users) {
      allSignatures.push(...user.selfCertifications);
    }
    for (const subKey of key.subKeys) {
      allSignatures.push(...subKey.bindingSignatures);
    }
    allSignatures.sort((a, b) => b.created.getTime() - a.created.getTime());
    const newestSig = allSignatures.find(sig => sig.verified === true);
    if (newestSig) {
      return newestSig.created.getTime();
    }
    throw new Error('No valid signature found in key');
  }

  public static revoke = async (key: Key): Promise<string | undefined> => {
    // TODO: Delegate to appropriate key type
    return await OpenPGPKey.revoke(key);
  }

}
