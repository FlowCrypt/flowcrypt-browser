/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import * as forge from 'node-forge';
import { Key, KeyUtil } from '../key.js';
import { Str } from '../../common.js';
import { UnreportableError } from '../../../platform/catch.js';

export class SmimeKey {

  public static parse = async (text: string): Promise<Key> => {
    const certificate = forge.pki.certificateFromPem(text);
    SmimeKey.removeWeakKeys(certificate);
    const email = (certificate.subject.getField('CN') as { value: string }).value;
    const normalizedEmail = Str.parseEmail(email).email;
    if (!normalizedEmail) {
      throw new UnreportableError(`This S/MIME x.509 certificate has an invalid recipient email: ${email}`);
    }
    const key = {
      type: 'x509',
      id: certificate.serialNumber.toUpperCase(),
      allIds: [certificate.serialNumber.toUpperCase()],
      usableForEncryption: certificate.publicKey && SmimeKey.isEmailCertificate(certificate),
      usableForSigning: certificate.publicKey && SmimeKey.isEmailCertificate(certificate),
      usableForEncryptionButExpired: false,
      usableForSigningButExpired: false,
      emails: [normalizedEmail],
      identities: [normalizedEmail],
      created: SmimeKey.dateToNumber(certificate.validity.notBefore),
      lastModified: SmimeKey.dateToNumber(certificate.validity.notBefore),
      expiration: SmimeKey.dateToNumber(certificate.validity.notAfter),
      fullyDecrypted: false,
      fullyEncrypted: false,
      isPublic: true,
      isPrivate: true,
    } as Key;
    (key as unknown as { rawArmored: string }).rawArmored = text;
    return key;
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
