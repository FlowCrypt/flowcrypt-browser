/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { Key, PrvPacket, KeyAlgo, KeyUtil, UnexpectedKeyTypeError, PubkeyInfo } from '../key.js';
import { opgp, streams } from './openpgpjs-custom.js';
import { Catch } from '../../../platform/catch.js';
import { Str, Value } from '../../common.js';
import { Buf } from '../../buf.js';
import type * as OpenPGP from 'openpgp';
import { PgpMsgMethod, VerifyRes } from './msg-util.js';

type OpenpgpMsgOrCleartext = OpenPGP.Message<OpenPGP.Data> | OpenPGP.CleartextMessage;
interface KeyWithPrivateFields extends Key {
  internal: OpenPGP.Key | string; // usable key without weak packets
  rawKey?: OpenPGP.Key; // parsed version of rawArmored
  rawArmored: string;
}

export class OpenPGPKey {
  private static readonly encryptionText = 'This is the text we are encrypting!';

  // mapping of algo names to required param count, lazy initialized
  private static paramCountByAlgo: { [key: number]: { pub: number; priv: number } };

  // mapping of algo names to required bits, lazy initialized
  private static minimumBitsByAlgo: { [key: string]: number };

  public static parse = async (text: string): Promise<Key> => {
    const keys = await OpenPGPKey.parseMany(text);
    const keysLength = keys.length;
    if (keysLength > 1) {
      throw new Error(`Found ${keysLength} OpenPGP keys, expected one`);
    }
    return keys[0];
  };

  public static parseMany = async (text: string): Promise<Key[]> => {
    const resultKeys = await opgp.readKeys({ armoredKeys: text });
    /* todo: test exception and re-wrap?
    if (result.err) {
      throw new Error('Cannot parse OpenPGP key: ' + result.err + ' for: ' + text);
    }
    */
    const keys: Key[] = [];
    for (const key of resultKeys) {
      await OpenPGPKey.validateAllDecryptedPackets(key);
      keys.push(await OpenPGPKey.convertExternalLibraryObjToKey(key));
    }
    return keys;
  };

  // remove crypto-library objects (useful when sending the object to/from background)
  public static pack = (key: Key) => {
    const keyWithPrivateFields = key as unknown as KeyWithPrivateFields;
    if (typeof keyWithPrivateFields.internal !== 'string') {
      keyWithPrivateFields.internal = keyWithPrivateFields.internal.armor();
      keyWithPrivateFields.rawKey = undefined;
    }
  };

  public static validateAllDecryptedPackets = async (key: OpenPGP.Key): Promise<void> => {
    const decryptedPackets = key
      .toPacketList()
      .filter(OpenPGPKey.isPacketPrivate)
      .filter(packet => packet.isDecrypted());
    for (const prvPacket of decryptedPackets) {
      await prvPacket.validate(); // gnu-dummy never raises an exception, invalid keys raise exceptions
    }
  };

  public static asPublicKey = async (pubkey: Key): Promise<Key> => {
    if (pubkey.family !== 'openpgp') {
      throw new UnexpectedKeyTypeError(`Key type is ${pubkey.family}, expecting OpenPGP`);
    }
    if (pubkey.isPrivate) {
      return await OpenPGPKey.convertExternalLibraryObjToKey((await OpenPGPKey.extractStrengthUncheckedExternalLibraryObjFromKey(pubkey)).toPublic());
    }
    return pubkey;
  };

  public static decryptKey = async (
    key: Key,
    passphrase: string,
    optionalKeyid?: OpenPGP.KeyID,
    optionalBehaviorFlag?: 'OK-IF-ALREADY-DECRYPTED'
  ): Promise<boolean> => {
    const prv = await OpenPGPKey.extractExternalLibraryObjFromKey(key);
    if (!prv.isPrivate()) {
      throw new Error('Nothing to decrypt in a public key');
    }
    if (!(await OpenPGPKey.decryptPrivateKey(prv, passphrase, optionalKeyid, optionalBehaviorFlag))) {
      return false;
    }
    await OpenPGPKey.convertExternalLibraryObjToKey(prv, key);
    return true;
  };

  public static encryptKey = async (key: Key, passphrase: string) => {
    const prv = await OpenPGPKey.extractExternalLibraryObjFromKey(key);
    if (!passphrase || passphrase === 'undefined' || passphrase === 'null') {
      throw new Error(`Encryption passphrase should not be empty:${typeof passphrase}:${passphrase}`);
    }
    if (!prv.isPrivate()) {
      throw new Error(`No private key packets in key to encrypt. Is this a private key?`);
    }
    const secretPackets = prv
      .getKeys()
      .map(k => k.keyPacket)
      .filter(OpenPGPKey.isPacketPrivate);
    const encryptedPacketCount = secretPackets.filter(p => !p.isDecrypted()).length;
    if (!secretPackets.length) {
      throw new Error(`No private key packets in key to encrypt. Is this a private key?`);
    }
    if (encryptedPacketCount) {
      throw new Error(`Cannot encrypt a key that has ${encryptedPacketCount} of ${secretPackets.length} private packets still encrypted`);
    }
    const encryptedPrv = await opgp.encryptKey({ privateKey: prv, passphrase });
    if (!OpenPGPKey.isFullyEncrypted(encryptedPrv)) {
      throw new Error('Expected key to be fully encrypted after prv.encrypt');
    }
    await OpenPGPKey.convertExternalLibraryObjToKey(encryptedPrv, key);
  };

  public static decryptMessage = async (message: OpenPGP.Message<OpenPGP.Data>, privateKeys: Key[], passwords?: string[]) => {
    const opgpKeys = await Promise.all(privateKeys.map(key => OpenPGPKey.extractExternalLibraryObjFromKey(key)));
    return await message.decrypt(
      opgpKeys.filter(key => key.isPrivate()).map(key => key as OpenPGP.PrivateKey),
      passwords
    );
  };

  public static encryptMessage: PgpMsgMethod.Encrypt = async ({ pubkeys, signingPrv, pwd, data, filename, armor, date }) => {
    if (!pubkeys && !pwd) {
      throw new Error('no-pubkeys-no-challenge');
    }
    const message = await opgp.createMessage({ binary: data, filename, date });
    const encryptionKeys = await Promise.all(pubkeys?.map(OpenPGPKey.extractExternalLibraryObjFromKey) ?? []);
    // TODO: Investigate unwrapping?
    const signingKeys: OpenPGP.PrivateKey[] = [];
    if (signingPrv) {
      const openPgpPrv = await OpenPGPKey.extractExternalLibraryObjFromKey(signingPrv);
      if (openPgpPrv?.isPrivate()) {
        signingKeys.push(openPgpPrv);
      }
    }
    if (armor) {
      return {
        type: 'openpgp',
        data: Buf.fromRawBytesStr(await opgp.encrypt({ format: 'armored', message, date, encryptionKeys, passwords: pwd ? [pwd] : undefined, signingKeys })),
      };
    } else {
      return {
        type: 'openpgp',
        data: await opgp.encrypt({ format: 'binary', message, date, encryptionKeys, passwords: pwd ? [pwd] : undefined, signingKeys }),
      };
    }
  };

