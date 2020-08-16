/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Buf } from '../buf.js';
import { Catch, UnreportableError } from '../../platform/catch.js';
import { MsgBlockParser } from '../msg-block-parser.js';
import { PgpArmor } from './pgp/pgp-armor.js';
import { opgp } from './pgp/openpgpjs-custom.js';
import { OpenPGPKey, PgpKey } from './pgp/openpgp-key.js';
import { SmimeKey } from './smime/smime-key.js';
import { MsgBlock } from '../msg-block.js';

/**
 * This is a common Key interface for both OpenPGP and X.509 keys.
 *
 * Since Key objects are frequently JSON serialized (e.g. via message passing)
 * all dates are expressed as number of milliseconds since Unix Epoch.
 * This is what `Date.now()` returns and `new Date(x)` accepts.
 */
export interface Key {
  type: 'openpgp' | 'x509';
  id: string; // This is a fingerprint for OpenPGP keys and Serial Number for X.509 keys.
  ids: string[];
  created: number;
  lastModified: number | undefined; // date of last signature, or undefined if never had valid signature
  expiration: number | undefined; // number of millis of expiration or undefined if never expires
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
}

export type PubkeyResult = { pubkey: Key, email: string, isMine: boolean };

export type Contact = {
  email: string;
  name: string | null;
  pubkey: Key | null;
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
  decrypted?: Key;  // only for internal use in this file
  parsed?: Key;     // only for internal use in this file
}

export type KeyAlgo = 'curve25519' | 'rsa2048' | 'rsa4096';

export interface KeyInfo extends PrvKeyInfo {
  // this cannot be Pubkey has it's being passed to localstorage
  public: string;
  fingerprint: string;
  primary: boolean;
}

export type KeyDetails$ids = {
  longid: string;
  fingerprint: string;
};

export interface KeyDetails {
  private?: string;
  public: Key;
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

export class UnexpectedKeyTypeError extends Error { }

export class KeyUtil {

  public static isWithoutSelfCertifications = async (key: Key) => {
    // all non-OpenPGP keys are automatically considered to be not
    // "without self certifications"
    if (key.type !== 'openpgp') {
      return false;
    }
    return await OpenPGPKey.isWithoutSelfCertifications(key);
  }

  /**
   * Read many keys, could be armored or binary, in single armor or separately, useful for importing keychains of various formats
   */
  public static readMany = async (fileData: Buf): Promise<{ keys: Key[], errs: Error[] }> => {
    const allKeys: Key[] = [];
    const allErrs: Error[] = [];
    const { blocks } = MsgBlockParser.detectBlocks(fileData.toUtfStr('ignore'));
    const isImportable = (block: MsgBlock) => block.type === 'publicKey' || block.type === 'privateKey' || block.type === 'certificate';
    const armoredPublicKeyBlocks = blocks.filter(isImportable);
    const pushKeysAndErrs = async (content: string | Buf, isArmored: boolean) => {
      try {
        if (isArmored) {
          allKeys.push(...await KeyUtil.parseMany(content.toString()));
        } else {
          const { err, keys } = await opgp.key.read(typeof content === 'string' ? Buf.fromUtfStr(content) : content);
          allErrs.push(...(err || []));
          allKeys.push(...await Promise.all(keys.map(key => OpenPGPKey.wrap(key, {} as Key))));
        }
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
    return { keys: allKeys, errs: allErrs };
  }

  public static parse = async (text: string): Promise<Key> => {
    return (await KeyUtil.parseMany(text))[0];
  }

  public static parseMany = async (text: string): Promise<Key[]> => {
    const keyType = KeyUtil.getKeyType(text);
    if (keyType === 'openpgp') {
      return await OpenPGPKey.parseMany(text);
    } else if (keyType === 'x509') {
      // TODO: No support for parsing multiple S/MIME keys for now
      return [await SmimeKey.parse(text)];
    }
    throw new UnexpectedKeyTypeError(`Key type is ${keyType}, expecting OpenPGP or x509 S/MIME`);
  }

  public static armor = (pubkey: Key): string => {
    if (pubkey.type === 'openpgp') {
      return OpenPGPKey.armor(pubkey);
    } else if (pubkey.type === 'x509') {
      return (pubkey as unknown as { raw: string }).raw;
    } else {
      throw new Error('Unknown pubkey type: ' + pubkey.type);
    }
  }

  public static diagnose = async (pubkey: Key, appendResult: (text: string, f?: () => Promise<unknown>) => Promise<void>) => {
    await appendResult(`Key type`, async () => pubkey.type);
    if (pubkey.type === 'openpgp') {
      await OpenPGPKey.diagnose(pubkey, appendResult);
    }
    await appendResult(`expiration`, async () => pubkey.expiration);
    await appendResult(`internal dateBeforeExpiration`, async () => KeyUtil.dateBeforeExpirationIfAlreadyExpired(pubkey));
    await appendResult(`internal usableButExpired`, async () => pubkey.usableButExpired);
  }

  public static asPublicKey = async (pubkey: Key): Promise<Key> => {
    // TODO: Delegate to appropriate key type
    if (pubkey.type === 'openpgp') {
      return await OpenPGPKey.asPublicKey(pubkey);
    }
    // TODO: Assuming S/MIME keys are already public: this should be fixed.
    return pubkey;
  }

  public static expired = (key: Key): boolean => {
    const exp = key.expiration;
    if (!exp) {
      return false;
    }
    return Date.now() > exp;
  }

  public static dateBeforeExpirationIfAlreadyExpired = (key: Key): Date | undefined => {
    const expiration = key.expiration;
    return expiration && KeyUtil.expired(key) ? new Date(expiration - 1000) : undefined;
  }

  // todo - this should be made to tolerate smime keys
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

  public static checkPassPhrase = async (pkey: string, passphrase: string): Promise<boolean> => {
    // decrypt will change the key in place so it's important to parse the key here
    // because passing an object from the caller could have unexpected consequences
    const key = await KeyUtil.parse(pkey);
    if (key.type !== 'openpgp') {
      throw new Error('Checking password for this key type is not implemented: ' + key.type);
    }
    return await PgpKey.decrypt(key, passphrase);
  }

  public static getKeyType = (pubkey: string): 'openpgp' | 'x509' | 'unknown' => {
    if (pubkey.startsWith('-----BEGIN CERTIFICATE-----')) {
      return 'x509';
    } else if (pubkey.startsWith(PgpArmor.headers('publicKey').begin)) {
      return 'openpgp';
    } else if (pubkey.startsWith(PgpArmor.headers('privateKey').begin)) {
      return 'openpgp';
    } else {
      return 'unknown';
    }
  }

  public static choosePubsBasedOnKeyTypeCombinationForPartialSmimeSupport = (pubs: PubkeyResult[]): Key[] => {
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
