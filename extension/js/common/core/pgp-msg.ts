/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';
import { Contact, KeyInfo, PgpKey, PrvKeyInfo } from './pgp-key.js';
import { MsgBlockType, ReplaceableMsgBlockType } from './msg-block.js';
import { Value } from './common.js';
import { Buf } from './buf.js';
import { Catch } from '../platform/catch.js';
import { PgpArmor, PreparedForDecrypt } from './pgp-armor.js';
import { PgpHash } from './pgp-hash.js';
import { opgp } from './pgp.js';
import { KeyCache } from '../platform/key-cache.js';
import { ContactStore } from '../platform/store/contact-store.js';
import { encrypt as smimeEncrypt } from './smime.js';

export namespace PgpMsgMethod {
  export namespace Arg {
    export type Encrypt = { pubkeys: string[], signingPrv?: OpenPGP.key.Key, pwd?: string, data: Uint8Array, filename?: string, armor: boolean, date?: Date };
    export type Type = { data: Uint8Array | string };
    export type Decrypt = { kisWithPp: PrvKeyInfo[], encryptedData: Uint8Array, msgPwd?: string };
    export type DiagnosePubkeys = { privateKis: KeyInfo[], message: Uint8Array };
    export type VerifyDetached = { plaintext: Uint8Array, sigText: Uint8Array };
  }
  export type DiagnosePubkeys = (arg: Arg.DiagnosePubkeys) => Promise<DiagnoseMsgPubkeysResult>;
  export type VerifyDetached = (arg: Arg.VerifyDetached) => Promise<VerifyRes>;
  export type Decrypt = (arg: Arg.Decrypt) => Promise<DecryptSuccess | DecryptError>;
  export type Type = (arg: Arg.Type) => Promise<PgpMsgTypeResult>;
  export type Encrypt = (arg: Arg.Encrypt) => Promise<OpenPGPEncryptResult | X509EncryptResult>;
  export type OpenPGPEncryptResult = OpenPGPEncryptArmorResult | OpenPGP.EncryptBinaryResult;
  export interface OpenPGPEncryptArmorResult {
    data: Uint8Array;
    signature?: string;
    type: 'openpgp';
  }
  export type X509EncryptResult = {
    data: Uint8Array;
    type: 'smime';
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

type OpenpgpMsgOrCleartext = OpenPGP.message.Message | OpenPGP.cleartext.CleartextMessage;

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

export class PgpMsg {

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
  public static sign = async (signingPrv: OpenPGP.key.Key, data: string, detached = false): Promise<string> => {
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

  public static verify = async (msgOrVerResults: OpenpgpMsgOrCleartext | OpenPGP.message.Verification[], pubs: OpenPGP.key.Key[], contact?: Contact): Promise<VerifyRes> => {
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
          sig.signer = await PgpKey.longid(verifyRes.keyid.bytes);
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

  public static verifyDetached: PgpMsgMethod.VerifyDetached = async ({ plaintext, sigText }) => {
    const message = opgp.message.fromText(Buf.fromUint8(plaintext).toUtfStr());
    await message.appendSignature(Buf.fromUint8(sigText).toUtfStr());
    const keys = await PgpMsg.getSortedKeys([], message);
    return await PgpMsg.verify(message, keys.forVerification, keys.verificationContacts[0]);
  }

  public static decrypt: PgpMsgMethod.Decrypt = async ({ kisWithPp, encryptedData, msgPwd }) => {
    const longids: DecryptError$longids = { message: [], matching: [], chosen: [], needPassphrase: [] };
    let prepared: PreparedForDecrypt;
    try {
      prepared = await PgpArmor.cryptoMsgPrepareForDecrypt(encryptedData);
    } catch (formatErr) {
      return { success: false, error: { type: DecryptErrTypes.format, message: String(formatErr) }, longids };
    }
    const keys = await PgpMsg.getSortedKeys(kisWithPp, prepared.message);
    longids.message = keys.encryptedFor;
    longids.matching = keys.prvForDecrypt.map(ki => ki.longid);
    longids.chosen = keys.prvForDecryptDecrypted.map(ki => ki.longid);
    longids.needPassphrase = keys.prvForDecryptWithoutPassphrases.map(ki => ki.longid);
    const isEncrypted = !prepared.isCleartext;
    if (!isEncrypted) {
      const signature = await PgpMsg.verify(prepared.message, keys.forVerification, keys.verificationContacts[0]);
      const text = await opgp.stream.readToEnd(prepared.message.getText()!);
      return { success: true, content: Buf.fromUtfStr(text), isEncrypted, signature };
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
      const privateKeys = keys.prvForDecryptDecrypted.map(ki => ki.decrypted!);
      const decrypted = await (prepared.message as OpenPGP.message.Message).decrypt(privateKeys, passwords, undefined, false);
      await PgpMsg.cryptoMsgGetSignedBy(decrypted, keys); // we can only figure out who signed the msg once it's decrypted
      const verifyResults = keys.signedBy.length ? await decrypted.verify(keys.forVerification) : undefined; // verify first to prevent stream hang
      const content = new Buf(await opgp.stream.readToEnd(decrypted.getLiteralData()!)); // read content second to prevent stream hang
      const signature = verifyResults ? await PgpMsg.verify(verifyResults, [], keys.verificationContacts[0]) : undefined; // evaluate verify results third to prevent stream hang
      if (!prepared.isCleartext && (prepared.message as OpenPGP.message.Message).packets.filterByTag(opgp.enums.packet.symmetricallyEncrypted).length) {
        const noMdc = 'Security threat!\n\nMessage is missing integrity checks (MDC). The sender should update their outdated software.\n\nDisplay the message at your own risk.';
        return { success: false, content, error: { type: DecryptErrTypes.noMdc, message: noMdc }, message: prepared.message, longids, isEncrypted };
      }
      return { success: true, content, isEncrypted, filename: decrypted.getFilename() || undefined, signature };
    } catch (e) {
      return { success: false, error: PgpMsg.cryptoMsgDecryptCategorizeErr(e, msgPwd), message: prepared.message, longids, isEncrypted };
    }
  }

  public static encrypt: PgpMsgMethod.Encrypt = async ({ pubkeys, signingPrv, pwd, data, filename, armor, date }) => {
    // slice(1) filters first key that is always own OpenPGP key
    // in result if X.509 encryption is selected the e-mail author
    // cannot decrypt e-mails that they have sent
    const otherKeys = pubkeys.slice(1);
    // tslint:disable-next-line: no-unbound-method
    const keyTypes = new Set(otherKeys.map(PgpKey.getKeyType));
    if (keyTypes.size > 1) {
      throw new Error('Mixed key types are not allowed: ' + [...keyTypes]);
    }
    const keyType = keyTypes.keys().next().value;
    if (keyType === 'x509') {
      return smimeEncrypt(otherKeys, data);
    }
    const message = opgp.message.fromBinary(data, filename, date);
    const options: OpenPGP.EncryptOptions = { armor, message, date };
    let usedChallenge = false;
    if (pubkeys) {
      options.publicKeys = [];
      for (const armoredPubkey of pubkeys) {
        const { keys: publicKeys } = await opgp.key.readArmored(armoredPubkey);
        options.publicKeys.push(...publicKeys);
      }
    }
    if (pwd) {
      options.passwords = [await PgpHash.challengeAnswer(pwd)];
      usedChallenge = true;
    }
    if (!pubkeys && !usedChallenge) {
      throw new Error('no-pubkeys-no-challenge');
    }
    if (signingPrv && typeof signingPrv.isPrivate !== 'undefined' && signingPrv.isPrivate()) { // tslint:disable-line:no-unbound-method - only testing if exists
      options.privateKeys = [signingPrv];
    }
    const result: OpenPGP.EncryptBinaryResult | OpenPGP.EncryptArmorResult = await opgp.encrypt(options);
    if (typeof result.data === 'string') {
      return { data: Buf.fromUtfStr(result.data), signature: result.signature, type: 'openpgp' };
    } else {
      return result as unknown as OpenPGP.EncryptBinaryResult;
    }
  }

  public static diagnosePubkeys: PgpMsgMethod.DiagnosePubkeys = async ({ privateKis, message }) => {
    const m = await opgp.message.readArmored(Buf.fromUint8(message).toUtfStr());
    const msgKeyIds = m.getEncryptionKeyIds ? m.getEncryptionKeyIds() : [];
    const localKeyIds: OpenPGP.Keyid[] = [];
    for (const k of await Promise.all(privateKis.map(ki => PgpKey.read(ki.public)))) {
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

  private static cryptoMsgGetSignedBy = async (msg: OpenpgpMsgOrCleartext, keys: SortedKeysForDecrypt) => {
    keys.signedBy = Value.arr.unique(await PgpKey.longids(msg.getSigningKeyIds ? msg.getSigningKeyIds() : []));
    if (keys.signedBy.length && typeof ContactStore.get === 'function') {
      const verificationContacts = await ContactStore.get(undefined, keys.signedBy);
      keys.verificationContacts = verificationContacts.filter(contact => contact && contact.pubkey) as Contact[];
      keys.forVerification = [];
      for (const contact of keys.verificationContacts) {
        const { keys: keysForVerification } = await opgp.key.readArmored(contact.pubkey!);
        keys.forVerification.push(...keysForVerification);
      }
    }
  }

  private static getSortedKeys = async (kiWithPp: PrvKeyInfo[], msg: OpenpgpMsgOrCleartext): Promise<SortedKeysForDecrypt> => {
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
    const encryptedForKeyids = msg instanceof opgp.message.Message ? (msg as OpenPGP.message.Message).getEncryptionKeyIds() : [];
    keys.encryptedFor = await PgpKey.longids(encryptedForKeyids);
    await PgpMsg.cryptoMsgGetSignedBy(msg, keys);
    if (keys.encryptedFor.length) {
      for (const ki of kiWithPp) {
        ki.parsed = await PgpKey.read(ki.private); // todo
        // this is inefficient because we are doing unnecessary parsing of all keys here
        // better would be to compare to already stored KeyInfo, however KeyInfo currently only holds primary longid, not longids of subkeys
        // while messages are typically encrypted for subkeys, thus we have to parse the key to get the info
        // we are filtering here to avoid a significant performance issue of having to attempt decrypting with all keys simultaneously
        for (const longid of await Promise.all(ki.parsed.getKeyIds().map(({ bytes }) => PgpKey.longid(bytes)))) {
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
      const matchingKeyids = PgpMsg.matchingKeyids(ki.parsed!, encryptedForKeyids);
      const cachedKey = KeyCache.getDecrypted(ki.longid);
      if (cachedKey && PgpMsg.isKeyDecryptedFor(cachedKey, matchingKeyids)) {
        ki.decrypted = cachedKey;
        keys.prvForDecryptDecrypted.push(ki);
      } else if (PgpMsg.isKeyDecryptedFor(ki.parsed!, matchingKeyids) || await PgpMsg.decryptKeyFor(ki.parsed!, ki.passphrase!, matchingKeyids) === true) {
        KeyCache.setDecrypted(ki.parsed!);
        ki.decrypted = ki.parsed!;
        keys.prvForDecryptDecrypted.push(ki);
      } else {
        keys.prvForDecryptWithoutPassphrases.push(ki);
      }
    }
    return keys;
  }

  private static matchingKeyids = (key: OpenPGP.key.Key, encryptedFor: OpenPGP.Keyid[]): OpenPGP.Keyid[] => {
    const msgKeyidBytesArr = (encryptedFor || []).map(kid => kid.bytes);
    return key.getKeyIds().filter(kid => msgKeyidBytesArr.includes(kid.bytes));
  }

  private static decryptKeyFor = async (prv: OpenPGP.key.Key, passphrase: string, matchingKeyIds: OpenPGP.Keyid[]): Promise<boolean> => {
    if (!matchingKeyIds.length) { // we don't know which keyids match, decrypt all key packets
      return await PgpKey.decrypt(prv, passphrase, undefined, 'OK-IF-ALREADY-DECRYPTED');
    }
    for (const matchingKeyId of matchingKeyIds) { // we know which keyids match, decrypt only matching key packets
      if (! await PgpKey.decrypt(prv, passphrase, matchingKeyId, 'OK-IF-ALREADY-DECRYPTED')) {
        return false; // failed to decrypt a particular needed key packet
      }
    }
    return true;
  }

  private static isKeyDecryptedFor = (prv: OpenPGP.key.Key, msgKeyIds: OpenPGP.Keyid[]): boolean => {
    if (prv.isFullyDecrypted()) {
      return true; // primary k + all subkeys decrypted, therefore it must be decrypted for any/every particular keyid
    }
    if (prv.isFullyEncrypted()) {
      return false; // not decrypted at all
    }
    if (!msgKeyIds.length) {
      return false; // we don't know which keyId to decrypt - must decrypt all (but key is only partially decrypted)
    }
    return msgKeyIds.filter(kid => prv.isPacketDecrypted(kid)).length === msgKeyIds.length; // test if all needed key packets are decrypted
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