  public static isWithoutSelfCertifications = async (key: Key) => {
    const opgpPrv = await OpenPGPKey.extractExternalLibraryObjFromKey(key);
    return await Catch.doesReject(opgpPrv.verifyPrimaryKey(), ['No self-certifications']);
  };

  public static reformatKey = async (
    privateKey: Key,
    passphrase: string | undefined,
    userIDs: { email: string | undefined; name: string }[],
    expireSeconds: number
  ) => {
    const opgpPrv = (await OpenPGPKey.extractExternalLibraryObjFromKey(privateKey)) as OpenPGP.PrivateKey; // todo: check isPrivate()?
    const keyPair = await opgp.reformatKey({
      privateKey: opgpPrv,
      passphrase,
      userIDs,
      keyExpirationTime: expireSeconds,
    });
    return await OpenPGPKey.parse(keyPair.privateKey);
  };

  /**
   * TODO: should be private, will change when readMany is rewritten
   * @param opgpKey - original OpenPGP.js key
   * @param keyToUpdate - an existing Key object to update, optional. Useful in encryptKey and decryptKey, because the operation
   *    is done on the original supplied object.
   */
  public static convertExternalLibraryObjToKey = async (opgpKey: OpenPGP.Key, keyToUpdate?: Key): Promise<Key> => {
    const { isPrimaryKeyStrong, keyWithoutWeakPackets } = OpenPGPKey.removeWeakKeyPackets(opgpKey);
    let encryptionKeyExp: Date | number | null;
    try {
      encryptionKeyExp = await OpenPGPKey.getKeyExpirationTime(keyWithoutWeakPackets, 'encrypt');
      // exp = await keyWithoutWeakPackets.getExpirationTime();
    } catch (e) {
      // eslint-disable-next-line no-null/no-null
      encryptionKeyExp = null;
    }
    let signingKeyExp: Date | number | null;
    try {
      signingKeyExp = await OpenPGPKey.getKeyExpirationTime(keyWithoutWeakPackets, 'sign');
      // exp = await keyWithoutWeakPackets.getExpirationTime();
    } catch (e) {
      // eslint-disable-next-line no-null/no-null
      signingKeyExp = null;
    }
    const { identities, emails } = await OpenPGPKey.getSortedUserids(keyWithoutWeakPackets);
    let lastModified: undefined | number;
    try {
      lastModified = await OpenPGPKey.getLastSigTime(keyWithoutWeakPackets);
    } catch (e) {
      // never had any valid signature
    }
    const fingerprint = keyWithoutWeakPackets.getFingerprint();
    if (!fingerprint) {
      throw new Error('Key does not have a fingerprint and cannot be parsed.');
    }
    const algoInfo = keyWithoutWeakPackets.keyPacket.getAlgorithmInfo();
    // tslint:disable-next-line:no-unnecessary-initializer
    const {
      encryptionKey = undefined,
      encryptionKeyIgnoringExpiration = undefined,
      signingKey = undefined,
      signingKeyIgnoringExpiration = undefined,
    } = isPrimaryKeyStrong ? await OpenPGPKey.getSigningAndEncryptionKeys(keyWithoutWeakPackets, encryptionKeyExp, signingKeyExp) : {};
    const missingPrivateKeyForSigning = signingKeyIgnoringExpiration?.keyPacket
      ? OpenPGPKey.arePrivateParamsMissing(signingKeyIgnoringExpiration.keyPacket)
      : false;
    const missingPrivateKeyForDecryption = encryptionKeyIgnoringExpiration?.keyPacket
      ? OpenPGPKey.arePrivateParamsMissing(encryptionKeyIgnoringExpiration.keyPacket)
      : false;
    const fullyDecrypted = keyWithoutWeakPackets.isPrivate() ? OpenPGPKey.isFullyDecrypted(keyWithoutWeakPackets) : true; /* public keys are always decrypted */
    const fullyEncrypted = keyWithoutWeakPackets.isPrivate() ? OpenPGPKey.isFullyEncrypted(keyWithoutWeakPackets) : false; /* public keys are never encrypted */
    const key = keyToUpdate || ({} as Key); // if no key to update, use empty object, will get props assigned below
    Object.assign(key, {
      family: 'openpgp',
      id: fingerprint.toUpperCase(),
      allIds: keyWithoutWeakPackets.getKeys().map(k => k.getFingerprint().toUpperCase()),
      usableForEncryption: encryptionKey ? true : false,
      usableForEncryptionButExpired: !encryptionKey && !!encryptionKeyIgnoringExpiration,
      usableForSigning: signingKey ? true : false,
      usableForSigningButExpired: !signingKey && !!signingKeyIgnoringExpiration,
      missingPrivateKeyForSigning,
      missingPrivateKeyForDecryption,
      // valid emails extracted from uids
      emails,
      // full uids that have valid emails in them

      identities,
      lastModified,
      expiration: encryptionKeyExp instanceof Date ? encryptionKeyExp.getTime() : undefined,
      created: keyWithoutWeakPackets.getCreationTime().getTime(),
      fullyDecrypted,
      fullyEncrypted,
      isPublic: !keyWithoutWeakPackets.isPrivate(),
      isPrivate: keyWithoutWeakPackets.isPrivate(),
      algo: {
        algorithm: algoInfo.algorithm,
        bits: algoInfo.bits,
        curve: algoInfo.curve,
        algorithmId: opgp.enums.publicKey[algoInfo.algorithm],
      },
      revoked: keyWithoutWeakPackets.revocationSignatures.length > 0,
    } as Key);
    const keyWithPrivateFields = key as KeyWithPrivateFields;
    keyWithPrivateFields.internal = keyWithoutWeakPackets;
    keyWithPrivateFields.rawKey = opgpKey;
    keyWithPrivateFields.rawArmored = opgpKey.armor();
    return key;
  };

