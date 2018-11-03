/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, KeyInfo, Contact } from './store.js';
import { Catch, Value, Str } from './common.js';
import { Ui, XssSafeFactory, Challenge } from './browser.js';
import { ReplaceableMsgBlockType, MsgBlock, MsgBlockType } from './mime.js';

declare const openpgp: typeof OpenPGP;

type InternalSortedKeysForDecrypt = { verification_contacts: Contact[]; for_verification: OpenPGP.key.Key[]; encrypted_for: string[]; signed_by: string[];
  prv_matching: KeyInfo[]; prv_for_decrypt: KeyInfo[]; prv_for_decrypt_decrypted: KeyInfo[]; prv_for_decrypt_without_passphrases: KeyInfo[]; };
type ConsummableBrowserBlob = {blob_type: 'text'|'uint8', blob_url: string};
type DecrytSuccess$content = { blob?: ConsummableBrowserBlob; text?: string; uint8?: Uint8Array; filename: string|null; };
type DecryptSuccess = { success: true; content: DecrytSuccess$content, signature: MsgVerifyResult|null; is_encrypted: boolean|null; };
type DecryptError$error = { type: DecryptErrTypes; error?: string; };
type DecryptError$longids = { message: string[]; matching: string[]; chosen: string[]; need_passphrase: string[]; };
type DecryptError = { success: false; error: DecryptError$error; longids: DecryptError$longids;
  is_encrypted: null|boolean; signature: null; message?: OpenPGP.message.Message|OpenPGP.cleartext.CleartextMessage; };
type CryptoArmorHeaderDefinition = {begin: string, middle?: string, end: string|RegExp, replace: boolean};
type CryptoArmorHeaderDefinitions = { readonly [type in ReplaceableMsgBlockType|'null'|'signature']: CryptoArmorHeaderDefinition; };

export type MsgVerifyResult = { signer: string|null; contact: Contact|null; match: boolean|null; error: null|string; };
export type DecryptResult = DecryptSuccess|DecryptError;
export type DiagnoseMsgPubkeysResult = { found_match: boolean, receivers: number, };
export enum DecryptErrTypes {
  key_mismatch = 'key_mismatch',
  use_password = 'use_password',
  wrong_password = 'wrong_password',
  no_mdc = 'no_mdc',
  need_passphrase = 'need_passphrase',
  format = 'format',
  other = 'other',
}

export class Pgp {

