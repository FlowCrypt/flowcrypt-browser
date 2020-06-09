/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import * as forge from 'node-forge';
import { Pubkey, PgpKey } from './pgp-key.js';

export class SmimeKey {
  public static parse = async (text: string): Promise<Pubkey> => {
    const key = {
      type: 'x509',
      id: '' + Math.random(),  // TODO: Replace with: smime.getSerialNumber()
      ids: [],
      usableForEncryption: true, // TODO: Replace with smime code checking encryption flag
      usableForSigning: true, // TODO:Replace with real checks
      usableButExpired: false,
      emails: [], // TODO: add parsing CN from the e-mail
      identities: [],
      created: new Date(0),
      lastModified: new Date(0),
      expiration: undefined,
      checkPassword: _ => { throw new Error('Not implemented yet.'); },
      fullyDecrypted: false,
      fullyEncrypted: false,
      isPublic: true,
      isPrivate: true,
    } as Pubkey;
    (key as unknown as { raw: string }).raw = text;
    return key;
  }

  public static encrypt = (pubkeys: Pubkey[], data: Uint8Array): { data: Uint8Array, type: 'smime' } => {
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