  /**
   * Returns signed data if detached=false, armored
   * Returns signature if detached=true, armored
   */
  public static sign = async (signingPrivate: Key, text: string, detached = false): Promise<string> => {
    const signingPrv = (await OpenPGPKey.extractExternalLibraryObjFromKey(signingPrivate)) as OpenPGP.PrivateKey; // todo: throw?
    const message = await opgp.createMessage({ text });
    const signRes = await opgp.sign({ message, format: 'armored', signingKeys: [signingPrv], detached });
    return signRes;
  };

  public static revoke = async (key: Key): Promise<string | undefined> => {
    let prv = await OpenPGPKey.extractExternalLibraryObjFromKey(key);
    if (!prv.isPrivate()) {
      return undefined; // todo: or throw?
    }
    if (!(await prv.isRevoked())) {
      const keypair = await opgp.revokeKey({ key: prv, format: 'object' });
      // todo: save this data into `key`?
      prv = keypair.privateKey;
    }
    const certificate = await prv.getRevocationCertificate();
    if (!certificate) {
      return undefined;
    } else if (typeof certificate === 'string') {
      return certificate;
    } else {
      return await streams.readToEnd(certificate);
    }
  };

  public static keyFlagsToString = (flags: OpenPGP.enums.keyFlags): string => {
    const strs: string[] = [];
    if (flags & opgp.enums.keyFlags.encryptCommunication) {
      strs.push('encrypt_communication');
    }
    if (flags & opgp.enums.keyFlags.encryptStorage) {
      strs.push('encrypt_storage');
    }
    if (flags & opgp.enums.keyFlags.signData) {
      strs.push('sign_data');
    }
    if (flags & opgp.enums.keyFlags.certifyKeys) {
      strs.push('certify_keys');
    }
    return '[' + strs.join(', ') + ']';
  };

  public static diagnose = async (pubkey: Key, passphrase: string): Promise<Map<string, string>> => {
    const key = await OpenPGPKey.extractExternalLibraryObjFromKey(pubkey);
    const result = new Map<string, string>();
    result.set(`Is Private?`, KeyUtil.formatResult(key.isPrivate()));
    for (let i = 0; i < key.users.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      result.set(`User id ${i}`, key.users[i].userID!.userID);
    }
    const user = await key.getPrimaryUser();
    result.set(`Primary User`, user?.user?.userID?.userID || 'No primary user');
    result.set(`Fingerprint`, Str.spaced(key.getFingerprint().toUpperCase() || 'err'));
    // take subkeys from original key so we show subkeys disabled by #2715 too
    const subKeys = (await OpenPGPKey.extractStrengthUncheckedExternalLibraryObjFromKey(pubkey))?.subkeys ?? key.subkeys;
    result.set(`Subkeys`, KeyUtil.formatResult(subKeys ? subKeys.length : subKeys));
    result.set(`Primary key algo`, KeyUtil.formatResult(opgp.enums.read(opgp.enums.publicKey, key.keyPacket.algorithm)));
    const flags = await OpenPGPKey.getPrimaryKeyFlags(key);
    result.set(`Usage flags`, KeyUtil.formatResult(OpenPGPKey.keyFlagsToString(flags)));
    if (key.isPrivate() && !OpenPGPKey.isFullyDecrypted(key)) {
      result.set(
        `key decrypt`,
        await KeyUtil.formatResultAsync(async () => {
          return (await OpenPGPKey.decryptPrivateKey(key, passphrase)) ? 'success' : 'INCORRECT PASSPHRASE';
        })
      );
      result.set(`isFullyDecrypted`, KeyUtil.formatResult(OpenPGPKey.isFullyDecrypted(key)));
      result.set(`isFullyEncrypted`, KeyUtil.formatResult(OpenPGPKey.isFullyEncrypted(key)));
    }
    result.set(
      `Primary key verify`,
      await KeyUtil.formatResultAsync(async () => {
        await key.verifyPrimaryKey(); // throws
        return `valid`;
      })
    );
    result.set(`Primary key creation?`, await KeyUtil.formatResultAsync(async () => OpenPGPKey.formatDate(key.getCreationTime())));
    result.set(`Primary key expiration?`, await KeyUtil.formatResultAsync(async () => OpenPGPKey.formatDate(await key.getExpirationTime())));
    const encryptResult = await OpenPGPKey.testEncryptDecrypt(key);
    await Promise.all(encryptResult.map(msg => result.set(`Encrypt/Decrypt test: ${msg}`, '')));
    if (key.isPrivate()) {
      result.set(`Sign/Verify test`, await KeyUtil.formatResultAsync(async () => await OpenPGPKey.testSignVerify(key)));
    }
    for (let subKeyIndex = 0; subKeyIndex < subKeys.length; subKeyIndex++) {
      const subKey = subKeys[subKeyIndex];
      const skn = `SK ${subKeyIndex} >`;
      result.set(`${skn} LongId`, await KeyUtil.formatResultAsync(async () => OpenPGPKey.bytesToLongid(subKey.getKeyID().bytes)));
      result.set(`${skn} Created`, await KeyUtil.formatResultAsync(async () => OpenPGPKey.formatDate(subKey.keyPacket.created)));
      result.set(`${skn} Algo`, await KeyUtil.formatResultAsync(async () => `${subKey.getAlgorithmInfo().algorithm}`));
      const flags = (await OpenPGPKey.getSubKeySigningFlags(key, subKey)) | (await OpenPGPKey.getSubKeyEncryptionFlags(key, subKey));
      result.set(`${skn} Usage flags`, KeyUtil.formatResult(OpenPGPKey.keyFlagsToString(flags)));
      result.set(
        `${skn} Verify`,
        await KeyUtil.formatResultAsync(async () => {
          await subKey.verify();
          return 'OK';
        })
      );
      result.set(
        `${skn} Subkey object type`,
        await KeyUtil.formatResultAsync(async () => (subKey.keyPacket instanceof opgp.SecretSubkeyPacket ? 'SecretSubkeyPacket' : 'PublicSubkeyPacket'))
      );
      result.set(`${skn} Subkey getBitSize`, await KeyUtil.formatResultAsync(async () => subKey.getAlgorithmInfo().bits)); // No longer exists on object
      result.set(`${skn} Subkey decrypted`, KeyUtil.formatResult(subKey.isDecrypted()));
      result.set(`${skn} Binding signature length`, await KeyUtil.formatResultAsync(async () => subKey.bindingSignatures.length));
      for (let sigIndex = 0; sigIndex < subKey.bindingSignatures.length; sigIndex++) {
        const sig = subKey.bindingSignatures[sigIndex];
        const sgn = `${skn} SIG ${sigIndex} >`;
        result.set(`${sgn} Key flags`, await KeyUtil.formatResultAsync(async () => sig.keyFlags));
        result.set(`${sgn} Version`, await KeyUtil.formatResultAsync(async () => sig.version));
        result.set(`${sgn} Public key algorithm`, await KeyUtil.formatResultAsync(async () => sig.publicKeyAlgorithm));
        result.set(`${sgn} Sig creation time`, KeyUtil.formatResult(OpenPGPKey.formatDate(sig.created)));
        result.set(
          `${sgn} Sig expiration time`,
          await KeyUtil.formatResultAsync(async () => {
            if (!subKey.keyPacket.created) {
              return 'unknown key creation time';
            }
            return OpenPGPKey.formatDate(subKey.keyPacket.created, sig.keyExpirationTime);
          })
        );
        result.set(
          `${sgn} Verify`,
          await KeyUtil.formatResultAsync(async () => {
            const dataToVerify = { key: key.keyPacket, bind: subKey.keyPacket };
            await sig.verify(key.keyPacket, opgp.enums.signature.subkeyBinding, dataToVerify); // throws
            return `valid`;
          })
        );
      }
    }
    return result;
  };

