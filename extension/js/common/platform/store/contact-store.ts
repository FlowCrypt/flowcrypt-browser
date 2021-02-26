/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AbstractStore } from './abstract-store.js';
import { Catch } from '../catch.js';
import { opgp } from '../../core/crypto/pgp/openpgpjs-custom.js';
import { BrowserMsg } from '../../browser/browser-msg.js';
import { Str } from '../../core/common.js';
import { Key, Contact, KeyUtil } from '../../core/crypto/key.js';
import { OpenPGPKey } from '../../core/crypto/pgp/openpgp-key.js';

// tslint:disable:no-null-keyword

type DbContactObjArg = {
  email: string,
  name?: string | null,
  pubkey?: string | null,
  pendingLookup?: boolean | number | null,
  lastUse?: number | null, // when was this contact last used to send an email
  lastSig?: number | null, // last pubkey signature (when was pubkey last updated by owner)
  lastCheck?: number | null; // when was the local copy of the pubkey last updated (or checked against Attester)
};

type Email = {
  email: string;
  name: string | null;
  searchable: string[];
  fingerprints: string[];
  pendingLookup: number;
  lastUse: number | null;
};

type Pubkey = {
  fingerprint: string;
  armoredKey: string;
  longids: string[];
  lastCheck: number | null,
  lastSig: number;
  expiresOn: number;
};

export type ContactPreview = {
  email: string;
  name: string | null;
  has_pgp: 0 | 1;
  last_use: number | null;
};

export type ContactUpdate = {
  email?: string;
  name?: string | null;
  pubkey?: Key;
  pending_lookup?: number;
  last_use?: number | null;
  pubkey_last_check?: number | null;
};

