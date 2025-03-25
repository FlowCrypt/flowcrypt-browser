/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import { Key, UnexpectedKeyTypeError } from '../key.js';
import { Str } from '../../common.js';
import { UnreportableError } from '../../../platform/catch.js';
import { PgpArmor } from '../pgp/pgp-armor.js';
import { Buf } from '../../buf.js';
import { MsgBlockParser } from '../../msg-block-parser.js';
import { MsgBlock } from '../../msg-block.js';
import * as forge from 'node-forge';
export type SmimeMsg = forge.pkcs7.PkcsEnvelopedData;
export const DATA_OID = '1.2.840.113549.1.7.1';
export const SIGNED_DATA_OID = '1.2.840.113549.1.7.2';
export const ENVELOPED_DATA_OID = '1.2.840.113549.1.7.3';
export class SmimeKey {
  private static get forge(): typeof forge {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return forge.default ? forge.default : forge;
  }
  public static parse(text: string): Key {
    if (text.includes(PgpArmor.headers('certificate').begin)) {
      const blocks = MsgBlockParser.detectBlocks(text).blocks;
      const certificates = blocks.filter(b => b.type === 'certificate');
      const leafCertificates = SmimeKey.getLeafCertificates(certificates);
      if (leafCertificates.length > 1) {
        throw new Error('Parsing S/MIME with more than one user certificate is not supported');
      }
      if (leafCertificates.length !== 1) {
        throw new Error('Could not parse S/MIME key without a user certificate');
      }
      const privateKeys = blocks.filter(b => ['pkcs8EncryptedPrivateKey', 'pkcs8PrivateKey', 'pkcs8RsaPrivateKey'].includes(b.type));
      if (privateKeys.length > 1) {
        throw new Error('Could not parse S/MIME key with more than one private keys');
      }
      return SmimeKey.getKeyFromCertificate(leafCertificates[0].pem, privateKeys[0]?.content ?? undefined);
    } else if (text.includes(PgpArmor.headers('pkcs12').begin)) {
      const armoredBytes = text.replace(PgpArmor.headers('pkcs12').begin, '').replace(PgpArmor.headers('pkcs12').end, '').trim();
      const emptyPassPhrase = '';
      return SmimeKey.parseDecryptBinary(Buf.fromBase64Str(armoredBytes), emptyPassPhrase);
    } else {
      throw new Error('Could not parse S/MIME key without known headers');
    }
  }

  public static parseDecryptBinary(buffer: Uint8Array, password: string): Key {
    const bytes = String.fromCharCode.apply(undefined, new Uint8Array(buffer) as unknown as number[]);
    const asn1 = this.forge.asn1.fromDer(bytes);
    let certificate: forge.pki.Certificate | undefined;
    try {
      // try to recognize a certificate
      certificate = this.forge.pki.certificateFromAsn1(asn1);
    } catch {
      // fall back to p12
    }
    if (certificate) {
      return SmimeKey.getKeyFromCertificate(certificate, undefined);
    }
    const p12 = this.forge.pkcs12.pkcs12FromAsn1(asn1, password);
    const certBags = p12.getBags({ bagType: this.forge.pki.oids.certBag });
    if (!certBags) {
      throw new Error('No user certificate found.');
    }
    const certBag = certBags[this.forge.pki.oids.certBag];
    if (!certBag) {
      throw new Error('No user certificate found.');
    }
    certificate = certBag[0]?.cert;
    if (!certificate) {
      throw new Error('No user certificate found.');
    }
    const keyBags = (p12.getBags({ bagType: this.forge.pki.oids.pkcs8ShroudedKeyBag })[this.forge.pki.oids.pkcs8ShroudedKeyBag] ?? []).concat(
      p12.getBags({ bagType: this.forge.pki.oids.keyBag })[this.forge.pki.oids.keyBag] ?? []
    );
    const privateKey = keyBags[0]?.key;
    return SmimeKey.getKeyFromCertificate(certificate, privateKey);
  }

