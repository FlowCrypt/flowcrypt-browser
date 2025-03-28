/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';
import { Key, KeyInfoWithIdentity, KeyInfoWithIdentityAndOptionalPp, KeyUtil } from '../key.js';
import { ReplaceableMsgBlockType } from '../../msg-block.js';
import { Buf } from '../../buf.js';
import { PgpArmor, PreparedForDecrypt } from './pgp-armor.js';
import { opgp } from './openpgpjs-custom.js';
import type * as OpenPGP from 'openpgp';
import { KeyCache } from '../../../platform/key-cache.js';
import { SmimeKey, SmimeMsg } from '../smime/smime-key.js';
import { OpenPGPKey } from './openpgp-key.js';
import { ContactStore } from '../../../platform/store/contact-store.js';
import * as Stream from '@openpgp/web-stream-tools';
import { Str } from '../../common.js';

export class DecryptionError extends Error {
  public decryptError: DecryptError;

  public constructor(decryptError: DecryptError) {
    super(decryptError.error.message);
    this.decryptError = decryptError;
  }
}

export namespace PgpMsgMethod {
  export namespace Arg {
    export type Encrypt = {
      pubkeys: Key[];
      signingPrv?: Key;
      pwd?: string;
      data: Uint8Array;
      filename?: string;
      armor: boolean;
      date?: Date;
    };
    export type Type = { data: Uint8Array };
    export type Decrypt = {
      kisWithPp: KeyInfoWithIdentityAndOptionalPp[];
      encryptedData: Uint8Array | string;
      msgPwd?: string;
      verificationPubs: string[];
    };
    export type DiagnosePubkeys = { armoredPubs: string[]; message: Uint8Array | string };
    export type VerifyDetached = { plaintext: Uint8Array | string; sigText: string; verificationPubs: string[] };
  }
  export type DiagnosePubkeys = (arg: Arg.DiagnosePubkeys) => Promise<DiagnoseMsgPubkeysResult>;
  export type VerifyDetached = (arg: Arg.VerifyDetached) => Promise<VerifyRes>;
  export type Decrypt = (arg: Arg.Decrypt) => Promise<DecryptResult>;
  export type Type = (arg: Arg.Type) => PgpMsgTypeResult;
  export type Encrypt = (arg: Arg.Encrypt) => Promise<EncryptResult>;
  export type EncryptResult = EncryptPgpResult | EncryptX509Result;
  export type EncryptPgpResult = {
    data: Uint8Array;
    type: 'openpgp';
  };
  export type EncryptX509Result = {
    data: Uint8Array;
    type: 'smime';
  };
}

type SortedKeysForDecrypt = {
  encryptedFor: string[];
  signedBy: string[];
  prvMatching: KeyInfoWithIdentityAndOptionalPp[];
  prvForDecrypt: KeyInfoWithIdentityAndOptionalPp[];
  prvForDecryptDecrypted: { ki: KeyInfoWithIdentityAndOptionalPp; decrypted: Key }[];
  prvForDecryptWithoutPassphrases: KeyInfoWithIdentity[];
};

export type DecryptSuccess = {
  success: true;
  signature?: VerifyRes;
  isCleartext: boolean;
  isEncrypted: boolean;
  filename?: string;
  content: Buf;
};
type DecryptError$error = { type: DecryptErrTypes; message: string };
type DecryptError$longids = { message: string[]; matching: string[]; chosen: string[]; needPassphrase: string[] };
export type DecryptError = {
  success: false;
  error: DecryptError$error;
  longids: DecryptError$longids;
  content?: Buf;
  isEncrypted?: boolean;
};

export type VerifyRes = {
  signerLongids: string[]; // signers longids from the message
  suppliedLongids: string[]; // longids from keys supplied to verify the message
  match: boolean | null; // we can return some pubkey information here
  error?: string;
  isErrFatal?: boolean;
  content?: Buf;
};
export type PgpMsgTypeResult = { armored: boolean; type: ReplaceableMsgBlockType } | undefined;
export type DecryptResult = DecryptSuccess | DecryptError;
export type DiagnoseMsgPubkeysResult = { found_match: boolean; receivers: number }; // eslint-disable-line @typescript-eslint/naming-convention
export enum DecryptErrTypes {
  keyMismatch = 'key_mismatch',
  usePassword = 'use_password',
  wrongPwd = 'wrong_password',
  noMdc = 'no_mdc',
  badMdc = 'bad_mdc',
  needPassphrase = 'need_passphrase',
  format = 'format',
  armorChecksumFailed = 'armor_checksum_failed',
  other = 'other',
}

