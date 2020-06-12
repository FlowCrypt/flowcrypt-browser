/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import * as forge from 'node-forge';
import { Pubkey, PgpKey } from '../pgp/pgp-key.js';

const isEmailCertificate = (certificate: forge.pki.Certificate) => {
  const eku = certificate.getExtension('extKeyUsage');
  if (!eku) {
    return false;
  }
  return !!(eku as { emailProtection: boolean }).emailProtection;
};

export class SmimeKey {
  public static parse = async (text: string): Promise<Pubkey> => {
    const certificate = forge.pki.certificateFromPem(text);
    const email = (certificate.subject.getField('CN') as { value: string }).value;
    const key = {
      type: 'x509',
      id: certificate.serialNumber,
      ids: [certificate.serialNumber],
      usableForEncryption: isEmailCertificate(certificate),
      usableForSigning: isEmailCertificate(certificate),
      usableButExpired: false,
      emails: [email],
      identities: [email],
      created: certificate.validity.notBefore,
      lastModified: certificate.validity.notBefore,
      expiration: certificate.validity.notAfter,
      checkPassword: _ => { throw new Error('Not implemented yet.'); },
      fullyDecrypted: false,
      fullyEncrypted: false,
      isPublic: true,
      isPrivate: true,
    } as Pubkey;
    (key as unknown as { raw: string }).raw = text;
    return key;
  }

  public static encrypt = async ({ pubkeys, data }: { pubkeys: Pubkey[], data: Uint8Array }): Promise<{ data: Uint8Array, type: 'smime' }> => {
    const p7 = forge.pkcs7.createEnvelopedData();
    for (const pubkey of pubkeys) {
      p7.addRecipient(forge.pki.certificateFromPem(PgpKey.armor(pubkey)));
    }
    const headers = `Content-Type: text/plain`;
    p7.content = forge.util.createBuffer(headers + '\r\n\r\n' + data);
    p7.encrypt();
    const derBuffer = forge.asn1.toDer(p7.toAsn1()).getBytes();
    const arr = [];
    for (let i = 0, j = derBuffer.length; i < j; ++i) {
      arr.push(derBuffer.charCodeAt(i));
    }
    return { data: new Uint8Array(arr), type: 'smime' };
  }

}
