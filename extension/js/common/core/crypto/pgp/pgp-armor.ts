/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// todo: move this file level up as it handles both S/MIME and OpenPGP?
import * as forge from 'node-forge';
import { Buf } from '../../buf.js';
import { ReplaceableMsgBlockType } from '../../msg-block.js';
import { Str } from '../../common.js';
import { opgp } from './openpgpjs-custom.js';
import { Stream } from '../../stream.js';
import { SmimeKey, ENVELOPED_DATA_OID } from '../smime/smime-key.js';

export type PreparedForDecrypt = { isArmored: boolean, isCleartext: true, isPkcs7: false, message: OpenPGP.cleartext.CleartextMessage | OpenPGP.message.Message }
  | { isArmored: boolean, isCleartext: false, isPkcs7: false, message: OpenPGP.message.Message }
  | { isArmored: boolean, isCleartext: false, isPkcs7: true, message: forge.pkcs7.PkcsEnvelopedData }
  ;

type CryptoArmorHeaderDefinitions = { readonly [type in ReplaceableMsgBlockType | 'null' | 'signature']: CryptoArmorHeaderDefinition; };
type CryptoArmorHeaderDefinition = { begin: string, middle?: string, end: string | RegExp, replace: boolean };

export class PgpArmor {

  public static ARMOR_HEADER_DICT: CryptoArmorHeaderDefinitions = { // general passwordMsg begin: /^[^\n]+: (Open Message|Nachricht öffnen)/
    null: { begin: '-----BEGIN', end: '-----END', replace: false },
    publicKey: { begin: '-----BEGIN PGP PUBLIC KEY BLOCK-----', end: '-----END PGP PUBLIC KEY BLOCK-----', replace: true },
    privateKey: { begin: '-----BEGIN PGP PRIVATE KEY BLOCK-----', end: '-----END PGP PRIVATE KEY BLOCK-----', replace: true },
    pkcs12: { begin: '-----BEGIN PKCS12 FILE-----', end: '-----END PKCS12 FILE-----', replace: true }, // custom format - Base64 dump of pkcs12 file bytes
    pkcs7: { begin: '-----BEGIN PKCS7-----', end: '-----END PKCS7-----', replace: true }, // PEM-formatted pkcs7 message
    pkcs8EncryptedPrivateKey: { begin: '-----BEGIN ENCRYPTED PRIVATE KEY-----', end: '-----END ENCRYPTED PRIVATE KEY-----', replace: true },
    pkcs8PrivateKey: { begin: '-----BEGIN PRIVATE KEY-----', end: '-----END PRIVATE KEY-----', replace: true },
    pkcs8RsaPrivateKey: { begin: '-----BEGIN RSA PRIVATE KEY-----', end: '-----END RSA PRIVATE KEY-----', replace: true },
    certificate: { begin: '-----BEGIN CERTIFICATE-----', end: '-----END CERTIFICATE-----', replace: true },
    signedMsg: { begin: '-----BEGIN PGP SIGNED MESSAGE-----', middle: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: true },
    signature: { begin: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: false },
    encryptedMsg: { begin: '-----BEGIN PGP MESSAGE-----', end: '-----END PGP MESSAGE-----', replace: true },
  };

  public static clip = (text: string): string | undefined => {
    if (text?.includes(PgpArmor.ARMOR_HEADER_DICT.null.begin) && text.includes(String(PgpArmor.ARMOR_HEADER_DICT.null.end))) {
      const match = text.match(/(-----BEGIN PGP (MESSAGE|SIGNED MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----[^]+-----END PGP (MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----)/gm);
      return (match && match.length) ? match[0] : undefined;
    }
    return undefined;
  };

  public static headers = (blockType: ReplaceableMsgBlockType | 'null', format = 'string'): CryptoArmorHeaderDefinition => {
    const h = PgpArmor.ARMOR_HEADER_DICT[blockType];
    return {
      begin: (typeof h.begin === 'string' && format === 're') ? h.begin.replace(/ /g, '\\s') : h.begin,
      end: (typeof h.end === 'string' && format === 're') ? h.end.replace(/ /g, '\\s') : h.end,
      replace: h.replace,
    };
  };

  public static normalize = (armored: string, type: ReplaceableMsgBlockType | 'key') => {
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
    const h = PgpArmor.headers(type === 'key' ? 'null' : type);
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
  };

  public static cryptoMsgPrepareForDecrypt = async (encrypted: Uint8Array): Promise<PreparedForDecrypt> => {
    if (!encrypted.length) {
      throw new Error('Encrypted message could not be parsed because no data was provided');
    }
    const utfChunk = new Buf(encrypted.slice(0, 100)).toUtfStr('ignore'); // ignore errors - this may not be utf string, just testing
    if (utfChunk.includes(PgpArmor.headers('pkcs7').begin)) {
      const p7 = SmimeKey.readArmoredPkcs7Message(encrypted);
      if (p7.type !== ENVELOPED_DATA_OID) {
        throw new Error('Not implemented');
      }
      return { isArmored: true, isCleartext: false, isPkcs7: true, message: p7 };
    }
    const isArmoredEncrypted = utfChunk.includes(PgpArmor.headers('encryptedMsg').begin);
    const isArmoredSignedOnly = utfChunk.includes(PgpArmor.headers('signedMsg').begin);
    const isArmored = isArmoredEncrypted || isArmoredSignedOnly;
    if (isArmoredSignedOnly) {
      return { isArmored, isCleartext: true, isPkcs7: false, message: await opgp.cleartext.readArmored(new Buf(encrypted).toUtfStr()) };
    } else if (isArmoredEncrypted) {
      const message = await opgp.message.readArmored(new Buf(encrypted).toUtfStr());
      const isCleartext = !!message.getLiteralData() && !!message.getSigningKeyIds().length && !message.getEncryptionKeyIds().length;
      return { isArmored: true, isCleartext, isPkcs7: false, message };
    } else if (encrypted instanceof Uint8Array) {
      return { isArmored, isCleartext: false, isPkcs7: false, message: await opgp.message.read(encrypted) };
    }
    throw new Error('Message does not have armor headers');
  };

  public static dearmor = async (text: string): Promise<{ type: OpenPGP.enums.armor, data: Uint8Array }> => {
    const decoded = await opgp.armor.decode(text);
    const data = await Stream.readToEnd(decoded.data);
    return { type: decoded.type, data };
  };

  public static armor = (messagetype: OpenPGP.enums.armor, body: object, partindex?: number, parttotal?: number, customComment?: string): string => {
    return opgp.armor.encode(messagetype, body, partindex, parttotal, customComment);
  };
}
