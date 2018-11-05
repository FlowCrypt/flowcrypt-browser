/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, KeyInfo, Contact } from './store.js';
import { Value, Str } from './common.js';
import { ReplaceableMsgBlockType, MsgBlock, MsgBlockType } from './mime.js';
import { Catch } from './catch.js';

declare const openpgp: typeof OpenPGP;

if (typeof openpgp !== 'undefined') {
  openpgp.config.versionstring = `FlowCrypt ${Catch.version() || ''} Gmail Encryption`;
  openpgp.config.commentstring = 'Seamlessly send and receive encrypted email';
  // openpgp.config.require_uid_self_cert = false;
}

type InternalSortedKeysForDecrypt = {
  verificationContacts: Contact[]; forVerification: OpenPGP.key.Key[]; encryptedFor: string[]; signedBy: string[];
  prvMatching: KeyInfo[]; prvForDecrypt: KeyInfo[]; prvForDecryptDecrypted: KeyInfo[]; prvForDecryptWithoutPassphrases: KeyInfo[];
};
type ConsummableBrowserBlob = { blob_type: 'text' | 'uint8', blob_url: string };
type DecrytSuccess$content = { blob?: ConsummableBrowserBlob; text?: string; uint8?: Uint8Array; filename: string | null; };
type DecryptSuccess = { success: true; content: DecrytSuccess$content, signature: MsgVerifyResult | null; isEncrypted: boolean | null; };
type DecryptError$error = { type: DecryptErrTypes; error?: string; };
type DecryptError$longids = { message: string[]; matching: string[]; chosen: string[]; needPassphrase: string[]; };
type DecryptError = {
  success: false; error: DecryptError$error; longids: DecryptError$longids;
  isEncrypted: null | boolean; signature: null; message?: OpenPGP.message.Message | OpenPGP.cleartext.CleartextMessage;
};
type CryptoArmorHeaderDefinition = { begin: string, middle?: string, end: string | RegExp, replace: boolean };
type CryptoArmorHeaderDefinitions = { readonly [type in ReplaceableMsgBlockType | 'null' | 'signature']: CryptoArmorHeaderDefinition; };
type PrepareForDecryptRes = { isArmored: boolean, isCleartext: false, message: OpenPGP.message.Message }
  | { isArmored: boolean, isCleartext: true, message: OpenPGP.cleartext.CleartextMessage };