  public static bytesToLongid = (binaryString: string) => {
    if (binaryString.length !== 8) {
      throw new Error(`Unexpected keyid bytes format (len: ${binaryString.length}): "${binaryString}"`);
    }
    return Buf.fromRawBytesStr(binaryString).toHexStr(true);
  };

  public static fingerprintToLongid = (fingerprint: string) => {
    if (fingerprint.length === 40) {
      // pgp keys
      return fingerprint.substr(-16).toUpperCase();
    }
    throw new Error(`Unexpected fingerprint format (len: ${fingerprint.length}): "${fingerprint}"`);
  };

  public static isFullyDecrypted = (key: OpenPGP.Key): boolean => {
    const nonDummyPrvPackets = OpenPGPKey.getPrvPackets(key);
    return nonDummyPrvPackets.every(p => p.isDecrypted() === true);
  };

  public static isFullyEncrypted = (key: OpenPGP.Key): boolean => {
    const nonDummyPrvPackets = OpenPGPKey.getPrvPackets(key);
    return nonDummyPrvPackets.every(p => p.isDecrypted() === false);
  };

  /**
   * todo - could return a Key
   */
  public static create = async (
    userIDs: { name: string; email: string }[],
    variant: KeyAlgo,
    passphrase: string,
    expireInMonths: number | undefined
  ): Promise<{ private: string; public: string }> => {
    const opt: OpenPGP.KeyOptions = { userIDs, passphrase };
    if (variant === 'curve25519') {
      opt.curve = 'curve25519';
    } else if (variant === 'rsa2048') {
      opt.rsaBits = 2048;
    } else if (variant === 'rsa3072') {
      opt.rsaBits = 3072;
    } else {
      opt.rsaBits = 4096;
    }
    if (expireInMonths) {
      opt.keyExpirationTime = 60 * 60 * 24 * 30 * expireInMonths; // seconds from now
    }
    const k = await opgp.generateKey({ ...opt, format: 'armored' });
    return { public: k.publicKey, private: k.privateKey };
  };

  public static isPacketPrivate = (p: OpenPGP.BasePacket): p is PrvPacket => {
    return p instanceof opgp.SecretKeyPacket || p instanceof opgp.SecretSubkeyPacket;
  };

  public static isBaseKeyPacket = (p: OpenPGP.BasePacket): p is OpenPGP.BasePublicKeyPacket => {
    return (
      p instanceof opgp.SecretKeyPacket || p instanceof opgp.SecretSubkeyPacket || p instanceof opgp.PublicKeyPacket || p instanceof opgp.PublicSubkeyPacket
    );
  };

  public static isPacketDecrypted = async (pubkey: Key, keyid: OpenPGP.KeyID) => {
    const [k] = (await OpenPGPKey.extractExternalLibraryObjFromKey(pubkey)).getKeys(keyid); // keyPacket.isDecrypted(keyID);
    if (!k) {
      throw new Error('KeyID not found');
    }
    const keyPacket = k.keyPacket;
    if (!OpenPGPKey.isPacketPrivate(keyPacket)) {
      throw new Error('Cannot check packet encryption status of secret key in a Public Key');
    }
    return keyPacket.isDecrypted() === true;
  };

  public static getPrimaryUserId = async (pubs: OpenPGP.PrivateKey[], keyid: OpenPGP.KeyID): Promise<string | undefined> => {
    for (const opgpkey of pubs) {
      const matchingKeys = opgpkey.getKeys(keyid);
      if (matchingKeys.length > 0) {
        const primaryUser = await opgpkey.getPrimaryUser();
        return primaryUser?.user?.userID?.userID;
      }
    }
    return undefined;
  };

  public static verify = async (msg: OpenpgpMsgOrCleartext, pubs: PubkeyInfo[]): Promise<VerifyRes> => {
    // todo: double-check if S/MIME ever gets here
    const validKeys = pubs.filter(x => !x.revoked && x.pubkey.family === 'openpgp').map(x => x.pubkey);
    // todo: #4172 revoked longid may result in incorrect "Missing pubkey..." output
    const verifyRes: VerifyRes = {
      match: null, // eslint-disable-line no-null/no-null
      signerLongids: [],
      suppliedLongids: validKeys.map(x => x.allIds.map(fp => OpenPGPKey.fingerprintToLongid(fp))).reduce((a, b) => a.concat(b), []),
    };
    const opgpKeys = await Promise.all(validKeys.map(x => OpenPGPKey.extractExternalLibraryObjFromKey(x)));
    // todo: expired?
    try {
      const signerLongids = msg.getSigningKeyIDs().map(kid => OpenPGPKey.bytesToLongid(kid.bytes));
      const text = msg instanceof opgp.CleartextMessage ? msg.getText() : msg.getLiteralData(); // todo: is this important?
      if (text) {
        // encrypted message
        verifyRes.content = typeof text === 'string' ? Buf.fromUtfStr(text) : Buf.fromUint8(text);
      }
      // is there an intersection?
      if (signerLongids.some(longid => verifyRes.suppliedLongids.includes(longid))) {
        const verifications = await msg.verify(opgpKeys);
        await Promise.all(verifications.map(verification => verification.verified)); // throws on invalid signature
        // todo - a valid signature is a valid signature, and should be surfaced. Currently, if any of the signatures are not valid, it's showing all as invalid
        // .. as it is now this could allow an attacker to append bogus signatures to validly signed messages, making otherwise correct messages seem incorrect
        // .. which is not really an issue - an attacker that can append signatures could have also just slightly changed the message, causing the same experience
        // .. so for now #wontfix unless a reasonable usecase surfaces
        verifyRes.match = verifications.length > 0;
      }
      verifyRes.signerLongids = Value.arr.unique(signerLongids);
    } catch (verifyErr) {
      verifyRes.match = null; // eslint-disable-line no-null/no-null
      if (verifyErr instanceof Error && verifyErr.message === 'Can only verify message with one literal data packet.') {
        verifyRes.error = 'FlowCrypt is not equipped to verify this message';
        verifyRes.isErrFatal = true; // don't try to re-fetch the message from API
      } else if (verifyErr instanceof Error && verifyErr.message.startsWith('Insecure message hash algorithm:')) {
        verifyRes.error = `${verifyErr.message}. Sender is using old, insecure OpenPGP software.`;
        verifyRes.isErrFatal = true; // don't try to re-fetch the message from API
      } else if (verifyErr instanceof Error && verifyErr.message === 'Signature is expired') {
        verifyRes.error = verifyErr.message;
        verifyRes.isErrFatal = true; // don't try to re-fetch the message from API
      } else if (verifyErr instanceof Error && verifyErr.message.endsWith('digest did not match')) {
        verifyRes.error = verifyErr.message;
        verifyRes.match = false;
      } else {
        verifyRes.error = `Error verifying this message: ${String(verifyErr)}`;
        Catch.reportErr(verifyErr);
      }
    }
    return verifyRes;
  };

