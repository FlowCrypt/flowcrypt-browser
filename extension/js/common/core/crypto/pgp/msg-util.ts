/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';
import { Contact, Key, KeyInfo, KeyInfoWithOptionalPp, KeyUtil } from '../key.js';
import { MsgBlockType, ReplaceableMsgBlockType } from '../../msg-block.js';
import { Value } from '../../common.js';
import { Buf } from '../../buf.js';
import { Catch } from '../../../platform/catch.js';
import { PgpArmor, PreparedForDecrypt } from './pgp-armor.js';
import { opgp } from './openpgpjs-custom.js';
import { KeyCache } from '../../../platform/key-cache.js';
import { ContactStore } from '../../../platform/store/contact-store.js';
import { SmimeKey } from '../smime/smime-key.js';
import { OpenPGPKey } from './openpgp-key.js';

export class DecryptionError extends Error {
  public decryptError: DecryptError;

  constructor(decryptError: DecryptError) {
    super(decryptError.error.message);
    this.decryptError = decryptError;
  }
}

export namespace PgpMsgMethod {
  export namespace Arg {
    export type Encrypt = { pubkeys: Key[], signingPrv?: Key, pwd?: string, data: Uint8Array, filename?: string, armor: boolean, date?: Date };
    export type Type = { data: Uint8Array | string };
    export type Decrypt = { kisWithPp: KeyInfoWithOptionalPp[], encryptedData: Uint8Array, msgPwd?: string };
    export type DiagnosePubkeys = { armoredPubs: string[], message: Uint8Array };
    export type VerifyDetached = { plaintext: Uint8Array, sigText: Uint8Array };
  }
  export type DiagnosePubkeys = (arg: Arg.DiagnosePubkeys) => Promise<DiagnoseMsgPubkeysResult>;
  export type VerifyDetached = (arg: Arg.VerifyDetached) => Promise<VerifyRes>;
  export type Decrypt = (arg: Arg.Decrypt) => Promise<DecryptSuccess | DecryptError>;
  export type Type = (arg: Arg.Type) => Promise<PgpMsgTypeResult>;
  export type Encrypt = (arg: Arg.Encrypt) => Promise<EncryptPgpResult | EncryptX509Result>;
  export type EncryptPgpResult = EncryptPgpArmorResult | OpenPGP.EncryptBinaryResult;
  export type EncryptAnyArmorResult = PgpMsgMethod.EncryptPgpArmorResult | EncryptX509Result;
  export interface EncryptPgpArmorResult {
    data: Uint8Array;
    signature?: string;
    type: 'openpgp';
  }
  export type EncryptX509Result = {
    data: Uint8Array;
    type: 'smime';
  };
}

type SortedKeysForDecrypt = {
  verificationContacts: Contact[];
  forVerification: OpenPGP.key.Key[];
  encryptedFor: string[];
  signedBy: string[];
  prvMatching: KeyInfoWithOptionalPp[];
  prvForDecrypt: KeyInfoWithOptionalPp[];
  prvForDecryptDecrypted: { ki: KeyInfoWithOptionalPp, decrypted: Key }[];
  prvForDecryptWithoutPassphrases: KeyInfo[];
};

export type DecryptSuccess = { success: true; signature?: VerifyRes; isEncrypted?: boolean, filename?: string, content: Buf };
type DecryptError$error = { type: DecryptErrTypes; message: string; };
type DecryptError$longids = { message: string[]; matching: string[]; chosen: string[]; needPassphrase: string[]; };
export type DecryptError = {
  success: false; error: DecryptError$error; longids: DecryptError$longids; content?: Buf;
  isEncrypted?: boolean; message?: OpenPGP.message.Message | OpenPGP.cleartext.CleartextMessage;
};

type OpenpgpMsgOrCleartext = OpenPGP.message.Message | OpenPGP.cleartext.CleartextMessage;

export type VerifyRes = { signer?: { primaryUserId: string | undefined, longid: string }; contact?: Contact; match: boolean | null; error?: string; isErrFatal?: boolean, content?: Buf };
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

export class MsgUtil {

