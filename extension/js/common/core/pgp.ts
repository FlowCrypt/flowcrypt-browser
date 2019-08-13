/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { VERSION } from './const.js';
import { Catch } from '../platform/catch.js';
import { Store } from '../platform/store.js';
import { Str, Value } from './common.js';
import { ReplaceableMsgBlockType, MsgBlock, MsgBlockType, Mime } from './mime.js';
import { AttMeta } from './att.js';
import { mnemonic } from './mnemonic.js';
import { requireOpenpgp } from '../platform/require.js';
import { secureRandomBytes, base64encode } from '../platform/util.js';
import { FcAttLinkData } from './att.js';
import { Buf } from './buf.js';
import { Xss } from '../platform/xss.js';

const openpgp = requireOpenpgp();

if (typeof openpgp !== 'undefined') { // in certain environments, eg browser content scripts, openpgp is not included (not all functions below need it)
  openpgp.config.versionstring = `FlowCrypt ${VERSION} Gmail Encryption`;
  openpgp.config.commentstring = 'Seamlessly send and receive encrypted email';
  openpgp.config.ignore_mdc_error = true; // we manually check for missing MDC and show loud warning to user (no auto-decrypt)
  // openpgp.config.require_uid_self_cert = false;
}

export namespace PgpMsgMethod {
  export namespace Arg {
    export type Encrypt = { pubkeys: string[], signingPrv?: OpenPGP.key.Key, pwd?: Pwd, data: Uint8Array, filename?: string, armor: boolean, date?: Date };
    export type Type = { data: Uint8Array };
    export type Decrypt = { kisWithPp: PrvKeyInfo[], encryptedData: Uint8Array, msgPwd?: string };
    export type DiagnosePubkeys = { privateKis: KeyInfo[], message: Uint8Array };
    export type VerifyDetached = { plaintext: Uint8Array, sigText: Uint8Array };
  }
  export type DiagnosePubkeys = (arg: Arg.DiagnosePubkeys) => Promise<DiagnoseMsgPubkeysResult>;
  export type VerifyDetached = (arg: Arg.VerifyDetached) => Promise<VerifyRes>;
  export type Decrypt = (arg: Arg.Decrypt) => Promise<DecryptSuccess | DecryptError>;
  export type Type = (arg: Arg.Type) => Promise<PgpMsgTypeResult>;
  export type Encrypt = (arg: Arg.Encrypt) => Promise<OpenPGP.EncryptResult>;
}

export type Contact = {
  email: string;
  name: string | null;
  pubkey: string | null;
  has_pgp: 0 | 1;
  searchable: string[];
  client: string | null;
  fingerprint: string | null;
  longid: string | null;
  longids: string[];
  keywords: string | null;
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
  decrypted?: OpenPGP.key.Key;  // only for internal use in this file
  parsed?: OpenPGP.key.Key;     // only for internal use in this file
}

export interface KeyInfo extends PrvKeyInfo {
  public: string;
  fingerprint: string;
  primary: boolean;
  keywords: string;
}

type KeyDetails$ids = {
  shortid: string;
  longid: string;
  fingerprint: string;
  keywords: string;
};

export interface KeyDetails {
  private?: string;
  public: string;
  isDecrypted: boolean | null;
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

type SortedKeysForDecrypt = {
  verificationContacts: Contact[];
  forVerification: OpenPGP.key.Key[];
  encryptedFor: string[];
  signedBy: string[];
  prvMatching: PrvKeyInfo[];
  prvForDecrypt: PrvKeyInfo[];
  prvForDecryptDecrypted: PrvKeyInfo[];
  prvForDecryptWithoutPassphrases: PrvKeyInfo[];
};

type DecryptSuccess = { success: true; signature?: VerifyRes; isEncrypted?: boolean, filename?: string, content: Buf };
type DecryptError$error = { type: DecryptErrTypes; message: string; };
type DecryptError$longids = { message: string[]; matching: string[]; chosen: string[]; needPassphrase: string[]; };
export type DecryptError = {
  success: false; error: DecryptError$error; longids: DecryptError$longids; content?: Buf;
  isEncrypted?: boolean; message?: OpenPGP.message.Message | OpenPGP.cleartext.CleartextMessage;
};
type CryptoArmorHeaderDefinition = { begin: string, middle?: string, end: string | RegExp, replace: boolean };
type CryptoArmorHeaderDefinitions = { readonly [type in ReplaceableMsgBlockType | 'null' | 'signature']: CryptoArmorHeaderDefinition; };
type PreparedForDecrypt = { isArmored: boolean, isCleartext: true, message: OpenPGP.cleartext.CleartextMessage }
  | { isArmored: boolean, isCleartext: false, message: OpenPGP.message.Message };

type OpenpgpMsgOrCleartext = OpenPGP.message.Message | OpenPGP.cleartext.CleartextMessage;

export type Pwd = { question?: string; answer: string; };
export type VerifyRes = { signer?: string; contact?: Contact; match: boolean | null; error?: string; };
export type PgpMsgTypeResult = { armored: boolean, type: MsgBlockType } | undefined;
export type DecryptResult = DecryptSuccess | DecryptError;
export type DiagnoseMsgPubkeysResult = { found_match: boolean, receivers: number, };
export enum DecryptErrTypes {
  keyMismatch = 'key_mismatch',
  usePassword = 'use_password',
  wrongPwd = 'wrong_password',
  noMdc = 'no_mdc',
  badMdc = 'bad_mdc',
  needPassphrase = 'need_passphrase',
  format = 'format',
  other = 'other',
}

export class FormatError extends Error {
  public data: string;
  constructor(message: string, data: string) {
    super(message);
    this.data = data;
  }
}

export class Pgp {

