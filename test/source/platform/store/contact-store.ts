/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { Contact, Key, KeyUtil } from '../../core/crypto/key';
import { OpenPGPKey } from '../../core/crypto/pgp/openpgp-key.js';

const DATA: Contact[] = [];

export type ContactUpdate = {
  email?: string;
  name?: string | null;
  pubkey?: Key;
  has_pgp?: 0 | 1;
  searchable?: string[];
  client?: string | null;
  fingerprint?: string | null;
  longid?: string | null;
  pending_lookup?: number;
  last_use?: number | null;
  pubkey_last_sig?: number | null;
  pubkey_last_check?: number | null;
  expiresOn?: number | null;
};

export class ContactStore {

  public static get = async (db: void, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    const result = DATA.filter(x => emailOrLongid.includes(x.email) ||
      (x.longid && emailOrLongid.includes(x.longid!)));
    return result;
  }

  public static update = async (db: void, email: string | string[], update: ContactUpdate): Promise<void> => {
    if (Array.isArray(email)) {
      await Promise.all(email.map(oneEmail => ContactStore.update(db, oneEmail, update)));
      return;
    }
    let [updated] = await ContactStore.get(db, [email]);
    if (!updated) { // updating a non-existing contact, insert it first
      updated = await ContactStore.obj({ email });
      DATA.push(updated);
    }
    if (update.pubkey?.isPrivate) {
      update.pubkey = await KeyUtil.asPublicKey(update.pubkey);
    }
    if (update.pubkey) {
      const key = typeof update.pubkey === 'string' ? await KeyUtil.parse(update.pubkey) : update.pubkey;
      update.fingerprint = key.id;
      update.longid = OpenPGPKey.fingerprintToLongid(key.id);
      update.pubkey_last_sig = key.lastModified ? Number(key.lastModified) : null;
      update.expiresOn = key.expiration ? Number(key.expiration) : null;
      update.pubkey = key;
      update.has_pgp = 1;
    }
    for (const k of Object.keys(update)) {
      // @ts-ignore
      updated[k] = update[k];
    }
  }

  public static obj = async ({ email, name, client, pubkey, pendingLookup, lastUse, lastCheck, lastSig }: any): Promise<Contact> => {
    if (!pubkey) {
      return {
        email,
        name: name || null,
        pending_lookup: (pendingLookup ? 1 : 0),
        pubkey: null,
        searchable: [],
        has_pgp: 0, // number because we use it for sorting
        client: null,
        fingerprint: null,
        longid: null,
        longids: [],
        last_use: lastUse || null,
        pubkey_last_sig: null,
        pubkey_last_check: null,
        expiresOn: null
      };
    }
    const pk = await KeyUtil.parse(pubkey);
    const contact = {
      email,
      name,
      client,
      pubkey: pk,
      fingerprint: pk.id,
      longid: OpenPGPKey.fingerprintToLongid(pk.id),
      longids: pk.allIds.map(id => OpenPGPKey.fingerprintToLongid(id)),
      pending_lookup: pendingLookup,
      last_use: lastUse,
      pubkey_last_check: lastCheck,
      pubkey_last_sig: lastSig
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
