/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { Key, PrvPacket, KeyAlgo, KeyUtil, UnexpectedKeyTypeError } from '../key.js';
import { opgp } from './openpgpjs-custom.js';
import { Catch } from '../../../platform/catch.js';
import { Str } from '../../common.js';
import { PgpHash } from './pgp-hash.js';
import { Buf } from '../../buf.js';
import { PgpMsgMethod, MsgUtil } from './msg-util.js';

const internal = Symbol('internal openpgpjs library format key');

export class OpenPGPKey {

  private static readonly encryptionText = 'This is the text we are encrypting!';


  public static parse = async (text: string): Promise<Key> => {
    // TODO: Should we throw if more keys are in the armor?
    return (await OpenPGPKey.parseMany(text))[0];
  }

  public static parseMany = async (text: string): Promise<Key[]> => {
    const result = await opgp.key.readArmored(text);
    if (result.err) {
      throw new Error('Cannot parse OpenPGP key: ' + result.err + ' for: ' + text);
    }
    const keys = [];
    for (const key of result.keys) {
      keys.push(await OpenPGPKey.convertExternalLibraryObjToKey(key));
    }
    return keys;
  }

  public static asPublicKey = async (pubkey: Key): Promise<Key> => {
    if (pubkey.type !== 'openpgp') {
      throw new UnexpectedKeyTypeError(`Key type is ${pubkey.type}, expecting OpenPGP`);
    }
    if (pubkey.isPrivate) {
      return await OpenPGPKey.convertExternalLibraryObjToKey(OpenPGPKey.extractExternalLibraryObjFromKey(pubkey).toPublic());
    }
    return pubkey;
  }

