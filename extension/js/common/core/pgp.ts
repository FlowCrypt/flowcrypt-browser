/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, Contact, PrvKeyInfo, KeyInfosWithPassphrases } from '../platform/store.js';
import { Value, Str } from './common.js';
import { ReplaceableMsgBlockType, MsgBlock, MsgBlockType, Mime } from './mime.js';
import { Catch } from '../platform/catch.js';
import { AttMeta } from './att.js';
import { mnemonic } from './mnemonic.js';
import { requireOpenpgp } from '../platform/require.js';
import { secureRandomBytes, base64encode } from '../platform/util.js';

const openpgp = requireOpenpgp();

if (typeof openpgp !== 'undefined') { // in certain environments, eg browser content scripts, openpgp may be undefined while loading
  openpgp.config.versionstring = `FlowCrypt ${Catch.version()} Gmail Encryption`;
  openpgp.config.commentstring = 'Seamlessly send and receive encrypted email';
  // openpgp.config.require_uid_self_cert = false;
}

export namespace PgpMsgMethod {
  export type DiagnosePubkeys = (acctEmail: string, m: string | Uint8Array | OpenPGP.message.Message) => Promise<DiagnoseMsgPubkeysResult>;
  export type VerifyDetached = (plaintext: string | Uint8Array, sigText: string | Uint8Array) => Promise<MsgVerifyResult>;
  export type Decrypt = (kisWithPp: KeyInfosWithPassphrases, encryptedData: string | Uint8Array, msgPwd?: string, getUint8?: boolean) => Promise<DecryptSuccess | DecryptError>;
}

