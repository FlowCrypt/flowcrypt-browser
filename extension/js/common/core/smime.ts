/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
import * as forge from 'node-forge';
import { Pubkey } from './pgp-key.js';

export const encrypt = (pubkeys: Pubkey[], data: Uint8Array): { data: Uint8Array, type: 'smime' } => {
  const p7 = forge.pkcs7.createEnvelopedData();
  for (const pubkey of pubkeys) {
    p7.addRecipient(forge.pki.certificateFromPem(pubkey.unparsed));
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
};