  private static getSortedUserids = async (key: OpenPGP.Key): Promise<{ identities: string[]; emails: string[] }> => {
    const data = (
      await Promise.all(
        key.users
          .filter(user => user?.userID)
          .map(async user => {
            const dataToVerify = { userId: user.userID, key: key.keyPacket };
            const selfCertification = await OpenPGPKey.getLatestValidSignature(
              user.selfCertifications,
              key.keyPacket,
              opgp.enums.signature.certGeneric,
              dataToVerify
            );
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            return { userid: user.userID!.userID, email: user.userID!.email, selfCertification };
          })
      )
    ).filter(x => x.selfCertification);
    // sort the same way as OpenPGP.js does
    data.sort((a, b) => {
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      const A = a.selfCertification!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      const B = b.selfCertification!; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      return Number(A.revoked) - Number(B.revoked) || Number(B.isPrimaryUserID) - Number(A.isPrimaryUserID) || Number(B.created) - Number(A.created);
    });
    return {
      identities: data.map(x => x.userid).filter(Boolean),
      emails: data.map(x => x.email).filter(Boolean), // todo: toLowerCase()?
    };
  };

  // mimicks OpenPGP.helper.getLatestValidSignature
  private static getLatestValidSignature = async (
    signatures: OpenPGP.SignaturePacket[],
    primaryKey: OpenPGP.BasePublicKeyPacket,
    signatureType: OpenPGP.enums.signature,
    dataToVerify: object | Uint8Array,
    date = new Date()
  ): Promise<OpenPGP.SignaturePacket | undefined> => {
    let signature: OpenPGP.SignaturePacket | undefined;
    for (let i = signatures.length - 1; i >= 0; i--) {
      try {
        if (
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          (!signature || signatures[i].created! >= signature.created!) &&
          // check binding signature is not expired (ie, check for V4 expiration time)
          !signatures[i].isExpired(date)
        ) {
          await signatures[i].verify(primaryKey, signatureType, dataToVerify);
          signature = signatures[i];
        }
      } catch (e) {
        // skip signature with failed verification
      }
    }
    return signature;
  };

  private static getValidEncryptionKeyPacketFlags = (key: OpenPGP.Key | OpenPGP.Subkey, signature: OpenPGP.SignaturePacket): OpenPGP.enums.keyFlags => {
    // todo: signature.verified
    if (!signature.keyFlags || signature.revoked !== false) {
      // Sanity check
      return 0;
    }
    if (
      [
        opgp.enums.read(opgp.enums.publicKey, opgp.enums.publicKey.dsa),
        opgp.enums.read(opgp.enums.publicKey, opgp.enums.publicKey.rsaSign),
        opgp.enums.read(opgp.enums.publicKey, opgp.enums.publicKey.ecdsa),
        opgp.enums.read(opgp.enums.publicKey, opgp.enums.publicKey.eddsa),
      ].includes(key.getAlgorithmInfo().algorithm)
    ) {
      return 0; // disallow encryption for these algorithms
    }
    return signature.keyFlags[0] & (opgp.enums.keyFlags.encryptCommunication | opgp.enums.keyFlags.encryptStorage);
  };

  private static getValidSigningKeyPacketFlags = (key: OpenPGP.Key | OpenPGP.Subkey, signature: OpenPGP.SignaturePacket): OpenPGP.enums.keyFlags => {
    // todo: signature.verified
    if (!signature.keyFlags || signature.revoked !== false) {
      // Sanity check
      return 0;
    }
    if (
      [
        opgp.enums.read(opgp.enums.publicKey, opgp.enums.publicKey.rsaEncrypt),
        opgp.enums.read(opgp.enums.publicKey, opgp.enums.publicKey.elgamal),
        opgp.enums.read(opgp.enums.publicKey, opgp.enums.publicKey.ecdh),
      ].includes(key.getAlgorithmInfo().algorithm)
    ) {
      return 0; // disallow signing for these algorithms
    }
    return signature.keyFlags[0] & (opgp.enums.keyFlags.signData | opgp.enums.keyFlags.certifyKeys);
  };

  private static getSubKeySigningFlags = async (key: OpenPGP.PrivateKey | OpenPGP.PublicKey, subKey: OpenPGP.Subkey): Promise<OpenPGP.enums.keyFlags> => {
    const primaryKey = key.keyPacket;
    // await subKey.verify(primaryKey);
    const dataToVerify = { key: primaryKey, bind: subKey.keyPacket };
    const date = new Date();
    const bindingSignature = await OpenPGPKey.getLatestValidSignature(
      subKey.bindingSignatures,
      primaryKey,
      opgp.enums.signature.subkeyBinding,
      dataToVerify,
      date
    );
    if (
      bindingSignature &&
      bindingSignature.embeddedSignature &&
      (await OpenPGPKey.getLatestValidSignature([bindingSignature.embeddedSignature], subKey.keyPacket, opgp.enums.signature.keyBinding, dataToVerify, date))
    ) {
      return OpenPGPKey.getValidSigningKeyPacketFlags(subKey, bindingSignature);
    }
    return 0;
  };