type KeyDetails$ids = {
  longid: string;
  fingerprint: string;
  keywords: string;
};
export interface KeyDetails {
  private?: string;
  public: string;
  ids: KeyDetails$ids[];
  users: string[];
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
type ConsummableBrowserBlob = { blob_type: 'text' | 'uint8', blob_url: string };
type DecrytSuccess$content = { blob?: ConsummableBrowserBlob; text?: string; uint8?: Uint8Array; filename?: string };
type DecryptSuccess = { success: true; content: DecrytSuccess$content, signature?: MsgVerifyResult; isEncrypted?: boolean };
type DecryptError$error = { type: DecryptErrTypes; error?: string; };
type DecryptError$longids = { message: string[]; matching: string[]; chosen: string[]; needPassphrase: string[]; };
type DecryptError = {
  success: false; error: DecryptError$error; longids: DecryptError$longids;
  isEncrypted?: boolean; message?: OpenPGP.message.Message | OpenPGP.cleartext.CleartextMessage;
};
type CryptoArmorHeaderDefinition = { begin: string, middle?: string, end: string | RegExp, replace: boolean };
type CryptoArmorHeaderDefinitions = { readonly [type in ReplaceableMsgBlockType | 'null' | 'signature']: CryptoArmorHeaderDefinition; };
type PrepareForDecryptRes = { isArmored: boolean, isCleartext: false, message: OpenPGP.message.Message }
  | { isArmored: boolean, isCleartext: true, message: OpenPGP.cleartext.CleartextMessage };

type OpenpgpMsgOrCleartext = OpenPGP.message.Message | OpenPGP.cleartext.CleartextMessage;

export type Pwd = { question?: string; answer: string; };
export type MsgVerifyResult = { signer?: string; contact?: Contact; match?: boolean; error?: string; };
export type DecryptResult = DecryptSuccess | DecryptError;
export type DiagnoseMsgPubkeysResult = { found_match: boolean, receivers: number, };
export enum DecryptErrTypes {
  keyMismatch = 'key_mismatch',
  usePassword = 'use_password',
  wrongPwd = 'wrong_password',
  noMdc = 'no_mdc',
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
    attestPacket: { begin: '-----BEGIN ATTEST PACKET-----', end: '-----END ATTEST PACKET-----', replace: true },
    cryptupVerification: { begin: '-----BEGIN CRYPTUP VERIFICATION-----', end: '-----END CRYPTUP VERIFICATION-----', replace: true },
    signedMsg: { begin: '-----BEGIN PGP SIGNED MESSAGE-----', middle: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: true },
    signature: { begin: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: false },
    message: { begin: '-----BEGIN PGP MESSAGE-----', end: '-----END PGP MESSAGE-----', replace: true },
    passwordMsg: { begin: 'This message is encrypted: Open Message', end: /https:(\/|&#x2F;){2}(cryptup\.org|flowcrypt\.com)(\/|&#x2F;)[a-zA-Z0-9]{10}(\n|$)/, replace: true },
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
      if (text && Value.is(Pgp.ARMOR_HEADER_DICT.null.begin).in(text) && Value.is(String(Pgp.ARMOR_HEADER_DICT.null.end)).in(text)) {
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
      let blocks: MsgBlock[] = [];
      const normalized = Str.normalize(origText);
      let startAt = 0;
      while (true) {
        const r = Pgp.internal.detectBlockNext(normalized, startAt);
        if (r.found) {
          blocks = blocks.concat(r.found);
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
      armored = Str.normalize(armored);
      if (Value.is(type).in(['message', 'publicKey', 'privateKey', 'key'])) {
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
      if (lines.length > 5 && Value.is(h.begin).in(lines[0]) && Value.is(String(h.end)).in(lines[lines.length - 1]) && !Value.is('').in(lines)) {
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
    sha1: (string: string) => Str.toHex(Str.fromUint8(openpgp.crypto.hash.digest(openpgp.enums.hash.sha1, string))),
    doubleSha1Upper: (string: string) => Pgp.hash.sha1(Pgp.hash.sha1(string)).toUpperCase(),
    sha256: (string: string) => Str.toHex(Str.fromUint8(openpgp.crypto.hash.digest(openpgp.enums.hash.sha256, string))),
    challengeAnswer: (answer: string) => Pgp.internal.cryptoHashSha256Loop(answer),
  };

  public static key = {
    create: async (userIds: { name: string, email: string }[], numBits: 4096, passphrase: string): Promise<{ private: string, public: string }> => {
      const k = await openpgp.generateKey({ numBits, userIds, passphrase });
      return { public: k.publicKeyArmored, private: k.privateKeyArmored };
    },
    read: (armoredKey: string) => openpgp.key.readArmored(armoredKey).keys[0],
    decrypt: async (key: OpenPGP.key.Key, passphrases: string[]): Promise<boolean> => {
      try {
        return await key.decrypt(passphrases);
      } catch (e) {
        if (e instanceof Error && Value.is('passphrase').in(e.message.toLowerCase())) {
          return false;
        }
        throw e;
      }
    },
    normalize: (armored: string): { normalized: string, keys: OpenPGP.key.Key[] } => {
      let keys: OpenPGP.key.Key[] = [];
      try {
        armored = Pgp.armor.normalize(armored, 'key');
        if (RegExp(Pgp.armor.headers('publicKey', 're').begin).test(armored)) {
          keys = openpgp.key.readArmored(armored).keys;
        } else if (RegExp(Pgp.armor.headers('privateKey', 're').begin).test(armored)) {
          keys = openpgp.key.readArmored(armored).keys;
        } else if (RegExp(Pgp.armor.headers('message', 're').begin).test(armored)) {
          keys = [new openpgp.key.Key(openpgp.message.readArmored(armored).packets)];
        }
        return { normalized: keys.map(k => k.armor()).join('\n'), keys };
      } catch (error) {
        Catch.handleErr(error);
        return { normalized: '', keys };
      }
    },
    fingerprint: (key: OpenPGP.key.Key | string, formatting: "default" | "spaced" = 'default'): string | undefined => {
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
          console.log(e);
          return undefined;
        }
      } else {
        try {
          return Pgp.key.fingerprint(openpgp.key.readArmored(key).keys[0], formatting);
        } catch (e) {
          if (e instanceof Error && e.message === 'openpgp is not defined') {
            Catch.handleErr(e);
          }
          console.log(e);
          return undefined;
        }
      }
    },
    longid: (keyOrFingerprintOrBytes: string | OpenPGP.key.Key | undefined): string | undefined => {
      if (!keyOrFingerprintOrBytes || typeof keyOrFingerprintOrBytes === 'undefined') {
        return undefined;
      } else if (typeof keyOrFingerprintOrBytes === 'string' && keyOrFingerprintOrBytes.length === 8) {
        return Str.toHex(keyOrFingerprintOrBytes).toUpperCase();
      } else if (typeof keyOrFingerprintOrBytes === 'string' && keyOrFingerprintOrBytes.length === 40) {
        return keyOrFingerprintOrBytes.substr(-16);
      } else if (typeof keyOrFingerprintOrBytes === 'string' && keyOrFingerprintOrBytes.length === 49) {
        return keyOrFingerprintOrBytes.replace(/ /g, '').substr(-16);
      } else {
        return Pgp.key.longid(Pgp.key.fingerprint(keyOrFingerprintOrBytes));
      }
    },
    usable: async (armored: string) => { // is pubkey usable for encrytion?
      if (!Pgp.key.fingerprint(armored)) {
        return false;
      }
      const pubkey = openpgp.key.readArmored(armored).keys[0];
      if (!pubkey) {
        return false;
      }
      if (await pubkey.getEncryptionKey()) {
        return true; // good key - cannot be expired
      }
      return await Pgp.key.usableButExpired(pubkey);
    },
    usableButExpired: async (key: OpenPGP.key.Key): Promise<boolean> => {
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
    dateBeforeExpiration: async (key: OpenPGP.key.Key): Promise<Date | undefined> => {
      const expires = await key.getExpirationTime();
      if (expires instanceof Date && expires.getTime() < Date.now()) { // expired
        return new Date(expires.getTime() - 1000);
      }
      return undefined;
    },
    parse: (armored: string): { original: string, normalized: string, keys: KeyDetails[] } => {
      const { normalized, keys } = Pgp.key.normalize(armored);
      return { original: armored, normalized, keys: keys.map(Pgp.key.serialize) };
    },
    serialize: (k: OpenPGP.key.Key): KeyDetails => {
      const keyPackets: OpenPGP.packet.AnyKeyPacket[] = [];
      for (const keyPacket of k.getKeys()) {
        keyPackets.push(keyPacket);
      }
      return {
        private: k.isPrivate() ? k.armor() : undefined,
        public: k.toPublic().armor(),
        users: k.getUserIds(),
        ids: keyPackets.map(k => k.getFingerprint().toUpperCase()).map(fingerprint => {
          if (fingerprint) {
            const longid = Pgp.key.longid(fingerprint);
            if (longid) {
              return { fingerprint, longid, keywords: mnemonic(longid) };
            }
          }
          return undefined;
        }).filter(Boolean) as KeyDetails$ids[],
      };
    },
  };

  public static password = {
    estimateStrength: (zxcvbnResultGuesses: number) => {
      const timeToCrack = zxcvbnResultGuesses / Pgp.PASSWORD_GUESSES_PER_SECOND;
      for (const word of Pgp.PASSWORD_CRACK_TIME_WORDS) {
        const readableTime = Pgp.internal.readableCrackTime(timeToCrack);
        // looks for a word match from readable_crack_time, defaults on "weak"
        if (Value.is(word.match).in(readableTime)) {
          return { word, seconds: Math.round(timeToCrack), time: readableTime };
        }
      }
      Catch.report('estimate_strength: got to end without any result');
      throw Error('(thrown) estimate_strength: got to end without any result');
    },
    weakWords: () => [
      'crypt', 'up', 'cryptup', 'flow', 'flowcrypt', 'encryption', 'pgp', 'email', 'set', 'backup', 'passphrase', 'best', 'pass', 'phrases', 'are', 'long', 'and', 'have', 'several',
      'words', 'in', 'them', 'Best pass phrases are long', 'have several words', 'in them', 'bestpassphrasesarelong', 'haveseveralwords', 'inthem',
      'Loss of this pass phrase', 'cannot be recovered', 'Note it down', 'on a paper', 'lossofthispassphrase', 'cannotberecovered', 'noteitdown', 'onapaper',
      'setpassword', 'set password', 'set pass word', 'setpassphrase', 'set pass phrase', 'set passphrase'
    ],
    random: () => { // eg TDW6-DU5M-TANI-LJXY
      return base64encode(Str.fromUint8(secureRandomBytes(128))).toUpperCase().replace(/[^A-Z0-9]|0|O|1/g, '').replace(/(.{4})/g, '$1-').substr(0, 19);
    },
  };

  public static internal = {
    msgBlockObj: (type: MsgBlockType, content: string, missingEnd = false): MsgBlock => ({ type, content, complete: !missingEnd }),
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
            if (indexOfConfirmedBegin === 0 || (type === 'passwordMsg' && indexOfConfirmedBegin >= 0 && indexOfConfirmedBegin < 15)) { // identified beginning of a specific block
              if (begin > startAt) {
                const potentialTextBeforeBlockBegun = origText.substring(startAt, begin).trim();
                if (potentialTextBeforeBlockBegun) {
                  result.found.push(Pgp.internal.msgBlockObj('text', potentialTextBeforeBlockBegun));
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
                if (type !== 'passwordMsg') {
                  result.found.push(Pgp.internal.msgBlockObj(type, origText.substring(begin, endIndex + foundBlockEndHeaderLength).trim()));
                } else {
                  const pwdMsgFullText = origText.substring(begin, endIndex + foundBlockEndHeaderLength).trim();
                  const pwdMsgShortIdMatch = pwdMsgFullText.match(/[a-zA-Z0-9]{10}$/);
                  if (pwdMsgShortIdMatch) {
                    result.found.push(Pgp.internal.msgBlockObj(type, pwdMsgShortIdMatch[0]));
                  } else {
                    result.found.push(Pgp.internal.msgBlockObj('text', pwdMsgFullText));
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
          result.found.push(Pgp.internal.msgBlockObj('text', potentialText));
        }
      }
      return result;
    },
    cryptoHashSha256Loop: (string: string, times = 100000) => {
      for (let i = 0; i < times; i++) {
        string = Pgp.hash.sha256(string);
      }
      return string;
    },
    cryptoKeyIds: (armoredPubkey: string) => openpgp.key.readArmored(armoredPubkey).keys[0].getKeyIds(),
    cryptoMsgPrepareForDecrypt: (data: string | Uint8Array): PrepareForDecryptRes => {
      const first100bytes = Str.fromUint8(data.slice(0, 100));
      const isArmoredEncrypted = Value.is(Pgp.armor.headers('message').begin).in(first100bytes);
      const isArmoredSignedOnly = Value.is(Pgp.armor.headers('signedMsg').begin).in(first100bytes);
      const isArmored = isArmoredEncrypted || isArmoredSignedOnly;
      if (isArmoredEncrypted) {
        return { isArmored, isCleartext: false, message: openpgp.message.readArmored(Str.fromUint8(data)) };
      } else if (isArmoredSignedOnly) {
        return { isArmored, isCleartext: true, message: openpgp.cleartext.readArmored(Str.fromUint8(data)) };
      } else {
        return { isArmored, isCleartext: false, message: openpgp.message.read(Str.toUint8(data)) };
      }
    },
    cryptoMsgGetSortedKeys: async (kiWithPp: KeyInfosWithPassphrases, msg: OpenpgpMsgOrCleartext): Promise<SortedKeysForDecrypt> => {
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
      const encryptedForKeyId = msg instanceof openpgp.message.Message ? (msg as OpenPGP.message.Message).getEncryptionKeyIds() : [];
      keys.encryptedFor = encryptedForKeyId.map(id => Pgp.key.longid(id.bytes)).filter(Boolean) as string[];
      keys.signedBy = (msg.getSigningKeyIds ? msg.getSigningKeyIds() : []).filter(Boolean).map(id => Pgp.key.longid(id.bytes)).filter(Boolean) as string[];
      keys.prvMatching = kiWithPp.keys.filter(ki => Value.is(ki.longid).in(keys.encryptedFor));
      if (keys.prvMatching.length) {
        keys.prvForDecrypt = keys.prvMatching;
      } else {
        keys.prvForDecrypt = kiWithPp.keys;
      }
      for (const prvForDecrypt of keys.prvForDecrypt) {
        const key = openpgp.key.readArmored(prvForDecrypt.private).keys[0];
        if (key.isDecrypted() || (kiWithPp.passphrases.length && await Pgp.key.decrypt(key, kiWithPp.passphrases) === true)) {
          prvForDecrypt.decrypted = key;
          keys.prvForDecryptDecrypted.push(prvForDecrypt);
        } else {
          keys.prvForDecryptWithoutPassphrases.push(prvForDecrypt);
        }
      }
      if (keys.signedBy.length && typeof Store.dbContactGet === 'function') {
        const verificationContacts = await Store.dbContactGet(undefined, keys.signedBy);
        keys.verificationContacts = verificationContacts.filter(contact => contact && contact.pubkey) as Contact[];
        // tslint:disable-next-line:no-unsafe-any
        keys.forVerification = [].concat.apply([], keys.verificationContacts.map(contact => openpgp.key.readArmored(contact.pubkey!).keys)); // pubkey! checked above
      }
      return keys;
    },
    cryptoMsgDecryptCategorizeErr: (decryptErr: any, msgPwd?: string): DecryptError$error => {
      const e = String(decryptErr).replace('Error: ', '').replace('Error decrypting message: ', '');
      const keyMismatchErrStrings = ['Cannot read property \'isDecrypted\' of null', 'privateKeyPacket is null',
        'TypeprivateKeyPacket is null', 'Session key decryption failed.', 'Invalid session key for decryption.'];
      if (Value.is(e).in(keyMismatchErrStrings) && !msgPwd) {
        return { type: DecryptErrTypes.keyMismatch, error: e };
      } else if (msgPwd && Value.is(e).in(['Invalid enum value.', 'CFB decrypt: invalid key', 'Session key decryption failed.'])) {
        return { type: DecryptErrTypes.wrongPwd, error: e };
      } else if (e === 'Decryption failed due to missing MDC in combination with modern cipher.') {
        return { type: DecryptErrTypes.noMdc, error: e };
      } else if (e === 'Decryption error') {
        return { type: DecryptErrTypes.format, error: e };
      } else {
        return { type: DecryptErrTypes.other, error: e };
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

  static type = (data: string | Uint8Array): { armored: boolean, type: MsgBlockType } | undefined => {
    if (!data || !data.length) {
      return undefined;
    }
    let d = data.slice(0, 50); // only interested in first 50 bytes
    // noinspection SuspiciousInstanceOfGuard
    if (d instanceof Uint8Array) {
      d = Str.fromUint8(d);
    }
    const firstByte = d[0].charCodeAt(0); // attempt to understand this as a binary PGP packet: https://tools.ietf.org/html/rfc4880#section-4.2
    if ((firstByte & 0b10000000) === 0b10000000) { // 1XXX XXXX - potential pgp packet tag
      let tagNumber = 0; // zero is a forbidden tag number
      if ((firstByte & 0b11000000) === 0b11000000) { // 11XX XXXX - potential new pgp packet tag
        tagNumber = firstByte & 0b00111111;  // 11TTTTTT where T is tag number bit
      } else { // 10XX XXXX - potential old pgp packet tag
        tagNumber = (firstByte & 0b00111100) / 4; // 10TTTTLL where T is tag number bit. Division by 4 in place of two bit shifts. I hate bit shifts.
      }
      if (Value.is(tagNumber).in(Object.values(openpgp.enums.packet))) {
        // Indeed a valid OpenPGP packet tag number
        // This does not 100% mean it's OpenPGP message
        // But it's a good indication that it may
        const t = openpgp.enums.packet;
        const msgTpes = [t.symEncryptedIntegrityProtected, t.modificationDetectionCode, t.symEncryptedAEADProtected, t.symmetricallyEncrypted, t.compressed];
        return { armored: false, type: Value.is(tagNumber).in(msgTpes) ? 'message' : 'publicKey' };
      }
    }
    const { blocks } = Pgp.armor.detectBlocks(d.trim());
    if (blocks.length === 1 && blocks[0].complete === false && Value.is(blocks[0].type).in(['message', 'privateKey', 'publicKey', 'signedMsg'])) {
      return { armored: true, type: blocks[0].type };
    }
    return undefined;
  }

  static sign = async (signingPrv: OpenPGP.key.Key, data: string): Promise<string> => {
    const signRes = await openpgp.sign({ data, armor: true, privateKeys: [signingPrv] });
    return (signRes as OpenPGP.SignArmorResult).data;
  }

  static verify = async (message: OpenpgpMsgOrCleartext, keysForVerification: OpenPGP.key.Key[], optionalContact?: Contact): Promise<MsgVerifyResult> => {
    const sig: MsgVerifyResult = { contact: optionalContact };
    try {
      for (const verifyRes of await message.verify(keysForVerification)) {
        sig.match = Value.is(sig.match).in([true, undefined]) && verifyRes.valid; // this will probably falsely show as not matching in some rare cases. Needs testing.
        if (!sig.signer) {
          sig.signer = Pgp.key.longid(verifyRes.keyid.bytes);
        }
      }
    } catch (verifyErr) {
      sig.match = undefined;
      if (verifyErr instanceof Error && verifyErr.message === 'Can only verify message with one literal data packet.') {
        sig.error = 'FlowCrypt is not equipped to verify this message (err 101)';
      } else {
        sig.error = `FlowCrypt had trouble verifying this message (${String(verifyErr)})`;
        Catch.handleErr(verifyErr);
      }
    }
    return sig;
  }

  static verifyDetached: PgpMsgMethod.VerifyDetached = async (plaintext, sigText) => {
    if (plaintext instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
      plaintext = Str.fromUint8(plaintext);
    }
    if (sigText instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
      sigText = Str.fromUint8(sigText);
    }
    const message = openpgp.message.fromText(plaintext);
    message.appendSignature(sigText);
    const keys = await Pgp.internal.cryptoMsgGetSortedKeys({ keys: [], passphrases: [] }, message);
    return await PgpMsg.verify(message, keys.forVerification, keys.verificationContacts[0]);
  }

  static decrypt: PgpMsgMethod.Decrypt = async (kisWithPp, encryptedData, msgPwd, getUint8 = false) => {
    let prepared;
    const longids: DecryptError$longids = { message: [], matching: [], chosen: [], needPassphrase: [] };
    try {
      prepared = Pgp.internal.cryptoMsgPrepareForDecrypt(encryptedData);
    } catch (formatErr) {
      return { success: false, error: { type: DecryptErrTypes.format, error: String(formatErr) }, longids };
    }
    const keys = await Pgp.internal.cryptoMsgGetSortedKeys(kisWithPp, prepared.message);
    longids.message = keys.encryptedFor;
    longids.matching = keys.prvForDecrypt.map(ki => ki.longid);
    longids.chosen = keys.prvForDecryptDecrypted.map(ki => ki.longid);
    longids.needPassphrase = keys.prvForDecryptWithoutPassphrases.map(ki => ki.longid);
    const isEncrypted = !prepared.isCleartext;
    if (!isEncrypted) {
      const signature = await PgpMsg.verify(prepared.message, keys.forVerification, keys.verificationContacts[0]);
      return { success: true, content: { text: prepared.message.getText() }, isEncrypted, signature };
    }
    if (!keys.prvForDecryptDecrypted.length && !msgPwd) {
      return { success: false, error: { type: DecryptErrTypes.needPassphrase }, message: prepared.message, longids, isEncrypted };
    }
    try {
      const packets = (prepared.message as OpenPGP.message.Message).packets;
      const isSymEncrypted = packets.filter(p => p.tag === openpgp.enums.packet.symEncryptedSessionKey).length > 0;
      const isPubEncrypted = packets.filter(p => p.tag === openpgp.enums.packet.publicKeyEncryptedSessionKey).length > 0;
      if (isSymEncrypted && !isPubEncrypted && !msgPwd) {
        return { success: false, error: { type: DecryptErrTypes.usePassword }, longids, isEncrypted };
      }
      const msgPasswords = msgPwd ? [msgPwd] : undefined;
      const decrypted = await (prepared.message as OpenPGP.message.Message).decrypt(keys.prvForDecryptDecrypted.map(ki => ki.decrypted!), msgPasswords);
      // const signature = keys.signed_by.length ? Pgp.message.verify(message, keys.for_verification, keys.verification_contacts[0]) : false;
      if (getUint8) {
        return { success: true, content: { uint8: decrypted.getLiteralData(), filename: decrypted.getFilename() || undefined }, isEncrypted };
      } else {
        return { success: true, content: { text: decrypted.getText(), filename: decrypted.getFilename() || undefined }, isEncrypted };
      }
    } catch (e) {
      return { success: false, error: Pgp.internal.cryptoMsgDecryptCategorizeErr(e, msgPwd), message: prepared.message, longids, isEncrypted };
    }
  }

  static encrypt = async (
    pubkeys: string[], signingPrv: OpenPGP.key.Key | undefined, pwd: Pwd | undefined, data: string | Uint8Array, filename?: string, armor?: boolean, date?: Date
  ): Promise<OpenPGP.EncryptResult> => {
    const options: OpenPGP.EncryptOptions = { data, armor, date, filename };
    let usedChallenge = false;
    if (pubkeys) {
      options.publicKeys = [];
      for (const armoredPubkey of pubkeys) {
        options.publicKeys = options.publicKeys.concat(openpgp.key.readArmored(armoredPubkey).keys);
      }
    }
    if (pwd && pwd.answer) {
      options.passwords = [Pgp.hash.challengeAnswer(pwd.answer)];
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

  static diagnosePubkeys: PgpMsgMethod.DiagnosePubkeys = async (acctEmail, m) => {
    let message: OpenPGP.message.Message;
    if (typeof m === 'string') {
      message = openpgp.message.readArmored(m);
    } else if (m instanceof Uint8Array) {
      message = openpgp.message.readArmored(Str.fromUint8(m));
    } else {
      message = m;
    }
    const msgKeyIds = message.getEncryptionKeyIds ? message.getEncryptionKeyIds() : [];
    const privateKeys = await Store.keysGet(acctEmail);
    const localKeyIds: OpenPGP.Keyid[] = [].concat.apply([], privateKeys.map(ki => ki.public).map(Pgp.internal.cryptoKeyIds)); // tslint:disable-line:no-unsafe-any
    const diagnosis = { found_match: false, receivers: msgKeyIds.length };
    for (const msgKeyId of msgKeyIds) {
      for (const localKeyId of localKeyIds) {
        if (msgKeyId === localKeyId) {
          diagnosis.found_match = true;
          return diagnosis;
        }
      }
    }
    return diagnosis;
  }

  static fmtDecrypted = async (decryptedContent: string): Promise<MsgBlock[]> => {
    const blocks: MsgBlock[] = [];
    if (!Mime.resemblesMsg(decryptedContent)) {
      decryptedContent = Str.extractFcAtts(decryptedContent, blocks);
      decryptedContent = Str.stripFcTeplyToken(decryptedContent);
      const armoredPubKeys: string[] = [];
      decryptedContent = Str.stripPublicKeys(decryptedContent, armoredPubKeys);
      blocks.push(Pgp.internal.msgBlockObj('html', Str.asEscapedHtml(decryptedContent)));
      PgpMsg.pushArmoredPubkeysToBlocks(armoredPubKeys, blocks);
    } else {
      const decoded = await Mime.decode(decryptedContent);
      if (typeof decoded.html !== 'undefined') {
        blocks.push(Pgp.internal.msgBlockObj('html', decoded.html));
      } else if (typeof decoded.text !== 'undefined') {
        blocks.push(Pgp.internal.msgBlockObj('html', Str.asEscapedHtml(decoded.text)));
      } else {
        blocks.push(Pgp.internal.msgBlockObj('html', Str.asEscapedHtml(decryptedContent)));
      }
      for (const att of decoded.atts) {
        if (att.treatAs() !== 'publicKey') {
          blocks.push(Pgp.internal.msgBlockAttObj('attachment', att.asText(), { name: att.name }));
        } else {
          PgpMsg.pushArmoredPubkeysToBlocks([att.asText()], blocks);
        }
      }
    }
    return blocks;
  }

  private static pushArmoredPubkeysToBlocks = (armoredPubkeys: string[], blocks: MsgBlock[]): void => {
    for (const armoredPubkey of armoredPubkeys) {
      for (const keyDetails of Pgp.key.parse(armoredPubkey).keys) {
        blocks.push(Pgp.internal.msgBlockKeyObj('publicKey', keyDetails.public, keyDetails));
      }
    }
  }

}
