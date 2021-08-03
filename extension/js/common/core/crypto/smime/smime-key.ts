/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import * as forge from 'node-forge';
import { Key } from '../key.js';
import { Str } from '../../common.js';
import { UnreportableError } from '../../../platform/catch.js';
import { PgpArmor } from '../pgp/pgp-armor.js';
import { Buf } from '../../buf.js';
import { MsgBlockParser } from '../../msg-block-parser.js';

export class SmimeKey {

  public static parse = (text: string): Key => {
    if (text.includes(PgpArmor.headers('certificate').begin)) {
      const blocks = MsgBlockParser.detectBlocks(text).blocks;
      const certificates = blocks.filter(b => b.type === 'certificate');
      if (certificates.length < 1) { // todo: should we select the correct certificate if a chain is provided?
        throw new Error('Could not parse S/MIME key without a certificate');
      }
      const privateKeys = blocks.filter(b => ['pkcs8EncryptedPrivateKey', 'pkcs8PrivateKey', 'pkcs8RsaPrivateKey'].includes(b.type));
      if (privateKeys.length > 1) {
        throw new Error('Could not parse S/MIME key with more than one private keys');
      }
      return SmimeKey.getKeyFromCertificate(certificates[0].content as string, privateKeys[0]?.content ?? undefined);
    } else if (text.includes(PgpArmor.headers('pkcs12').begin)) {
      const armoredBytes = text.replace(PgpArmor.headers('pkcs12').begin, '').replace(PgpArmor.headers('pkcs12').end, '').trim();
      const emptyPassPhrase = '';
      return SmimeKey.parseDecryptBinary(Buf.fromBase64Str(armoredBytes), emptyPassPhrase);
    } else {
      throw new Error('Could not parse S/MIME key without known headers');
    }
  }