  public static decryptKey = async (key: Key, passphrase: string, optionalKeyid?: OpenPGP.Keyid, optionalBehaviorFlag?: 'OK-IF-ALREADY-DECRYPTED'): Promise<boolean> => {
    const prv = OpenPGPKey.extractExternalLibraryObjFromKey(key);
    if (!prv.isPrivate()) {
      throw new Error("Nothing to decrypt in a public key");
    }
    const chosenPrvPackets = prv.getKeys(optionalKeyid).map(k => k.keyPacket).filter(OpenPGPKey.isPacketPrivate) as PrvPacket[];
    if (!chosenPrvPackets.length) {
      throw new Error(`No private key packets selected of ${prv.getKeys().map(k => k.keyPacket).filter(OpenPGPKey.isPacketPrivate).length} prv packets available`);
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
    await OpenPGPKey.convertExternalLibraryObjToKey(prv, key);
    return true;
  }

  public static encryptKey = async (key: Key, passphrase: string) => {
    const prv = OpenPGPKey.extractExternalLibraryObjFromKey(key);
    if (!passphrase || passphrase === 'undefined' || passphrase === 'null') {
      throw new Error(`Encryption passphrase should not be empty:${typeof passphrase}:${passphrase}`);
    }
    const secretPackets = prv.getKeys().map(k => k.keyPacket).filter(OpenPGPKey.isPacketPrivate);
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
    await OpenPGPKey.convertExternalLibraryObjToKey(prv, key);
  }

  public static decryptMessage = async (message: OpenPGP.message.Message, privateKeys: Key[], passwords?: string[]) => {
    return await message.decrypt(privateKeys.map(key => OpenPGPKey.extractExternalLibraryObjFromKey(key)), passwords, undefined, false);
  }

  public static encryptMessage: PgpMsgMethod.Encrypt = async ({ pubkeys, signingPrv, pwd, data, filename, armor, date }) => {
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
      const openPgpPrv = OpenPGPKey.extractExternalLibraryObjFromKey(signingPrv);
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
    const opgpPrv = OpenPGPKey.extractExternalLibraryObjFromKey(key);
    return await Catch.doesReject(opgpPrv.verifyPrimaryKey(), ['No self-certifications']);
  }

  public static reformatKey = async (privateKey: Key, passphrase: string, userIds: { email: string | undefined; name: string }[], expireSeconds: number) => {
    const opgpPrv = OpenPGPKey.extractExternalLibraryObjFromKey(privateKey);
    const keyPair = await opgp.reformatKey({ privateKey: opgpPrv, passphrase, userIds, keyExpirationTime: expireSeconds });
    return await OpenPGPKey.convertExternalLibraryObjToKey(keyPair.key);
  }

  /**
   * TODO: should be private, will change when readMany is rewritten
   * @param opgpKey - original OpenPGP.js key
   * @param keyToUpdate - an existing Key object to update, optional. Useful in encryptKey and decryptKey, because the operation
   *    is done on the original supplied object.
   */
  public static convertExternalLibraryObjToKey = async (opgpKey: OpenPGP.key.Key, keyToUpdate?: Key): Promise<Key> => {
    let exp: null | Date | number;
    try {
      exp = await opgpKey.getExpirationTime('encrypt');
    } catch (e) {
      // tslint:disable-next-line: no-null-keyword
      exp = null;
    }
    const expired = () => {
      if (exp === Infinity || !exp) {
        return false;
      }
      // According to the documentation expiration is either undefined, Infinity
      // (typeof number) or a Date object. So in this case `exp` should never
      // be of type number.
      if (typeof exp === 'number') {
        throw new Error(`Got unexpected value for expiration: ${exp}`);
      }
      return Date.now() > exp.getTime();
    };
    const emails = opgpKey.users
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
    let lastModified: undefined | number;
    try {
      lastModified = await OpenPGPKey.getLastSigTime(opgpKey);
    } catch (e) {
      // never had any valid signature
    }
    const fingerprint = opgpKey.getFingerprint();
    if (!fingerprint) {
      throw new Error('Key does not have a fingerprint and cannot be parsed.');
    }
    const algoInfo = opgpKey.primaryKey.getAlgorithmInfo();
    const key = keyToUpdate || {} as Key; // if no key to update, use empty object, will get props assigned below
    Object.assign(key, {
      type: 'openpgp',
      id: fingerprint.toUpperCase(),
      allIds: opgpKey.getKeys().map(k => k.getFingerprint().toUpperCase()),
      usableForEncryption: ! await Catch.doesReject(opgpKey.getEncryptionKey()),
      usableButExpired: await OpenPGPKey.usableButExpired(opgpKey, exp, expired),
      usableForSigning: ! await Catch.doesReject(opgpKey.getSigningKey()),
      // valid emails extracted from uids
      emails,
      // full uids that have valid emails in them
      // tslint:disable-next-line: no-unsafe-any
      identities: opgpKey.users.map(u => u.userId).filter(u => !!u && u.userid && Str.parseEmail(u.userid).email).map(u => u!.userid).filter(Boolean) as string[],
      lastModified,
      expiration: exp instanceof Date ? exp.getTime() : undefined,
      created: opgpKey.getCreationTime().getTime(),
      fullyDecrypted: opgpKey.isPublic() ? true /* public keys are always decrypted */ : opgpKey.isFullyDecrypted(),
      fullyEncrypted: opgpKey.isPublic() ? false /* public keys are never encrypted */ : opgpKey.isFullyEncrypted(),
      isPublic: opgpKey.isPublic(),
      isPrivate: opgpKey.isPrivate(),
      algo: {
        algorithm: algoInfo.algorithm,
        bits: algoInfo.bits,
        curve: (algoInfo as any).curve as string | undefined,
        algorithmId: opgp.enums.publicKey[algoInfo.algorithm]
      },
    } as Key);
    (key as any)[internal] = opgpKey;
    (key as any).raw = opgpKey.armor();
    return key;
  }

  /**
   * Returns signed data if detached=false, armored
   * Returns signature if detached=true, armored
   */
  public static sign = async (signingPrivate: Key, data: string, detached = false): Promise<string> => {
    const signingPrv = OpenPGPKey.extractExternalLibraryObjFromKey(signingPrivate);
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
    let prv = OpenPGPKey.extractExternalLibraryObjFromKey(key);
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
      throw new UnexpectedKeyTypeError(`Key type is ${pubkey.type}, expecting OpenPGP`);
    }
    const extensions = pubkey as unknown as { raw: string };
    if (!extensions.raw) {
      throw new Error('Object has type == "openpgp" but no raw key.');
    }
    return extensions.raw;
  }

  public static keyFlagsToString = (flags: OpenPGP.enums.keyFlags): string => {
    const strs: string[] = [];
    if (flags & opgp.enums.keyFlags.sign_data) {
      strs.push('sign_data');
    }
    if (flags & opgp.enums.keyFlags.certify_keys) {
      strs.push('certify_keys');
    }
    if (flags & opgp.enums.keyFlags.encrypt_communication) {
      strs.push('encrypt_communication');
    }
    if (flags & opgp.enums.keyFlags.encrypt_storage) {
      strs.push('encrypt_storage');
    }
    if (strs.length === 0) {
      return '[none]';
    }
    return strs.join(', ');
  }