  private static getSubKeyEncryptionFlags = async (key: OpenPGP.PrivateKey | OpenPGP.PublicKey, subKey: OpenPGP.Subkey): Promise<OpenPGP.enums.keyFlags> => {
    const primaryKey = key.keyPacket;
    // await subKey.verify(primaryKey);
    const dataToVerify = { key: primaryKey, bind: subKey.keyPacket };
    const date = new Date();
    const bindingSignature = await OpenPGPKey.getLatestValidSignature(
      subKey.bindingSignatures,
      primaryKey,
      opgp.enums.signature.subkeyBinding,
      dataToVerify,
      date
    );
    if (bindingSignature) {
      return OpenPGPKey.getValidEncryptionKeyPacketFlags(subKey, bindingSignature);
    }
    return 0;
  };

  private static getPrimaryKeyFlags = async (key: OpenPGP.PrivateKey | OpenPGP.PublicKey): Promise<OpenPGP.enums.keyFlags> => {
    const primaryUser = await key.getPrimaryUser();
    return (
      OpenPGPKey.getValidEncryptionKeyPacketFlags(key, primaryUser.user.selfCertifications[0]) | // todo: index?!
      OpenPGPKey.getValidSigningKeyPacketFlags(key, primaryUser.user.selfCertifications[0]) // todo: index?!
    );
  };

  /**
   * Get latest self-signature date, in utc millis.
   * This is used to figure out how recently was key updated, and if one key is newer than other.
   */
  private static getLastSigTime = async (key: OpenPGP.Key): Promise<number> => {
    await key.getExpirationTime(); // will force all sigs to be verified
    const allSignatures: OpenPGP.SignaturePacket[] = [];
    for (const user of key.users) {
      allSignatures.push(...user.selfCertifications);
    }
    for (const subKey of key.subkeys) {
      allSignatures.push(...subKey.bindingSignatures);
    }
    if (allSignatures.length > 0) {
      // todo: all are verified now? .filter(x => x.verified)
      return Math.max(...allSignatures.map(x => (x.created ? x.created.getTime() : 0)));
    }
    throw new Error('No valid signature found in key');
  };

  private static extractExternalLibraryObjFromKey = async (key: Key): Promise<OpenPGP.PrivateKey | OpenPGP.PublicKey> => {
    if (key.family !== 'openpgp') {
      throw new UnexpectedKeyTypeError(`Key type is ${key.family}, expecting OpenPGP`);
    }
    const keyWithPrivateFields = key as KeyWithPrivateFields;
    const internal = keyWithPrivateFields.internal;
    if (!internal) {
      throw new Error('Object has type == "openpgp" but no internal key.');
    } else if (typeof internal === 'string') {
      keyWithPrivateFields.internal = await opgp.readKey({ armoredKey: internal });
      return keyWithPrivateFields.internal;
    }
    return internal;
  };

  private static extractStrengthUncheckedExternalLibraryObjFromKey = async (key: Key) => {
    if (key.family !== 'openpgp') {
      throw new UnexpectedKeyTypeError(`Key type is ${key.family}, expecting OpenPGP`);
    }
    const keyWithPrivateFields = key as KeyWithPrivateFields;
    if (!keyWithPrivateFields.rawKey) {
      keyWithPrivateFields.rawKey = await opgp.readKey({ armoredKey: keyWithPrivateFields.rawArmored });
    }
    return keyWithPrivateFields.rawKey;
  };

  private static isKeyExpired = (keyExp: number | Date | null) => {
    if (keyExp === Infinity || !keyExp) {
      return false;
    }
    // According to the documentation expiration is either undefined, Infinity
    // (typeof number) or a Date object. So in this case `exp` should never
    // be of type number.
    if (typeof keyExp === 'number') {
      throw new Error(`Got unexpected value for expiration: ${keyExp}`);
    }
    return Date.now() > keyExp.getTime();
  };

  private static getKeyIgnoringExpiration = async (
    getter: (keyid?: OpenPGP.KeyID, date?: Date, userId?: OpenPGP.UserID) => Promise<OpenPGP.Key | OpenPGP.Subkey | null>,
    exp: Date | number | null
  ): Promise<OpenPGP.Key | OpenPGP.Subkey | null> => {
    const firstTry = await Catch.undefinedOnException(getter());
    if (firstTry) {
      return firstTry;
    }
    // eslint-disable-next-line no-null/no-null
    if (exp === null || typeof exp === 'number') {
      // If key does not expire (exp == Infinity) the encryption key should be available.
      return null; // eslint-disable-line no-null/no-null
    }
    const oneSecondBeforeExpiration = exp && OpenPGPKey.isKeyExpired(exp) ? new Date(exp.getTime() - 1000) : undefined;
    if (typeof oneSecondBeforeExpiration === 'undefined') {
      return null; // eslint-disable-line no-null/no-null
    }
    const secondTry = await Catch.undefinedOnException(getter(undefined, oneSecondBeforeExpiration));
    return secondTry ? secondTry : null; // eslint-disable-line no-null/no-null
  };

  private static getSigningAndEncryptionKeys = async (
    key: OpenPGP.PrivateKey | OpenPGP.PublicKey,
    encryptionKeyExp: number | Date | null,
    signingKeyExp: number | Date | null
  ) => {
    const getEncryptionKey = (keyid?: OpenPGP.KeyID, date?: Date, userId?: OpenPGP.UserID) => key.getEncryptionKey(keyid, date, userId);
    const encryptionKey = await Catch.undefinedOnException(getEncryptionKey());
    const encryptionKeyIgnoringExpiration = encryptionKey ? encryptionKey : await OpenPGPKey.getKeyIgnoringExpiration(getEncryptionKey, encryptionKeyExp);
    const getSigningKey = (keyid?: OpenPGP.KeyID, date?: Date, userId?: OpenPGP.UserID) => key.getSigningKey(keyid, date, userId);
    const signingKey = await Catch.undefinedOnException(getSigningKey());
    const signingKeyIgnoringExpiration = signingKey ? signingKey : await OpenPGPKey.getKeyIgnoringExpiration(getSigningKey, signingKeyExp);
    return { encryptionKey, encryptionKeyIgnoringExpiration, signingKey, signingKeyIgnoringExpiration };
  };