  /**
   * @param data: an already encoded plain mime message
   */
  public static async encryptMessage({
    pubkeys,
    data: input,
    armor,
  }: {
    pubkeys: Key[];
    data: Uint8Array;
    armor: boolean;
  }): Promise<{ data: Uint8Array; type: 'smime' }> {
    const p7 = this.forge.pkcs7.createEnvelopedData();
    // collapse duplicate certificates into one
    // check both fingerprints and longids (certificate Serial Number and Issuer)
    const longids: string[] = [];
    const ids: string[] = [];
    for (const pubkey of pubkeys) {
      const longid = SmimeKey.getKeyLongid(pubkey);
      if (ids.includes(pubkey.id) && longids.includes(longid)) {
        continue;
      } else {
        ids.push(pubkey.id);
        longids.push(longid);
      }
      const certificate = SmimeKey.getCertificate(pubkey);
      if (SmimeKey.isKeyWeak(certificate)) {
        throw new Error(`The key can't be used for encryption as it doesn't meet the strength requirements`);
      }
      p7.addRecipient(certificate);
    }
    p7.content = this.forge.util.createBuffer(input);
    p7.encrypt();
    let data: Uint8Array;
    if (armor) {
      data = Buf.fromRawBytesStr(this.forge.pkcs7.messageToPem(p7));
    } else {
      data = SmimeKey.messageToDer(p7);
    }
    return { data, type: 'smime' };
  }

  public static readArmoredPkcs7Message(
    encrypted: Uint8Array | string
  ): forge.pkcs7.PkcsEnvelopedData | forge.pkcs7.PkcsEncryptedData | forge.pkcs7.PkcsSignedData {
    return this.forge.pkcs7.messageFromPem(Str.with(encrypted));
  }

  public static decryptMessage(p7: forge.pkcs7.PkcsEnvelopedData, key: Key): Uint8Array {
    // todo: make sure private, decrypted ? and x509
    const armoredPrivateKey = SmimeKey.getArmoredPrivateKey(key);
    const decryptedPrivateKey = this.forge.pki.privateKeyFromPem(armoredPrivateKey);
    // find a recipient by the issuer of a certificate
    const recipient = p7.findRecipient(SmimeKey.getCertificate(key));
    // decrypt
    p7.decrypt(recipient, decryptedPrivateKey); // todo: exception handling
    return p7.content ? Buf.fromRawBytesStr(p7.content.getBytes()) : new Buf();
  }

  // signs binary data and returns DER-encoded PKCS#7 message
  public static async sign(signingPrivate: Key, data: Uint8Array): Promise<Uint8Array> {
    // todo: !isFullyDecrypted
    const p7 = this.forge.pkcs7.createSignedData();
    p7.addSigner({
      certificate: SmimeKey.getCertificate(signingPrivate),
      key: SmimeKey.getArmoredPrivateKey(signingPrivate),
      // digestAlgorithm: this.forge.pki.oids.sha1,
      /*
      authenticatedAttributes: [{
        type: this.forge.pki.oids.contentType,
        value: this.forge.pki.oids.data
      }, {
        type: this.forge.pki.oids.messageDigest
      }] */
    });
    p7.content = this.forge.util.createBuffer(data);
    p7.sign();
    return SmimeKey.messageToDer(p7);
  }

  public static async decryptKey(key: Key, passphrase: string, optionalBehaviorFlag?: 'OK-IF-ALREADY-DECRYPTED'): Promise<boolean> {
    if (!key.isPrivate) {
      throw new Error('Nothing to decrypt in a public key');
    }
    if (key.fullyDecrypted) {
      if (optionalBehaviorFlag === 'OK-IF-ALREADY-DECRYPTED') {
        return true;
      } else {
        throw new Error('Decryption failed - private key was already decrypted');
      }
    }
    const encryptedPrivateKey = SmimeKey.getArmoredPrivateKey(key);
    const privateKey = this.forge.pki.decryptRsaPrivateKey(encryptedPrivateKey, passphrase); // null on password mismatch
    if (!privateKey) {
      return false;
    }
    SmimeKey.checkPrivateKeyCertificateMatchOrThrow(SmimeKey.getCertificate(key), privateKey);
    SmimeKey.saveArmored(key, SmimeKey.getArmoredCertificate(key), privateKey);
    key.fullyDecrypted = true;
    key.fullyEncrypted = false;
    return true;
  }