  public static diagnose = async (pubkey: Key, appendResult: (text: string, f?: () => Promise<unknown>) => Promise<void>) => {
    const key = OpenPGPKey.extractExternalLibraryObjFromKey(pubkey);
    if (!key.isPrivate() && !key.isPublic()) {
      await appendResult(`key is neither public or private!!`);
      return;
    }
    await appendResult(`Is Private?`, async () => key.isPrivate());
    for (let i = 0; i < key.users.length; i++) {
      await appendResult(`User id ${i}`, async () => key.users[i].userId!.userid);
    }
    await appendResult(`Primary User`, async () => {
      const user = await key.getPrimaryUser();
      return user?.user?.userId?.userid || 'No primary user';
    });
    await appendResult(`Fingerprint`, async () => Str.spaced(key.getFingerprint().toUpperCase() || 'err'));
    await appendResult(`Subkeys`, async () => key.subKeys ? key.subKeys.length : key.subKeys);
    await appendResult(`Primary key algo`, async () => key.primaryKey.algorithm);
    await appendResult(`Usage`, async () => {
      const flags = await OpenPGPKey.getPrimaryKeyFlags(key);
      return OpenPGPKey.keyFlagsToString(flags);
    });
    if (key.isPrivate()) {
      const pubkey = await KeyUtil.parse(key.armor());
      await appendResult(`key decrypt`, async () => KeyUtil.decrypt(pubkey, String($('.input_passphrase').val())));
      await appendResult(`isFullyDecrypted`, async () => key.isFullyDecrypted());
      await appendResult(`isFullyEncrypted`, async () => key.isFullyEncrypted());
    }
    await appendResult(`Primary key verify`, async () => {
      await key.verifyPrimaryKey(); // throws
      return `valid`;
    });
    await appendResult(`Primary key creation?`, async () => OpenPGPKey.formatDate(await key.getCreationTime()));
    await appendResult(`Primary key expiration?`, async () => OpenPGPKey.formatDate(await key.getExpirationTime()));
    const encryptResult = await OpenPGPKey.testEncryptDecrypt(key);
    await Promise.all(encryptResult.map(msg => appendResult(`Encrypt/Decrypt test: ${msg}`)));
    if (key.isPrivate()) {
      await appendResult(`Sign/Verify test`, async () => await OpenPGPKey.testSignVerify(key));
    }
    for (let subKeyIndex = 0; subKeyIndex < key.subKeys.length; subKeyIndex++) {
      const subKey = key.subKeys[subKeyIndex];
      const skn = `SK ${subKeyIndex} >`;
      await appendResult(`${skn} LongId`, async () => OpenPGPKey.bytesToLongid(subKey.getKeyId().bytes));
      await appendResult(`${skn} Created`, async () => OpenPGPKey.formatDate(subKey.keyPacket.created));
      await appendResult(`${skn} Algo`, async () => `${subKey.getAlgorithmInfo().algorithm}`);
      await appendResult(`${skn} Verify`, async () => {
        await subKey.verify(key.primaryKey);
        return 'OK';
      });
      await appendResult(`${skn} Usage`, async () => {
        const flags = await OpenPGPKey.getSubKeySigningFlags(key, subKey) |
          await OpenPGPKey.getSubKeyEncryptionFlags(key, subKey);
        return OpenPGPKey.keyFlagsToString(flags);
      });
      await appendResult(`${skn} Subkey tag`, async () => subKey.keyPacket.tag);
      await appendResult(`${skn} Subkey getBitSize`, async () => subKey.getAlgorithmInfo().bits);       // No longer exists on object
      await appendResult(`${skn} Subkey decrypted`, async () => subKey.isDecrypted());
      await appendResult(`${skn} Binding signature length`, async () => subKey.bindingSignatures.length);
      for (let sigIndex = 0; sigIndex < subKey.bindingSignatures.length; sigIndex++) {
        const sig = subKey.bindingSignatures[sigIndex];
        const sgn = `${skn} SIG ${sigIndex} >`;
        await appendResult(`${sgn} Key flags`, async () => sig.keyFlags);
        await appendResult(`${sgn} Tag`, async () => sig.tag);
        await appendResult(`${sgn} Version`, async () => sig.version);
        await appendResult(`${sgn} Public key algorithm`, async () => sig.publicKeyAlgorithm);
        await appendResult(`${sgn} Sig creation time`, async () => OpenPGPKey.formatDate(sig.created));
        await appendResult(`${sgn} Sig expiration time`, async () => {
          if (!subKey.keyPacket.created) {
            return 'unknown key creation time';
          }
          return OpenPGPKey.formatDate(subKey.keyPacket.created, sig.keyExpirationTime);
        });
        await appendResult(`${sgn} Verified`, async () => sig.verified);
      }
    }
  }