  private static ARMOR_HEADER_MAX_LENGTH = 50;
  private static ARMOR_HEADER_DICT: CryptoArmorHeaderDefinitions = { // general passwordMsg begin: /^[^\n]+: (Open Message|Nachricht öffnen)/
    null: { begin: '-----BEGIN', end: '-----END', replace: false },
    publicKey: { begin: '-----BEGIN PGP PUBLIC KEY BLOCK-----', end: '-----END PGP PUBLIC KEY BLOCK-----', replace: true },
    privateKey: { begin: '-----BEGIN PGP PRIVATE KEY BLOCK-----', end: '-----END PGP PRIVATE KEY BLOCK-----', replace: true },
    cryptupVerification: { begin: '-----BEGIN CRYPTUP VERIFICATION-----', end: '-----END CRYPTUP VERIFICATION-----', replace: true },
    signedMsg: { begin: '-----BEGIN PGP SIGNED MESSAGE-----', middle: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: true },
    signature: { begin: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: false },
    encryptedMsg: { begin: '-----BEGIN PGP MESSAGE-----', end: '-----END PGP MESSAGE-----', replace: true },
    encryptedMsgLink: { begin: 'This message is encrypted: Open Message', end: /https:(\/|&#x2F;){2}(cryptup\.org|flowcrypt\.com)(\/|&#x2F;)[a-zA-Z0-9]{10}(\n|$)/, replace: true },
  };
  // (10k pc)*(2 core p/pc)*(4k guess p/core) httpshttps://www.abuse.ch/?p=3294://threatpost.com/how-much-does-botnet-cost-022813/77573/ https://www.abuse.ch/?p=3294
  private static PASSWORD_GUESSES_PER_SECOND = 10000 * 2 * 4000;
  private static PASSWORD_CRACK_TIME_WORDS = [
    { match: 'millenni', word: 'perfect', bar: 100, color: 'green', pass: true },
    { match: 'centu', word: 'great', bar: 80, color: 'green', pass: true },
    { match: 'year', word: 'good', bar: 60, color: 'orange', pass: true },
    { match: 'month', word: 'reasonable', bar: 40, color: 'darkorange', pass: true },
    { match: 'day', word: 'poor', bar: 20, color: 'darkred', pass: false },
    { match: '', word: 'weak', bar: 10, color: 'red', pass: false },
  ];

  public static armor = {
    clip: (text: string): string | undefined => {
      if (text && text.includes(Pgp.ARMOR_HEADER_DICT.null.begin) && text.includes(String(Pgp.ARMOR_HEADER_DICT.null.end))) {
        const match = text.match(/(-----BEGIN PGP (MESSAGE|SIGNED MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----[^]+-----END PGP (MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----)/gm);
        return (match && match.length) ? match[0] : undefined;
      }
      return undefined;
    },
    headers: (blockType: ReplaceableMsgBlockType | 'null', format = 'string'): CryptoArmorHeaderDefinition => {
      const h = Pgp.ARMOR_HEADER_DICT[blockType];
      return {
        begin: (typeof h.begin === 'string' && format === 're') ? h.begin.replace(/ /g, '\\\s') : h.begin,
        end: (typeof h.end === 'string' && format === 're') ? h.end.replace(/ /g, '\\\s') : h.end,
        replace: h.replace,
      };
    },
    detectBlocks: (origText: string) => {
      const blocks: MsgBlock[] = [];
      const normalized = Str.normalize(origText);
      let startAt = 0;
      while (true) {
        const r = Pgp.internal.detectBlockNext(normalized, startAt);
        if (r.found) {
          blocks.push(...r.found);
        }
        if (typeof r.continueAt === 'undefined') {
          return { blocks, normalized };
        } else {
          if (r.continueAt <= startAt) {
            Catch.report(`Pgp.armor.detect_blocks likely infinite loop: r.continue_at(${r.continueAt}) <= start_at(${startAt})`);
            return { blocks, normalized }; // prevent infinite loop
          }
          startAt = r.continueAt;
        }
      }
    },
    normalize: (armored: string, type: ReplaceableMsgBlockType | 'key') => {
      armored = Str.normalize(armored).replace(/\n /g, '\n');
      if (['encryptedMsg', 'publicKey', 'privateKey', 'key'].includes(type)) {
        armored = armored.replace(/\r?\n/g, '\n').trim();
        const nl2 = armored.match(/\n\n/g);
        const nl3 = armored.match(/\n\n\n/g);
        const nl4 = armored.match(/\n\n\n\n/g);
        const nl6 = armored.match(/\n\n\n\n\n\n/g);
        if (nl3 && nl6 && nl3.length > 1 && nl6.length === 1) {
          armored = armored.replace(/\n\n\n/g, '\n'); // newlines tripled: fix
        } else if (nl2 && nl4 && nl2.length > 1 && nl4.length === 1) {
          armored = armored.replace(/\n\n/g, '\n'); // newlines doubled. GPA on windows does this, and sometimes message can get extracted this way from html
        }
      }
      const lines = armored.split('\n');
      const h = Pgp.armor.headers(type === 'key' ? 'null' : type);
      // check for and fix missing a mandatory empty line
      if (lines.length > 5 && lines[0].includes(h.begin) && lines[lines.length - 1].includes(String(h.end)) && !lines.includes('')) {
        for (let i = 1; i < 5; i++) {
          if (lines[i].match(/^[a-zA-Z0-9\-_. ]+: .+$/)) {
            continue; // skip comment lines, looking for first data line
          }
          if (lines[i].match(/^[a-zA-Z0-9\/+]{32,77}$/)) { // insert empty line before first data line
            armored = `${lines.slice(0, i).join('\n')}\n\n${lines.slice(i).join('\n')}`;
            break;
          }
          break; // don't do anything if format not as expected
        }
      }
      return armored;
    },
  };

  public static hash = {
    sha1UtfStr: async (string: string): Promise<string> => {
      return openpgp.util.Uint8Array_to_hex(await openpgp.crypto.hash.digest(openpgp.enums.hash.sha1, Buf.fromUtfStr(string)));
    },
    sha256UtfStr: async (string: string) => {
      return openpgp.util.Uint8Array_to_hex(await openpgp.crypto.hash.digest(openpgp.enums.hash.sha256, Buf.fromUtfStr(string)));
    },
    doubleSha1Upper: async (string: string) => {
      return (await Pgp.hash.sha1UtfStr(await Pgp.hash.sha1UtfStr(string))).toUpperCase();
    },
    challengeAnswer: async (answer: string) => {
      return await Pgp.internal.cryptoHashSha256Loop(answer);
    },
  };

  public static key = {
    create: async (userIds: { name: string, email: string }[], variant: 'rsa2048' | 'rsa4096' | 'curve25519', passphrase: string): Promise<{ private: string, public: string }> => {
      const opt: OpenPGP.KeyOptions = { userIds, passphrase };
      if (variant === 'curve25519') {
        opt.curve = 'curve25519';
      } else if (variant === 'rsa2048') {
        opt.numBits = 2048;
      } else {
        opt.numBits = 4096;
      }
      const k = await openpgp.generateKey(opt);
      return { public: k.publicKeyArmored, private: k.privateKeyArmored };
    },
    /**
     * used only for keys that we ourselves parsed / formatted before, eg from local storage, because no err handling
     */
    read: async (armoredKey: string) => { // should be renamed to readOne
      const fromCache = Store.armoredKeyCacheGet(armoredKey);
      if (fromCache) {
        return fromCache;
      }
      const { keys: [key] } = await openpgp.key.readArmored(armoredKey);
      if (key && key.isPrivate()) {
        Store.armoredKeyCacheSet(armoredKey, key);
      }
      return key;
    },
    /**
     * Read many keys, could be armored or binary, in single armor or separately, useful for importing keychains of various formats
     */
    readMany: async (fileData: Buf): Promise<{ keys: OpenPGP.key.Key[], errs: Error[] }> => {
      const allKeys: OpenPGP.key.Key[] = [];
      const allErrs: Error[] = [];
      const { blocks } = await Pgp.armor.detectBlocks(fileData.toUtfStr());
      const armoredPublicKeyBlocks = blocks.filter(block => block.type === 'publicKey' || block.type === 'privateKey');
      if (armoredPublicKeyBlocks.length) {
        for (const block of blocks) {
          try {
            const { err, keys } = await openpgp.key.readArmored(block.content.toString());
            allErrs.push(...(err || []));
            allKeys.push(...keys);
          } catch (e) {
            allErrs.push(e instanceof Error ? e : new Error(String(e)));
          }
        }
      } else {
        try {
          const { err, keys } = await openpgp.key.read(fileData);
          allErrs.push(...(err || []));
          allKeys.push(...keys);
        } catch (e) {
          allErrs.push(e instanceof Error ? e : new Error(String(e)));
        }
      }
      return { keys: allKeys, errs: allErrs };
    },
    decrypt: async (key: OpenPGP.key.Key, passphrases: string[], optionalKeyid?: OpenPGP.Keyid, optionalBehaviorFlag?: 'OK-IF-ALREADY-DECRYPTED'): Promise<boolean> => {
      try {
        return await key.decrypt(passphrases, optionalKeyid); // when no keyid intersection found, it will decrypt all
      } catch (e) {
        if (e instanceof Error && e.message.toLowerCase().includes('passphrase')) {
          return false;
        } else if (e instanceof Error && e.message.toLowerCase().includes('already decrypted') && optionalBehaviorFlag === 'OK-IF-ALREADY-DECRYPTED') {
          // OpenPGP.js will say key.isDecrypted() -> false, but still throw 'already decrypted', if some packets were already decrypted, but not others
          // below we can gracefully decrypt the remaining required packets, if a flag was provided to do so
          if (passphrases.length !== 1) {
            throw new Error(`Key packet is already decrypted + cannot gracefully decrypt with more than one pass phrase`);
          }
          for (const { keyPacket } of key.getKeys(optionalKeyid)) {
            if (keyPacket.isDecrypted() === false && (keyPacket as OpenPGP.packet.SecretKey).encrypted) {
              try {
                await (keyPacket as OpenPGP.packet.SecretKey).decrypt(passphrases[0]);
              } catch (e) {
                if (e instanceof Error && e.message.includes('passphrase')) {
                  return false;
                }
                throw e;
              }
            }
          }
          return true;
        }
        throw e;
      }
    },
    normalize: async (armored: string): Promise<{ normalized: string, keys: OpenPGP.key.Key[] }> => {
      try {
        let keys: OpenPGP.key.Key[] = [];
        armored = Pgp.armor.normalize(armored, 'key');
        if (RegExp(Pgp.armor.headers('publicKey', 're').begin).test(armored)) {
          keys = (await openpgp.key.readArmored(armored)).keys;
        } else if (RegExp(Pgp.armor.headers('privateKey', 're').begin).test(armored)) {
          keys = (await openpgp.key.readArmored(armored)).keys;
        } else if (RegExp(Pgp.armor.headers('encryptedMsg', 're').begin).test(armored)) {
          keys = [new openpgp.key.Key((await openpgp.message.readArmored(armored)).packets)];
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
    },
    fingerprint: async (key: OpenPGP.key.Key | string, formatting: "default" | "spaced" = 'default'): Promise<string | undefined> => {
      if (!key) {
        return undefined;
      } else if (key instanceof openpgp.key.Key) {
        if (!key.primaryKey.getFingerprintBytes()) {
          return undefined;
        }
        try {
          const fp = key.primaryKey.getFingerprint().toUpperCase();
          if (formatting === 'spaced') {
            return fp.replace(/(.{4})/g, '$1 ').trim();
          }
          return fp;
        } catch (e) {
          console.error(e);
          return undefined;
        }
      } else {
        try {
          return await Pgp.key.fingerprint(await Pgp.key.read(key), formatting);
        } catch (e) {
          if (e instanceof Error && e.message === 'openpgp is not defined') {
            Catch.reportErr(e);
          }
          console.error(e);
          return undefined;
        }
      }
    },
    longid: async (keyOrFingerprintOrBytes: string | OpenPGP.key.Key | undefined): Promise<string | undefined> => {
      if (!keyOrFingerprintOrBytes || typeof keyOrFingerprintOrBytes === 'undefined') {
        return undefined;
      } else if (typeof keyOrFingerprintOrBytes === 'string' && keyOrFingerprintOrBytes.length === 8) {
        return openpgp.util.str_to_hex(keyOrFingerprintOrBytes).toUpperCase();
      } else if (typeof keyOrFingerprintOrBytes === 'string' && keyOrFingerprintOrBytes.length === 40) {
        return keyOrFingerprintOrBytes.substr(-16);
      } else if (typeof keyOrFingerprintOrBytes === 'string' && keyOrFingerprintOrBytes.length === 49) {
        return keyOrFingerprintOrBytes.replace(/ /g, '').substr(-16);
      } else {
        return await Pgp.key.longid(await Pgp.key.fingerprint(keyOrFingerprintOrBytes));
      }
    },
    usable: async (armored: string) => { // is pubkey usable for encrytion?
      if (!Pgp.key.fingerprint(armored)) {
        return false;
      }
      const { keys: [pubkey] } = await openpgp.key.readArmored(armored);
      if (!pubkey) {
        return false;
      }
      if (await pubkey.getEncryptionKey()) {
        return true; // good key - cannot be expired
      }
      return await Pgp.key.usableButExpired(pubkey);
    },
    expired: async (key: OpenPGP.key.Key): Promise<boolean> => {
      if (!key) {
        return false;
      }
      const exp = await key.getExpirationTime('encrypt');
      if (exp === Infinity || !exp) {
        return false;
      }
      if (exp instanceof Date) {
        return Date.now() > exp.getTime();
      }
      throw new Error(`Got unexpected value for expiration: ${exp}`); // exp must be either null, Infinity or a Date
    },
    usableButExpired: async (key: OpenPGP.key.Key): Promise<boolean> => {
      if (!key) {
        return false;
      }
      if (await key.getEncryptionKey()) {
        return false; // good key - cannot be expired
      }
      const oneSecondBeforeExpiration = await Pgp.key.dateBeforeExpiration(key);
      if (typeof oneSecondBeforeExpiration === 'undefined') {
        return false; // key does not expire
      }
      // try to see if the key was usable just before expiration
      return Boolean(await key.getEncryptionKey(undefined, oneSecondBeforeExpiration));
    },
    dateBeforeExpiration: async (key: OpenPGP.key.Key | string): Promise<Date | undefined> => {
      const openPgpKey = typeof key === 'string' ? await Pgp.key.read(key) : key;
      const expires = await openPgpKey.getExpirationTime('encrypt');
      if (expires instanceof Date && expires.getTime() < Date.now()) { // expired
        return new Date(expires.getTime() - 1000);
      }
      return undefined;
    },
    parse: async (armored: string): Promise<{ original: string, normalized: string, keys: KeyDetails[] }> => {
      const { normalized, keys } = await Pgp.key.normalize(armored);
      return { original: armored, normalized, keys: await Promise.all(keys.map(Pgp.key.details)) };
    },
    details: async (k: OpenPGP.key.Key): Promise<KeyDetails> => {
      const keys = k.getKeys();
      const algoInfo = k.primaryKey.getAlgorithmInfo();
      const algo = { algorithm: algoInfo.algorithm, bits: algoInfo.bits, curve: (algoInfo as any).curve, algorithmId: openpgp.enums.publicKey[algoInfo.algorithm] };
      const created = k.primaryKey.created.getTime() / 1000;
      const ids: KeyDetails$ids[] = [];
      for (const key of keys) {
        const fingerprint = key.getFingerprint().toUpperCase();
        if (fingerprint) {
          const longid = await Pgp.key.longid(fingerprint);
          if (longid) {
            const shortid = longid.substr(-8);
            ids.push({ fingerprint, longid, shortid, keywords: mnemonic(longid)! });
          }
        }
      }
      return {
        private: k.isPrivate() ? k.armor() : undefined,
        isDecrypted: k.isDecrypted(),
        public: k.toPublic().armor(),
        users: k.getUserIds(),
        ids,
        algo,
        created,
      };
    },
    /**
     * Get latest self-signature date, in utc millis.
     * This is used to figure out how recently was key updated, and if one key is newer than other.
     */
    lastSig: async (key: OpenPGP.key.Key): Promise<number> => {
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
  };

  public static password = {
    estimateStrength: (zxcvbnResultGuesses: number) => {
      const timeToCrack = zxcvbnResultGuesses / Pgp.PASSWORD_GUESSES_PER_SECOND;
      for (const word of Pgp.PASSWORD_CRACK_TIME_WORDS) {
        const readableTime = Pgp.internal.readableCrackTime(timeToCrack);
        if (readableTime.includes(word.match)) { // looks for a word match from readable_crack_time, defaults on "weak"
          return { word, seconds: Math.round(timeToCrack), time: readableTime };
        }
      }
      throw Error('(thrown) estimate_strength: got to end without any result');
    },
    weakWords: () => [
      'crypt', 'up', 'cryptup', 'flow', 'flowcrypt', 'encryption', 'pgp', 'email', 'set', 'backup', 'passphrase', 'best', 'pass', 'phrases', 'are', 'long', 'and', 'have', 'several',
      'words', 'in', 'them', 'Best pass phrases are long', 'have several words', 'in them', 'bestpassphrasesarelong', 'haveseveralwords', 'inthem',
      'Loss of this pass phrase', 'cannot be recovered', 'Note it down', 'on a paper', 'lossofthispassphrase', 'cannotberecovered', 'noteitdown', 'onapaper',
      'setpassword', 'set password', 'set pass word', 'setpassphrase', 'set pass phrase', 'set passphrase'
    ],
    random: () => { // eg TDW6-DU5M-TANI-LJXY
      return base64encode(openpgp.util.Uint8Array_to_str(secureRandomBytes(128))).toUpperCase().replace(/[^A-Z0-9]|0|O|1/g, '').replace(/(.{4})/g, '$1-').substr(0, 19);
    },
  };

  public static internal = {
    msgBlockObj: (type: MsgBlockType, content: string | Buf, missingEnd = false): MsgBlock => ({ type, content, complete: !missingEnd }),
    msgBlockDecryptErrObj: (encryptedContent: string | Buf, decryptErr: DecryptError): MsgBlock => ({ type: 'decryptErr', content: encryptedContent, decryptErr, complete: true }),
    msgBlockAttObj: (type: MsgBlockType, content: string, attMeta: AttMeta): MsgBlock => ({ type, content, complete: true, attMeta }),
    msgBlockKeyObj: (type: MsgBlockType, content: string, keyDetails: KeyDetails): MsgBlock => ({ type, content, complete: true, keyDetails }),
    detectBlockNext: (origText: string, startAt: number) => {
      const result: { found: MsgBlock[], continueAt?: number } = { found: [] as MsgBlock[] };
      const begin = origText.indexOf(Pgp.armor.headers('null').begin, startAt);
      if (begin !== -1) { // found
        const potentialBeginHeader = origText.substr(begin, Pgp.ARMOR_HEADER_MAX_LENGTH);
        for (const xType of Object.keys(Pgp.ARMOR_HEADER_DICT)) {
          const type = xType as ReplaceableMsgBlockType;
          const blockHeaderDef = Pgp.ARMOR_HEADER_DICT[type];
          if (blockHeaderDef.replace) {
            const indexOfConfirmedBegin = potentialBeginHeader.indexOf(blockHeaderDef.begin);
            if (indexOfConfirmedBegin === 0 || (type === 'encryptedMsgLink' && indexOfConfirmedBegin >= 0 && indexOfConfirmedBegin < 15)) { // identified beginning of a specific block
              if (begin > startAt) {
                const potentialTextBeforeBlockBegun = origText.substring(startAt, begin).trim();
                if (potentialTextBeforeBlockBegun) {
                  result.found.push(Pgp.internal.msgBlockObj('plainText', potentialTextBeforeBlockBegun));
                }
              }
              let endIndex: number = -1;
              let foundBlockEndHeaderLength = 0;
              if (typeof blockHeaderDef.end === 'string') {
                endIndex = origText.indexOf(blockHeaderDef.end, begin + blockHeaderDef.begin.length);
                foundBlockEndHeaderLength = blockHeaderDef.end.length;
              } else { // regexp
                const origTextAfterBeginIndex = origText.substring(begin);
                const matchEnd = origTextAfterBeginIndex.match(blockHeaderDef.end);
                if (matchEnd) {
                  endIndex = matchEnd.index ? begin + matchEnd.index : -1;
                  foundBlockEndHeaderLength = matchEnd[0].length;
                }
              }
              if (endIndex !== -1) { // identified end of the same block
                if (type !== 'encryptedMsgLink') {
                  result.found.push(Pgp.internal.msgBlockObj(type, origText.substring(begin, endIndex + foundBlockEndHeaderLength).trim()));
                } else {
                  const pwdMsgFullText = origText.substring(begin, endIndex + foundBlockEndHeaderLength).trim();
                  const pwdMsgShortIdMatch = pwdMsgFullText.match(/[a-zA-Z0-9]{10}$/);
                  if (pwdMsgShortIdMatch) {
                    result.found.push(Pgp.internal.msgBlockObj(type, pwdMsgShortIdMatch[0]));
                  } else {
                    result.found.push(Pgp.internal.msgBlockObj('plainText', pwdMsgFullText));
                  }
                }
                result.continueAt = endIndex + foundBlockEndHeaderLength;
              } else { // corresponding end not found
                result.found.push(Pgp.internal.msgBlockObj(type, origText.substr(begin), true));
              }
              break;
            }
          }
        }
      }
      if (origText && !result.found.length) { // didn't find any blocks, but input is non-empty
        const potentialText = origText.substr(startAt).trim();
        if (potentialText) {
          result.found.push(Pgp.internal.msgBlockObj('plainText', potentialText));
        }
      }
      return result;
    },
    cryptoHashSha256Loop: async (string: string, times = 100000) => {
      for (let i = 0; i < times; i++) {
        string = await Pgp.hash.sha256UtfStr(string);
      }
      return string;
    },
    cryptoMsgPrepareForDecrypt: async (encrypted: Uint8Array): Promise<PreparedForDecrypt> => {
      if (!encrypted.length) {
        throw new Error('Encrypted message could not be parsed because no data was provided');
      }
      const utfChunk = new Buf(encrypted.slice(0, 100)).toUtfStr('ignore'); // ignore errors - this may not be utf string, just testing
      const isArmoredEncrypted = utfChunk.includes(Pgp.armor.headers('encryptedMsg').begin);
      const isArmoredSignedOnly = utfChunk.includes(Pgp.armor.headers('signedMsg').begin);
      const isArmored = isArmoredEncrypted || isArmoredSignedOnly;
      if (isArmoredEncrypted) {
        return { isArmored, isCleartext: false, message: await openpgp.message.readArmored(new Buf(encrypted).toUtfStr()) };
      } else if (isArmoredSignedOnly) {
        return { isArmored, isCleartext: true, message: await openpgp.cleartext.readArmored(new Buf(encrypted).toUtfStr()) };
      } else if (encrypted instanceof Uint8Array) {
        return { isArmored, isCleartext: false, message: await openpgp.message.read(encrypted) };
      }
      throw new Error('Message does not have armor headers');
    },
    longids: async (keyIds: OpenPGP.Keyid[]) => {
      const longids: string[] = [];
      for (const id of keyIds) {
        const longid = await Pgp.key.longid(id.bytes);
        if (longid) {
          longids.push(longid);
        }
      }
      return longids;
    },
    cryptoMsgGetSignedBy: async (msg: OpenpgpMsgOrCleartext, keys: SortedKeysForDecrypt) => {
      keys.signedBy = Value.arr.unique(await Pgp.internal.longids(msg.getSigningKeyIds ? msg.getSigningKeyIds() : []));
      if (keys.signedBy.length && typeof Store.dbContactGet === 'function') {
        const verificationContacts = await Store.dbContactGet(undefined, keys.signedBy);
        keys.verificationContacts = verificationContacts.filter(contact => contact && contact.pubkey) as Contact[];
        keys.forVerification = [];
        for (const contact of keys.verificationContacts) {
          const { keys: keysForVerification } = await openpgp.key.readArmored(contact.pubkey!);
          keys.forVerification.push(...keysForVerification);
        }
      }
    },
    cryptoKeyOptionalMatchingKeyid: (key: OpenPGP.key.Key, forMsgKeyids: OpenPGP.Keyid[]) => {
      const msgKeyidBytesArr = (forMsgKeyids || []).map(kid => kid.bytes);
      return key.getKeyIds().find(kid => msgKeyidBytesArr.includes(kid.bytes));
    },
    cryptoMsgGetSortedKeys: async (kiWithPp: PrvKeyInfo[], msg: OpenpgpMsgOrCleartext): Promise<SortedKeysForDecrypt> => {
      const keys: SortedKeysForDecrypt = {
        verificationContacts: [],
        forVerification: [],
        encryptedFor: [],
        signedBy: [],
        prvMatching: [],
        prvForDecrypt: [],
        prvForDecryptDecrypted: [],
        prvForDecryptWithoutPassphrases: [],
      };
      const encryptedForKeyids = msg instanceof openpgp.message.Message ? (msg as OpenPGP.message.Message).getEncryptionKeyIds() : [];
      keys.encryptedFor = await Pgp.internal.longids(encryptedForKeyids);
      await Pgp.internal.cryptoMsgGetSignedBy(msg, keys);
      if (keys.encryptedFor.length) {
        for (const ki of kiWithPp) {
          ki.parsed = await Pgp.key.read(ki.private);
          // this is inefficient because we are doing unnecessary parsing of all keys here
          // better would be to compare to already stored KeyInfo, however KeyInfo currently only holds primary longid, not longids of subkeys
          // while messages are typically encrypted for subkeys, thus we have to parse the key to get the info
          // we are filtering here to avoid a significant performance issue of having to attempt decrypting with all keys simultaneously
          for (const longid of await Promise.all(ki.parsed.getKeyIds().map(({ bytes }) => Pgp.key.longid(bytes)))) {
            if (keys.encryptedFor.includes(longid!)) {
              keys.prvMatching.push(ki);
              break;
            }
          }
        }
        keys.prvForDecrypt = keys.prvMatching.length ? keys.prvMatching : kiWithPp;
      } else { // prvs not needed for signed msgs
        keys.prvForDecrypt = [];
      }
      for (const ki of keys.prvForDecrypt) {
        const optionalMatchingKeyid = Pgp.internal.cryptoKeyOptionalMatchingKeyid(ki.parsed!, encryptedForKeyids);
        const cachedDecryptedKey = Store.decryptedKeyCacheGet(ki.longid);
        if (cachedDecryptedKey && (cachedDecryptedKey.isDecrypted() || (optionalMatchingKeyid && cachedDecryptedKey.getKeys(optionalMatchingKeyid).every(k => k.isDecrypted() === true)))) {
          ki.decrypted = cachedDecryptedKey;
          keys.prvForDecryptDecrypted.push(ki);
        } else if (ki.parsed!.isDecrypted() || await Pgp.key.decrypt(ki.parsed!, [ki.passphrase!], optionalMatchingKeyid, 'OK-IF-ALREADY-DECRYPTED') === true) {
          Store.decryptedKeyCacheSet(ki.parsed!);
          ki.decrypted = ki.parsed!;
          keys.prvForDecryptDecrypted.push(ki);
        } else {
          keys.prvForDecryptWithoutPassphrases.push(ki);
        }
      }
      return keys;
    },
    cryptoMsgDecryptCategorizeErr: (decryptErr: any, msgPwd?: string): DecryptError$error => {
      const e = String(decryptErr).replace('Error: ', '').replace('Error decrypting message: ', '');
      const keyMismatchErrStrings = ['Cannot read property \'isDecrypted\' of null', 'privateKeyPacket is null',
        'TypeprivateKeyPacket is null', 'Session key decryption failed.', 'Invalid session key for decryption.'];
      if (keyMismatchErrStrings.includes(e) && !msgPwd) {
        return { type: DecryptErrTypes.keyMismatch, message: e };
      } else if (msgPwd && ['Invalid enum value.', 'CFB decrypt: invalid key', 'Session key decryption failed.'].includes(e)) {
        return { type: DecryptErrTypes.wrongPwd, message: e };
      } else if (e === 'Decryption failed due to missing MDC in combination with modern cipher.' || e === 'Decryption failed due to missing MDC.') {
        return { type: DecryptErrTypes.noMdc, message: e };
      } else if (e === 'Decryption error') {
        return { type: DecryptErrTypes.format, message: e };
      } else if (e === 'Modification detected.') {
        return { type: DecryptErrTypes.badMdc, message: `Security threat - opening this message is dangerous because it was modified in transit.` };
      } else {
        return { type: DecryptErrTypes.other, message: e };
      }
    },
    readableCrackTime: (totalSeconds: number) => { // http://stackoverflow.com/questions/8211744/convert-time-interval-given-in-seconds-into-more-human-readable-form
      const numberWordEnding = (n: number) => (n > 1) ? 's' : '';
      totalSeconds = Math.round(totalSeconds);
      const millennia = Math.round(totalSeconds / (86400 * 30 * 12 * 100 * 1000));
      if (millennia) {
        return millennia === 1 ? 'a millennium' : 'millennia';
      }
      const centuries = Math.round(totalSeconds / (86400 * 30 * 12 * 100));
      if (centuries) {
        return centuries === 1 ? 'a century' : 'centuries';
      }
      const years = Math.round(totalSeconds / (86400 * 30 * 12));
      if (years) {
        return years + ' year' + numberWordEnding(years);
      }
      const months = Math.round(totalSeconds / (86400 * 30));
      if (months) {
        return months + ' month' + numberWordEnding(months);
      }
      const days = Math.round(totalSeconds / 86400);
      if (days) {
        return days + ' day' + numberWordEnding(days);
      }
      const hours = Math.round(totalSeconds / 3600);
      if (hours) {
        return hours + ' hour' + numberWordEnding(hours);
      }
      const minutes = Math.round(totalSeconds / 60);
      if (minutes) {
        return minutes + ' minute' + numberWordEnding(minutes);
      }
      const seconds = totalSeconds % 60;
      if (seconds) {
        return seconds + ' second' + numberWordEnding(seconds);
      }
      return 'less than a second';
    },
  };

}

export class PgpMsg {

  static type: PgpMsgMethod.Type = async ({ data }) => { // promisified because used through bg script
    if (!data || !data.length) {
      return undefined;
    }
    const firstByte = data[0];
    // attempt to understand this as a binary PGP packet: https://tools.ietf.org/html/rfc4880#section-4.2
    if ((firstByte & 0b10000000) === 0b10000000) { // 1XXX XXXX - potential pgp packet tag
      let tagNumber = 0; // zero is a forbidden tag number
      if ((firstByte & 0b11000000) === 0b11000000) { // 11XX XXXX - potential new pgp packet tag
        tagNumber = firstByte & 0b00111111;  // 11TTTTTT where T is tag number bit
      } else { // 10XX XXXX - potential old pgp packet tag
        tagNumber = (firstByte & 0b00111100) / 4; // 10TTTTLL where T is tag number bit. Division by 4 in place of two bit shifts. I hate bit shifts.
      }
      if (Object.values(openpgp.enums.packet).includes(tagNumber)) {
        // Indeed a valid OpenPGP packet tag number
        // This does not 100% mean it's OpenPGP message
        // But it's a good indication that it may
        const t = openpgp.enums.packet;
        const msgTpes = [t.symEncryptedIntegrityProtected, t.modificationDetectionCode, t.symEncryptedAEADProtected, t.symmetricallyEncrypted, t.compressed];
        return { armored: false, type: msgTpes.includes(tagNumber) ? 'encryptedMsg' : 'publicKey' };
      }
    }
    const { blocks } = Pgp.armor.detectBlocks(new Buf(data.slice(0, 50)).toUtfStr().trim()); // only interested in first 50 bytes
    if (blocks.length === 1 && blocks[0].complete === false && ['encryptedMsg', 'privateKey', 'publicKey', 'signedMsg'].includes(blocks[0].type)) {
      return { armored: true, type: blocks[0].type };
    }
    return undefined;
  }

  static sign = async (signingPrv: OpenPGP.key.Key, data: string): Promise<string> => {
    const message = openpgp.cleartext.fromText(data);
    const signRes = await openpgp.sign({ message, armor: true, privateKeys: [signingPrv] });
    return await openpgp.stream.readToEnd((signRes as OpenPGP.SignArmorResult).data);
  }

  static verify = async (msgOrVerResults: OpenpgpMsgOrCleartext | OpenPGP.message.Verification[], pubs: OpenPGP.key.Key[], contact?: Contact): Promise<VerifyRes> => {
    const sig: VerifyRes = { contact, match: null }; // tslint:disable-line:no-null-keyword
    try {
      // While this looks like bad method API design, it's here to ensure execution order when 1) reading data, 2) verifying, 3) processing signatures
      // Else it will hang trying to read a stream: https://github.com/openpgpjs/openpgpjs/issues/916#issuecomment-510620625
      const verifyResults = Array.isArray(msgOrVerResults) ? msgOrVerResults : await msgOrVerResults.verify(pubs);
      for (const verifyRes of verifyResults) {
        // todo - a valid signature is a valid signature, and should be surfaced. Currently, if any of the signatures are not valid, it's showing all as invalid
        // .. as it is now this could allow an attacker to append bogus signatures to validly signed messages, making otherwise correct messages seem incorrect
        // .. which is not really an issue - an attacker that can append signatures could have also just slightly changed the message, causing the same experience
        // .. so for now #wontfix unless a reasonable usecase surfaces
        sig.match = (sig.match === true || sig.match === null) && await verifyRes.verified;
        if (!sig.signer) {
          // todo - currently only the first signer will be reported. Should we be showing all signers? How common is that?
          sig.signer = await Pgp.key.longid(verifyRes.keyid.bytes);
        }
      }
    } catch (verifyErr) {
      sig.match = null; // tslint:disable-line:no-null-keyword
      if (verifyErr instanceof Error && verifyErr.message === 'Can only verify message with one literal data packet.') {
        sig.error = 'FlowCrypt is not equipped to verify this message (err 101)';
      } else {
        sig.error = `FlowCrypt had trouble verifying this message (${String(verifyErr)})`;
        Catch.reportErr(verifyErr);
      }
    }
    return sig;
  }

  static verifyDetached: PgpMsgMethod.VerifyDetached = async ({ plaintext, sigText }) => {
    const message = openpgp.message.fromText(Buf.fromUint8(plaintext).toUtfStr());
    await message.appendSignature(Buf.fromUint8(sigText).toUtfStr());
    const keys = await Pgp.internal.cryptoMsgGetSortedKeys([], message);
    return await PgpMsg.verify(message, keys.forVerification, keys.verificationContacts[0]);
  }

  static decrypt: PgpMsgMethod.Decrypt = async ({ kisWithPp, encryptedData, msgPwd }) => {
    let prepared: PreparedForDecrypt;
    const longids: DecryptError$longids = { message: [], matching: [], chosen: [], needPassphrase: [] };
    try {
      prepared = await Pgp.internal.cryptoMsgPrepareForDecrypt(encryptedData);
    } catch (formatErr) {
      return { success: false, error: { type: DecryptErrTypes.format, message: String(formatErr) }, longids };
    }
    const keys = await Pgp.internal.cryptoMsgGetSortedKeys(kisWithPp, prepared.message);
    longids.message = keys.encryptedFor;
    longids.matching = keys.prvForDecrypt.map(ki => ki.longid);
    longids.chosen = keys.prvForDecryptDecrypted.map(ki => ki.longid);
    longids.needPassphrase = keys.prvForDecryptWithoutPassphrases.map(ki => ki.longid);
    const isEncrypted = !prepared.isCleartext;
    if (!isEncrypted) {
      const signature = await PgpMsg.verify(prepared.message, keys.forVerification, keys.verificationContacts[0]);
      const text = await openpgp.stream.readToEnd(prepared.message.getText()!);
      return { success: true, content: Buf.fromUtfStr(text), isEncrypted, signature };
    }
    if (!keys.prvForDecryptDecrypted.length && !msgPwd) {
      return { success: false, error: { type: DecryptErrTypes.needPassphrase, message: 'Missing pass phrase' }, message: prepared.message, longids, isEncrypted };
    }
    try {
      const packets = (prepared.message as OpenPGP.message.Message).packets;
      const isSymEncrypted = packets.filter(p => p.tag === openpgp.enums.packet.symEncryptedSessionKey).length > 0;
      const isPubEncrypted = packets.filter(p => p.tag === openpgp.enums.packet.publicKeyEncryptedSessionKey).length > 0;
      if (isSymEncrypted && !isPubEncrypted && !msgPwd) {
        return { success: false, error: { type: DecryptErrTypes.usePassword, message: 'Use message password' }, longids, isEncrypted };
      }
      const passwords = msgPwd ? [msgPwd] : undefined;
      const privateKeys = keys.prvForDecryptDecrypted.map(ki => ki.decrypted!);
      const decrypted = await (prepared.message as OpenPGP.message.Message).decrypt(privateKeys, passwords, undefined, false);
      await Pgp.internal.cryptoMsgGetSignedBy(decrypted, keys); // we can only figure out who signed the msg once it's decrypted
      const verifyResults = keys.signedBy.length ? await decrypted.verify(keys.forVerification) : undefined; // verify first to prevent stream hang
      const content = new Buf(await openpgp.stream.readToEnd(decrypted.getLiteralData()!)); // read content second to prevent stream hang
      const signature = verifyResults ? await PgpMsg.verify(verifyResults, [], keys.verificationContacts[0]) : undefined; // evaluate verify results third to prevent stream hang
      if (!prepared.isCleartext && (prepared.message as OpenPGP.message.Message).packets.filterByTag(openpgp.enums.packet.symmetricallyEncrypted).length) {
        const noMdc = 'Security threat!\n\nMessage is missing integrity checks (MDC). The sender should update their outdated software.\n\nDisplay the message at your own risk.';
        return { success: false, content, error: { type: DecryptErrTypes.noMdc, message: noMdc }, message: prepared.message, longids, isEncrypted };
      }
      return { success: true, content, isEncrypted, filename: decrypted.getFilename() || undefined, signature };
    } catch (e) {
      return { success: false, error: Pgp.internal.cryptoMsgDecryptCategorizeErr(e, msgPwd), message: prepared.message, longids, isEncrypted };
    }
  }

  static encrypt: PgpMsgMethod.Encrypt = async ({ pubkeys, signingPrv, pwd, data, filename, armor, date }) => {
    const message = openpgp.message.fromBinary(data, filename, date);
    const options: OpenPGP.EncryptOptions = { armor, message };
    let usedChallenge = false;
    if (pubkeys) {
      options.publicKeys = [];
      for (const armoredPubkey of pubkeys) {
        const { keys: publicKeys } = await openpgp.key.readArmored(armoredPubkey);
        options.publicKeys.push(...publicKeys);
      }
    }
    if (pwd && pwd.answer) {
      options.passwords = [await Pgp.hash.challengeAnswer(pwd.answer)];
      usedChallenge = true;
    }
    if (!pubkeys && !usedChallenge) {
      throw new Error('no-pubkeys-no-challenge');
    }
    if (signingPrv && typeof signingPrv.isPrivate !== 'undefined' && signingPrv.isPrivate()) {
      options.privateKeys = [signingPrv];
    }
    return await openpgp.encrypt(options);
  }

  static diagnosePubkeys: PgpMsgMethod.DiagnosePubkeys = async ({ privateKis, message }) => {
    const m = await openpgp.message.readArmored(Buf.fromUint8(message).toUtfStr());
    const msgKeyIds = m.getEncryptionKeyIds ? m.getEncryptionKeyIds() : [];
    const localKeyIds: OpenPGP.Keyid[] = [];
    for (const k of await Promise.all(privateKis.map(ki => Pgp.key.read(ki.public)))) {
      localKeyIds.push(...k.getKeyIds());
    }
    const diagnosis = { found_match: false, receivers: msgKeyIds.length };
    for (const msgKeyId of msgKeyIds) {
      for (const localKeyId of localKeyIds) {
        if (msgKeyId.bytes === localKeyId.bytes) {
          diagnosis.found_match = true;
          return diagnosis;
        }
      }
    }
    return diagnosis;
  }

  /**
   * textBlockType - choose if textual block should be returned as escaped html (for direct browser rendering) or text (other platforms)
   */
  static fmtDecryptedAsSanitizedHtmlBlocks = async (decryptedContent: Uint8Array): Promise<MsgBlock[]> => {
    const blocks: MsgBlock[] = [];
    if (!Mime.resemblesMsg(decryptedContent)) {
      let utf = Buf.fromUint8(decryptedContent).toUtfStr();
      utf = PgpMsg.extractFcAtts(utf, blocks);
      utf = PgpMsg.stripFcTeplyToken(utf);
      const armoredPubKeys: string[] = [];
      utf = PgpMsg.stripPublicKeys(utf, armoredPubKeys);
      blocks.push(Pgp.internal.msgBlockObj('decryptedHtml', Str.asEscapedHtml(utf))); // escaped text as html
      await PgpMsg.pushArmoredPubkeysToBlocks(armoredPubKeys, blocks);
    } else {
      const decoded = await Mime.decode(decryptedContent);
      if (typeof decoded.html !== 'undefined') {
        blocks.push(Pgp.internal.msgBlockObj('decryptedHtml', Xss.htmlSanitizeKeepBasicTags(decoded.html))); // sanitized html
      } else if (typeof decoded.text !== 'undefined') {
        blocks.push(Pgp.internal.msgBlockObj('decryptedHtml', Str.asEscapedHtml(decoded.text))); // escaped text as html
      } else {
        blocks.push(Pgp.internal.msgBlockObj('decryptedHtml', Str.asEscapedHtml(Buf.with(decryptedContent).toUtfStr()))); // escaped mime text as html
      }
      for (const att of decoded.atts) {
        if (att.treatAs() === 'publicKey') {
          await PgpMsg.pushArmoredPubkeysToBlocks([att.getData().toUtfStr()], blocks);
        } else {
          blocks.push(Pgp.internal.msgBlockAttObj('decryptedAtt', '', { name: att.name, data: att.getData(), length: att.length, type: att.type }));
        }
      }
    }
    return blocks;
  }

  public static extractFcAtts = (decryptedContent: string, blocks: MsgBlock[]) => {
    // these tags were created by FlowCrypt exclusively, so the structure is fairly rigid
    // `<a href="${att.url}" class="cryptup_file" cryptup-data="${fcData}">${linkText}</a>\n`
    // thus we use RegEx so that it works on both browser and node
    if (decryptedContent.includes('class="cryptup_file"')) {
      decryptedContent = decryptedContent.replace(/<a\s+href="([^"]+)"\s+class="cryptup_file"\s+cryptup-data="([^"]+)"\s*>[^<]+<\/a>\n?/gm, (_, url, fcData) => {
        const a = Str.htmlAttrDecode(String(fcData));
        if (PgpMsg.isFcAttLinkData(a)) {
          blocks.push(Pgp.internal.msgBlockAttObj('encryptedAttLink', '', { type: a.type, name: a.name, length: a.size, url: String(url) }));
        }
        return '';
      });
    }
    return decryptedContent;
  }

  public static stripPublicKeys = (decryptedContent: string, foundPublicKeys: string[]) => {
    let { blocks, normalized } = Pgp.armor.detectBlocks(decryptedContent); // tslint:disable-line:prefer-const
    for (const block of blocks) {
      if (block.type === 'publicKey') {
        const armored = block.content.toString();
        foundPublicKeys.push(armored);
        normalized = normalized.replace(armored, '');
      }
    }
    return normalized;
  }

  // public static extractFcReplyToken = (decryptedContent: string) => { // todo - used exclusively on the web - move to a web package
  //   const fcTokenElement = $(`<div>${decryptedContent}</div>`).find('.cryptup_reply');
  //   if (fcTokenElement.length) {
  //     const fcData = fcTokenElement.attr('cryptup-data');
  //     if (fcData) {
  //       return Str.htmlAttrDecode(fcData);
  //     }
  //   }
  // }

  public static stripFcTeplyToken = (decryptedContent: string) => decryptedContent.replace(/<div[^>]+class="cryptup_reply"[^>]+><\/div>/, '');

  private static isFcAttLinkData = (o: any): o is FcAttLinkData => {
    return o && typeof o === 'object' && typeof (o as FcAttLinkData).name !== 'undefined'
      && typeof (o as FcAttLinkData).size !== 'undefined' && typeof (o as FcAttLinkData).type !== 'undefined';
  }

  private static pushArmoredPubkeysToBlocks = async (armoredPubkeys: string[], blocks: MsgBlock[]): Promise<void> => {
    for (const armoredPubkey of armoredPubkeys) {
      const { keys } = await Pgp.key.parse(armoredPubkey);
      for (const keyDetails of keys) {
        blocks.push(Pgp.internal.msgBlockKeyObj('publicKey', keyDetails.public, keyDetails));
      }
    }
  }

}
