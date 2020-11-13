/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Contact, KeyUtil } from '../../core/crypto/key';
import { OpenPGPKey } from '../../core/crypto/pgp/openpgp-key.js';

const DATA: Contact[] = [];

export class ContactStore {

  public static get = async (db: void, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    const result = DATA.filter(x => emailOrLongid.includes(x.email) ||
      (x.longid && emailOrLongid.includes(x.longid!)));
    return result;
  }

  public static obj = async ({ email, name, client, pubkey }: any): Promise<Contact> => {
    const pk = await KeyUtil.parse(pubkey);
    const contact = {
      email,
      name,
      client,
      pubkey: pk,
      fingerprint: pk.id,
      longid: OpenPGPKey.fingerprintToLongid(pk.id),
      longids: pk.allIds.map(id => OpenPGPKey.fingerprintToLongid(id))
    } as Contact;
    return contact;
  }

  public static save = async (db: any, contact: Contact | Contact[]): Promise<void> => {
    if (Array.isArray(contact)) {
      DATA.push(...contact);
    } else {
      DATA.push(contact);
    }
  }
}
