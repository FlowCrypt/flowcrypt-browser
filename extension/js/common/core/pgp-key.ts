/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from './buf.js';
import { Catch, UnreportableError } from '../platform/catch.js';
import { MsgBlockParser } from './msg-block-parser.js';
import { PgpArmor } from './pgp-armor.js';
import { opgp } from './pgp.js';
import { OpenPGPKey } from './openpgp-key.js';

export interface Pubkey {
  type: 'openpgp' | 'x509';
  // This is a fingerprint for OpenPGP keys and Serial Number for X.509 keys.
  id: string;
  ids: string[];
  created: Date;
  lastModified: Date | undefined;
  expiration: Date | undefined;
  unparsed: string;
  usableForEncryption: boolean;
  usableForSigning: boolean;
  usableButExpired: boolean;
  emails: string[];
  identities: string[];
  fullyDecrypted: boolean;
  fullyEncrypted: boolean;
  // TODO: Aren't isPublic and isPrivate mutually exclusive?
  isPublic: boolean;
  isPrivate: boolean;
  checkPassword(password: string): Promise<boolean>;
}

export type PubkeyResult = { pubkey: Pubkey, email: string, isMine: boolean };

export type Contact = {
  email: string;
  name: string | null;
  pubkey: Pubkey | null;
  has_pgp: 0 | 1;
  searchable: string[];
  client: string | null;
  fingerprint: string | null;
  longid: string | null;
  longids: string[];
  pending_lookup: number;
  last_use: number | null;
  pubkey_last_sig: number | null;
  pubkey_last_check: number | null;
  expiresOn: number | null;
};

export interface PrvKeyInfo {
  private: string;
  longid: string;
  passphrase?: string;
  decrypted?: Pubkey;  // only for internal use in this file
  parsed?: Pubkey;     // only for internal use in this file
}

export type KeyAlgo = 'curve25519' | 'rsa2048' | 'rsa4096';

export interface KeyInfo extends PrvKeyInfo {
  // this cannot be Pubkey has it's being passed to localstorage
  public: string;
  fingerprint: string;
  primary: boolean;
}

type KeyDetails$ids = {
  shortid: string;
  longid: string;
  fingerprint: string;
};

