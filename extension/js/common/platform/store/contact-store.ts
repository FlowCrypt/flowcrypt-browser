/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { PgpClient } from '../../api/pub-lookup.js';
import { AbstractStore } from './abstract-store.js';
import { Catch } from '../catch.js';
import { opgp } from '../../core/crypto/pgp/openpgpjs-custom.js';
import { BrowserMsg } from '../../browser/browser-msg.js';
import { Str } from '../../core/common.js';
import { Key, Contact, KeyUtil } from '../../core/crypto/key.js';

// tslint:disable:no-null-keyword

export type DbContactObjArg = {
  email: string,
  name?: string | null,
  client?: 'pgp' | 'cryptup' | PgpClient | null,
  pubkey?: string | null,
  pendingLookup?: boolean | number | null,
  lastUse?: number | null, // when was this contact last used to send an email
  lastSig?: number | null, // last pubkey signature (when was pubkey last updated by owner)
  lastCheck?: number | null; // when was the local copy of the pubkey last updated (or checked against Attester)
};

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
};

export type DbContactFilter = { has_pgp?: boolean, substring?: string, limit?: number };

/**
 * Store of contacts and their public keys
 * This includes an index of email and name substrings for easier search when user is typing
 * Db is initialized in the background page and accessed through BrowserMsg
 */
export class ContactStore extends AbstractStore {

  // static [f: string]: Function; // https://github.com/Microsoft/TypeScript/issues/6480

  private static dbQueryKeys = ['limit', 'substring', 'has_pgp'];

  public static dbOpen = async (): Promise<IDBDatabase> => {
    return await new Promise((resolve, reject) => {
      let openDbReq: IDBOpenDBRequest;
      openDbReq = indexedDB.open('cryptup', 3);
      openDbReq.onupgradeneeded = (event) => {
        let contacts: IDBObjectStore;
        if (event.oldVersion < 1) {
          contacts = openDbReq.result.createObjectStore('contacts', { keyPath: 'email' }); // tslint:disable-line:no-unsafe-any
          contacts.createIndex('search', 'searchable', { multiEntry: true });
          contacts.createIndex('index_has_pgp', 'has_pgp');
          contacts.createIndex('index_pending_lookup', 'pending_lookup');
        }
        if (event.oldVersion < 2) {
          contacts = openDbReq.transaction!.objectStore('contacts');
          contacts.createIndex('index_longid', 'longid'); // longid of the first public key packet, no subkeys
        }
        if (event.oldVersion < 3) {
          contacts = openDbReq.transaction!.objectStore('contacts');
          contacts.createIndex('index_longids', 'longids', { multiEntry: true }); // longids of all public key packets in armored pubkey
        }
      };
      openDbReq.onsuccess = () => resolve(openDbReq.result as IDBDatabase);
      openDbReq.onblocked = () => reject(ContactStore.errCategorize(openDbReq.error));
      openDbReq.onerror = () => reject(ContactStore.errCategorize(openDbReq.error));
    });
  }

  public static obj = async ({ email, name, client, pubkey, pendingLookup, lastUse, lastCheck, lastSig }: DbContactObjArg): Promise<Contact> => {
    if (typeof opgp === 'undefined') {
      return await BrowserMsg.send.bg.await.db({ f: 'obj', args: [{ email, name, client, pubkey, pendingLookup, lastUse, lastSig, lastCheck }] }) as Contact;
    } else {
      const validEmail = Str.parseEmail(email).email;
      if (!validEmail) {
        throw new Error(`Cannot save contact because email is not valid: ${email}`);
      }
      if (!pubkey) {
        return {
          email: validEmail,
          name: name || null,
          pending_lookup: (pendingLookup ? 1 : 0),
          pubkey: null,
          has_pgp: 0, // number because we use it for sorting
          searchable: ContactStore.dbCreateSearchIndexList(validEmail, name || null, false),
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
      const expiresOnMs = Number(pk.expiration) || undefined;
      return {
        email: validEmail,
        name: name || null,
        pubkey: pk,
        has_pgp: 1, // number because we use it for sorting
        searchable: ContactStore.dbCreateSearchIndexList(validEmail, name || null, true),
        client: ContactStore.storablePgpClient(client || 'pgp'),
        fingerprint: pk.id,
        longid: pk.ids[0],
        longids: pk.ids,
        pending_lookup: 0,
        last_use: lastUse || null,
        pubkey_last_sig: Number(pk.lastModified) || null,
        pubkey_last_check: lastCheck || null,
        expiresOn: expiresOnMs || null
      };
    }
  }

  /**
   * Used to save a contact that does not yet exist
   */
  public static save = async (db: IDBDatabase | undefined, contact: Contact | Contact[]): Promise<void> => {
    if (!db) { // relay op through background process
      await BrowserMsg.send.bg.await.db({ f: 'save', args: [contact] });
      return;
    }
    if (Array.isArray(contact)) {
      await Promise.all(contact.map(oneContact => ContactStore.save(db, oneContact)));
      return;
    }
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('contacts', 'readwrite');
      const contactsTable = tx.objectStore('contacts');
      contactsTable.put(contact);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(ContactStore.errCategorize(tx.error));
    });
  }