  /**
   * In order to prioritize strong subkeys over weak ones to solve #2715, we delete the weak ones
   * and let OpenPGP.js decide based on remaining packets
   * @param opgpKey - original OpenPGP.js key
   * @return isPrimaryKeyStrong - true, if primary key is safe to use
   *         keyWithoutWeakPackets - key with weak subkets removed
   */
  private static removeWeakKeyPackets = (
    opgpKey: OpenPGP.Key
  ): { isPrimaryKeyStrong: boolean; keyWithoutWeakPackets: OpenPGP.PrivateKey | OpenPGP.PublicKey } => {
    let isPrimaryKeyStrong = true;
    const packets = opgpKey.toPacketList();
    const newPacketList = new opgp.PacketList<OpenPGP.BasePacket>();
    for (const packet of packets) {
      if (OpenPGPKey.isBaseKeyPacket(packet)) {
        const { algorithm, bits } = packet.getAlgorithmInfo();
        if (!OpenPGPKey.minimumBitsByAlgo) {
          OpenPGPKey.minimumBitsByAlgo = {
            [opgp.enums.read(opgp.enums.publicKey, opgp.enums.publicKey.rsaEncrypt)]: 2048,
            [opgp.enums.read(opgp.enums.publicKey, opgp.enums.publicKey.rsaEncryptSign)]: 2048,
            [opgp.enums.read(opgp.enums.publicKey, opgp.enums.publicKey.rsaSign)]: 2048,
          };
        }
        const minimumBits = OpenPGPKey.minimumBitsByAlgo[algorithm];
        if (minimumBits && (bits || 0) < minimumBits) {
          if (packet === opgpKey.keyPacket) {
            // the primary key packet should remain, otherwise the key can't be parsed
            isPrimaryKeyStrong = false;
          } else {
            continue; // discard this packet as weak
          }
        }
      }
      newPacketList.push(packet);
    }
    if (packets.length !== newPacketList.length) {
      return {
        isPrimaryKeyStrong,
        keyWithoutWeakPackets: opgpKey instanceof opgp.PrivateKey ? new opgp.PrivateKey(newPacketList) : new opgp.PublicKey(newPacketList),
      };
    }
    return { isPrimaryKeyStrong, keyWithoutWeakPackets: opgpKey };
  };

  private static arePrivateParamsMissing = (packet: OpenPGP.BasePublicKeyPacket): boolean => {
    // detection of missing private params to solve #2887
    if (!OpenPGPKey.paramCountByAlgo) {
      OpenPGPKey.paramCountByAlgo = {
        // Adjusted for the OpenPGP.js v5.
        // See parsePublicKeyParams() and parsePrivateKeyParams()
        // in the openpgp.js source code for details.
        [opgp.enums.publicKey.rsaEncrypt]: { pub: 2, priv: 4 }, // (n, e), (d, p, q, u)
        [opgp.enums.publicKey.rsaEncryptSign]: { pub: 2, priv: 4 }, // (n, e), (d, p, q, u)
        [opgp.enums.publicKey.rsaSign]: { pub: 2, priv: 4 }, // (n, e), (d, p, q, u)
        [opgp.enums.publicKey.dsa]: { pub: 4, priv: 1 }, // (p, q, g, y), (x)
        [opgp.enums.publicKey.elgamal]: { pub: 3, priv: 1 }, // (p, g, y), (x)
        [opgp.enums.publicKey.ecdsa]: { pub: 2, priv: 1 }, // (oid, Q), (d)
        [opgp.enums.publicKey.ecdh]: { pub: 2, priv: 1 }, // (oid, Q, kdfParams), (d)
        [opgp.enums.publicKey.eddsa]: { pub: 2, priv: 1 }, // (oid, Q), (seed)
      };
    }
    return packet instanceof opgp.SecretKeyPacket || packet instanceof opgp.SecretSubkeyPacket
      ? packet.algorithm &&
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          !(packet as any).isEncrypted && // isDecrypted() returns false when isEncrypted is null
          (!(packet as OpenPGP.BaseSecretKeyPacket).privateParams ||
            OpenPGPKey.paramCountByAlgo[packet.algorithm].priv >
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              Object.keys((packet as OpenPGP.BaseSecretKeyPacket).privateParams!).length)
      : true;
  };

  private static testEncryptDecrypt = async (key: OpenPGP.PrivateKey | OpenPGP.PublicKey): Promise<string[]> => {
    const output: string[] = [];
    try {
      const encryptedMsg = await opgp.encrypt({
        message: await opgp.createMessage({ text: OpenPGPKey.encryptionText }),
        encryptionKeys: key.toPublic(),
        format: 'armored',
      });
      output.push(`Encryption with key was successful`);
      if (key.isPrivate() && OpenPGPKey.isFullyDecrypted(key)) {
        const decryptedMsg = await opgp.decrypt({
          message: await opgp.readMessage({ armoredMessage: encryptedMsg }),
          decryptionKeys: key,
        });
        output.push(`Decryption with key ${decryptedMsg.data === OpenPGPKey.encryptionText ? 'succeeded' : 'failed!'}`);
      } else {
        output.push(`Skipping decryption because isPrivate:${key.isPrivate()} isFullyDecrypted:${OpenPGPKey.isFullyDecrypted(key)}`);
      }
    } catch (err) {
      output.push(`Got error performing encryption/decryption test: ${err}`);
    }
    return output;
  };

  private static testSignVerify = async (key: OpenPGP.PrivateKey): Promise<string> => {
    const output: string[] = [];
    try {
      if (!OpenPGPKey.isFullyDecrypted(key)) {
        return 'skipped, not fully decrypted';
      }
      const signedMessage = await (await opgp.createMessage({ text: OpenPGPKey.encryptionText })).sign([key]);
      output.push('sign msg ok');
      const verifyResult = await OpenPGPKey.verify(signedMessage, [{ pubkey: await OpenPGPKey.convertExternalLibraryObjToKey(key), revoked: false }]);
      // eslint-disable-next-line no-null/no-null
      if (verifyResult.error !== null && typeof verifyResult.error !== 'undefined') {
        output.push(`verify failed: ${verifyResult.error}`);
      } else {
        if (verifyResult.match && verifyResult.signerLongids.includes(OpenPGPKey.bytesToLongid(key.getKeyID().bytes))) {
          output.push('verify ok');
        } else {
          output.push(`verify mismatch: match[${verifyResult.match}]`);
        }
      }
    } catch (e) {
      output.push(`Exception: ${String(e)}`);
    }
    return output.join('|');
  };