type DbContactFilter = { has_pgp?: boolean, substring?: string, limit?: number };

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
      openDbReq = indexedDB.open('cryptup', 4);
      openDbReq.onupgradeneeded = (event) => {
        if (event.oldVersion < 4) {
          const emails = openDbReq.result.createObjectStore('emails', { keyPath: 'email' });
          const pubkeys = openDbReq.result.createObjectStore('pubkeys', { keyPath: 'fingerprint' });
          emails.createIndex('search', 'searchable', { multiEntry: true });
          emails.createIndex('index_pending_lookup', 'pendingLookup');
          emails.createIndex('index_fingerprints', 'fingerprints', { multiEntry: true }); // fingerprints of all connected pubkeys
          pubkeys.createIndex('index_longids', 'longids', { multiEntry: true }); // longids of all public key packets in armored pubkey
        }
        if (event.oldVersion < 5) { // delete when migrating from 4 to 5?
          // openDbReq.result.deleteObjectStore('contacts'); // tslint:disable-line:no-unsafe-any
        }
        openDbReq.onsuccess = () => resolve(openDbReq.result as IDBDatabase);
        openDbReq.onblocked = () => reject(ContactStore.errCategorize(openDbReq.error));
        openDbReq.onerror = () => reject(ContactStore.errCategorize(openDbReq.error));
      };
    });
  }

  public static previewObj = ({ email, name }: { email: string, name?: string | null }): ContactPreview => {
    const validEmail = Str.parseEmail(email).email;
    if (!validEmail) {
      throw new Error(`Cannot handle the contact because email is not valid: ${email}`);
    }
    return { email: validEmail, name: name || null, has_pgp: 0, last_use: null };
  }

  public static obj = async ({ email, name, pubkey, pendingLookup, lastUse, lastCheck, lastSig }: DbContactObjArg): Promise<Contact> => {
    if (typeof opgp === 'undefined') {
      return await BrowserMsg.send.bg.await.db({ f: 'obj', args: [{ email, name, pubkey, pendingLookup, lastUse, lastSig, lastCheck }] }) as Contact;
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
          pubkey: undefined,
          has_pgp: 0, // number because we use it for sorting
          fingerprint: null,
          last_use: lastUse || null,
          pubkey_last_sig: null,
          pubkey_last_check: null,
          expiresOn: null
        };
      }
      const pk = await KeyUtil.parse(pubkey);
      return {
        email: validEmail,
        name: name || null,
        pubkey: pk,
        has_pgp: 1, // number because we use it for sorting
        pending_lookup: 0,
        last_use: lastUse || null,
        pubkey_last_check: lastCheck || null,
        ...ContactStore.getKeyAttributes(pk)
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
    await ContactStore.update(db, contact.email, contact);
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
    if (update.pubkey?.isPrivate) {
      Catch.report(`Wrongly updating prv ${update.pubkey.id} as contact - converting to pubkey (email=${update.pubkey.emails[0]})`);
      update.pubkey = await KeyUtil.asPublicKey(update.pubkey);
    }
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['emails', 'pubkeys'], 'readwrite');
      const req = tx.objectStore('emails').get(email);
      ContactStore.setReqPipe(req,
        (emailEntity: Email) => {
          if (!emailEntity) {
            const validEmail = Str.parseEmail(email).email;
            if (!validEmail) {
              reject(`Cannot save contact because email is not valid: ${email}`);
              return;
            }
            emailEntity = { email, name: null, searchable: [], fingerprints: [], pendingLookup: 0, lastUse: null };
          }
          if (update.pubkey) {
            // todo: get the pubkey record if it exists to retrieve lastCheck
            /* const req1 = tx.objectStore('pubkeys').get(update.pubkey.id);
            ContactStore.setReqPipe(req1, ... */
            const keyAttrs = ContactStore.getKeyAttributes(update.pubkey);
            const pubkeyEntity = {
              fingerprint: update.pubkey.id,
              lastCheck: null,
              lastSig: keyAttrs.pubkey_last_sig,
              expiresOn: keyAttrs.expiresOn,
              longids: update.pubkey.allIds.map(id => OpenPGPKey.fingerprintToLongid(id)),
              armoredKey: KeyUtil.armor(update.pubkey)
            } as Pubkey;
            if (!emailEntity.fingerprints.includes(pubkeyEntity.fingerprint)) {
              emailEntity.fingerprints.push(pubkeyEntity.fingerprint);
            }
            if (Object.keys(update).includes('pubkey_last_check') && update.pubkey_last_check) {
              pubkeyEntity.lastCheck = update.pubkey_last_check;
            }
            tx.objectStore('pubkeys').put(pubkeyEntity);
          }
          if (Object.keys(update).includes('name')) {
            emailEntity.name = update.name ?? null;
          }
          if (Object.keys(update).includes('pending_lookup')) {
            emailEntity.pendingLookup = update.pending_lookup ?? 0;
          }
          if (Object.keys(update).includes('last_use')) {
            emailEntity.lastUse = update.last_use ?? null;
          }
          ContactStore.updateSearchable(emailEntity);
          tx.objectStore('emails').put(emailEntity);
          tx.oncomplete = () => resolve(undefined);
          tx.onabort = () => reject(ContactStore.errCategorize(tx.error));
        }, reject);
    });
  }

  public static get = async (db: undefined | IDBDatabase, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    if (!db) { // relay op through background process
      return ContactStore.recreateDates(await BrowserMsg.send.bg.await.db({ f: 'get', args: [emailOrLongid] }) as (Contact | undefined)[]);
    }
    if (emailOrLongid.length === 1) {
      const contact = await ContactStore.dbContactInternalGetOne(db, emailOrLongid[0]);
      if (!contact) {
        return [contact];
      }
      return ContactStore.recreateDates([contact]);
    } else {
      const results: (Contact | undefined)[] = [];
      for (const singleEmailOrLongid of emailOrLongid) {
        const [contact] = await ContactStore.get(db, [singleEmailOrLongid]);
        results.push(contact);
      }
      return ContactStore.recreateDates(results);
    }
  }

  public static search = async (db: IDBDatabase | undefined, query: DbContactFilter): Promise<ContactPreview[]> => {
    return (await ContactStore.rawSearch(db, query)).filter(Boolean).map(ContactStore.toContactPreview);
  }

  public static searchPubkeys = async (db: IDBDatabase | undefined, query: DbContactFilter): Promise<string[]> => {
    const fingerprints = (await ContactStore.rawSearch(db, query)).filter(Boolean).map(email => email.fingerprints).reduce((a, b) => a.concat(b));
    return (await ContactStore.extractPubkeys(db, fingerprints)).map(pubkey => pubkey?.armoredKey).filter(Boolean);
  }

  private static extractPubkeys = async (db: IDBDatabase | undefined, fingerprints: string[]): Promise<Pubkey[]> => {
    if (!db) { // relay op through background process
      return await BrowserMsg.send.bg.await.db({ f: 'extractPubkeys', args: [fingerprints] }) as Pubkey[];
    }
    const raw: Pubkey[] = await new Promise((resolve, reject) => {
      const tx = db.transaction(['pubkeys'], 'readonly');
      const search = tx.objectStore('pubkeys').openCursor(fingerprints);
      const found: Pubkey[] = [];
      ContactStore.setReqPipe(search,
        () => {
          const cursor = search.result as IDBCursorWithValue | undefined;
          if (!cursor) {
            resolve(found);
          } else {
            found.push(cursor.value); // tslint:disable-line:no-unsafe-any
            cursor.continue();
          }
        },
        reject);
    });
    return raw;
  }

  private static rawSearch = async (db: IDBDatabase | undefined, query: DbContactFilter): Promise<Email[]> => {
    if (!db) { // relay op through background process
      return await BrowserMsg.send.bg.await.db({ f: 'rawSearch', args: [query] }) as Email[];
    }
    for (const key of Object.keys(query)) {
      if (!ContactStore.dbQueryKeys.includes(key)) {
        throw new Error('ContactStore.rawSearch: unknown key: ' + key);
      }
    }
    query.substring = ContactStore.normalizeString(query.substring || '');
    if (typeof query.has_pgp === 'undefined' && query.substring) {
      const resultsWithPgp = await ContactStore.rawSearch(db, { substring: query.substring, limit: query.limit, has_pgp: true });
      if (query.limit && resultsWithPgp.length === query.limit) {
        return resultsWithPgp;
      } else {
        const limit = query.limit ? query.limit - resultsWithPgp.length : undefined;
        const resultsWithoutPgp = await ContactStore.rawSearch(db, { substring: query.substring, limit, has_pgp: false });
        return resultsWithPgp.concat(resultsWithoutPgp);
      }
    }
    const raw: Email[] = await new Promise((resolve, reject) => {
      const emails = db.transaction(['emails'], 'readonly').objectStore('emails');
      let search: IDBRequest;
      if (typeof query.has_pgp === 'undefined') { // any query.has_pgp value
        search = emails.openCursor(); // no substring, already covered in `typeof query.has_pgp === 'undefined' && query.substring` above
      } else { // specific query.has_pgp value
        let range: IDBKeyRange;
        if (query.substring) {
          range = IDBKeyRange.only(ContactStore.dbIndex(query.has_pgp, query.substring));
        } else if (query.has_pgp) {
          range = IDBKeyRange.lowerBound('t:', false); // starting with 't:' inclusive
        } else {
          range = IDBKeyRange.upperBound('t:', true); // up to 't:', excluding it gives false range
        }
        search = emails.index('search').openCursor(range);
      }
      const found: Email[] = [];
      ContactStore.setReqPipe(search,
        () => {
          const cursor = search.result as IDBCursorWithValue | undefined;
          if (!cursor) {
            resolve(found);
          } else {
            found.push(cursor.value); // tslint:disable-line:no-unsafe-any
            if (query.limit && found.length >= query.limit) {
              resolve(found);
            } else {
              cursor.continue();
            }
          }
        },
        reject);
    });
    return raw;
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

  private static updateSearchable = (emailEntity: Email) => {
    const email = emailEntity.email.toLowerCase();
    const name = emailEntity.name ? emailEntity.name.toLowerCase() : '';
    const parts = [email, name];
    const domain: string = email.split('@').pop() || '';
    parts.push(domain, ...email.split(/[^a-z0-9]/));
    parts.push(...name.split(/[^a-z0-9]/));
    const index: string[] = [];
    for (const part of parts.filter(p => !!p)) {
      let substring = '';
      for (const letter of part.split('')) {
        substring += letter;
        const normalized = ContactStore.normalizeString(substring);
        if (!index.includes(normalized)) {
          index.push(ContactStore.dbIndex(emailEntity.fingerprints.length > 0, normalized));
        }
      }
    }
    emailEntity.searchable = index;
  }

  private static setReqOnError = (req: IDBRequest, reject: (reason?: any) => void) => {
    req.onerror = () => reject(ContactStore.errCategorize(req.error || new Error('Unknown db error')));
  }

  private static setReqPipe<T>(req: IDBRequest, pipe: (value?: T) => void, reject: (reason?: any) => void) {
    req.onsuccess = () => {
      try {
        pipe(req.result as T);
      } catch (codeErr) {
        reject(codeErr);
        Catch.reportErr(codeErr);
      }
    };
    this.setReqOnError(req, reject);
  }

  private static dbContactInternalGetOne = async (db: IDBDatabase, emailOrLongid: string): Promise<Contact | undefined> => {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(['emails', 'pubkeys'], 'readonly');
      if (!/^[A-F0-9]{16}$/.test(emailOrLongid)) { // email
        const req = tx.objectStore('emails').get(emailOrLongid);
        ContactStore.setReqPipe(req,
          (email: Email) => {
            if (!email) {
              resolve(undefined);
              return;
            }
            if (!email.fingerprints || email.fingerprints.length === 0) {
              resolve(undefined);
              return;
            }
            // todo: load all fingerprints and pick a valid one?
            const req2 = tx.objectStore('pubkeys').get(email.fingerprints[0]);
            ContactStore.setReqPipe(req2,
              (pubkey: Pubkey) => {
                resolve(ContactStore.toContact(email, pubkey));
              },
              reject);
          },
          reject);
      } else { // search all longids
        const req = tx.objectStore('pubkeys').index('index_longids').get(emailOrLongid);
        ContactStore.setReqPipe(req,
          (pubkey: Pubkey) => {
            if (!pubkey) {
              resolve(undefined);
              return;
            }
            const req2 = tx.objectStore('emails').index('index_fingerprints').get(pubkey.fingerprint!);
            ContactStore.setReqPipe(req2,
              (email: Email) => {
                if (!email) {
                  resolve(undefined);
                } else {
                  resolve(ContactStore.toContact(email, pubkey));
                }
              },
              reject);
          },
          reject);
      }
    });
  }

  private static getKeyAttributes = (key: Key | undefined): { fingerprint: string | null, expiresOn: number | null, pubkey_last_sig: number | null } => {
    return { fingerprint: key?.id ?? null, expiresOn: Number(key?.expiration) || null, pubkey_last_sig: Number(key?.lastModified) || null };
  }

  private static toContact = async (email: Email, pubkey: Pubkey): Promise<Contact | undefined> => {
    if (!email) {
      return;
    }
    const parsed = pubkey ? await KeyUtil.parse(pubkey.armoredKey) : undefined;
    return {
      email: email.email,
      name: email.name,
      pubkey: parsed,
      has_pgp: pubkey ? 1 : 0,
      pending_lookup: email.pendingLookup,
      last_use: email.lastUse,
      pubkey_last_check: pubkey?.lastCheck,
      ...ContactStore.getKeyAttributes(parsed)
    };
  }

  private static toContactPreview = (result: Email): ContactPreview => {
    return { email: result.email, name: result.name, has_pgp: result.fingerprints.length > 0 ? 1 : 0, last_use: result.lastUse };
  }

  private static recreateDates = (contacts: (Contact | undefined)[]) => {
    for (const contact of contacts) {
      if (contact) {
        // string dates were created by JSON serializing Date objects
        // convert any previously saved string-dates into numbers
        if (typeof contact?.pubkey?.created === 'string') {
          contact.pubkey.created = new Date(contact.pubkey.created).getTime();
        }
        if (typeof contact?.pubkey?.expiration === 'string') {
          contact.pubkey.expiration = new Date(contact.pubkey.expiration).getTime();
        }
        if (typeof contact?.pubkey?.lastModified === 'string') {
          contact.pubkey.lastModified = new Date(contact.pubkey.lastModified).getTime();
        }
      }
    }
    return contacts;
  }

}