export type Pwd = { question?: string; answer: string; };
export type MsgVerifyResult = { signer: string | null; contact: Contact | null; match: boolean | null; error: null | string; };
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
    strip: (pgpBlockText: string) => {
      if (!pgpBlockText) {
        return pgpBlockText;
      }
      let debug = false;
      if (debug) {
        console.info('pgp_block_1');
        console.info(pgpBlockText);
      }
      let newlines = [/<div><br><\/div>/g, /<\/div><div>/g, /<[bB][rR]( [a-zA-Z]+="[^"]*")* ?\/? ?>/g, /<div ?\/?>/g];
      let spaces = [/&nbsp;/g];
      let removes = [/<wbr ?\/?>/g, /<\/?div>/g];
      for (let newline of newlines) {
        pgpBlockText = pgpBlockText.replace(newline, '\n');
      }
      if (debug) {
        console.info('pgp_block_2');
        console.info(pgpBlockText);
      }
      for (let remove of removes) {
        pgpBlockText = pgpBlockText.replace(remove, '');
      }
      if (debug) {
        console.info('pgp_block_3');
        console.info(pgpBlockText);
      }
      for (let space of spaces) {
        pgpBlockText = pgpBlockText.replace(space, ' ');
      }
      if (debug) {
        console.info('pgp_block_4');
        console.info(pgpBlockText);
      }
      pgpBlockText = pgpBlockText.replace(/\r\n/g, '\n');
      if (debug) {
        console.info('pgp_block_5');
        console.info(pgpBlockText);
      }
      pgpBlockText = $('<div>' + pgpBlockText + '</div>').text();
      if (debug) {
        console.info('pgp_block_6');
        console.info(pgpBlockText);
      }
      let doubleNl = pgpBlockText.match(/\n\n/g);
      if (doubleNl !== null && doubleNl.length > 2) { // a lot of newlines are doubled
        pgpBlockText = pgpBlockText.replace(/\n\n/g, '\n');
        if (debug) {
          console.info('pgp_block_removed_doubles');
        }
      }
      if (debug) {
        console.info('pgp_block_7');
        console.info(pgpBlockText);
      }
      pgpBlockText = pgpBlockText.replace(/^ +/gm, '');
      if (debug) {
        console.info('pgp_block_final');
        console.info(pgpBlockText);
      }
      return pgpBlockText;
    },
    clip: (text: string) => {
      if (text && Value.is(Pgp.ARMOR_HEADER_DICT.null.begin).in(text) && Value.is(Pgp.ARMOR_HEADER_DICT.null.end as string).in(text)) {
        let match = text.match(/(-----BEGIN PGP (MESSAGE|SIGNED MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----[^]+-----END PGP (MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----)/gm);
        return (match !== null && match.length) ? match[0] : null;
      }
      return null;
    },
    headers: (blockType: ReplaceableMsgBlockType | 'null', format = 'string'): CryptoArmorHeaderDefinition => {
      let h = Pgp.ARMOR_HEADER_DICT[blockType];
      return {
        begin: (typeof h.begin === 'string' && format === 're') ? h.begin.replace(/ /g, '\\\s') : h.begin,
        end: (typeof h.end === 'string' && format === 're') ? h.end.replace(/ /g, '\\\s') : h.end,
        replace: h.replace,
      };
    },
    detectBlocks: (origText: string) => {
      let blocks: MsgBlock[] = [];
      let normalized = Str.normalize(origText);
      let startAt = 0;
      while (true) {
        let r = Pgp.internal.cryptoArmorDetectBlockNext(normalized, startAt);
        if (r.found) {
          blocks = blocks.concat(r.found);
        }
        if (r.continue_at === null) {
          return { blocks, normalized };
        } else {
          if (r.continue_at <= startAt) {
            Catch.report(`Pgp.armor.detect_blocks likely infinite loop: r.continue_at(${r.continue_at}) <= start_at(${startAt})`);
            return { blocks, normalized }; // prevent infinite loop
          }
          startAt = r.continue_at;
        }
      }
    },
    normalize: (armored: string, type: string) => {
      armored = Str.normalize(armored);
      if (Value.is(type).in(['message', 'publicKey', 'privateKey', 'key'])) {
        armored = armored.replace(/\r?\n/g, '\n').trim();
        let nl2 = armored.match(/\n\n/g);
        let nl3 = armored.match(/\n\n\n/g);
        let nl4 = armored.match(/\n\n\n\n/g);
        let nl6 = armored.match(/\n\n\n\n\n\n/g);
        if (nl3 && nl6 && nl3.length > 1 && nl6.length === 1) {
          return armored.replace(/\n\n\n/g, '\n'); // newlines tripled: fix
        } else if (nl2 && nl4 && nl2.length > 1 && nl4.length === 1) {
          return armored.replace(/\n\n/g, '\n'); // newlines doubled.GPA on windows does this, and sometimes message can get extracted this way from html
        }
        return armored;
      } else {
        return armored;
      }
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
      let k = await openpgp.generateKey({ numBits, userIds, passphrase });
      return { public: k.publicKeyArmored, private: k.privateKeyArmored };
    },
    read: (armoredKey: string) => openpgp.key.readArmored(armoredKey).keys[0],
    decrypt: async (key: OpenPGP.key.Key, passphrases: string[]): Promise<boolean> => {
      try {
        return await key.decrypt(passphrases);
      } catch (e) {
        if (Value.is('passphrase').in(e.message.toLowerCase())) {
          return false;
        }
        throw e;
      }
    },
    normalize: (armored: string) => {
      try {
        armored = Pgp.armor.normalize(armored, 'key');
        let key: OpenPGP.key.Key | undefined;
        if (RegExp(Pgp.armor.headers('publicKey', 're').begin).test(armored)) {
          key = openpgp.key.readArmored(armored).keys[0];
        } else if (RegExp(Pgp.armor.headers('message', 're').begin).test(armored)) {
          key = new openpgp.key.Key(openpgp.message.readArmored(armored).packets);
        }
        if (key) {
          return key.armor();
        } else {
          return armored;
        }
      } catch (error) {
        Catch.handleException(error);
      }
    },
    fingerprint: (key: OpenPGP.key.Key | string, formatting: "default" | "spaced" = 'default'): string | null => {
      if (key === null || typeof key === 'undefined') {
        return null;
      } else if (key instanceof openpgp.key.Key) {
        if (key.primaryKey.getFingerprintBytes() === null) {
          return null;
        }
        try {
          let fp = key.primaryKey.getFingerprint().toUpperCase();
          if (formatting === 'spaced') {
            return fp.replace(/(.{4})/g, '$1 ').trim();
          }
          return fp;
        } catch (error) {
          console.log(error);
          return null;
        }
      } else {
        try {
          return Pgp.key.fingerprint(openpgp.key.readArmored(key).keys[0], formatting);
        } catch (error) {
          if (error.message === 'openpgp is not defined') {
            Catch.handleException(error);
          }
          console.log(error);
          return null;
        }
      }
    },
    longid: (keyOrFingerprintOrBytes: string | OpenPGP.key.Key | null | undefined): string | null => {
      if (keyOrFingerprintOrBytes === null || typeof keyOrFingerprintOrBytes === 'undefined') {
        return null;
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
      let pubkey = openpgp.key.readArmored(armored).keys[0];
      if (!pubkey) {
        return false;
      }
      if (await pubkey.getEncryptionKey() !== null) {
        return true; // good key - cannot be expired
      }
      return await Pgp.key.usableButExpired(pubkey);
    },
    usableButExpired: async (key: OpenPGP.key.Key): Promise<boolean> => {
      if (await key.getEncryptionKey() !== null) {
        return false; // good key - cannot be expired
      }
      let oneSecondBeforeExpiration = await Pgp.key.dateBeforeExpiration(key);
      if (oneSecondBeforeExpiration === null) {
        return false; // key does not expire
      }
      // try to see if the key was usable just before expiration
      return await key.getEncryptionKey(null, oneSecondBeforeExpiration) !== null;
    },
    dateBeforeExpiration: async (key: OpenPGP.key.Key): Promise<Date | null> => {
      let expires = await key.getExpirationTime();
      if (expires instanceof Date && expires.getTime() < Date.now()) { // expired
        return new Date(expires.getTime() - 1000);
      }
      return null;
    },
  };

  public static msg = {
    type: (data: string | Uint8Array): { armored: boolean, type: MsgBlockType } | null => {
      if (!data || !data.length) {
        return null;
      }
      let d = data.slice(0, 50); // only interested in first 50 bytes
      // noinspection SuspiciousInstanceOfGuard
      if (d instanceof Uint8Array) {
        d = Str.fromUint8(d);
      }
      let firstByte = d[0].charCodeAt(0); // attempt to understand this as a binary PGP packet: https://tools.ietf.org/html/rfc4880#section-4.2
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
          let t = openpgp.enums.packet;
          let msgTpes = [t.symEncryptedIntegrityProtected, t.modificationDetectionCode, t.symEncryptedAEADProtected, t.symmetricallyEncrypted, t.compressed];
          return { armored: false, type: Value.is(tagNumber).in(msgTpes) ? 'message' : 'publicKey' };
        }
      }
      let { blocks } = Pgp.armor.detectBlocks(d.trim());
      if (blocks.length === 1 && blocks[0].complete === false && Value.is(blocks[0].type).in(['message', 'privateKey', 'publicKey', 'signedMsg'])) {
        return { armored: true, type: blocks[0].type };
      }
      return null;
    },
    sign: async (signingPrv: OpenPGP.key.Key, data: string): Promise<string> => {
      let signRes = await openpgp.sign({ data, armor: true, privateKeys: [signingPrv] });
      return (signRes as OpenPGP.SignArmorResult).data;
    },
    verify: async (message: OpenPGP.message.Message | OpenPGP.cleartext.CleartextMessage, keysForVerification: OpenPGP.key.Key[], optionalContact: Contact | null = null) => {
      let signature: MsgVerifyResult = { signer: null, contact: optionalContact, match: null, error: null };
      try {
        for (let verifyRes of await message.verify(keysForVerification)) {
          signature.match = Value.is(signature.match).in([true, null]) && verifyRes.valid; // this will probably falsely show as not matching in some rare cases. Needs testing.
          if (!signature.signer) {
            signature.signer = Pgp.key.longid(verifyRes.keyid.bytes);
          }
        }
      } catch (verifyErr) {
        signature.match = null;
        if (verifyErr.message === 'Can only verify message with one literal data packet.') {
          signature.error = 'FlowCrypt is not equipped to verify this message (err 101)';
        } else {
          signature.error = `FlowCrypt had trouble verifying this message (${verifyErr.message})`;
          Catch.handleException(verifyErr);
        }
      }
      return signature;
    },
    verifyDetached: async (acctEmail: string, plaintext: string | Uint8Array, sigText: string | Uint8Array): Promise<MsgVerifyResult> => {
      if (plaintext instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
        plaintext = Str.fromUint8(plaintext);
      }
      if (sigText instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
        sigText = Str.fromUint8(sigText);
      }
      let message = openpgp.message.fromText(plaintext);
      message.appendSignature(sigText);
      let keys = await Pgp.internal.cryptoMsgGetSortedKeysForMsg(acctEmail, message);
      return await Pgp.msg.verify(message, keys.forVerification, keys.verificationContacts[0]);
    },
    decrypt: async (acctEmail: string, encryptedData: string | Uint8Array, msgPwd: string | null = null, getUint8 = false): Promise<DecryptSuccess | DecryptError> => {
      let prepared;
      let longids = { message: [] as string[], matching: [] as string[], chosen: [] as string[], needPassphrase: [] as string[] };
      try {
        prepared = Pgp.internal.cryptoMsgPrepareForDecrypt(encryptedData);
      } catch (formatErr) {
        return { success: false, error: { type: DecryptErrTypes.format, error: formatErr.message }, longids, isEncrypted: null, signature: null };
      }
      let keys = await Pgp.internal.cryptoMsgGetSortedKeysForMsg(acctEmail, prepared.message);
      longids.message = keys.encryptedFor;
      longids.matching = keys.prvForDecrypt.map(ki => ki.longid);
      longids.chosen = keys.prvForDecryptDecrypted.map(ki => ki.longid);
      longids.needPassphrase = keys.prvForDecryptWithoutPassphrases.map(ki => ki.longid);
      let isEncrypted = !prepared.isCleartext;
      if (!isEncrypted) {
        let signature = await Pgp.msg.verify(prepared.message, keys.forVerification, keys.verificationContacts[0]);
        return { success: true, content: { text: prepared.message.getText(), filename: null }, isEncrypted, signature };
      }
      if (!keys.prvForDecryptDecrypted.length && !msgPwd) {
        return { success: false, error: { type: DecryptErrTypes.needPassphrase }, signature: null, message: prepared.message, longids, isEncrypted };
      }
      try {
        let packets = (prepared.message as OpenPGP.message.Message).packets;
        let isSymEncrypted = packets.filter(p => p.tag === openpgp.enums.packet.symEncryptedSessionKey).length > 0;
        let isPubEncrypted = packets.filter(p => p.tag === openpgp.enums.packet.publicKeyEncryptedSessionKey).length > 0;
        if (isSymEncrypted && !isPubEncrypted && !msgPwd) {
          return { success: false, error: { type: DecryptErrTypes.usePassword }, longids, isEncrypted, signature: null };
        }
        let msgPasswords = msgPwd ? [msgPwd] : null;
        let decrypted = await (prepared.message as OpenPGP.message.Message).decrypt(keys.prvForDecryptDecrypted.map(ki => ki.decrypted!), msgPasswords);
        // let signature = keys.signed_by.length ? Pgp.message.verify(message, keys.for_verification, keys.verification_contacts[0]) : false;
        let signature = null;
        if (getUint8) {
          return { success: true, content: { uint8: decrypted.getLiteralData(), filename: decrypted.getFilename() }, isEncrypted, signature };
        } else {
          return { success: true, content: { text: decrypted.getText(), filename: decrypted.getFilename() }, isEncrypted, signature };
        }
      } catch (e) {
        return { success: false, error: Pgp.internal.cryptoMsgDecryptCategorizeErr(e, msgPwd), signature: null, message: prepared.message, longids, isEncrypted };
      }
    },
    encrypt: async (
      pubkeys: string[], signingPrv: OpenPGP.key.Key | null, pwd: Pwd | null, data: string | Uint8Array, filename?: string, armor?: boolean, date?: Date
    ): Promise<OpenPGP.EncryptResult> => {
      let options: OpenPGP.EncryptOptions = { data, armor, date, filename };
      let usedChallenge = false;
      if (pubkeys) {
        options.publicKeys = [];
        for (let armoredPubkey of pubkeys) {
          options.publicKeys = options.publicKeys.concat(openpgp.key.readArmored(armoredPubkey).keys);
        }
      }
      if (pwd && pwd.answer) {
        options.passwords = [Pgp.hash.challengeAnswer(pwd.answer)];
        usedChallenge = true;
      }
      if (!pubkeys && !usedChallenge) {
        alert('Internal error: don\'t know how to encryt message. Please refresh the page and try again, or contact me at human@flowcrypt.com if this happens repeatedly.');
        throw new Error('no-pubkeys-no-challenge');
      }
      if (signingPrv && typeof signingPrv.isPrivate !== 'undefined' && signingPrv.isPrivate()) {
        options.privateKeys = [signingPrv];
      }
      return await openpgp.encrypt(options);
    },
    diagnosePubkeys: async (acctEmail: string, m: string | Uint8Array | OpenPGP.message.Message): Promise<DiagnoseMsgPubkeysResult> => {
      let message: OpenPGP.message.Message;
      if (typeof m === 'string') {
        message = openpgp.message.readArmored(m);
      } else if (m instanceof Uint8Array) {
        message = openpgp.message.readArmored(Str.fromUint8(m));
      } else {
        message = m;
      }
      let msgKeyIds = message.getEncryptionKeyIds ? message.getEncryptionKeyIds() : [];
      let privateKeys = await Store.keysGet(acctEmail);
      let localKeyIds = [].concat.apply([], privateKeys.map(ki => ki.public).map(Pgp.internal.cryptoKeyIds));
      let diagnosis = { found_match: false, receivers: msgKeyIds.length };
      for (let msgKeyId of msgKeyIds) {
        for (let localKeyId of localKeyIds) {
          if (msgKeyId === localKeyId) {
            diagnosis.found_match = true;
            return diagnosis;
          }
        }
      }
      return diagnosis;
    },
  };

  public static password = {
    estimateStrength: (zxcvbnResultGuesses: number) => {
      let timeToCrack = zxcvbnResultGuesses / Pgp.PASSWORD_GUESSES_PER_SECOND;
      for (let word of Pgp.PASSWORD_CRACK_TIME_WORDS) {
        let readableTime = Pgp.internal.readableCrackTime(timeToCrack);
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
      let secureRandomArray = new Uint8Array(128);
      window.crypto.getRandomValues(secureRandomArray);
      return btoa(Str.fromUint8(secureRandomArray)).toUpperCase().replace(/[^A-Z0-9]|0|O|1/g, '').replace(/(.{4})/g, '$1-').substr(0, 19);
    },
  };

  public static internal = {
    cryptoArmorBlockObj: (type: MsgBlockType, content: string, missingEnd = false): MsgBlock => ({ type, content, complete: !missingEnd }),
    cryptoArmorDetectBlockNext: (origText: string, startAt: number) => {
      let result = { found: [] as MsgBlock[], continue_at: null as number | null };
      let begin = origText.indexOf(Pgp.armor.headers('null').begin, startAt);
      if (begin !== -1) { // found
        let potentialBeginHeader = origText.substr(begin, Pgp.ARMOR_HEADER_MAX_LENGTH);
        for (let xType of Object.keys(Pgp.ARMOR_HEADER_DICT)) {
          let type = xType as ReplaceableMsgBlockType;
          let blockHeaderDef = Pgp.ARMOR_HEADER_DICT[type];
          if (blockHeaderDef.replace) {
            let indexOfConfirmedBegin = potentialBeginHeader.indexOf(blockHeaderDef.begin);
            if (indexOfConfirmedBegin === 0 || (type === 'passwordMsg' && indexOfConfirmedBegin >= 0 && indexOfConfirmedBegin < 15)) { // identified beginning of a specific block
              if (begin > startAt) {
                let potentialTextBeforeBlockBegun = origText.substring(startAt, begin).trim();
                if (potentialTextBeforeBlockBegun) {
                  result.found.push(Pgp.internal.cryptoArmorBlockObj('text', potentialTextBeforeBlockBegun));
                }
              }
              let endIndex: number = -1;
              let foundBlockEndHeaderLength = 0;
              if (typeof blockHeaderDef.end === 'string') {
                endIndex = origText.indexOf(blockHeaderDef.end, begin + blockHeaderDef.begin.length);
                foundBlockEndHeaderLength = blockHeaderDef.end.length;
              } else { // regexp
                let origTextAfterBeginIndex = origText.substring(begin);
                let regexpEnd = origTextAfterBeginIndex.match(blockHeaderDef.end);
                if (regexpEnd !== null) {
                  endIndex = regexpEnd.index ? begin + regexpEnd.index : -1;
                  foundBlockEndHeaderLength = regexpEnd[0].length;
                }
              }
              if (endIndex !== -1) { // identified end of the same block
                if (type !== 'passwordMsg') {
                  result.found.push(Pgp.internal.cryptoArmorBlockObj(type, origText.substring(begin, endIndex + foundBlockEndHeaderLength).trim()));
                } else {
                  let pwdMsgFullText = origText.substring(begin, endIndex + foundBlockEndHeaderLength).trim();
                  let pwdMsgShortIdMatch = pwdMsgFullText.match(/[a-zA-Z0-9]{10}$/);
                  if (pwdMsgShortIdMatch) {
                    result.found.push(Pgp.internal.cryptoArmorBlockObj(type, pwdMsgShortIdMatch[0]));
                  } else {
                    result.found.push(Pgp.internal.cryptoArmorBlockObj('text', pwdMsgFullText));
                  }
                }
                result.continue_at = endIndex + foundBlockEndHeaderLength;
              } else { // corresponding end not found
                result.found.push(Pgp.internal.cryptoArmorBlockObj(type, origText.substr(begin), true));
              }
              break;
            }
          }
        }
      }
      if (origText && !result.found.length) { // didn't find any blocks, but input is non-empty
        let potentialText = origText.substr(startAt).trim();
        if (potentialText) {
          result.found.push(Pgp.internal.cryptoArmorBlockObj('text', potentialText));
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
      let first100bytes = Str.fromUint8(data.slice(0, 100));
      let isArmoredEncrypted = Value.is(Pgp.armor.headers('message').begin).in(first100bytes);
      let isArmoredSignedOnly = Value.is(Pgp.armor.headers('signedMsg').begin).in(first100bytes);
      let isArmored = isArmoredEncrypted || isArmoredSignedOnly;
      if (isArmoredEncrypted) {
        return { isArmored, isCleartext: false, message: openpgp.message.readArmored(Str.fromUint8(data)) };
      } else if (isArmoredSignedOnly) {
        return { isArmored, isCleartext: true, message: openpgp.cleartext.readArmored(Str.fromUint8(data)) };
      } else {
        return { isArmored, isCleartext: false, message: openpgp.message.read(Str.toUint8(data)) };
      }
    },
    cryptoMsgGetSortedKeysForMsg: async (acctEmail: string, msg: OpenPGP.message.Message | OpenPGP.cleartext.CleartextMessage): Promise<InternalSortedKeysForDecrypt> => {
      let keys: InternalSortedKeysForDecrypt = {
        verificationContacts: [],
        forVerification: [],
        encryptedFor: [],
        signedBy: [],
        prvMatching: [],
        prvForDecrypt: [],
        prvForDecryptDecrypted: [],
        prvForDecryptWithoutPassphrases: [],
      };
      let encryptedFor = msg instanceof openpgp.message.Message ? (msg as OpenPGP.message.Message).getEncryptionKeyIds() : [];
      keys.encryptedFor = encryptedFor.map(id => Pgp.key.longid(id.bytes)).filter(Boolean) as string[];
      keys.signedBy = (msg.getSigningKeyIds ? msg.getSigningKeyIds() : []).filter(Boolean).map(id => Pgp.key.longid((id as any).bytes)).filter(Boolean) as string[];
      let privateKeysAll = await Store.keysGet(acctEmail);
      keys.prvMatching = privateKeysAll.filter(ki => Value.is(ki.longid).in(keys.encryptedFor));
      if (keys.prvMatching.length) {
        keys.prvForDecrypt = keys.prvMatching;
      } else {
        keys.prvForDecrypt = privateKeysAll;
      }
      let passphrases = (await Promise.all(keys.prvForDecrypt.map(ki => Store.passphraseGet(acctEmail, ki.longid))));
      let passphrasesFiltered = passphrases.filter(pp => pp !== null) as string[];
      for (let prvForDecrypt of keys.prvForDecrypt) {
        let key = openpgp.key.readArmored(prvForDecrypt.private).keys[0];
        if (key.isDecrypted() || (passphrasesFiltered.length && await Pgp.key.decrypt(key, passphrasesFiltered) === true)) {
          prvForDecrypt.decrypted = key;
          keys.prvForDecryptDecrypted.push(prvForDecrypt);
        } else {
          keys.prvForDecryptWithoutPassphrases.push(prvForDecrypt);
        }
      }
      if (keys.signedBy.length && typeof Store.dbContactGet === 'function') {
        let verificationContacts = await Store.dbContactGet(null, keys.signedBy);
        keys.verificationContacts = verificationContacts.filter(contact => contact !== null && contact.pubkey) as Contact[];
        keys.forVerification = [].concat.apply([], keys.verificationContacts.map(contact => openpgp.key.readArmored(contact.pubkey!).keys)); // pubkey! checked above
      }
      return keys;
    },
    cryptoMsgDecryptCategorizeErr: (decryptErr: Error, msgPwd: string | null): DecryptError$error => {
      let e = String(decryptErr).replace('Error: ', '').replace('Error decrypting message: ', '');
      let keyMismatchErrStrings = ['Cannot read property \'isDecrypted\' of null', 'privateKeyPacket is null',
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
      let numberWordEnding = (n: number) => (n > 1) ? 's' : '';
      totalSeconds = Math.round(totalSeconds);
      let millennia = Math.round(totalSeconds / (86400 * 30 * 12 * 100 * 1000));
      if (millennia) {
        return millennia === 1 ? 'a millennium' : 'millennia';
      }
      let centuries = Math.round(totalSeconds / (86400 * 30 * 12 * 100));
      if (centuries) {
        return centuries === 1 ? 'a century' : 'centuries';
      }
      let years = Math.round(totalSeconds / (86400 * 30 * 12));
      if (years) {
        return years + ' year' + numberWordEnding(years);
      }
      let months = Math.round(totalSeconds / (86400 * 30));
      if (months) {
        return months + ' month' + numberWordEnding(months);
      }
      let days = Math.round(totalSeconds / 86400);
      if (days) {
        return days + ' day' + numberWordEnding(days);
      }
      let hours = Math.round(totalSeconds / 3600);
      if (hours) {
        return hours + ' hour' + numberWordEnding(hours);
      }
      let minutes = Math.round(totalSeconds / 60);
      if (minutes) {
        return minutes + ' minute' + numberWordEnding(minutes);
      }
      let seconds = totalSeconds % 60;
      if (seconds) {
        return seconds + ' second' + numberWordEnding(seconds);
      }
      return 'less than a second';
    },
  };

}