  private static formatDate = (date: Date | number | null, expiresInSecondsFromDate?: number | null) => {
    if (date === Infinity) {
      return '-';
    }
    if (typeof date === 'number') {
      return `UNEXPECTED FORMAT: ${date}`;
    }
    // eslint-disable-next-line no-null/no-null
    if (date === null) {
      return `null (not applicable)`;
    }
    if (typeof expiresInSecondsFromDate === 'undefined') {
      return `${date.getTime() / 1000} or ${date.toISOString()}`;
    }
    // eslint-disable-next-line no-null/no-null
    if (expiresInSecondsFromDate === null) {
      return '-'; // no expiration
    }
    const expDate = new Date(date.getTime() + expiresInSecondsFromDate * 1000);
    return `${date.getTime() / 1000} + ${expiresInSecondsFromDate} seconds, which is: ${expDate.getTime() / 1000} or ${expDate.toISOString()}`;
  };

  private static decryptPrivateKey = async (
    prv: OpenPGP.PrivateKey,
    passphrase: string,
    optionalKeyid?: OpenPGP.KeyID,
    optionalBehaviorFlag?: 'OK-IF-ALREADY-DECRYPTED'
  ) => {
    const chosenPrvPackets = prv
      .getKeys(optionalKeyid)
      .map(k => k.keyPacket)
      .filter(OpenPGPKey.isPacketPrivate) as PrvPacket[];
    if (!chosenPrvPackets.length) {
      throw new Error(
        `No private key packets selected of ${
          prv
            .getKeys()
            .map(k => k.keyPacket)
            .filter(OpenPGPKey.isPacketPrivate).length
        } prv packets available`
      );
    }
    for (const prvPacket of chosenPrvPackets) {
      if (prvPacket.isDecrypted()) {
        if (optionalBehaviorFlag === 'OK-IF-ALREADY-DECRYPTED') {
          continue;
        } else {
          throw new Error('Decryption failed - key packet was already decrypted');
        }
      }
      try {
        await prvPacket.decrypt(passphrase); // throws on password mismatch
        await prvPacket.validate(); // throws
      } catch (e) {
        if (e instanceof Error && e.message.toLowerCase().includes('incorrect key passphrase')) {
          return false;
        }
        throw e;
      }
    }
    return true;
  };

  private static getPrvPackets = (k: OpenPGP.Key): PrvPacket[] => {
    if (!k.isPrivate()) {
      throw new Error('Cannot check encryption status of secret keys in a Public Key');
    }
    const prvPackets = k
      .getKeys()
      .map(k => k.keyPacket)
      .filter(OpenPGPKey.isPacketPrivate) as PrvPacket[];
    if (!prvPackets.length) {
      throw new Error('This key has no private packets. Is it a Private Key?');
    }
    const nonDummyPrvPackets = prvPackets.filter(p => !p.isDummy());
    if (!nonDummyPrvPackets.length) {
      throw new Error('This key only has a gnu-dummy private packet, with no actual secret keys.');
    }
    return nonDummyPrvPackets;
  };

  /* tslint:disable:no-null-keyword */
  private static maxDate = (dates: (Date | null)[]): Date | null => {
    // eslint-disable-next-line no-null/no-null
    let res: Date | null = null;
    for (const date of dates) {
      // eslint-disable-next-line no-null/no-null
      if (res === null || (date !== null && date > res)) {
        res = date;
      }
    }
    return res;
  };
  /* tslint:enable:no-null-keyword */

  private static getSubkeyExpirationTime = (subkey: OpenPGP.Subkey): number | Date => {
    const bindingCreated = OpenPGPKey.maxDate(subkey.bindingSignatures.map(b => b.created));
    const binding = subkey.bindingSignatures.filter(b => b.created === bindingCreated)[0];
    return binding.getExpirationTime();
  };

  // Attempt to backport from openpgp.js v4
  /* tslint:disable:no-null-keyword */
  private static getKeyExpirationTime = async (
    key: OpenPGP.Key,
    capabilities?: 'encrypt' | 'encrypt_sign' | 'sign' | null,
    keyId?: OpenPGP.KeyID | undefined,
    userId?: OpenPGP.UserID | undefined
  ): Promise<Date | null | typeof Infinity> => {
    const primaryUser = await key.getPrimaryUser(undefined, userId, undefined);
    if (!primaryUser) throw new Error('Could not find primary user');
    const keyExpiry = await key.getExpirationTime(userId);
    // eslint-disable-next-line no-null/no-null
    if (!keyExpiry) return null;
    const selfCertCreated = OpenPGPKey.maxDate(primaryUser.user.selfCertifications.map(selfCert => selfCert.created));
    const selfCert = primaryUser.user.selfCertifications.filter(selfCert => selfCert.created === selfCertCreated)[0];
    const sigExpiry = selfCert.getExpirationTime();
    let expiry = keyExpiry < sigExpiry ? keyExpiry : sigExpiry;
    if (capabilities === 'encrypt' || capabilities === 'encrypt_sign') {
      const encryptionKey =
        (await key.getEncryptionKey(keyId, new Date(expiry), userId).catch(() => {
          return undefined;
        })) ||
        // eslint-disable-next-line no-null/no-null
        (await key.getEncryptionKey(keyId, null, userId).catch(() => {
          return undefined;
        }));
      // eslint-disable-next-line no-null/no-null
      if (!encryptionKey) return null;
      // for some reason, "instanceof Key" didn't work: 'Right-hand side of \'instanceof\' is not an object'
      const encryptionKeyExpiry =
        'bindingSignatures' in encryptionKey
          ? OpenPGPKey.getSubkeyExpirationTime(encryptionKey)
          : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            (await encryptionKey.getExpirationTime(userId))!;
      if (encryptionKeyExpiry < expiry) expiry = encryptionKeyExpiry;
    }
    if (capabilities === 'sign' || capabilities === 'encrypt_sign') {
      const signatureKey =
        (await key.getSigningKey(keyId, new Date(expiry), userId).catch(() => {
          return undefined;
        })) ||
        // eslint-disable-next-line no-null/no-null
        (await key.getSigningKey(keyId, null, userId).catch(() => {
          return undefined;
        }));
      // eslint-disable-next-line no-null/no-null
      if (!signatureKey) return null;
      // could be the same as above, so checking for property instead of using "instanceof"
      const signatureKeyExpiry =
        'bindingSignatures' in signatureKey
          ? await OpenPGPKey.getSubkeyExpirationTime(signatureKey)
          : // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            (await signatureKey.getExpirationTime(userId))!;
      if (signatureKeyExpiry < expiry) expiry = signatureKeyExpiry;
    }
    return expiry;
  };
  /* tslint:enable:no-null-keyword */
}