  public static type: PgpMsgMethod.Type = async ({ data }) => { // promisified because used through bg script
    if (!data || !data.length) {
      return undefined;
    }
    if (typeof data === 'string') {
      // Uint8Array sent over BrowserMsg gets converted to blobs on the sending side, and read on the receiving side
      // Firefox blocks such blobs from content scripts to background, see: https://github.com/FlowCrypt/flowcrypt-browser/issues/2587
      // that's why we add an option to send data as a base64 formatted string
      data = Buf.fromBase64Str(data);
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
      if (Object.values(opgp.enums.packet).includes(tagNumber)) {
        // Indeed a valid OpenPGP packet tag number
        // This does not 100% mean it's OpenPGP message
        // But it's a good indication that it may be
        const t = opgp.enums.packet;
        const msgTpes = [t.symEncryptedIntegrityProtected, t.modificationDetectionCode, t.symEncryptedAEADProtected, t.symmetricallyEncrypted, t.compressed];
        return { armored: false, type: msgTpes.includes(tagNumber) ? 'encryptedMsg' : 'publicKey' };
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
  }

  /**
   * Returns signed data if detached=false, armored
   * Returns signature if detached=true, armored
   */
  public static sign = async (signingPrivate: Key, data: string, detached = false): Promise<string> => {
    // TODO: Delegate to appropriate key type
    return await OpenPGPKey.sign(signingPrivate, data, detached);
  }

  public static verify = async (msg: OpenpgpMsgOrCleartext, pubs: OpenPGP.key.Key[], contact?: Contact): Promise<VerifyRes> => {
    const verifyRes: VerifyRes = { contact, match: null }; // tslint:disable-line:no-null-keyword
    try {
      // this is here to ensure execution order when 1) verify, 2) read data, 3) processing signatures
      // Else it will hang trying to read a stream: https://github.com/openpgpjs/openpgpjs/issues/916#issuecomment-510620625
      const verifications = await msg.verify(pubs); // first step
      const stream = msg instanceof opgp.message.Message ? msg.getLiteralData() : msg.getText();
      if (stream) { // encrypted message
        const data = await opgp.stream.readToEnd(stream); // second step
        verifyRes.content = data instanceof Uint8Array ? new Buf(data) : Buf.fromUtfStr(data);
      }
      // third step below
      for (const verification of verifications) {
        // todo - a valid signature is a valid signature, and should be surfaced. Currently, if any of the signatures are not valid, it's showing all as invalid
        // .. as it is now this could allow an attacker to append bogus signatures to validly signed messages, making otherwise correct messages seem incorrect
        // .. which is not really an issue - an attacker that can append signatures could have also just slightly changed the message, causing the same experience
        // .. so for now #wontfix unless a reasonable usecase surfaces
        verifyRes.match = (verifyRes.match === true || verifyRes.match === null) && await verification.verified;
        if (!verifyRes.signer) {
          // todo - currently only the first signer will be reported. Should we be showing all signers? How common is that?
          verifyRes.signer = {
            longid: OpenPGPKey.bytesToLongid(verification.keyid.bytes),
            primaryUserId: await OpenPGPKey.getPrimaryUserId(pubs, verification.keyid)
          };
        }
      }
    } catch (verifyErr) {
      verifyRes.match = null; // tslint:disable-line:no-null-keyword
      if (verifyErr instanceof Error && verifyErr.message === 'Can only verify message with one literal data packet.') {
        verifyRes.error = 'FlowCrypt is not equipped to verify this message';
        verifyRes.isErrFatal = true; // don't try to re-fetch the message from API
      } else if (verifyErr instanceof Error && verifyErr.message.startsWith('Insecure message hash algorithm:')) {
        verifyRes.error = `Could not verify message: ${verifyErr.message}. Sender is using old, insecure OpenPGP software.`;
        verifyRes.isErrFatal = true; // don't try to re-fetch the message from API
      } else if (verifyErr instanceof Error && verifyErr.message === 'Signature is expired') {
        verifyRes.error = verifyErr.message;
        verifyRes.isErrFatal = true; // don't try to re-fetch the message from API
      } else if (verifyErr instanceof Error && verifyErr.message === 'Message digest did not match') {
        verifyRes.error = verifyErr.message;
      } else {
        verifyRes.error = `Error verifying this message: ${String(verifyErr)}`;
        Catch.reportErr(verifyErr);
      }
    }
    return verifyRes;
  }

  public static verifyDetached: PgpMsgMethod.VerifyDetached = async ({ plaintext, sigText }) => {
    const message = opgp.message.fromText(Buf.fromUint8(plaintext).toUtfStr());
    await message.appendSignature(Buf.fromUint8(sigText).toUtfStr());
    const keys = await MsgUtil.getSortedKeys([], message);
    return await MsgUtil.verify(message, keys.forVerification, keys.verificationContacts[0]);
  }

  public static decryptMessage: PgpMsgMethod.Decrypt = async ({ kisWithPp, encryptedData, msgPwd }) => {
    const longids: DecryptError$longids = { message: [], matching: [], chosen: [], needPassphrase: [] };
    let prepared: PreparedForDecrypt;
    try {
      prepared = await PgpArmor.cryptoMsgPrepareForDecrypt(encryptedData);
    } catch (formatErr) {
      return { success: false, error: { type: DecryptErrTypes.format, message: String(formatErr) }, longids };
    }
    const keys = await MsgUtil.getSortedKeys(kisWithPp, prepared.message);
    longids.message = keys.encryptedFor;
    longids.matching = keys.prvForDecrypt.map(ki => ki.longid);
    longids.chosen = keys.prvForDecryptDecrypted.map(decrypted => decrypted.ki.longid);
    longids.needPassphrase = keys.prvForDecryptWithoutPassphrases.map(ki => ki.longid);
    const isEncrypted = !prepared.isCleartext;
    if (!isEncrypted) {
      const signature = await MsgUtil.verify(prepared.message, keys.forVerification, keys.verificationContacts[0]);
      const content = signature.content || Buf.fromUtfStr('no content');
      signature.content = undefined; // no need to duplicate data
      return { success: true, content, isEncrypted, signature };
    }
    if (!keys.prvForDecryptDecrypted.length && !msgPwd) {
      return { success: false, error: { type: DecryptErrTypes.needPassphrase, message: 'Missing pass phrase' }, message: prepared.message, longids, isEncrypted };
    }
    try {
      const packets = (prepared.message as OpenPGP.message.Message).packets;
      const isSymEncrypted = packets.filter(p => p.tag === opgp.enums.packet.symEncryptedSessionKey).length > 0;
      const isPubEncrypted = packets.filter(p => p.tag === opgp.enums.packet.publicKeyEncryptedSessionKey).length > 0;
      if (isSymEncrypted && !isPubEncrypted && !msgPwd) {
        return { success: false, error: { type: DecryptErrTypes.usePassword, message: 'Use message password' }, longids, isEncrypted };
      }
      const passwords = msgPwd ? [msgPwd] : undefined;
      const privateKeys = keys.prvForDecryptDecrypted.map(decrypted => decrypted.decrypted);
      const decrypted = await OpenPGPKey.decryptMessage(prepared.message as OpenPGP.message.Message, privateKeys, passwords);
      await MsgUtil.cryptoMsgGetSignedBy(decrypted, keys); // we can only figure out who signed the msg once it's decrypted
      const signature = keys.signedBy.length ? await MsgUtil.verify(decrypted, keys.forVerification, keys.verificationContacts[0]) : undefined;
      const content = signature?.content || new Buf(await opgp.stream.readToEnd(decrypted.getLiteralData()!));
      if (signature?.content) {
        signature.content = undefined; // already passed as "content" on the response object, don't need it duplicated
      }
      if (!prepared.isCleartext && (prepared.message as OpenPGP.message.Message).packets.filterByTag(opgp.enums.packet.symmetricallyEncrypted).length) {
        const noMdc = 'Security threat!\n\nMessage is missing integrity checks (MDC). The sender should update their outdated software.\n\nDisplay the message at your own risk.';
        return { success: false, content, error: { type: DecryptErrTypes.noMdc, message: noMdc }, message: prepared.message, longids, isEncrypted };
      }
      return { success: true, content, isEncrypted, filename: decrypted.getFilename() || undefined, signature };
    } catch (e) {
      return { success: false, error: MsgUtil.cryptoMsgDecryptCategorizeErr(e, msgPwd), message: prepared.message, longids, isEncrypted };
    }
  }

  public static encryptMessage: PgpMsgMethod.Encrypt = async ({ pubkeys, signingPrv, pwd, data, filename, armor, date }) => {
    const keyTypes = new Set(pubkeys.map(k => k.type));
    if (keyTypes.has('openpgp') && keyTypes.has('x509')) {
      throw new Error('Mixed key types are not allowed: ' + [...keyTypes]);
    }
    const input = { pubkeys, signingPrv, pwd, data, filename, armor, date };
    if (keyTypes.has('x509')) {
      return await SmimeKey.encryptMessage(input);
    }
    return await OpenPGPKey.encryptMessage(input);
  }

  public static diagnosePubkeys: PgpMsgMethod.DiagnosePubkeys = async ({ armoredPubs, message }) => {
    const m = await opgp.message.readArmored(Buf.fromUint8(message).toUtfStr());
    const msgKeyIds = m.getEncryptionKeyIds ? m.getEncryptionKeyIds() : [];
    const localKeyIds: string[] = [];
    for (const k of await Promise.all(armoredPubs.map(pub => KeyUtil.parse(pub)))) {
      localKeyIds.push(...k.allIds.map(id => OpenPGPKey.fingerprintToLongid(id)));
    }
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

  private static cryptoMsgGetSignedBy = async (msg: OpenpgpMsgOrCleartext, keys: SortedKeysForDecrypt) => {
    keys.signedBy = Value.arr.unique(msg.getSigningKeyIds ? msg.getSigningKeyIds().map(kid => OpenPGPKey.bytesToLongid(kid.bytes)) : []);
    if (keys.signedBy.length && typeof ContactStore.get === 'function') {
      const verificationContacts = await ContactStore.get(undefined, keys.signedBy);
      keys.verificationContacts = verificationContacts.filter(contact => contact && contact.pubkey) as Contact[];
      keys.forVerification = [];
      for (const contact of keys.verificationContacts) {
        const { keys: keysForVerification } = await opgp.key.readArmored(KeyUtil.armor(contact.pubkey!));
        keys.forVerification.push(...keysForVerification);
      }
    }
  }

  private static getSortedKeys = async (kiWithPp: KeyInfoWithOptionalPp[], msg: OpenpgpMsgOrCleartext): Promise<SortedKeysForDecrypt> => {
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
    const encryptionKeyids = msg instanceof opgp.message.Message ? (msg as OpenPGP.message.Message).getEncryptionKeyIds() : [];
    keys.encryptedFor = encryptionKeyids.map(kid => OpenPGPKey.bytesToLongid(kid.bytes));
    await MsgUtil.cryptoMsgGetSignedBy(msg, keys);
    if (keys.encryptedFor.length) {
      keys.prvMatching = kiWithPp.filter(ki => ki.fingerprints.some(
        fp => keys.encryptedFor.includes(OpenPGPKey.fingerprintToLongid(fp))));
      keys.prvForDecrypt = keys.prvMatching.length ? keys.prvMatching : kiWithPp;
    } else { // prvs not needed for signed msgs
      keys.prvForDecrypt = [];
    }
    for (const ki of keys.prvForDecrypt) {
      const matchingKeyids = MsgUtil.matchingKeyids(ki.fingerprints, encryptionKeyids);
      const cachedKey = KeyCache.getDecrypted(ki.longid);
      if (cachedKey && MsgUtil.isKeyDecryptedFor(cachedKey, matchingKeyids)) {
        keys.prvForDecryptDecrypted.push({ ki, decrypted: cachedKey });
        continue;
      }
      const parsed = await KeyUtil.parse(ki.private);
      // todo - the `ki.passphrase || ''` used to be `ki.passphrase!` which could have actually allowed an undefined to be passed
      // as fixed currently it appears better, but it may be best to instead check `ki.passphrase && await MsgUtil.decryptKeyFor(...)`
      // but that is a larger change that would require separate PR and testing
      if (MsgUtil.isKeyDecryptedFor(parsed, matchingKeyids) || await MsgUtil.decryptKeyFor(parsed, ki.passphrase || '', matchingKeyids) === true) {
        KeyCache.setDecrypted(parsed);
        keys.prvForDecryptDecrypted.push({ ki, decrypted: parsed });
      } else {
        keys.prvForDecryptWithoutPassphrases.push(ki);
      }
    }
    return keys;
  }

  private static matchingKeyids = (fingerprints: string[], encryptedForKeyids: OpenPGP.Keyid[]): OpenPGP.Keyid[] => {
    const allKeyLongids = fingerprints.map(fp => OpenPGPKey.fingerprintToLongid(fp));
    return encryptedForKeyids.filter(kid => allKeyLongids.includes(OpenPGPKey.bytesToLongid(kid.bytes)));
  }

  private static decryptKeyFor = async (prv: Key, passphrase: string, matchingKeyIds: OpenPGP.Keyid[]): Promise<boolean> => {
    if (!matchingKeyIds.length) { // we don't know which keyids match, decrypt all key packets
      return await KeyUtil.decrypt(prv, passphrase, undefined, 'OK-IF-ALREADY-DECRYPTED');
    }
    for (const matchingKeyId of matchingKeyIds) { // we know which keyids match, decrypt only matching key packets
      if (! await KeyUtil.decrypt(prv, passphrase, matchingKeyId, 'OK-IF-ALREADY-DECRYPTED')) {
        return false; // failed to decrypt a particular needed key packet
      }
    }
    return true;
  }

  private static isKeyDecryptedFor = (prv: Key, msgKeyIds: OpenPGP.Keyid[]): boolean => {
    if (prv.fullyDecrypted) {
      return true; // primary k + all subkeys decrypted, therefore it must be decrypted for any/every particular keyid
    }
    if (prv.fullyEncrypted) {
      return false; // not decrypted at all
    }
    if (!msgKeyIds.length) {
      return false; // we don't know which keyId to decrypt - must decrypt all (but key is only partially decrypted)
    }
    return msgKeyIds.filter(kid => OpenPGPKey.isPacketDecrypted(prv, kid)).length === msgKeyIds.length; // test if all needed key packets are decrypted
  }

  private static cryptoMsgDecryptCategorizeErr = (decryptErr: any, msgPwd?: string): DecryptError$error => {
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
  }

}