  public static bytesToLongid = (binaryString: string) => {
    if (binaryString.length !== 8) {
      throw new Error(`Unexpected keyid bytes format (len: ${binaryString.length}): "${binaryString}"`);
    }
    return opgp.util.str_to_hex(binaryString).toUpperCase();
  }

  public static fingerprintToLongid = (fingerprint: string) => {
    if (fingerprint.length === 32) { // s/mime keys
      return fingerprint; // leave as is - s/mime has no concept of longids
    }
    if (fingerprint.length === 40) { // pgp keys
      return fingerprint.substr(-16).toUpperCase();
    }
    throw new Error(`Unexpected fingerprint format (len: ${fingerprint.length}): "${fingerprint}"`);
  }

  /**
   * todo - could return a Key
   */
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

  public static isPacketDecrypted = (pubkey: Key, keyid: OpenPGP.Keyid) => {
    return OpenPGPKey.extractExternalLibraryObjFromKey(pubkey).isPacketDecrypted(keyid);
  }

  // mimicks OpenPGP.helper.getLatestValidSignature
  private static getLatestValidSignature = async (signatures: OpenPGP.packet.Signature[],
    primaryKey: OpenPGP.packet.PublicKey | OpenPGP.packet.SecretKey,
    signatureType: OpenPGP.enums.signature,
    dataToVerify: any,
    date = new Date()):
    Promise<OpenPGP.packet.Signature | undefined> => {
    let signature: OpenPGP.packet.Signature | undefined;
    for (let i = signatures.length - 1; i >= 0; i--) {
      try {
        if (
          (!signature || signatures[i].created >= signature.created) &&
          // check binding signature is not expired (ie, check for V4 expiration time)
          !signatures[i].isExpired(date) &&
          // check binding signature is verified
          (signatures[i].verified || await signatures[i].verify(primaryKey, signatureType, dataToVerify))
        ) {
          signature = signatures[i];
        }
      } catch (e) {
        // skip signature with failed verification
      }
    }
    return signature;
  }

  private static getValidEncryptionKeyPacketFlags = (keyPacket: OpenPGP.packet.PublicKey | OpenPGP.packet.SecretKey, signature: OpenPGP.packet.Signature): OpenPGP.enums.keyFlags => {
    if (!signature.keyFlags || !signature.verified || signature.revoked !== false) { // Sanity check
      return 0;
    }
    if ([
      opgp.enums.publicKey.dsa,
      opgp.enums.publicKey.rsa_sign,
      opgp.enums.publicKey.ecdsa,
      opgp.enums.publicKey.eddsa].includes(keyPacket.algorithm)) {
      return 0; // disallow encryption for these algorithms
    }
    return signature.keyFlags[0] & (opgp.enums.keyFlags.encrypt_communication | opgp.enums.keyFlags.encrypt_storage);
  }

  private static getValidSigningKeyPacketFlags = (keyPacket: OpenPGP.packet.PublicKey | OpenPGP.packet.SecretKey,
    signature: OpenPGP.packet.Signature): OpenPGP.enums.keyFlags => {
    if (!signature.keyFlags || !signature.verified || signature.revoked !== false) { // Sanity check
      return 0;
    }
    if ([
      opgp.enums.publicKey.rsa_encrypt,
      opgp.enums.publicKey.elgamal,
      opgp.enums.publicKey.ecdh].includes(keyPacket.algorithm)) {
      return 0; // disallow signing for these algorithms
    }
    return signature.keyFlags[0] & (opgp.enums.keyFlags.sign_data | opgp.enums.keyFlags.certify_keys);
  }

  private static getSubKeySigningFlags = async (key: OpenPGP.key.Key, subKey: OpenPGP.key.SubKey): Promise<OpenPGP.enums.keyFlags> => {
    const primaryKey = key.keyPacket;
    // await subKey.verify(primaryKey);
    const dataToVerify = { key: primaryKey, bind: subKey.keyPacket };
    const date = new Date();
    const bindingSignature = await OpenPGPKey.getLatestValidSignature(subKey.bindingSignatures, primaryKey,
      opgp.enums.signature.subkey_binding,
      dataToVerify, date);
    if (
      bindingSignature &&
      bindingSignature.embeddedSignature &&
      await OpenPGPKey.getLatestValidSignature([bindingSignature.embeddedSignature], subKey.keyPacket, opgp.enums.signature.key_binding, dataToVerify, date)
    ) {
      return OpenPGPKey.getValidSigningKeyPacketFlags(subKey.keyPacket, bindingSignature);
    }
    return 0;
  }