  /**
   * used to update existing contact
   */
  public static update = async (db: IDBDatabase | undefined, email: string | string[], update: ContactUpdate): Promise<void> => {
    if (!db) { // relay op through background process
      await BrowserMsg.send.bg.await.db({ f: 'update', args: [email, update] });
      return;
    }
    if (Array.isArray(email)) {
      await Promise.all(email.map(oneEmail => ContactStore.update(db, oneEmail, update)));
      return;
    }
    let [existing] = await ContactStore.get(db, [email]);
    if (!existing) { // updating a non-existing contact, insert it first
      await ContactStore.save(db, await ContactStore.obj({ email }));
      [existing] = await ContactStore.get(db, [email]);
      if (!existing) {
        throw new Error('contact not found right after inserting it');
      }
    }
    if (update.pubkey?.isPrivate) {
      Catch.report('Wrongly updating prv as contact - converting to pubkey');
      update.pubkey = await KeyUtil.asPublicKey(update.pubkey);
    }
    if (!update.searchable && (update.name !== existing.name || update.has_pgp !== existing.has_pgp)) { // update searchable index based on new name or new has_pgp
      const newHasPgp = Boolean(typeof update.has_pgp !== 'undefined' && update.has_pgp !== null ? update.has_pgp : existing.has_pgp);
      const newName = typeof update.name !== 'undefined' && update.name !== null ? update.name : existing.name;
      update.searchable = ContactStore.dbCreateSearchIndexList(existing.email, newName, newHasPgp);
    }
    for (const k of Object.keys(update)) {
      // @ts-ignore - may be saving any of the provided values - could do this one by one while ensuring proper types
      existing[k] = update[k];
    }
    if (existing.pubkey && typeof existing.pubkey === 'object') {
      existing.pubkey = KeyUtil.armor(existing.pubkey) as any as Key; // serializing for storage
    }
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('contacts', 'readwrite');
      const contactsTable = tx.objectStore('contacts');
      contactsTable.put(existing);
      tx.oncomplete = Catch.try(resolve);
      tx.onabort = () => reject(ContactStore.errCategorize(tx.error));
    });
  }

  public static get = async (db: undefined | IDBDatabase, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    if (!db) { // relay op through background process
      return ContactStore.recreateDates(await BrowserMsg.send.bg.await.db({ f: 'get', args: [emailOrLongid] }) as (Contact | undefined)[]);
    }
    if (emailOrLongid.length === 1) {
      // contacts imported before August 2019 may have only primary longid recorded, in index_longid (string)
      // contacts imported after August 2019 have both index_longid (string) and index_longids (string[] containing all subkeys)
      // below we search contact by first trying to only search by primary longid
      // (or by email - such searches are not affected by longid indexing)
      const contact = await ContactStore.dbContactInternalGetOne(db, emailOrLongid[0], false);
      if (contact || !/^[A-F0-9]{16}$/.test(emailOrLongid[0])) {
        // if we found something, return it
        // or if we were searching by email, return found contact or nothing
        return ContactStore.recreateDates([contact]);
      } else {
        // not found any key by primary longid, and searching by longid -> search by any subkey longid
        // it may not find pubkeys imported before August 2019, re-importing such pubkeys will make them findable
        return ContactStore.recreateDates([await ContactStore.dbContactInternalGetOne(db, emailOrLongid[0], true)]);
      }
    } else {
      const results: (Contact | undefined)[] = [];
      for (const singleEmailOrLongid of emailOrLongid) {
        const [contact] = await ContactStore.get(db, [singleEmailOrLongid]);
        results.push(contact);
      }
      return ContactStore.recreateDates(results);
    }
  }

  public static search = async (db: IDBDatabase | undefined, query: DbContactFilter): Promise<Contact[]> => {
    if (!db) { // relay op through background process
      return await BrowserMsg.send.bg.await.db({ f: 'search', args: [query] }) as Contact[];
    }
    for (const key of Object.keys(query)) {
      if (!ContactStore.dbQueryKeys.includes(key)) {
        throw new Error('ContactStore.search: unknown key: ' + key);
      }
    }
    query.substring = ContactStore.normalizeString(query.substring || '');
    if (typeof query.has_pgp === 'undefined' && query.substring) {
      const resultsWithPgp = await ContactStore.search(db, { substring: query.substring, limit: query.limit, has_pgp: true });
      if (query.limit && resultsWithPgp.length === query.limit) {
        return resultsWithPgp;
      } else {
        const limit = query.limit ? query.limit - resultsWithPgp.length : undefined;
        const resultsWithoutPgp = await ContactStore.search(db, { substring: query.substring, limit, has_pgp: false });
        return resultsWithPgp.concat(resultsWithoutPgp);
      }
    }
    const toDeserialize: unknown[] = await new Promise((resolve, reject) => {
      const contacts = db.transaction('contacts', 'readonly').objectStore('contacts');
      let search: IDBRequest;
      if (typeof query.has_pgp === 'undefined') { // any query.has_pgp value
        search = contacts.openCursor(); // no substring, already covered in `typeof query.has_pgp === 'undefined' && query.substring` above
      } else { // specific query.has_pgp value
        if (query.substring) {
          search = contacts.index('search').openCursor(IDBKeyRange.only(ContactStore.dbIndex(query.has_pgp, query.substring)));
        } else {
          search = contacts.index('index_has_pgp').openCursor(IDBKeyRange.only(Number(query.has_pgp)));
        }
      }
      const found: unknown[] = [];
      search.onsuccess = Catch.try(() => {
        const cursor = search.result as IDBCursorWithValue | undefined;
        if (!cursor || found.length === query.limit) {
          resolve(found);
        } else {
          found.push(cursor.value);
          cursor.continue();
        }
      });
      search.onerror = () => reject(ContactStore.errCategorize(search!.error!)); // todo - added ! after ts3 upgrade - investigate
    });
    const deserialized = await Promise.all(toDeserialize.map(ContactStore.deserialize));
    return deserialized.filter(contact => !!contact) as Contact[];
  }

  private static normalizeString = (str: string) => {
    return str.normalize('NFKD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
  }

  private static dbIndex = (hasPgp: boolean, substring: string) => {
    if (!substring) {
      throw new Error('db_index has to include substring');
    }
    return (hasPgp ? 't:' : 'f:') + substring;
  }

  private static dbCreateSearchIndexList = (email: string, name: string | null, hasPgp: boolean) => {
    email = email.toLowerCase();
    name = name ? name.toLowerCase() : '';
    const parts = [email, name];
    parts.push(...email.split(/[^a-z0-9]/));
    parts.push(...name.split(/[^a-z0-9]/));
    const index: string[] = [];
    for (const part of parts) {
      if (part) {
        let substring = '';
        for (const letter of part.split('')) {
          substring += letter;
          const normalized = ContactStore.normalizeString(substring);
          if (!index.includes(normalized)) {
            index.push(ContactStore.dbIndex(hasPgp, normalized));
          }
        }
      }
    }
    return index;
  }

  private static storablePgpClient = (rawPgpClient: 'pgp' | 'cryptup' | PgpClient | null): 'pgp' | 'cryptup' | null => {
    if (rawPgpClient === 'flowcrypt') {
      return 'cryptup';
    } else if (rawPgpClient === 'pgp-other') {
      return 'pgp';
    } else {
      return rawPgpClient;
    }
  }

  private static dbContactInternalGetOne = async (db: IDBDatabase, emailOrLongid: string, searchSubkeyLongids: boolean): Promise<Contact | undefined> => {
    return await new Promise((resolve, reject) => {
      let tx: IDBRequest;
      if (!/^[A-F0-9]{16}$/.test(emailOrLongid)) { // email
        tx = db.transaction('contacts', 'readonly').objectStore('contacts').get(emailOrLongid);
      } else if (searchSubkeyLongids) { // search all longids
        tx = db.transaction('contacts', 'readonly').objectStore('contacts').index('index_longids').get(emailOrLongid);
      } else { // search primary longid
        tx = db.transaction('contacts', 'readonly').objectStore('contacts').index('index_longid').get(emailOrLongid);
      }
      tx.onsuccess = Catch.try(() => resolve(ContactStore.deserialize(tx.result)));
      tx.onerror = () => reject(ContactStore.errCategorize(tx.error || new Error('Unknown db error')));
    });
  }

  private static deserialize = async (result: any): Promise<Contact | undefined> => {
    if (!result) {
      return;
    }
    if (typeof result.pubkey === 'object') { // tslint:disable-line:no-unsafe-any
      return result; // tslint:disable-line:no-unsafe-any
    }
    return { ...result, pubkey: await KeyUtil.parse(result.pubkey) }; // tslint:disable-line:no-unsafe-any
  }

  private static recreateDates = (contacts: (Contact | undefined)[]) => {
    for (const contact of contacts) {
      if (contact) {
        if (typeof contact?.pubkey?.created === 'string') {
          contact.pubkey.created = new Date(contact.pubkey.created);
        }
        if (typeof contact?.pubkey?.expiration === 'string') {
          contact.pubkey.expiration = new Date(contact.pubkey.expiration);
        }
        if (typeof contact?.pubkey?.lastModified === 'string') {
          contact.pubkey.lastModified = new Date(contact.pubkey.lastModified);
        }
      }
    }
    return contacts;
  }

}