  public static async encryptKey(key: Key, passphrase: string) {
    const armoredPrivateKey = SmimeKey.getArmoredPrivateKey(key);
    if (!armoredPrivateKey) {
      throw new Error(`No private key found to encrypt. Is this a private key?`);
    }
    if (!passphrase || passphrase === 'undefined' || passphrase === 'null') {
      throw new Error(`Encryption passphrase should not be empty:${typeof passphrase}:${passphrase}`);
    }
    const encryptedPrivateKey = this.forge.pki.encryptRsaPrivateKey(this.forge.pki.privateKeyFromPem(armoredPrivateKey), passphrase);
    if (!encryptedPrivateKey) {
      throw new Error('Failed to encrypt the private key.');
    }
    SmimeKey.saveArmored(key, SmimeKey.getArmoredCertificate(key), encryptedPrivateKey);
    key.fullyDecrypted = false;
    key.fullyEncrypted = true;
  }

  public static asPublicKey(key: Key): Key {
    if (key.family !== 'x509') {
      throw new UnexpectedKeyTypeError(`Key type is ${key.family}, expecting x509 S/MIME`);
    }
    if (key.isPrivate) {
      return SmimeKey.getKeyFromCertificate(SmimeKey.getArmoredCertificate(key), undefined);
    }
    return key;
  }

  public static getKeyLongid(key: Key): string {
    if (key.issuerAndSerialNumber !== undefined) {
      const encodedIssuerAndSerialNumber = SmimeKey.getLongIdFromDer(key.issuerAndSerialNumber);
      if (encodedIssuerAndSerialNumber) {
        return encodedIssuerAndSerialNumber;
      }
    }
    throw new Error(`Cannot extract IssuerAndSerialNumber from the certificate for: ${key.id}`);
  }

  public static getMessageLongids(msg: SmimeMsg): string[] {
    return msg.recipients.map(recipient => {
      const asn1 = SmimeKey.createIssuerAndSerialNumberAsn1(SmimeKey.attributesToDistinguishedNameAsn1(recipient.issuer), recipient.serialNumber);
      const der = this.forge.asn1.toDer(asn1).getBytes();
      return SmimeKey.getLongIdFromDer(der);
    });
  }

  private static messageToDer(p7: forge.pkcs7.Pkcs7Data): Uint8Array {
    const asn1 = p7.toAsn1();
    return Buf.fromRawBytesStr(this.forge.asn1.toDer(asn1).getBytes());
  }

  // convert from binary string as provided by Forge to a 'X509-' prefixed base64 longid
  private static getLongIdFromDer(der: string): string {
    return 'X509-' + Buf.fromRawBytesStr(der).toBase64Str();
  }

  private static getLeafCertificates(msgBlocks: MsgBlock[]): { pem: string; certificate: forge.pki.Certificate }[] {
    const parsed = msgBlocks.map(cert => {
      return { pem: cert.content as string, certificate: this.forge.pki.certificateFromPem(cert.content as string) };
    });
    // Note: no signature check is performed.
    return parsed.filter((c, i) => !parsed.some((other, j) => j !== i && other.certificate.isIssuer(c.certificate)));
  }