export class MsgUtil {
  public static type: PgpMsgMethod.Type = ({ data }) => {
    if (!data?.length) {
      return undefined;
    }
    const firstByte = data[0];
    // attempt to understand this as a binary PGP packet: https://tools.ietf.org/html/rfc4880#section-4.2
    if ((firstByte & 0b10000000) === 0b10000000) {
      // 1XXX XXXX - potential pgp packet tag
      let tagNumber = 0; // zero is a forbidden tag number
      if ((firstByte & 0b11000000) === 0b11000000) {
        // 11XX XXXX - potential new pgp packet tag
        tagNumber = firstByte & 0b00111111; // 11TTTTTT where T is tag number bit
      } else {
        // 10XX XXXX - potential old pgp packet tag
        tagNumber = (firstByte & 0b00111100) / 4; // 10TTTTLL where T is tag number bit. Division by 4 in place of two bit shifts. I hate bit shifts.
      }
      if (Object.values(opgp.enums.packet).includes(tagNumber)) {
        // Indeed a valid OpenPGP packet tag number
        // This does not 100% mean it's OpenPGP message
        // But it's a good indication that it may be
        const t = opgp.enums.packet;
        const msgTypes = [
          t.publicKeyEncryptedSessionKey,
          t.symEncryptedIntegrityProtectedData,
          t.modificationDetectionCode,
          t.aeadEncryptedData,
          t.symmetricallyEncryptedData,
          t.compressedData,
        ];
        return { armored: false, type: msgTypes.includes(tagNumber) ? 'encryptedMsg' : 'publicKey' };
      }
    }
    const fiftyBytesUtf = new Buf(data.slice(0, 50)).toUtfStr().trim();
    const armorTypes: ReplaceableMsgBlockType[] = ['encryptedMsg', 'privateKey', 'publicKey', 'signedMsg'];
    for (const type of armorTypes) {
      if (fiftyBytesUtf.includes(PgpArmor.headers(type).begin)) {
        return { armored: true, type };
      }
    }
    return undefined;
  };

  /**
   * Returns signed data if detached=false, armored
   * Returns signature if detached=true, armored
   */
  public static async sign(signingPrivate: Key, data: string, detached = false): Promise<string> {
    // TODO: Delegate to appropriate key type
    return await OpenPGPKey.sign(signingPrivate, data, detached);
  }

  public static async verifyDetached({ plaintext, sigText, verificationPubs }: PgpMsgMethod.Arg.VerifyDetached) {
    const message = await opgp.createMessage({ text: Str.with(plaintext) });
    try {
      await message.appendSignature(sigText);
    } catch (formatErr) {
      return {
        match: null, // eslint-disable-line no-null/no-null
        signerLongids: [],
        suppliedLongids: [],
        error: String(formatErr).replace('Error: ', ''),
        isErrFatal: true,
      };
    }
    return await OpenPGPKey.verify(message, await ContactStore.getPubkeyInfos(undefined, verificationPubs));
  }