export interface KeyDetails {
  private?: string;
  public: Pubkey;
  isFullyEncrypted: boolean | undefined;
  isFullyDecrypted: boolean | undefined;
  ids: KeyDetails$ids[];
  users: string[];
  created: number;
  algo: { // same as OpenPGP.key.AlgorithmInfo
    algorithm: string;
    algorithmId: number;
    bits?: number;
    curve?: string;
  };
}
export type PrvPacket = (OpenPGP.packet.SecretKey | OpenPGP.packet.SecretSubkey);

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

  /**
   * used only for keys that we ourselves parsed / formatted before, eg from local storage, because no err handling
   */
  public static readAsOpenPGP = async (armoredKey: string) => { // should be renamed to readOne
    const { keys: [key] } = await opgp.key.readArmored(armoredKey);
    if (key?.isPrivate()) {
      // KeyCache.setArmored(armoredKey, key); TODO: FIXME: cache doesn't work
    }
    return key;
  }

  /**
   * Read many keys, could be armored or binary, in single armor or separately, useful for importing keychains of various formats
   */
  public static readMany = async (fileData: Buf): Promise<{ keys: Pubkey[], errs: Error[] }> => {
    const allKeys: OpenPGP.key.Key[] = [];
    const allErrs: Error[] = [];
    const { blocks } = MsgBlockParser.detectBlocks(fileData.toUtfStr('ignore'));
    const armoredPublicKeyBlocks = blocks.filter(block => block.type === 'publicKey' || block.type === 'privateKey');
    const pushKeysAndErrs = async (content: string | Buf, isArmored: boolean) => {
      try {
        const { err, keys } = isArmored
          ? await opgp.key.readArmored(content.toString())
          : await opgp.key.read(typeof content === 'string' ? Buf.fromUtfStr(content) : content);
        allErrs.push(...(err || []));
        allKeys.push(...keys);
      } catch (e) {
        allErrs.push(e instanceof Error ? e : new Error(String(e)));
      }
    };
    if (armoredPublicKeyBlocks.length) {
      for (const block of blocks) {
        await pushKeysAndErrs(block.content, true);
      }
    } else {
      await pushKeysAndErrs(fileData, false);
    }
    return { keys: await Promise.all(allKeys.map(key => OpenPGPKey.wrap(key, {} as Pubkey))), errs: allErrs };
  }

  public static isPacketPrivate = (p: OpenPGP.packet.AnyKeyPacket): p is PrvPacket => {
    return p.tag === opgp.enums.packet.secretKey || p.tag === opgp.enums.packet.secretSubkey;
  }

  public static decrypt = async (key: Pubkey, passphrase: string, optionalKeyid?: string, optionalBehaviorFlag?: 'OK-IF-ALREADY-DECRYPTED'): Promise<boolean> => {
    // TODO: Delegate to appropriate key type
    return await OpenPGPKey.decryptKey(key, passphrase, optionalKeyid, optionalBehaviorFlag);
  }

  public static encrypt = async (key: Pubkey, passphrase: string) => {
    // TODO: Delegate to appropriate key type
    return await OpenPGPKey.encryptKey(key, passphrase);
  }

  public static isWithoutSelfCertifications = async (key: Pubkey) => {
    if (key.type !== 'openpgp') {
      throw new Error('Unsupported key type: ' + key.type);
    }
    const k = await PgpKey.readAsOpenPGP(key.unparsed);
    return await Catch.doesReject(k.verifyPrimaryKey(), ['No self-certifications']);
  }

  public static normalize = async (armored: string): Promise<{ normalized: string, keys: OpenPGP.key.Key[] }> => {
    try {
      let keys: OpenPGP.key.Key[] = [];
      armored = PgpArmor.normalize(armored, 'key');
      if (RegExp(PgpArmor.headers('publicKey', 're').begin).test(armored)) {
        keys = (await opgp.key.readArmored(armored)).keys;
      } else if (RegExp(PgpArmor.headers('privateKey', 're').begin).test(armored)) {
        keys = (await opgp.key.readArmored(armored)).keys;
      } else if (RegExp(PgpArmor.headers('encryptedMsg', 're').begin).test(armored)) {
        keys = [new opgp.key.Key((await opgp.message.readArmored(armored)).packets)];
      }
      for (const k of keys) {
        for (const u of k.users) {
          u.otherCertifications = []; // prevent key bloat
        }
      }
      return { normalized: keys.map(k => k.armor()).join('\n'), keys };
    } catch (error) {
      Catch.reportErr(error);
      return { normalized: '', keys: [] };
    }
  }

  public static parse = async (text: string): Promise<Pubkey> => {
    const keyType = PgpKey.getKeyType(text);
    if (keyType === 'openpgp') {
      return await OpenPGPKey.parse(text);
    } else if (keyType === 'x509') {
      return {
        type: 'x509',
        id: '' + Math.random(),  // TODO: Replace with: smime.getSerialNumber()
        ids: [],
        unparsed: text,
        usableForEncryption: true, // TODO: Replace with smime code checking encryption flag
        usableForSigning: true, // TODO:Replace with real checks
        usableButExpired: false,
        emails: [], // TODO: add parsing CN from the e-mail
        identities: [],
        created: new Date(0),
        lastModified: new Date(0),
        expiration: undefined,
        checkPassword: _ => { throw new Error('Not implemented yet.'); },
        fullyDecrypted: false,
        fullyEncrypted: false,
        isPublic: true,
        isPrivate: true,
      };
    }
    throw new Error('Unsupported key type: ' + keyType);
  }

  public static reformatKey = async (privateKey: Pubkey, passphrase: string, userIds: { email: string | undefined; name: string }[], expireSeconds: number) => {
    // TODO: Delegate to appropriate key type
    return await OpenPGPKey.reformatKey(privateKey, passphrase, userIds, expireSeconds);
  }

  public static isPacketDecrypted = (pubkey: Pubkey, keyId: string) => {
    // TODO: Delegate to appropriate key type
    return OpenPGPKey.isPacketDecrypted(pubkey, keyId);
  }

  public static serializeToString = (pubkey: Pubkey): string => {
    return pubkey.unparsed;
  }

  public static asPublicKey = async (pubkey: Pubkey): Promise<Pubkey> => {
    // TODO: Delegate to appropriate key type
    if (pubkey.type === 'openpgp') {
      return await OpenPGPKey.asPublicKey(pubkey);
    }
    // TODO: Assuming S/MIME keys are already public: this should be fixed.
    return pubkey;
  }

  public static fingerprint = async (key: Pubkey | OpenPGP.key.Key): Promise<string | undefined> => {
    if ('id' in key) {
      return key.id;
    }
    return key.getFingerprint().toUpperCase();
  }

  public static longid = async (keyOrFingerprintOrBytesOrLongid: string | Pubkey | undefined | OpenPGP.key.Key): Promise<string | undefined> => {
    if (!keyOrFingerprintOrBytesOrLongid) {
      return undefined;
    } else if (typeof keyOrFingerprintOrBytesOrLongid === 'string' && keyOrFingerprintOrBytesOrLongid.length === 8) {
      return opgp.util.str_to_hex(keyOrFingerprintOrBytesOrLongid).toUpperCase(); // in binary form
    } else if (typeof keyOrFingerprintOrBytesOrLongid === 'string' && keyOrFingerprintOrBytesOrLongid.length === 16) {
      return keyOrFingerprintOrBytesOrLongid.toUpperCase(); // already a longid
    } else if (typeof keyOrFingerprintOrBytesOrLongid === 'string' && keyOrFingerprintOrBytesOrLongid.length === 40) {
      return keyOrFingerprintOrBytesOrLongid.substr(-16); // was a fingerprint
    } else if (typeof keyOrFingerprintOrBytesOrLongid === 'string' && keyOrFingerprintOrBytesOrLongid.length === 49) {
      return keyOrFingerprintOrBytesOrLongid.replace(/ /g, '').substr(-16); // spaced fingerprint
    } else if (typeof keyOrFingerprintOrBytesOrLongid === 'string') {
      return await PgpKey.longid(await PgpKey.parse(keyOrFingerprintOrBytesOrLongid));
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

  public static expired = (key: Pubkey): boolean => {
    const exp = key.expiration;
    if (!exp) {
      return false;
    }
    if (exp instanceof Date) {
      return Date.now() > exp.getTime();
    }
    throw new Error(`Got unexpected value for expiration: ${exp}`);
  }

  public static dateBeforeExpirationIfAlreadyExpired = (key: Pubkey): Date | undefined => {
    const expiration = key.expiration;
    return expiration && PgpKey.expired(key) ? new Date(expiration.getTime() - 1000) : undefined;
  }

  public static expiration = async (key: OpenPGP.key.Key, capability: 'encrypt' | 'encrypt_sign' | 'sign' = 'encrypt') => {
    const expires = await key.getExpirationTime(capability); // returns Date or Infinity
    return expires instanceof Date ? expires : undefined;
  }

  public static parseDetails = async (armored: string): Promise<{ original: string, normalized: string, keys: KeyDetails[] }> => {
    const { normalized, keys } = await PgpKey.normalize(armored);
    return { original: armored, normalized, keys: await Promise.all(keys.map(PgpKey.details)) };
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
      public: await PgpKey.parse(k.toPublic().armor()),
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

  public static revoke = async (key: Pubkey): Promise<string | undefined> => {
    // TODO: Delegate to appropriate key type
    return await OpenPGPKey.revoke(key);
  }

  public static getKeyType = (pubkey: string): 'openpgp' | 'x509' | 'unknown' => {
    if (pubkey.startsWith('-----BEGIN CERTIFICATE-----')) {
      return 'x509';
    } else if (pubkey.startsWith('-----BEGIN PGP ')) {
      // both public and private keys will be considered as 'openpgp'
      return 'openpgp';
    } else {
      return 'unknown';
    }
  }

  public static choosePubsBasedOnKeyTypeCombinationForPartialSmimeSupport = (pubs: PubkeyResult[]): Pubkey[] => {
    const myPubs = pubs.filter(pub => pub.isMine); // currently this must be openpgp pub
    const otherPgpPubs = pubs.filter(pub => !pub.isMine && pub.pubkey.type === 'openpgp');
    const otherSmimePubs = pubs.filter(pub => !pub.isMine && pub.pubkey.type === 'x509');
    if (otherPgpPubs.length && otherSmimePubs.length) {
      let err = `Cannot use mixed OpenPGP (${otherPgpPubs.map(p => p.email).join(', ')}) and S/MIME (${otherSmimePubs.map(p => p.email).join(', ')}) public keys yet.`;
      err += 'If you need to email S/MIME recipient, do not add any OpenPGP recipient at the same time.';
      throw new UnreportableError(err);
    }
    if (otherPgpPubs.length) {
      return myPubs.concat(...otherPgpPubs).map(p => p.pubkey);
    }
    if (otherSmimePubs.length) { // todo - currently skipping my own pgp keys when encrypting message for S/MIME
      return otherSmimePubs.map(pub => pub.pubkey);
    }
    return myPubs.map(p => p.pubkey);
  }

}
