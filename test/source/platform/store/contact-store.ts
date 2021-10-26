/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:no-null-keyword

import { Contact, Key, KeyUtil } from '../../core/crypto/key';

const DATA: Contact[] = [];

export type ContactUpdate = {
  email?: string;
  name?: string | null;
  pubkey?: Key;
  lastUse?: number | null;
};

export type Pubkey = {
  fingerprint: string;
  armoredKey: string;
  longids: string[];
  lastCheck: number | null,
  expiresOn: number | null;
};

export type PubkeyInfo = {
  pubkey: Key,
  revoked: boolean,
  lastCheck?: number | undefined
};

export class ContactStore {

  public static get = async (db: void, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    const result = DATA.filter(x => emailOrLongid.includes(x.email) ||
      // is there any intersection
      (x.pubkey && KeyUtil.getPubkeyLongids(x.pubkey).some(y => emailOrLongid.includes(y))));
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
    for (const k of Object.keys(update)) {
      // @ts-ignore
      updated[k] = update[k];
    }
    if (update.pubkey) {
      const key = typeof update.pubkey === 'string' ? await KeyUtil.parse(update.pubkey) : update.pubkey;
      updated.pubkey = key;
      updated.fingerprint = key.id;
      updated.expiresOn = key.expiration ? Number(key.expiration) : null;
      updated.hasPgp = 1;
    }
  }

  public static obj = async ({ email, name, pubkey, lastUse, lastCheck }: any): Promise<Contact> => {
    if (!pubkey) {
      return {
        email,
        name: name || null,
        pubkey: undefined,
        hasPgp: 0, // number because we use it for sorting
        fingerprint: null,
        lastUse: lastUse || null,
        pubkeyLastCheck: null,
        expiresOn: null,
        revoked: false
      };
    }
    const pk = await KeyUtil.parse(pubkey);
    const contact = {
      email,
      name,
      pubkey: pk,
      hasPgp: 1, // number because we use it for sorting
      fingerprint: pk.id,
      lastUse,
      pubkeyLastCheck: lastCheck,
      revoked: pk.revoked
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