  private static getSubKeyEncryptionFlags = async (key: OpenPGP.key.Key, subKey: OpenPGP.key.SubKey): Promise<OpenPGP.enums.keyFlags> => {
    const primaryKey = key.keyPacket;
    // await subKey.verify(primaryKey);
    const dataToVerify = { key: primaryKey, bind: subKey.keyPacket };
    const date = new Date();
    const bindingSignature = await OpenPGPKey.getLatestValidSignature(subKey.bindingSignatures, primaryKey,
      opgp.enums.signature.subkey_binding,
      dataToVerify, date);
    if (bindingSignature) {
      return OpenPGPKey.getValidEncryptionKeyPacketFlags(subKey.keyPacket, bindingSignature);
    }
    return 0;
  }

  private static getPrimaryKeyFlags = async (key: OpenPGP.key.Key): Promise<OpenPGP.enums.keyFlags> => {
    const primaryUser = await key.getPrimaryUser();
    return OpenPGPKey.getValidEncryptionKeyPacketFlags(key.keyPacket, primaryUser.selfCertification)
      | OpenPGPKey.getValidSigningKeyPacketFlags(key.keyPacket, primaryUser.selfCertification);
  }

  /**
   * Get latest self-signature date, in utc millis.
   * This is used to figure out how recently was key updated, and if one key is newer than other.
   */
  private static getLastSigTime = async (key: OpenPGP.key.Key): Promise<number> => {
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

  private static extractExternalLibraryObjFromKey = (pubkey: Key) => {
    if (pubkey.type !== 'openpgp') {
      throw new UnexpectedKeyTypeError(`Key type is ${pubkey.type}, expecting OpenPGP`);
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
    if (! await Catch.doesReject(key.getEncryptionKey())) {
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

  private static testEncryptDecrypt = async (key: OpenPGP.key.Key): Promise<string[]> => {
    const output: string[] = [];
    try {
      const encryptedMsg = await opgp.encrypt({ message: opgp.message.fromText(OpenPGPKey.encryptionText), publicKeys: key.toPublic(), armor: true });
      output.push(`Encryption with key was successful`);
      if (key.isPrivate() && key.isFullyDecrypted()) {
        const decryptedMsg = await opgp.decrypt({ message: await opgp.message.readArmored(encryptedMsg.data), privateKeys: key });
        output.push(`Decryption with key ${decryptedMsg.data === OpenPGPKey.encryptionText ? 'succeeded' : 'failed!'}`);
      } else {
        output.push(`Skipping decryption because isPrivate:${key.isPrivate()} isFullyDecrypted:${key.isFullyDecrypted()}`);
      }
    } catch (err) {
      output.push(`Got error performing encryption/decryption test: ${err}`);
    }
    return output;
  }

  private static testSignVerify = async (key: OpenPGP.key.Key): Promise<string> => {
    const output: string[] = [];
    try {
      if (!key.isFullyDecrypted()) {
        return 'skipped, not fully decrypted';
      }
      const signedMessage = await opgp.message.fromText(OpenPGPKey.encryptionText).sign([key]);
      output.push('sign msg ok');
      const verifyResult = await MsgUtil.verify(signedMessage, [key]);
      if (verifyResult.error !== null && typeof verifyResult.error !== 'undefined') {
        output.push(`verify failed: ${verifyResult.error}`);
      } else {
        if (verifyResult.match && verifyResult.signer === OpenPGPKey.bytesToLongid(key.getKeyId().bytes)) {
          output.push('verify ok');
        } else {
          output.push(`verify mismatch: match[${verifyResult.match}] signer[${verifyResult.signer}]`);
        }
      }
    } catch (e) {
      output.push(`Exception: ${String(e)}`);
    }
    return output.join('|');
  }

  private static formatDate = (date: Date | number | null, expiresInSecondsFromDate?: number | null) => {
    if (date === Infinity) {
      return '-';
    }
    if (typeof date === 'number') {
      return `UNEXPECTED FORMAT: ${date}`;
    }
    if (date === null) {
      return `null (not applicable)`;
    }
    if (typeof expiresInSecondsFromDate === 'undefined') {
      return `${date.getTime() / 1000} or ${date.toISOString()}`;
    }
    if (expiresInSecondsFromDate === null) {
      return '-'; // no expiration
    }
    const expDate = new Date(date.getTime() + (expiresInSecondsFromDate * 1000));
    return `${date.getTime() / 1000} + ${expiresInSecondsFromDate} seconds, which is: ${expDate.getTime() / 1000} or ${expDate.toISOString()}`;
  }

}