  private static getNormalizedEmailsFromCertificate(certificate: forge.pki.Certificate): string[] {
    const emailFromSubject = (certificate.subject.getField('CN') as { value: string }).value;
    const normalizedEmail = Str.parseEmail(emailFromSubject).email;
    const emails = normalizedEmail ? [normalizedEmail] : [];
    // search for e-mails in subjectAltName extension
    const subjectAltName = certificate.getExtension('subjectAltName') as {
      altNames: { type: number; value: string }[];
    };
    if (subjectAltName?.altNames) {
      const emailsFromAltNames = subjectAltName.altNames
        .filter(entry => entry.type === 1)
        .map(entry => Str.parseEmail(entry.value).email)
        .filter(Boolean);
      emails.push(...(emailsFromAltNames as string[]));
    }
    if (emails.length) {
      return emails.filter((value, index, self) => self.indexOf(value) === index);
    }
    throw new UnreportableError(`This S/MIME x.509 certificate has an invalid recipient email: ${emailFromSubject}`);
  }

  private static getKeyFromCertificate(certificateOrText: forge.pki.Certificate | string, privateKey: forge.pki.PrivateKey | string | undefined): Key {
    const certificate = typeof certificateOrText === 'string' ? this.forge.pki.certificateFromPem(certificateOrText) : certificateOrText;
    if (!certificate.publicKey) {
      throw new UnreportableError(`This S/MIME x.509 certificate doesn't have a public key`);
    }
    let encrypted = false;
    if (typeof privateKey === 'string') {
      if (privateKey.includes(PgpArmor.headers('pkcs8EncryptedPrivateKey').begin)) {
        encrypted = true;
      } else {
        // test that we can read the unencrypted key
        const unencryptedKey = this.forge.pki.privateKeyFromPem(privateKey);
        if (!unencryptedKey) {
          privateKey = undefined;
        }
        SmimeKey.checkPrivateKeyCertificateMatchOrThrow(certificate, unencryptedKey);
      }
    }
    const fingerprint = this.forge.pki.getPublicKeyFingerprint(certificate.publicKey, { encoding: 'hex' }).toUpperCase();
    const emails = SmimeKey.getNormalizedEmailsFromCertificate(certificate);
    const issuerAndSerialNumberAsn1 = SmimeKey.createIssuerAndSerialNumberAsn1(
      this.forge.pki.distinguishedNameToAsn1(certificate.issuer),
      certificate.serialNumber
    );

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const expiration = SmimeKey.dateToNumber(certificate.validity.notAfter)!;
    const expired = expiration < Date.now();
    const usableIgnoringExpiration = SmimeKey.isEmailCertificate(certificate) && !SmimeKey.isKeyWeak(certificate);
    const key = {
      family: 'x509',
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
      issuerAndSerialNumber: this.forge.asn1.toDer(issuerAndSerialNumberAsn1).getBytes(),
    } as Key;
    SmimeKey.saveArmored(key, certificateOrText, privateKey);
    return key;
  }

  private static attributesToDistinguishedNameAsn1(attributes: forge.pki.Attribute[]): forge.asn1.Asn1 {
    return this.forge.asn1.create(
      this.forge.asn1.Class.UNIVERSAL,
      this.forge.asn1.Type.SEQUENCE,
      true,
      attributes.map(attr => {
        const valueTagClass = attr.valueTagClass || this.forge.asn1.Type.PRINTABLESTRING;
        return this.forge.asn1.create(this.forge.asn1.Class.UNIVERSAL, this.forge.asn1.Type.SET, true, [
          this.forge.asn1.create(this.forge.asn1.Class.UNIVERSAL, this.forge.asn1.Type.SEQUENCE, true, [
            // AttributeType
            this.forge.asn1.create(this.forge.asn1.Class.UNIVERSAL, this.forge.asn1.Type.OID, false, this.forge.asn1.oidToDer(attr.type).getBytes()),
            // AttributeValue
            this.forge.asn1.create(
              this.forge.asn1.Class.UNIVERSAL,
              attr.valueTagClass,
              false,
              // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-enum-comparison
              valueTagClass === this.forge.asn1.Type.UTF8 ? this.forge.util.encodeUtf8(attr.value) : attr.value
            ),
          ]),
        ]);
      })
    );
  }