  public static async decryptMessage({ kisWithPp, encryptedData, msgPwd, verificationPubs }: PgpMsgMethod.Arg.Decrypt): Promise<DecryptResult> {
    const longids: DecryptError$longids = { message: [], matching: [], chosen: [], needPassphrase: [] };
    let prepared: PreparedForDecrypt;
    try {
      prepared = await PgpArmor.cryptoMsgPrepareForDecrypt(encryptedData);
    } catch (formatErr) {
      return { success: false, error: MsgUtil.cryptoMsgDecryptCategorizeErr(formatErr), longids };
    }
    // there are 3 types of messages possible at this point
    // 1. PKCS#7 if isPkcs7 is true
    // 2. OpenPGP cleartext message if isCleartext is true
    // 3. Other types of OpenPGP message
    // Hence isCleartext and isPkcs7 are mutually exclusive
    const isCleartext = prepared.isCleartext;
    if (isCleartext) {
      const signature = await OpenPGPKey.verify(prepared.message, await ContactStore.getPubkeyInfos(undefined, verificationPubs));
      const content = signature.content || Buf.fromUtfStr('no content');
      signature.content = undefined; // no need to duplicate data
      return { success: true, content, isEncrypted: false, isCleartext, signature };
    }
    const isEncrypted = true;
    const keys = prepared.isPkcs7 ? await MsgUtil.getSmimeKeys(kisWithPp, prepared.message) : await MsgUtil.getSortedKeys(kisWithPp, prepared.message);
    longids.message = keys.encryptedFor;
    longids.matching = keys.prvForDecrypt.map(ki => ki.longid);
    longids.chosen = keys.prvForDecryptDecrypted.map(decrypted => decrypted.ki.longid);
    longids.needPassphrase = keys.prvForDecryptWithoutPassphrases.map(ki => ki.longid);
    if (!keys.prvForDecryptDecrypted.length && (!msgPwd || prepared.isPkcs7)) {
      return {
        success: false,
        error: { type: DecryptErrTypes.needPassphrase, message: 'Missing pass phrase' },
        longids,
        isEncrypted,
      };
    }
    try {
      if (prepared.isPkcs7) {
        const decrypted = SmimeKey.decryptMessage(prepared.message, keys.prvForDecryptDecrypted[0].decrypted);
        return { success: true, content: new Buf(decrypted), isEncrypted, isCleartext };
      }
      // cleartext and PKCS#7 are gone by this line
      const msg = prepared.message;
      const packets = msg.packets;
      const isSymEncrypted = packets.filter(p => p instanceof opgp.SymEncryptedSessionKeyPacket).length > 0;
      const isPubEncrypted = packets.filter(p => p instanceof opgp.PublicKeyEncryptedSessionKeyPacket).length > 0;
      if (isSymEncrypted && !isPubEncrypted && !msgPwd) {
        return {
          success: false,
          error: { type: DecryptErrTypes.usePassword, message: 'Use message password' },
          longids,
          isEncrypted,
        };
      }
      const passwords = msgPwd ? [msgPwd] : undefined;
      const privateKeys = keys.prvForDecryptDecrypted.map(decrypted => decrypted.decrypted);
      const decrypted = await OpenPGPKey.decryptMessage(msg, privateKeys, passwords);
      const signature = await OpenPGPKey.verify(decrypted, await ContactStore.getPubkeyInfos(undefined, verificationPubs));
      let content: Buf | undefined;
      if (signature?.content) {
        content = signature.content;
        signature.content = undefined; // will pass "content" on the response object, don't need it duplicated
      } else {
        const literalData = decrypted.getLiteralData();
        if (literalData) {
          content = Buf.with(await Stream.readToEnd(literalData));
        }
      }
      if (!content) {
        // should never happen, but I suppose it's better than using content!
        return {
          success: false,
          error: {
            type: DecryptErrTypes.other,
            message: 'unexpectedly missing content',
          },
          longids,
          isEncrypted,
        };
      }
      if (msg.packets.filterByTag(opgp.enums.packet.symmetricallyEncryptedData).length) {
        const noMdc =
          'Security threat!\n\nMessage is missing integrity checks (MDC). ' +
          ' The sender should update their outdated software.\n\nDisplay the message at your own risk.';
        return {
          success: false,
          content,
          error: { type: DecryptErrTypes.noMdc, message: noMdc },
          longids,
          isEncrypted,
        };
      }
      return { success: true, content, isEncrypted, isCleartext, filename: decrypted.getFilename() || undefined, signature };
    } catch (e) {
      return { success: false, error: MsgUtil.cryptoMsgDecryptCategorizeErr(e, msgPwd), longids, isEncrypted };
    }
  }

  public static async encryptMessage({ pubkeys, signingPrv, pwd, data, filename, armor, date }: PgpMsgMethod.Arg.Encrypt): Promise<PgpMsgMethod.EncryptResult> {
    const keyFamilies = new Set(pubkeys.map(k => k.family));
    if (keyFamilies.has('openpgp') && keyFamilies.has('x509')) {
      throw new Error('Mixed key families are not allowed: ' + [...keyFamilies]);
    }
    const input = { pubkeys, signingPrv, pwd, data, filename, armor, date };
    if (keyFamilies.has('x509')) {
      return await SmimeKey.encryptMessage(input);
    }
    return await OpenPGPKey.encryptMessage(input);
  }