  private static ARMOR_HEADER_MAX_LENGTH = 50;
  private static ARMOR_HEADER_DICT: CryptoArmorHeaderDefinitions = { // general password_message begin: /^[^\n]+: (Open Message|Nachricht öffnen)/
    null: { begin: '-----BEGIN', end: '-----END', replace: false },
    public_key: { begin: '-----BEGIN PGP PUBLIC KEY BLOCK-----', end: '-----END PGP PUBLIC KEY BLOCK-----', replace: true },
    private_key: { begin: '-----BEGIN PGP PRIVATE KEY BLOCK-----', end: '-----END PGP PRIVATE KEY BLOCK-----', replace: true },
    attest_packet: { begin: '-----BEGIN ATTEST PACKET-----', end: '-----END ATTEST PACKET-----', replace: true },
    cryptup_verification: { begin: '-----BEGIN CRYPTUP VERIFICATION-----', end: '-----END CRYPTUP VERIFICATION-----', replace: true },
    signed_message: { begin: '-----BEGIN PGP SIGNED MESSAGE-----', middle: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: true },
    signature: { begin: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: false },
    message: { begin: '-----BEGIN PGP MESSAGE-----', end: '-----END PGP MESSAGE-----', replace: true },
    password_message: { begin: 'This message is encrypted: Open Message', end: /https:(\/|&#x2F;){2}(cryptup\.org|flowcrypt\.com)(\/|&#x2F;)[a-zA-Z0-9]{10}(\n|$)/, replace: true},
  };
  private static PASSWORD_GUESSES_PER_SECOND = 10000 * 2 * 4000; // (10k pc)*(2 core p/pc)*(4k guess p/core) httpshttps://www.abuse.ch/?p=3294://threatpost.com/how-much-does-botnet-cost-022813/77573/ https://www.abuse.ch/?p=3294
  private static PASSWORD_CRACK_TIME_WORDS = [
    {match: 'millenni', word: 'perfect',    bar: 100, color: 'green',       pass: true},
    {match: 'centu',    word: 'great',      bar: 80,  color: 'green',       pass: true},
    {match: 'year',     word: 'good',       bar: 60,  color: 'orange',      pass: true},
    {match: 'month',    word: 'reasonable', bar: 40,  color: 'darkorange',  pass: true},
    {match: 'day',      word: 'poor',       bar: 20,  color: 'darkred',     pass: false},
    {match: '',         word: 'weak',       bar: 10,  color: 'red',         pass: false},
  ];

  public static armor = {
    strip: (pgp_block_text: string) => {
      if (!pgp_block_text) {
        return pgp_block_text;
      }
      let debug = false;
      if (debug) {
        console.info('pgp_block_1');
        console.info(pgp_block_text);
      }
      let newlines = [/<div><br><\/div>/g, /<\/div><div>/g, /<[bB][rR]( [a-zA-Z]+="[^"]*")* ?\/? ?>/g, /<div ?\/?>/g];
      let spaces = [/&nbsp;/g];
      let removes = [/<wbr ?\/?>/g, /<\/?div>/g];
      for (let newline of newlines) {
        pgp_block_text = pgp_block_text.replace(newline, '\n');
      }
      if (debug) {
        console.info('pgp_block_2');
        console.info(pgp_block_text);
      }
      for (let remove of removes) {
        pgp_block_text = pgp_block_text.replace(remove, '');
      }
      if (debug) {
        console.info('pgp_block_3');
        console.info(pgp_block_text);
      }
      for (let space of spaces) {
        pgp_block_text = pgp_block_text.replace(space, ' ');
      }
      if (debug) {
        console.info('pgp_block_4');
        console.info(pgp_block_text);
      }
      pgp_block_text = pgp_block_text.replace(/\r\n/g, '\n');
      if (debug) {
        console.info('pgp_block_5');
        console.info(pgp_block_text);
      }
      pgp_block_text = $('<div>' + pgp_block_text + '</div>').text();
      if (debug) {
        console.info('pgp_block_6');
        console.info(pgp_block_text);
      }
      let double_newlines = pgp_block_text.match(/\n\n/g);
      if (double_newlines !== null && double_newlines.length > 2) { // a lot of newlines are doubled
        pgp_block_text = pgp_block_text.replace(/\n\n/g, '\n');
        if (debug) {
          console.info('pgp_block_removed_doubles');
        }
      }
      if (debug) {
        console.info('pgp_block_7');
        console.info(pgp_block_text);
      }
      pgp_block_text = pgp_block_text.replace(/^ +/gm, '');
      if (debug) {
        console.info('pgp_block_final');
        console.info(pgp_block_text);
      }
      return pgp_block_text;
    },
    clip: (text: string) => {
      if (text && Value.is(Pgp.ARMOR_HEADER_DICT.null.begin).in(text) && Value.is(Pgp.ARMOR_HEADER_DICT.null.end as string).in(text)) {
        let match = text.match(/(-----BEGIN PGP (MESSAGE|SIGNED MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----[^]+-----END PGP (MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----)/gm);
        return(match !== null && match.length) ? match[0] : null;
      }
      return null;
    },
    headers: (block_type: ReplaceableMsgBlockType|'null', format='string'): CryptoArmorHeaderDefinition => {
      let h = Pgp.ARMOR_HEADER_DICT[block_type];
      return {
        begin: (typeof h.begin === 'string' && format === 're') ? h.begin.replace(/ /g, '\\\s') : h.begin,
        end: (typeof h.end === 'string' && format === 're') ? h.end.replace(/ /g, '\\\s') : h.end,
        replace: h.replace,
      };
    },
    detect_blocks: (orig_text: string) => {
      let blocks: MsgBlock[] = [];
      let normalized = Str.normalize(orig_text);
      let start_at = 0;
      while(true) {
        let r = Pgp.internal.crypto_armor_detect_block_next(normalized, start_at);
        if (r.found) {
          blocks = blocks.concat(r.found);
        }
        if (r.continue_at === null) {
          return {blocks, normalized};
        } else {
          if (r.continue_at <= start_at) {
            Catch.report(`Pgp.armor.detect_blocks likely infinite loop: r.continue_at(${r.continue_at}) <= start_at(${start_at})`);
            return {blocks, normalized}; // prevent infinite loop
          }
          start_at = r.continue_at;
        }
      }
    },
    /**
     * XSS WARNING
     *
     * Return values are inserted directly into DOM. Results must be html escaped.
     *
     * When edited, REQUEST A SECOND SET OF EYES TO REVIEW CHANGES
     */
    replace_blocks: (factory: XssSafeFactory, orig_text: string, msg_id:string|null=null, sender_email:string|null=null, is_outgoing: boolean|null=null) => {
      let {blocks} = Pgp.armor.detect_blocks(orig_text);
      if (blocks.length === 1 && blocks[0].type === 'text') {
        return;
      }
      let r = '';
      for (let block of blocks) {
        r += (r ? '\n\n' : '') + Ui.renderable_msg_block(factory, block, msg_id, sender_email, is_outgoing);
      }
      return r;
    },
    normalize: (armored: string, type:string) => {
      armored = Str.normalize(armored);
      if (Value.is(type).in(['message', 'public_key', 'private_key', 'key'])) {
        armored = armored.replace(/\r?\n/g, '\n').trim();
        let nl_2 = armored.match(/\n\n/g);
        let nl_3 = armored.match(/\n\n\n/g);
        let nl_4 = armored.match(/\n\n\n\n/g);
        let nl_6 = armored.match(/\n\n\n\n\n\n/g);
        if (nl_3 && nl_6 && nl_3.length > 1 && nl_6.length === 1) {
          return armored.replace(/\n\n\n/g, '\n'); // newlines tripled: fix
        } else if (nl_2 && nl_4 && nl_2.length > 1 && nl_4.length === 1) {
          return armored.replace(/\n\n/g, '\n'); // newlines doubled.GPA on windows does this, and sometimes message can get extracted this way from html
        }
        return armored;
      } else {
        return armored;
      }
    },
  };

  public static hash = {
    sha1: (string: string) => Str.to_hex(Str.from_uint8(openpgp.crypto.hash.digest(openpgp.enums.hash.sha1, string))),
    double_sha1_upper: (string: string) => Pgp.hash.sha1(Pgp.hash.sha1(string)).toUpperCase(),
    sha256: (string: string) => Str.to_hex(Str.from_uint8(openpgp.crypto.hash.digest(openpgp.enums.hash.sha256, string))),
    challenge_answer: (answer: string) => Pgp.internal.crypto_hash_sha256_loop(answer),
  };

  public static key = {
    create: async (userIds: {name: string, email: string}[], numBits: 4096, passphrase: string): Promise<{private: string, public: string}> => {
      let k = await openpgp.generateKey({numBits, userIds, passphrase});
      return {public: k.publicKeyArmored, private: k.privateKeyArmored};
    },
    read: (armored_key: string) => openpgp.key.readArmored(armored_key).keys[0],
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
        let key: OpenPGP.key.Key|undefined;
        if (RegExp(Pgp.armor.headers('public_key', 're').begin).test(armored)) {
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
        Catch.handle_exception(error);
      }
    },
    fingerprint: (key: OpenPGP.key.Key|string, formatting:"default"|"spaced"='default'): string|null => {
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
            Catch.handle_exception(error);
          }
          console.log(error);
          return null;
        }
      }
    },
    longid: (key_or_fingerprint_or_bytes: string|OpenPGP.key.Key|null|undefined): string|null => {
      if (key_or_fingerprint_or_bytes === null || typeof key_or_fingerprint_or_bytes === 'undefined') {
        return null;
      } else if (typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 8) {
        return Str.to_hex(key_or_fingerprint_or_bytes).toUpperCase();
      } else if (typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 40) {
        return key_or_fingerprint_or_bytes.substr(-16);
      } else if (typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 49) {
        return key_or_fingerprint_or_bytes.replace(/ /g, '').substr(-16);
      } else {
        return Pgp.key.longid(Pgp.key.fingerprint(key_or_fingerprint_or_bytes));
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
      if(await pubkey.getEncryptionKey() !== null) {
        return true; // good key - cannot be expired
      }
      return await Pgp.key.usable_but_expired(pubkey);
    },
    usable_but_expired: async (key: OpenPGP.key.Key): Promise<boolean> => {
      if(await key.getEncryptionKey() !== null) {
        return false; // good key - cannot be expired
      }
      let one_second_before_expiration = await Pgp.key.date_before_expiration(key);
      if(one_second_before_expiration === null) {
        return false; // key does not expire
      }
      // try to see if the key was usable just before expiration
      return await key.getEncryptionKey(null, one_second_before_expiration) !== null;
    },
    date_before_expiration: async (key: OpenPGP.key.Key): Promise<Date|null> => {
      let expires = await key.getExpirationTime();
      if(expires instanceof Date && expires.getTime() < Date.now()) { // expired
        return new Date(expires.getTime() - 1000);
      }
      return null;
    },
  };

  public static msg = {
    type: (data: string|Uint8Array): {armored: boolean, type: MsgBlockType}|null => {
      if (!data || !data.length) {
        return null;
      }
      let d = data.slice(0, 50); // only interested in first 50 bytes
      // noinspection SuspiciousInstanceOfGuard
      if (d instanceof Uint8Array) {
        d = Str.from_uint8(d);
      }
      let first_byte = d[0].charCodeAt(0); // attempt to understand this as a binary PGP packet: https://tools.ietf.org/html/rfc4880#section-4.2
      if ((first_byte & 0b10000000) === 0b10000000) { // 1XXX XXXX - potential pgp packet tag
        let tag_number = 0; // zero is a forbidden tag number
        if ((first_byte & 0b11000000) === 0b11000000) { // 11XX XXXX - potential new pgp packet tag
          tag_number = first_byte & 0b00111111;  // 11TTTTTT where T is tag number bit
        } else { // 10XX XXXX - potential old pgp packet tag
          tag_number = (first_byte & 0b00111100) / 4; // 10TTTTLL where T is tag number bit. Division by 4 in place of two bit shifts. I hate bit shifts.
        }
        if (Value.is(tag_number).in(Object.values(openpgp.enums.packet))) {
          // Indeed a valid OpenPGP packet tag number
          // This does not 100% mean it's OpenPGP message
          // But it's a good indication that it may
          let t = openpgp.enums.packet;
          let m_types = [t.symEncryptedIntegrityProtected, t.modificationDetectionCode, t.symEncryptedAEADProtected, t.symmetricallyEncrypted, t.compressed];
          return {armored: false, type: Value.is(tag_number).in(m_types) ? 'message' : 'public_key'};
        }
      }
      let {blocks} = Pgp.armor.detect_blocks(d.trim());
      if (blocks.length === 1 && blocks[0].complete === false && Value.is(blocks[0].type).in(['message', 'private_key', 'public_key', 'signed_message'])) {
        return {armored: true, type: blocks[0].type};
      }
      return null;
    },
    sign: async (signing_prv: OpenPGP.key.Key, data: string): Promise<string> => {
      let sign_result = await openpgp.sign({data, armor: true, privateKeys: [signing_prv]});
      return (sign_result as OpenPGP.SignArmorResult).data;
    },
    verify: async (message: OpenPGP.message.Message|OpenPGP.cleartext.CleartextMessage, keys_for_verification: OpenPGP.key.Key[], optional_contact: Contact|null=null) => {
      let signature: MsgVerifyResult = { signer: null, contact: optional_contact, match: null, error: null };
      try {
        for (let verify_result of await message.verify(keys_for_verification)) {
          signature.match = Value.is(signature.match).in([true, null]) && verify_result.valid; // this will probably falsely show as not matching in some rare cases. Needs testing.
          if (!signature.signer) {
            signature.signer = Pgp.key.longid(verify_result.keyid.bytes);
          }
        }
      } catch (verify_error) {
        signature.match = null;
        if (verify_error.message === 'Can only verify message with one literal data packet.') {
          signature.error = 'FlowCrypt is not equipped to verify this message (err 101)';
        } else {
          signature.error = `FlowCrypt had trouble verifying this message (${verify_error.message})`;
          Catch.handle_exception(verify_error);
        }
      }
      return signature;
    },
    verify_detached: async (account_email: string, plaintext: string|Uint8Array, signature_text: string|Uint8Array): Promise<MsgVerifyResult> => {
      if (plaintext instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
        plaintext = Str.from_uint8(plaintext);
      }
      if (signature_text instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
        signature_text = Str.from_uint8(signature_text);
      }
      let message = openpgp.message.fromText(plaintext);
      message.appendSignature(signature_text);
      let keys = await Pgp.internal.crypto_message_get_sorted_keys_for_message(account_email, message);
      return await Pgp.msg.verify(message, keys.for_verification, keys.verification_contacts[0]);
    },
    decrypt: async (account_email: string, encrypted_data: string|Uint8Array, msg_pwd: string|null=null, get_uint8=false): Promise<DecryptSuccess|DecryptError> => {
      let prepared;
      let longids = {message: [] as string[], matching: [] as string[], chosen: [] as string[], need_passphrase: [] as string[]};
      try {
        prepared = Pgp.internal.crypto_message_prepare_for_decrypt(encrypted_data);
      } catch (format_error) {
        return {success: false, error: {type: DecryptErrTypes.format, error: format_error.message}, longids, is_encrypted: null, signature: null};
      }
      let keys = await Pgp.internal.crypto_message_get_sorted_keys_for_message(account_email, prepared.message);
      longids.message = keys.encrypted_for;
      longids.matching = keys.prv_for_decrypt.map(ki => ki.longid);
      longids.chosen = keys.prv_for_decrypt_decrypted.map(ki => ki.longid);
      longids.need_passphrase = keys.prv_for_decrypt_without_passphrases.map(ki => ki.longid);
      let is_encrypted = !prepared.is_cleartext;
      if (!is_encrypted) {
        return {success: true, content: {text: prepared.message.getText(), filename: null}, is_encrypted, signature: await Pgp.msg.verify(prepared.message, keys.for_verification, keys.verification_contacts[0])};
      }
      if (!keys.prv_for_decrypt_decrypted.length && !msg_pwd) {
        return {success: false, error: {type: DecryptErrTypes.need_passphrase}, signature: null, message: prepared.message, longids, is_encrypted};
      }
      try {
        let packets = (prepared.message as OpenPGP.message.Message).packets;
        let is_sym_encrypted = packets.filter(p => p.tag === openpgp.enums.packet.symEncryptedSessionKey).length > 0;
        let is_pub_encrypted = packets.filter(p => p.tag === openpgp.enums.packet.publicKeyEncryptedSessionKey).length > 0;
        if(is_sym_encrypted && !is_pub_encrypted && !msg_pwd) {
          return {success: false, error: {type: DecryptErrTypes.use_password}, longids, is_encrypted, signature: null};
        }
        let msg_passwords = msg_pwd ? [msg_pwd] : null;
        let decrypted = await (prepared.message as OpenPGP.message.Message).decrypt(keys.prv_for_decrypt_decrypted.map(ki => ki.decrypted!), msg_passwords);
        // let signature_result = keys.signed_by.length ? Pgp.message.verify(message, keys.for_verification, keys.verification_contacts[0]) : false;
        let signature_result = null;
        if(get_uint8) {
          return {success: true, content: {uint8: decrypted.getLiteralData(), filename: decrypted.getFilename()}, is_encrypted, signature: signature_result};
        } else {
          return {success: true, content: {text: decrypted.getText(), filename: decrypted.getFilename()}, is_encrypted, signature: signature_result};
        }
      } catch (e) {
        return {success: false, error: Pgp.internal.crypto_message_decrypt_categorize_error(e, msg_pwd), signature: null, message: prepared.message, longids, is_encrypted};
      }
    },
    encrypt: async (armored_pubkeys: string[], signing_prv: OpenPGP.key.Key|null, challenge: Challenge|null, data: string|Uint8Array, filename: string|null, armor: boolean, date: Date|null=null): Promise<OpenPGP.EncryptResult> => {
      let options: OpenPGP.EncryptOptions = { data, armor, date: date || undefined, filename: filename || undefined };
      let used_challange = false;
      if (armored_pubkeys) {
        options.publicKeys = [];
        for (let armored_pubkey of armored_pubkeys) {
          options.publicKeys = options.publicKeys.concat(openpgp.key.readArmored(armored_pubkey).keys);
        }
      }
      if (challenge && challenge.answer) {
        options.passwords = [Pgp.hash.challenge_answer(challenge.answer)];
        used_challange = true;
      }
      if (!armored_pubkeys && !used_challange) {
        alert('Internal error: don\'t know how to encryt message. Please refresh the page and try again, or contact me at human@flowcrypt.com if this happens repeatedly.');
        throw new Error('no-pubkeys-no-challenge');
      }
      if (signing_prv && typeof signing_prv.isPrivate !== 'undefined' && signing_prv.isPrivate()) {
        options.privateKeys = [signing_prv];
      }
      return await openpgp.encrypt(options);
    },
    diagnose_pubkeys: async (account_email: string, m: string|Uint8Array|OpenPGP.message.Message): Promise<DiagnoseMsgPubkeysResult> => {
      let message: OpenPGP.message.Message;
      if (typeof m === 'string') {
        message = openpgp.message.readArmored(m);
      } else if (m instanceof Uint8Array) {
        message = openpgp.message.readArmored(Str.from_uint8(m));
      } else {
        message = m;
      }
      let message_key_ids = message.getEncryptionKeyIds ? message.getEncryptionKeyIds() : [];
      let private_keys = await Store.keysGet(account_email);
      let local_key_ids = [].concat.apply([], private_keys.map(ki => ki.public).map(Pgp.internal.crypto_key_ids));
      let diagnosis = { found_match: false, receivers: message_key_ids.length };
      for (let msg_k_id of message_key_ids) {
        for (let local_k_id of local_key_ids) {
          if (msg_k_id === local_k_id) {
            diagnosis.found_match = true;
            return diagnosis;
          }
        }
      }
      return diagnosis;
    },
  };

  public static password = {
    estimate_strength: (zxcvbn_result_guesses: number) => {
      let time_to_crack = zxcvbn_result_guesses / Pgp.PASSWORD_GUESSES_PER_SECOND;
      for (let word of Pgp.PASSWORD_CRACK_TIME_WORDS) {
        let readable_time = Pgp.internal.readable_crack_time(time_to_crack);
        // looks for a word match from readable_crack_time, defaults on "weak"
        if (Value.is(word.match).in(readable_time)) {
          return {word, seconds: Math.round(time_to_crack), time: readable_time};
        }
      }
      Catch.report('estimate_strength: got to end without any result');
      throw Error('(thrown) estimate_strength: got to end without any result');
    },
    weak_words: () => [
      'crypt', 'up', 'cryptup', 'flow', 'flowcrypt', 'encryption', 'pgp', 'email', 'set', 'backup', 'passphrase', 'best', 'pass', 'phrases', 'are', 'long', 'and', 'have', 'several',
      'words', 'in', 'them', 'Best pass phrases are long', 'have several words', 'in them', 'bestpassphrasesarelong', 'haveseveralwords', 'inthem',
      'Loss of this pass phrase', 'cannot be recovered', 'Note it down', 'on a paper', 'lossofthispassphrase', 'cannotberecovered', 'noteitdown', 'onapaper',
      'setpassword', 'set password', 'set pass word', 'setpassphrase', 'set pass phrase', 'set passphrase'
    ],
    random: () => { // eg TDW6-DU5M-TANI-LJXY
      let secure_random_array = new Uint8Array(128);
      window.crypto.getRandomValues(secure_random_array);
      return btoa(Str.from_uint8(secure_random_array)).toUpperCase().replace(/[^A-Z0-9]|0|O|1/g, '').replace(/(.{4})/g, '$1-').substr(0, 19);
    },
  };

  public static internal = {
    crypto_armor_block_object: (type: MsgBlockType, content: string, missing_end=false): MsgBlock => ({type, content, complete: !missing_end}),
    crypto_armor_detect_block_next: (orig_text: string, start_at: number) => {
      let result = {found: [] as MsgBlock[], continue_at: null as number|null};
      let begin = orig_text.indexOf(Pgp.armor.headers('null').begin, start_at);
      if (begin !== -1) { // found
        let potential_begin_header = orig_text.substr(begin, Pgp.ARMOR_HEADER_MAX_LENGTH);
        for (let _type of Object.keys(Pgp.ARMOR_HEADER_DICT)) {
          let type = _type as ReplaceableMsgBlockType;
          let block_header_def = Pgp.ARMOR_HEADER_DICT[type];
          if (block_header_def.replace) {
            let index_of_confirmed_begin = potential_begin_header.indexOf(block_header_def.begin);
            if (index_of_confirmed_begin === 0 || (type === 'password_message' && index_of_confirmed_begin >= 0 && index_of_confirmed_begin < 15)) { // identified beginning of a specific block
              if (begin > start_at) {
                let potential_text_before_block_begun = orig_text.substring(start_at, begin).trim();
                if (potential_text_before_block_begun) {
                  result.found.push(Pgp.internal.crypto_armor_block_object('text', potential_text_before_block_begun));
                }
              }
              let end_index: number = -1;
              let found_block_end_header_length = 0;
              if (typeof block_header_def.end === 'string') {
                end_index = orig_text.indexOf(block_header_def.end, begin + block_header_def.begin.length);
                found_block_end_header_length = block_header_def.end.length;
              } else { // regexp
                let orig_text_after_begin_index = orig_text.substring(begin);
                let regexp_end = orig_text_after_begin_index.match(block_header_def.end);
                if (regexp_end !== null) {
                  end_index = regexp_end.index ? begin + regexp_end.index : -1;
                  found_block_end_header_length = regexp_end[0].length;
                }
              }
              if (end_index !== -1) { // identified end of the same block
                if (type !== 'password_message') {
                  result.found.push(Pgp.internal.crypto_armor_block_object(type, orig_text.substring(begin, end_index + found_block_end_header_length).trim()));
                } else {
                  let pm_full_text = orig_text.substring(begin, end_index + found_block_end_header_length).trim();
                  let pm_short_id_match = pm_full_text.match(/[a-zA-Z0-9]{10}$/);
                  if (pm_short_id_match) {
                    result.found.push(Pgp.internal.crypto_armor_block_object(type, pm_short_id_match[0]));
                  } else {
                    result.found.push(Pgp.internal.crypto_armor_block_object('text', pm_full_text));
                  }
                }
                result.continue_at = end_index + found_block_end_header_length;
              } else { // corresponding end not found
                result.found.push(Pgp.internal.crypto_armor_block_object(type, orig_text.substr(begin), true));
              }
              break;
            }
          }
        }
      }
      if (orig_text && !result.found.length) { // didn't find any blocks, but input is non-empty
        let potential_text = orig_text.substr(start_at).trim();
        if (potential_text) {
          result.found.push(Pgp.internal.crypto_armor_block_object('text', potential_text));
        }
      }
      return result;
    },
    crypto_hash_sha256_loop: (string: string, times=100000) => {
      for (let i = 0; i < times; i++) {
        string = Pgp.hash.sha256(string);
      }
      return string;
    },
    crypto_key_ids: (armored_pubkey: string) => openpgp.key.readArmored(armored_pubkey).keys[0].getKeyIds(),
    crypto_message_prepare_for_decrypt: (data: string|Uint8Array): {is_armored: boolean, is_cleartext: false, message: OpenPGP.message.Message}|{is_armored: boolean, is_cleartext: true, message: OpenPGP.cleartext.CleartextMessage} => {
      let first_100_bytes = Str.from_uint8(data.slice(0, 100));
      let is_armored_encrypted = Value.is(Pgp.armor.headers('message').begin).in(first_100_bytes);
      let is_armored_signed_only = Value.is(Pgp.armor.headers('signed_message').begin).in(first_100_bytes);
      let is_armored = is_armored_encrypted || is_armored_signed_only;
      if (is_armored_encrypted) {
        return {is_armored, is_cleartext: false, message: openpgp.message.readArmored(Str.from_uint8(data))};
      } else if (is_armored_signed_only) {
        return {is_armored, is_cleartext: true, message: openpgp.cleartext.readArmored(Str.from_uint8(data))};
      } else {
        return {is_armored, is_cleartext: false, message: openpgp.message.read(Str.to_uint8(data))};
      }
    },
    crypto_message_get_sorted_keys_for_message: async (account_email: string, message: OpenPGP.message.Message|OpenPGP.cleartext.CleartextMessage): Promise<InternalSortedKeysForDecrypt> => {
      let keys: InternalSortedKeysForDecrypt = {
        verification_contacts: [],
        for_verification: [],
        encrypted_for: [],
        signed_by: [],
        prv_matching: [],
        prv_for_decrypt: [],
        prv_for_decrypt_decrypted: [],
        prv_for_decrypt_without_passphrases: [],
      };
      keys.encrypted_for = (message instanceof openpgp.message.Message ? (message as OpenPGP.message.Message).getEncryptionKeyIds() : []).map(id => Pgp.key.longid(id.bytes)).filter(Boolean) as string[];
      keys.signed_by = (message.getSigningKeyIds ? message.getSigningKeyIds() : []).filter(Boolean).map(id => Pgp.key.longid((id as any).bytes)).filter(Boolean) as string[];
      let private_keys_all = await Store.keysGet(account_email);
      keys.prv_matching = private_keys_all.filter(ki => Value.is(ki.longid).in(keys.encrypted_for));
      if (keys.prv_matching.length) {
        keys.prv_for_decrypt = keys.prv_matching;
      } else {
        keys.prv_for_decrypt = private_keys_all;
      }
      let passphrases = (await Promise.all(keys.prv_for_decrypt.map(ki => Store.passphrase_get(account_email, ki.longid))));
      let passphrases_filtered = passphrases.filter(pp => pp !== null) as string[];
      for (let prv_for_decrypt of keys.prv_for_decrypt) {
        let key = openpgp.key.readArmored(prv_for_decrypt.private).keys[0];
        if (key.isDecrypted() || (passphrases_filtered.length && await Pgp.key.decrypt(key, passphrases_filtered) === true)) {
          prv_for_decrypt.decrypted = key;
          keys.prv_for_decrypt_decrypted.push(prv_for_decrypt);
        } else {
          keys.prv_for_decrypt_without_passphrases.push(prv_for_decrypt);
        }
      }
      if (keys.signed_by.length && typeof Store.db_contact_get === 'function') {
        let verification_contacts = await Store.db_contact_get(null, keys.signed_by);
        keys.verification_contacts = verification_contacts.filter(contact => contact !== null && contact.pubkey) as Contact[];
        keys.for_verification = [].concat.apply([], keys.verification_contacts.map(contact => openpgp.key.readArmored(contact.pubkey!).keys)); // pubkey! checked above
      }
      return keys;
    },
    crypto_message_decrypt_categorize_error: (decrypt_error: Error, message_password: string|null): DecryptError$error => {
      let e = String(decrypt_error).replace('Error: ', '').replace('Error decrypting message: ', '');
      if (Value.is(e).in(['Cannot read property \'isDecrypted\' of null', 'privateKeyPacket is null', 'TypeprivateKeyPacket is null', 'Session key decryption failed.', 'Invalid session key for decryption.']) && !message_password) {
        return {type: DecryptErrTypes.key_mismatch, error: e};
      } else if (message_password && Value.is(e).in(['Invalid enum value.', 'CFB decrypt: invalid key', 'Session key decryption failed.'])) {
        return {type: DecryptErrTypes.wrong_password, error: e};
      } else if (e === 'Decryption failed due to missing MDC in combination with modern cipher.') {
        return {type: DecryptErrTypes.no_mdc, error: e};
      } else if (e === 'Decryption error') {
        return {type: DecryptErrTypes.format, error: e};
      } else {
        return {type: DecryptErrTypes.other, error: e};
      }
    },
    readable_crack_time: (total_seconds: number) => { // http://stackoverflow.com/questions/8211744/convert-time-interval-given-in-seconds-into-more-human-readable-form
      let number_word_ending = (n: number) => (n > 1) ? 's' : '';
      total_seconds = Math.round(total_seconds);
      let millennia = Math.round(total_seconds / (86400 * 30 * 12 * 100 * 1000));
      if (millennia) {
        return millennia === 1 ? 'a millennium' : 'millennia';
      }
      let centuries = Math.round(total_seconds / (86400 * 30 * 12 * 100));
      if (centuries) {
        return centuries === 1 ? 'a century' : 'centuries';
      }
      let years = Math.round(total_seconds / (86400 * 30 * 12));
      if (years) {
        return years + ' year' + number_word_ending(years);
      }
      let months = Math.round(total_seconds / (86400 * 30));
      if (months) {
        return months + ' month' + number_word_ending(months);
      }
      let days = Math.round(total_seconds / 86400);
      if (days) {
        return days + ' day' + number_word_ending(days);
      }
      let hours = Math.round(total_seconds / 3600);
      if (hours) {
        return hours + ' hour' + number_word_ending(hours);
      }
      let minutes = Math.round(total_seconds / 60);
      if (minutes) {
        return minutes + ' minute' + number_word_ending(minutes);
      }
      let seconds = total_seconds % 60;
      if (seconds) {
        return seconds + ' second' + number_word_ending(seconds);
      }
      return 'less than a second';
    },
  };

}