  public static parseDecryptBinary = (buffer: Uint8Array, password: string): Key => {
    const bytes = String.fromCharCode.apply(undefined, new Uint8Array(buffer) as unknown as number[]) as string;
    const asn1 = forge.asn1.fromDer(bytes);
    let certificate: forge.pki.Certificate | undefined;
    try {
      // try to recognize a certificate
      certificate = forge.pki.certificateFromAsn1(asn1);
    } catch (e) {
      // fall back to p12
    }
    if (certificate) {
      return SmimeKey.getKeyFromCertificate(certificate, undefined);
    }
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    if (!certBags) {
      throw new Error('No user certificate found.');
    }
    const certBag = certBags[forge.pki.oids.certBag];
    if (!certBag) {
      throw new Error('No user certificate found.');
    }
    certificate = certBag[0]?.cert;
    if (!certificate) {
      throw new Error('No user certificate found.');
    }
    const keyBags = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [])
      .concat(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []);
    const privateKey = keyBags[0]?.key;
    return SmimeKey.getKeyFromCertificate(certificate, privateKey);
  }

  /**
   * @param data: an already encoded plain mime message
   */
  public static encryptMessage = async ({ pubkeys, data }: { pubkeys: Key[], data: Uint8Array }): Promise<{ data: Uint8Array, type: 'smime' }> => {
    const p7 = forge.pkcs7.createEnvelopedData();
    for (const pubkey of pubkeys) {
      const certificate = SmimeKey.getCertificate(pubkey);
      if (SmimeKey.isKeyWeak(certificate)) {
        throw new Error(`The key can't be used for encryption as it doesn't meet the strength requirements`);
      }
      p7.addRecipient(certificate);
    }
    p7.content = forge.util.createBuffer(data);
    p7.encrypt();
    const derBuffer = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const arr = [];
    for (let i = 0, j = derBuffer.length; i < j; ++i) {
      arr.push(derBuffer.charCodeAt(i));
    }
    return { data: new Uint8Array(arr), type: 'smime' };
  }

  public static decryptKey = async (key: Key, passphrase: string, optionalBehaviorFlag?: 'OK-IF-ALREADY-DECRYPTED'): Promise<boolean> => {
    if (!key.isPrivate) {
      throw new Error("Nothing to decrypt in a public key");
    }
    if (key.fullyDecrypted) {
      if (optionalBehaviorFlag === 'OK-IF-ALREADY-DECRYPTED') {
        return true;
      } else {
        throw new Error("Decryption failed - private key was already decrypted");
      }
    }
    const encryptedPrivateKey = SmimeKey.getArmoredPrivateKey(key);
    const privateKey = await forge.pki.decryptRsaPrivateKey(encryptedPrivateKey, passphrase); // throws on password mismatch
    if (privateKey) {
      SmimeKey.saveArmored(key, SmimeKey.getArmoredCertificate(key), privateKey);
      key.fullyDecrypted = true;
      key.fullyEncrypted = false;
      return true;
    }
    return false;
  }

  public static encryptKey = async (key: Key, passphrase: string) => {
    const armoredPrivateKey = SmimeKey.getArmoredPrivateKey(key);
    if (!armoredPrivateKey) {
      throw new Error(`No private key found to encrypt. Is this a private key?`);
    }
    if (!passphrase || passphrase === 'undefined' || passphrase === 'null') {
      throw new Error(`Encryption passphrase should not be empty:${typeof passphrase}:${passphrase}`);
    }
    const encryptedPrivateKey = forge.pki.encryptRsaPrivateKey(forge.pki.privateKeyFromPem(armoredPrivateKey), passphrase);
    if (!encryptedPrivateKey) {
      throw new Error('Failed to encrypt the private key.');
    }
    SmimeKey.saveArmored(key, SmimeKey.getArmoredCertificate(key), encryptedPrivateKey);
    key.fullyDecrypted = false;
    key.fullyEncrypted = true;
  }

  private static getNormalizedEmailsFromCertificate = (certificate: forge.pki.Certificate): string[] => {
    const emailFromSubject = (certificate.subject.getField('CN') as { value: string }).value;
    const normalizedEmail = Str.parseEmail(emailFromSubject).email;
    const emails = normalizedEmail ? [normalizedEmail] : [];
    // search for e-mails in subjectAltName extension
    const subjectAltName = certificate.getExtension('subjectAltName') as { altNames: { type: number, value: string }[] };
    if (subjectAltName && subjectAltName.altNames) {
      const emailsFromAltNames = subjectAltName.altNames.filter(entry => entry.type === 1).
        map(entry => Str.parseEmail(entry.value).email).filter(Boolean);
      emails.push(...emailsFromAltNames as string[]);
    }
    if (emails.length) {
      return emails.filter((value, index, self) => self.indexOf(value) === index);
    }
    throw new UnreportableError(`This S/MIME x.509 certificate has an invalid recipient email: ${emailFromSubject}`);
  }

  private static getKeyFromCertificate = (certificateOrText: forge.pki.Certificate | string, privateKey: forge.pki.PrivateKey | string | undefined): Key => {
    const certificate = (typeof certificateOrText === 'string') ? forge.pki.certificateFromPem(certificateOrText) : certificateOrText;
    if (!certificate.publicKey) {
      throw new UnreportableError(`This S/MIME x.509 certificate doesn't have a public key`);
    }
    let encrypted = false;
    if (typeof privateKey === 'string') {
      if (privateKey.includes((PgpArmor.headers('pkcs8EncryptedPrivateKey').begin))) {
        encrypted = true;
      } else {
        // test that we can read the unencrypted key
        const unencryptedKey = forge.pki.privateKeyFromPem(privateKey);
        // todo: catch exception?
        if (!unencryptedKey) {
          privateKey = undefined;
        }
      }
    }
    const fingerprint = forge.pki.getPublicKeyFingerprint(certificate.publicKey, { encoding: 'hex' }).toUpperCase();
    const emails = SmimeKey.getNormalizedEmailsFromCertificate(certificate);
    const issuerAndSerialNumberAsn1 =
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, [
        // Name
        forge.pki.distinguishedNameToAsn1(certificate.issuer),
        // Serial
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.INTEGER, false,
          forge.util.hexToBytes(certificate.serialNumber))
      ]);
    const expiration = SmimeKey.dateToNumber(certificate.validity.notAfter)!;
    const expired = expiration < Date.now();
    const usableIgnoringExpiration = SmimeKey.isEmailCertificate(certificate) && !SmimeKey.isKeyWeak(certificate);
    const key = {
      type: 'x509',
      id: fingerprint,
      allIds: [fingerprint],
      usableForEncryption: usableIgnoringExpiration && !expired,
      usableForSigning: usableIgnoringExpiration && !expired,
      usableForEncryptionButExpired: usableIgnoringExpiration && expired,
      usableForSigningButExpired: usableIgnoringExpiration && expired,
      emails,
      identities: emails,
      created: SmimeKey.dateToNumber(certificate.validity.notBefore),
      lastModified: SmimeKey.dateToNumber(certificate.validity.notBefore),
      expiration,
      fullyDecrypted: !encrypted,
      fullyEncrypted: encrypted,
      isPublic: !privateKey,
      isPrivate: !!privateKey,
      revoked: false,
      issuerAndSerialNumber: forge.asn1.toDer(issuerAndSerialNumberAsn1).getBytes()
    } as Key;
    SmimeKey.saveArmored(key, certificateOrText, privateKey);
    return key;
  }

  private static getArmoredPrivateKey = (key: Key) => {
    return (key as unknown as { privateKeyArmored: string }).privateKeyArmored;
  }

  private static getArmoredCertificate = (key: Key) => {
    return (key as unknown as { certificateArmored: string }).certificateArmored;
  }

  private static getCertificate = (key: Key) => {
    return forge.pki.certificateFromPem(SmimeKey.getArmoredCertificate(key));
  }

  private static saveArmored = (key: Key, certificate: forge.pki.Certificate | string, privateKey: forge.pki.PrivateKey | string | undefined) => {
    const armored = [];
    if (privateKey) {
      const armoredPrivateKey = (typeof privateKey === 'string') ? privateKey : forge.pki.privateKeyToPem(privateKey);
      armored.push(armoredPrivateKey);
      (key as unknown as { privateKeyArmored: string }).privateKeyArmored = armoredPrivateKey;
    }
    const armoredCertificate = (typeof certificate === 'string') ? certificate : forge.pki.certificateToPem(certificate);
    armored.push(armoredCertificate);
    (key as unknown as { certificateArmored: string }).certificateArmored = armoredCertificate;
    (key as unknown as { rawArmored: string }).rawArmored = armored.join(''); // todo: crlf?
  }

  private static isKeyWeak = (certificate: forge.pki.Certificate) => {
    const publicKeyN = (certificate.publicKey as forge.pki.rsa.PublicKey)?.n;
    if (publicKeyN && publicKeyN.bitLength() < 2048) {
      return true;
    }
    return false;
  }

  private static isEmailCertificate = (certificate: forge.pki.Certificate) => {
    const eku = certificate.getExtension('extKeyUsage');
    if (!eku) {
      return false;
    }
    return !!(eku as { emailProtection: boolean }).emailProtection;
  }

  private static dateToNumber = (date: Date): undefined | number => {
    if (!date) {
      return;
    }
    return date.getTime();
  }

}