  public static async diagnosePubkeys({ armoredPubs, message }: PgpMsgMethod.Arg.DiagnosePubkeys) {
    const m = await opgp.readMessage({ armoredMessage: Str.with(message) });
    const msgKeyIds = m.getEncryptionKeyIDs();
    const localKeyIds: string[] = [];
    for (const k of await Promise.all(armoredPubs.map(pub => KeyUtil.parse(pub)))) {
      localKeyIds.push(...KeyUtil.getPubkeyLongids(k));
    }
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const diagnosis = { found_match: false, receivers: msgKeyIds.length };
    for (const msgKeyId of msgKeyIds) {
      for (const localKeyId of localKeyIds) {
        if (msgKeyId.bytes === localKeyId) {
          diagnosis.found_match = true;
          return diagnosis;
        }
      }
    }
    return diagnosis;
  }

  public static isPasswordMessageEnabled(subject: string, disallowTerms: string[]) {
    if (!subject || !Array.isArray(disallowTerms)) {
      return true; // If no subject or no terms to disallow, assume enabled
    }

    const lowerSubject = subject.toLowerCase();

    for (const term of disallowTerms) {
      // Escape term for regex
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use regex to ensure the term appears as a separate token
      // (^|\W) ensures the term is at start or preceded by non-word char
      // (\W|$) ensures the term is followed by non-word char or end
      const regex = new RegExp(`(^|\\W)${escapedTerm}(\\W|$)`, 'i');

      if (regex.test(lowerSubject)) {
        // Found a disallowed term as a separate token
        return false;
      }
    }

    // No disallowed terms found as exact matches
    return true;
  }

  private static async getSortedKeys(kiWithPp: KeyInfoWithIdentityAndOptionalPp[], msg: OpenPGP.Message<OpenPGP.Data>): Promise<SortedKeysForDecrypt> {
    const keys: SortedKeysForDecrypt = {
      encryptedFor: [],
      signedBy: [],
      prvMatching: [],
      prvForDecrypt: [],
      prvForDecryptDecrypted: [],
      prvForDecryptWithoutPassphrases: [],
    };
    const encryptionKeyids = msg.getEncryptionKeyIDs();
    keys.encryptedFor = encryptionKeyids.map(kid => OpenPGPKey.bytesToLongid(kid.bytes));
    if (keys.encryptedFor.length) {
      keys.prvMatching = kiWithPp.filter(ki => KeyUtil.getKeyInfoLongids(ki).some(longid => keys.encryptedFor.includes(longid)));
      keys.prvForDecrypt = keys.prvMatching.length ? keys.prvMatching : kiWithPp;
    } else {
      // prvs not needed for signed msgs
      keys.prvForDecrypt = [];
    }
    for (const ki of keys.prvForDecrypt) {
      const matchingKeyids = MsgUtil.matchingKeyids(KeyUtil.getKeyInfoLongids(ki), encryptionKeyids);
      const cachedKey = KeyCache.getDecrypted(ki.longid);
      if (cachedKey && (await MsgUtil.isKeyDecryptedFor(cachedKey, matchingKeyids))) {
        keys.prvForDecryptDecrypted.push({ ki, decrypted: cachedKey });
        continue;
      }
      const parsed = await KeyUtil.parse(ki.private);
      // todo - the `ki.passphrase || ''` used to be `ki.passphrase!` which could have actually allowed an undefined to be passed
      // as fixed currently it appears better, but it may be best to instead check `ki.passphrase && await MsgUtil.decryptKeyFor(...)`
      // but that is a larger change that would require separate PR and testing
      if ((await MsgUtil.isKeyDecryptedFor(parsed, matchingKeyids)) || (await MsgUtil.decryptKeyFor(parsed, ki.passphrase || '', matchingKeyids))) {
        KeyCache.setDecrypted(parsed);
        keys.prvForDecryptDecrypted.push({ ki, decrypted: parsed });
      } else {
        keys.prvForDecryptWithoutPassphrases.push(ki);
      }
    }
    return keys;
  }