  private static createIssuerAndSerialNumberAsn1(issuerAsn1: forge.asn1.Asn1, serialNumberHex: string) {
    return this.forge.asn1.create(this.forge.asn1.Class.UNIVERSAL, this.forge.asn1.Type.SEQUENCE, true, [
      // Issuer
      issuerAsn1,
      // Serial
      this.forge.asn1.create(this.forge.asn1.Class.UNIVERSAL, this.forge.asn1.Type.INTEGER, false, this.forge.util.hexToBytes(serialNumberHex)),
    ]);
  }

  private static getArmoredPrivateKey(key: Key) {
    return (key as unknown as { privateKeyArmored: string }).privateKeyArmored;
  }

  private static getArmoredCertificate(key: Key) {
    return (key as unknown as { certificateArmored: string }).certificateArmored;
  }

  private static getCertificate(key: Key) {
    return this.forge.pki.certificateFromPem(SmimeKey.getArmoredCertificate(key));
  }

  private static saveArmored(key: Key, certificate: forge.pki.Certificate | string, privateKey: forge.pki.PrivateKey | string | undefined) {
    const armored: string[] = [];
    if (privateKey) {
      let armoredPrivateKey = typeof privateKey === 'string' ? privateKey : this.forge.pki.privateKeyToPem(privateKey);
      if (!armoredPrivateKey.endsWith('\n')) {
        armoredPrivateKey += '\r\n';
      }
      armored.push(armoredPrivateKey);
      (key as unknown as { privateKeyArmored: string }).privateKeyArmored = armoredPrivateKey;
    }
    let armoredCertificate = typeof certificate === 'string' ? certificate : this.forge.pki.certificateToPem(certificate);
    if (!armoredCertificate.endsWith('\n')) {
      armoredCertificate += '\r\n';
    }
    armored.push(armoredCertificate);
    (key as unknown as { certificateArmored: string }).certificateArmored = armoredCertificate;
    (key as unknown as { rawArmored: string }).rawArmored = armored.join('');
  }

  private static isKeyWeak(certificate: forge.pki.Certificate) {
    const publicKeyN = (certificate.publicKey as forge.pki.rsa.PublicKey)?.n;
    if (publicKeyN && publicKeyN.bitLength() < 2048) {
      return true;
    }
    return false;
  }

  private static checkPrivateKeyCertificateMatchOrThrow(certificate: forge.pki.Certificate, privateKey: forge.pki.PrivateKey): void {
    const publicKeyN = (certificate.publicKey as forge.pki.rsa.PublicKey)?.n;
    const publicKeyE = (certificate.publicKey as forge.pki.rsa.PublicKey)?.e;
    const privateKeyN = (privateKey as forge.pki.rsa.PrivateKey).n;
    const privateKeyE = (privateKey as forge.pki.rsa.PrivateKey).e;
    if (publicKeyN && publicKeyE && privateKeyN && privateKeyE) {
      // compare RSA Private and Public Key material
      if (publicKeyN.compareTo(privateKeyN) === 0 && publicKeyE.compareTo(privateKeyE) === 0) {
        return;
      }
      throw new UnreportableError("Certificate doesn't match the private key");
    }
    throw new UnreportableError('This key family is not supported');
    /* todo: edwards25519
    const derivedPublicKey = this.forge.pki.ed25519.publicKeyFromPrivateKey({ privateKey: privateKey as this.forge.pki.ed25519.BinaryBuffer });
    Buffer.from(derivedPublicKey).compare(Buffer.from(certificate.publicKey as this.forge.pki.ed25519.NativeBuffer)) === 0;
    */
  }

  private static isEmailCertificate(certificate: forge.pki.Certificate) {
    const eku = certificate.getExtension('extKeyUsage');
    if (!eku) {
      return false;
    }
    return !!(eku as { emailProtection: boolean }).emailProtection;
  }

  private static dateToNumber(date: Date): undefined | number {
    if (!date) {
      return;
    }
    return date.getTime();
  }
}
