/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import * as forge from 'node-forge';
import { Key, KeyUtil } from '../key.js';
import { Str } from '../../common.js';
import { UnreportableError } from '../../../platform/catch.js';
import { PgpArmor } from '../pgp/pgp-armor.js';
import { Buf } from '../../buf.js';

export class SmimeKey {

  public static parse = (text: string): Key => {
    if (text.includes(PgpArmor.headers('certificate').begin)) {
      return SmimeKey.parsePemCertificate(text);
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
      return SmimeKey.getKeyFromCertificate(certificate, forge.pki.certificateToPem(certificate));
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
    certificate.privateKey = keyBags[0]?.key;
    const headers = PgpArmor.headers('pkcs12');
    return SmimeKey.getKeyFromCertificate(certificate, `${headers.begin}\n${forge.util.encode64(bytes)}\n${headers.end}`);
  }

  /**
   * @param data: an already encoded plain mime message
   */
  public static encryptMessage = async ({ pubkeys, data }: { pubkeys: Key[], data: Uint8Array }): Promise<{ data: Uint8Array, type: 'smime' }> => {
    const p7 = forge.pkcs7.createEnvelopedData();
    for (const pubkey of pubkeys) {
      const certificate = forge.pki.certificateFromPem(KeyUtil.armor(pubkey));
      SmimeKey.removeWeakKeys(certificate);
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

  private static getKeyFromCertificate = (certificate: forge.pki.Certificate, pem: string): Key => {
    if (!certificate.publicKey) {
      throw new UnreportableError(`This S/MIME x.509 certificate doesn't have a public key`);
    }
    const fingerprint = forge.pki.getPublicKeyFingerprint(certificate.publicKey, { encoding: 'hex' }).toUpperCase();
    SmimeKey.removeWeakKeys(certificate);
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
    const usableIgnoringExpiration = SmimeKey.isEmailCertificate(certificate);
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
      fullyDecrypted: !!certificate.privateKey,
      fullyEncrypted: false,
      isPublic: !certificate.privateKey,
      isPrivate: !!certificate.privateKey,
      revoked: false,
      issuerAndSerialNumber: forge.asn1.toDer(issuerAndSerialNumberAsn1).getBytes()
    } as Key;
    (key as unknown as { rawArmored: string }).rawArmored = pem;
    return key;
  }

  private static parsePemCertificate = (text: string): Key => {
    const certificate = forge.pki.certificateFromPem(text);
    return SmimeKey.getKeyFromCertificate(certificate, text);
  }

  private static removeWeakKeys = (certificate: forge.pki.Certificate) => {
    const publicKeyN = (certificate.publicKey as forge.pki.rsa.PublicKey)?.n;
    if (publicKeyN && publicKeyN.bitLength() < 2048) {
      certificate.publicKey = undefined;
    }
    const privateKeyN = (certificate.privateKey as forge.pki.rsa.PrivateKey)?.n;
    if (privateKeyN && privateKeyN.bitLength() < 2048) {
      certificate.privateKey = undefined;
    }
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