  private static async getSmimeKeys(kiWithPp: KeyInfoWithIdentityAndOptionalPp[], msg: SmimeMsg): Promise<SortedKeysForDecrypt> {
    const keys: SortedKeysForDecrypt = {
      encryptedFor: [],
      signedBy: [],
      prvMatching: [],
      prvForDecrypt: [],
      prvForDecryptDecrypted: [],
      prvForDecryptWithoutPassphrases: [],
    };
    keys.encryptedFor = SmimeKey.getMessageLongids(msg);
    if (keys.encryptedFor.length) {
      keys.prvMatching = kiWithPp.filter(ki => KeyUtil.getKeyInfoLongids(ki).some(longid => keys.encryptedFor.includes(longid)));
      keys.prvForDecrypt = keys.prvMatching.length ? keys.prvMatching : kiWithPp;
    } else {
      // prvs not needed for signed msgs
      keys.prvForDecrypt = [];
    }
    for (const ki of keys.prvForDecrypt) {
      const cachedKey = KeyCache.getDecrypted(ki.longid);
      if (cachedKey) {
        keys.prvForDecryptDecrypted.push({ ki, decrypted: cachedKey });
        continue;
      }
      const parsed = await KeyUtil.parse(ki.private);
      if (parsed.fullyDecrypted || (ki.passphrase && (await SmimeKey.decryptKey(parsed, ki.passphrase)))) {
        KeyCache.setDecrypted(parsed);
        keys.prvForDecryptDecrypted.push({ ki, decrypted: parsed });
      } else {
        keys.prvForDecryptWithoutPassphrases.push(ki);
      }
    }
    return keys;
  }

  private static matchingKeyids(longids: string[], encryptedForKeyids: OpenPGP.KeyID[]): OpenPGP.KeyID[] {
    return encryptedForKeyids.filter(kid => longids.includes(OpenPGPKey.bytesToLongid(kid.bytes)));
  }

  private static async decryptKeyFor(prv: Key, passphrase: string, matchingKeyIds: OpenPGP.KeyID[]): Promise<boolean> {
    if (!matchingKeyIds.length) {
      // we don't know which keyids match, decrypt all key packets
      return await KeyUtil.decrypt(prv, passphrase, undefined, 'OK-IF-ALREADY-DECRYPTED');
    }
    for (const matchingKeyId of matchingKeyIds) {
      // we know which keyids match, decrypt only matching key packets
      if (!(await KeyUtil.decrypt(prv, passphrase, matchingKeyId, 'OK-IF-ALREADY-DECRYPTED'))) {
        return false; // failed to decrypt a particular needed key packet
      }
    }
    return true;
  }

  private static async isKeyDecryptedFor(prv: Key, msgKeyIds: OpenPGP.KeyID[]): Promise<boolean> {
    if (prv.fullyDecrypted) {
      return true; // primary k + all subkeys decrypted, therefore it must be decrypted for any/every particular keyid
    }
    if (prv.fullyEncrypted) {
      return false; // not decrypted at all
    }
    if (!msgKeyIds.length) {
      return false; // we don't know which keyId to decrypt - must decrypt all (but key is only partially decrypted)
    }
    return (await Promise.all(msgKeyIds.map(kid => OpenPGPKey.isPacketDecrypted(prv, kid)))).every(Boolean); // test if all needed key packets are decrypted
  }

  private static cryptoMsgDecryptCategorizeErr(decryptErr: unknown, msgPwd?: string): DecryptError$error {
    const e = String(decryptErr).replace('Error: ', '').replace('Error decrypting message: ', '');
    const keyMismatchErrStrings = [
      "Cannot read property 'isDecrypted' of null",
      'privateKeyPacket is null',
      'TypeprivateKeyPacket is null',
      'Session key decryption failed.',
      'Invalid session key for decryption.',
    ];
    if (keyMismatchErrStrings.includes(e) && !msgPwd) {
      return { type: DecryptErrTypes.keyMismatch, message: e };
    } else if (msgPwd && ['Invalid enum value.', 'CFB decrypt: invalid key', 'Session key decryption failed.'].includes(e)) {
      return { type: DecryptErrTypes.wrongPwd, message: e };
    } else if (e === 'Decryption failed due to missing MDC in combination with modern cipher.' || e === 'Decryption failed due to missing MDC.') {
      return { type: DecryptErrTypes.noMdc, message: e };
    } else if (e === 'Decryption error') {
      return { type: DecryptErrTypes.format, message: e };
    } else if (e === 'Modification detected.') {
      return {
        type: DecryptErrTypes.badMdc,
        message: `Security threat - opening this message is dangerous because it was modified in transit.`,
      };
    } else if (e === 'Ascii armor integrity check failed') {
      return {
        type: DecryptErrTypes.armorChecksumFailed,
        message: e,
      };
    } else {
      return { type: DecryptErrTypes.other, message: e };
    }
  }
}
