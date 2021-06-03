/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AbstractStore } from './abstract-store.js';
import { Catch } from '../catch.js';
import { opgp } from '../../core/crypto/pgp/openpgpjs-custom.js';
import { BrowserMsg } from '../../browser/browser-msg.js';
import { DateUtility, Str } from '../../core/common.js';
import { Key, Contact, KeyUtil } from '../../core/crypto/key.js';

// tslint:disable:no-null-keyword

type DbContactObjArg = {
  email: string,
  name?: string | null,
  pubkey?: string | null,
  lastUse?: number | null, // when was this contact last used to send an email
  lastCheck?: number | null; // when was the local copy of the pubkey last updated (or checked against Attester)
};

export type Email = {
  email: string;
  name: string | null;
  searchable: string[];
  fingerprints: string[];
  lastUse: number | null;
};

export type Pubkey = {
  fingerprint: string;
  armoredKey: string;
  longids: string[];
  lastCheck: number | null,
  expiresOn: number | null;
};

type Revocation = {
  fingerprint: string;
};

type PubkeyAttributes = {
  fingerprint: string | null;
  expiresOn: number | null;
};

export type ContactV4 = {
  info: Email,
  pubkeys: Pubkey[],
  revocations: Revocation[]
}

export type ContactPreview = {
  email: string;
  name: string | null;
  hasPgp: 0 | 1;
  lastUse: number | null;
};

export type ContactUpdate = {
  name?: string | null;
  lastUse?: number | null;
  pubkey?: Key;
  pubkeyLastCheck?: number | null; // when non-null, `pubkey` must be supplied
};

type DbContactFilter = { hasPgp?: boolean, substring?: string, limit?: number };

const x509postfix = "-X509";

/**
 * Store of contacts and their public keys
 * This includes an index of email and name substrings for easier search when user is typing
 * Db is initialized in the background page and accessed through BrowserMsg
 */
export class ContactStore extends AbstractStore {

  // static [f: string]: Function; // https://github.com/Microsoft/TypeScript/issues/6480

  private static dbQueryKeys = ['limit', 'substring', 'hasPgp'];

  public static dbOpen = async (): Promise<IDBDatabase> => {
    return await new Promise((resolve, reject) => {
      const openDbReq = indexedDB.open('cryptup', 5);
      openDbReq.onupgradeneeded = (event) => {
        const db = openDbReq.result;
        if (event.oldVersion < 4) {
          const emails = db.createObjectStore('emails', { keyPath: 'email' });
          const pubkeys = db.createObjectStore('pubkeys', { keyPath: 'fingerprint' });
          emails.createIndex('search', 'searchable', { multiEntry: true });
          emails.createIndex('index_fingerprints', 'fingerprints', { multiEntry: true }); // fingerprints of all connected pubkeys
          pubkeys.createIndex('index_longids', 'longids', { multiEntry: true }); // longids of all public key packets in armored pubkey
        }
        if (event.oldVersion < 5) {
          db.createObjectStore('revocations', { keyPath: 'fingerprint' });
        }
        if (db.objectStoreNames.contains('contacts')) {
          const countRequest = openDbReq.transaction!.objectStore('contacts').count();
          ContactStore.setReqPipe(countRequest, (count: number) => {
            if (count === 0) {
              console.info('contacts store is now empty, deleting it...');
              db.deleteObjectStore('contacts');
            }
          });
        }
      };
      openDbReq.onsuccess = () => resolve(openDbReq.result as IDBDatabase);
      openDbReq.onblocked = () => reject(ContactStore.errCategorize(openDbReq.error));
      openDbReq.onerror = () => reject(ContactStore.errCategorize(openDbReq.error));
    });
  }

  public static previewObj = ({ email, name }: { email: string, name?: string | null }): ContactPreview => {
    const validEmail = Str.parseEmail(email).email;
    if (!validEmail) {
      throw new Error(`Cannot handle the contact because email is not valid: ${email}`);
    }
    return { email: validEmail, name: name || null, hasPgp: 0, lastUse: null };
  }

  public static obj = async ({ email, name, pubkey, lastUse, lastCheck }: DbContactObjArg): Promise<Contact> => {
    if (typeof opgp === 'undefined') {
      return await BrowserMsg.send.bg.await.db({ f: 'obj', args: [{ email, name, pubkey, lastUse, lastCheck }] }) as Contact;
    } else {
      const validEmail = Str.parseEmail(email).email;
      if (!validEmail) {
        throw new Error(`Cannot save contact because email is not valid: ${email}`);
      }
      if (!pubkey) {
        return {
          email: validEmail,
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
      return {
        email: validEmail,
        name: name || null,
        pubkey: pk,
        hasPgp: 1, // number because we use it for sorting
        lastUse: lastUse || null,
        pubkeyLastCheck: lastCheck || null,
        revoked: pk.revoked,
        ...ContactStore.getKeyAttributes(pk)
      };
    }
  }

  /**
   * Used to save a contact or an array of contacts.
   * An underlying update operation is used for each of the provided contact.
   * Null properties will be ignored if a record already exists in the database
   * as described in the `update` remarks.
   *
   * @param {IDBDatabase} db                     (optional) database to use
   * @param {Contact | Contact[]} email            a single contact or an array of contacts
   * @returns {Promise<void>}
   *
   * @async
   * @static
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
   * Used to update certain fields of existing contacts or create new contacts using the provided data.
   * If an array of emails is provided, the update operation will be performed independently on each of them.
   * Null or missing properties from the `update` object will not be overwritten in the database,
   * The `pubkey` property will be used only to add or update a pubkey record by the pubkey fingerprint.
   * Null value of `pubkey` won't affect any pubkey records.
   * The `pubkeyLastCheck` property can be set to a non-null value only when `pubkey` specified
   * and will be applied only to that specific pubkey record. Missing or null `pubkeyLastCheck` will
   * leave the `pubkeyLastCheck` value of the existing pubkey unchanged.
   *
   * @param {IDBDatabase} db                     (optional) database to use
   * @param {string | string[]} email            a single email or an array of emails
   * @param {ContactUpdate} update               object containing fields to be updated
   * @returns {Promise<void>}
   *
   * @async
   * @static
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
    const validEmail = Str.parseEmail(email).email;
    if (!validEmail) {
      throw Error(`Cannot update contact because email is not valid: ${email}`);
    }
    if (update.pubkey?.isPrivate) {
      Catch.report(`Wrongly updating prv ${update.pubkey.id} as contact - converting to pubkey`);
      update.pubkey = await KeyUtil.asPublicKey(update.pubkey);
    }
    const tx = db.transaction(['emails', 'pubkeys', 'revocations'], 'readwrite');
    await new Promise((resolve, reject) => {
      ContactStore.setTxHandlers(tx, resolve, reject);
      ContactStore.updateTx(tx, validEmail, update);
    });
  }

  public static get = async (db: undefined | IDBDatabase, emailOrLongid: string[]): Promise<(Contact | undefined)[]> => {
    if (!db) { // relay op through background process
      return await BrowserMsg.send.bg.await.db({ f: 'get', args: [emailOrLongid] }) as (Contact | undefined)[];
    }
    if (emailOrLongid.length === 1) {
      const contact = await ContactStore.dbContactInternalGetOne(db, emailOrLongid[0]);
      return [contact];
    } else {
      const results: (Contact | undefined)[] = [];
      for (const singleEmailOrLongid of emailOrLongid) {
        const [contact] = await ContactStore.get(db, [singleEmailOrLongid]);
        results.push(contact);
      }
      return results;
    }
  }

  public static search = async (db: IDBDatabase | undefined, query: DbContactFilter): Promise<ContactPreview[]> => {
    return (await ContactStore.rawSearch(db, query)).filter(Boolean).map(ContactStore.toContactPreview);
  }

  public static searchPubkeys = async (db: IDBDatabase | undefined, query: DbContactFilter): Promise<string[]> => {
    const fingerprints = (await ContactStore.rawSearch(db, query)).filter(Boolean).map(email => email.fingerprints).reduce((a, b) => a.concat(b));
    return (await ContactStore.extractPubkeys(db, fingerprints)).map(pubkey => pubkey?.armoredKey).filter(Boolean);
  }

  public static getOneWithAllPubkeys = async (db: IDBDatabase | undefined, email: string):
    Promise<{ info: Email, sortedPubkeys: { pubkey: Key, revoked: boolean, lastCheck: number | null }[] } | undefined> => {
    if (!db) { // relay op through background process
      // tslint:disable-next-line:no-unsafe-any
      return await BrowserMsg.send.bg.await.db({ f: 'getOneWithAllPubkeys', args: [email] });
    }
    const tx = db.transaction(['emails', 'pubkeys', 'revocations'], 'readonly');
    const pubkeys: Pubkey[] = [];
    const revocations: Revocation[] = [];
    const emailEntity: Email | undefined = await new Promise((resolve, reject) => {
      const req = tx.objectStore('emails').get(email);
      ContactStore.setReqPipe(req,
        (email: Email) => {
          if (!email) {
            resolve(undefined);
            return;
          }
          if (!email.fingerprints || email.fingerprints.length === 0) {
            resolve(email);
            return;
          }
          const uniqueAndStrippedFingerprints = email.fingerprints.
            map(ContactStore.stripFingerprint).
            filter((value, index, self) => !self.slice(0, index).find((el) => el === value));
          let countdown = email.fingerprints.length + uniqueAndStrippedFingerprints.length;
          // request all pubkeys by fingerprints
          for (const fp of email.fingerprints) {
            const req2 = tx.objectStore('pubkeys').get(fp);
            ContactStore.setReqPipe(req2,
              (pubkey: Pubkey) => {
                if (pubkey) {
                  pubkeys.push(pubkey);
                }
                if (!--countdown) {
                  resolve(email);
                }
              },
              reject);
          }
          for (const fp of uniqueAndStrippedFingerprints) {
            const range = ContactStore.createFingerprintRange(fp);
            const req3 = tx.objectStore('revocations').getAll(range);
            ContactStore.setReqPipe(req3,
              (revocation: Revocation[]) => {
                revocations.push(...revocation);
                if (!--countdown) {
                  resolve(email);
                }
              },
              reject);
          }
        },
        reject);
    });
    return emailEntity ? { info: emailEntity, sortedPubkeys: await ContactStore.sortKeys(pubkeys, revocations) } : undefined;
  }

  public static getPubkey = async (db: IDBDatabase | undefined, { id, type }: { id: string, type: string }):
    Promise<string | undefined> => {
    if (!db) { // relay op through background process
      return (await BrowserMsg.send.bg.await.db({ f: 'getPubkey', args: [{ id, type }] })) as string | undefined;
    }
    const internalFingerprint = ContactStore.getPubkeyId({ id, type });
    const tx = db.transaction(['pubkeys'], 'readonly');
    const emailEntity: Pubkey = await new Promise((resolve, reject) => {
      const req = tx.objectStore('pubkeys').get(internalFingerprint);
      ContactStore.setReqPipe(req, resolve, reject);
    });
    return emailEntity?.armoredKey;
  }

  public static updateTx = (tx: IDBTransaction, email: string, update: ContactUpdate) => {
    if (update.pubkey && !update.pubkeyLastCheck) {
      const req = tx.objectStore('pubkeys').get(ContactStore.getPubkeyId(update.pubkey));
      ContactStore.setReqPipe(req, (pubkey: Pubkey) => {
        const range = ContactStore.createFingerprintRange(update.pubkey!.id);
        const req2 = tx.objectStore('revocations').getAll(range);
        ContactStore.setReqPipe(req2, (revocations: Revocation[]) => {
          ContactStore.updateTxPhase2(tx, email, update, pubkey, revocations);
        });
      });
    } else {
      ContactStore.updateTxPhase2(tx, email, update, undefined, []);
    }
  }

  public static setReqPipe<T>(req: IDBRequest, pipe: (value?: T) => void, reject?: ((reason?: any) => void) | undefined) {
    req.onsuccess = () => {
      try {
        pipe(req.result as T);
      } catch (codeErr) {
        req.transaction!.dispatchEvent(new ErrorEvent('error'));
        if (reject) {
          reject(codeErr);
        }
        Catch.reportErr(codeErr);
      }
    };
    if (reject) {
      this.setReqOnError(req, reject);
    }
  }

  public static pubkeyObj = (pubkey: Key, lastCheck: number | null | undefined): Pubkey => {
    const keyAttrs = ContactStore.getKeyAttributes(pubkey);
    return {
      fingerprint: ContactStore.getPubkeyId(pubkey),
      lastCheck: DateUtility.asNumber(lastCheck),
      expiresOn: keyAttrs.expiresOn,
      longids: KeyUtil.getPubkeyLongids(pubkey),
      armoredKey: KeyUtil.armor(pubkey)
    };
  }

  public static revocationObj = (pubkey: Key): { fingerprint: string, armoredKey: string } => {
    return { fingerprint: ContactStore.getPubkeyId(pubkey), armoredKey: KeyUtil.armor(pubkey) };
    // todo: we can add a timestamp here and/or some other info
  }

  private static sortKeys = async (pubkeys: Pubkey[], revocations: Revocation[]) => {
    // parse the keys
    const parsed = await Promise.all(pubkeys.map(async (pubkey) => {
      const pk = await KeyUtil.parse(pubkey.armoredKey);
      const revoked = pk.revoked || revocations.some(r => ContactStore.equalFingerprints(pk.id, r.fingerprint));
      const expirationSortValue = (typeof pk.expiration === 'undefined') ? Infinity : pk.expiration!;
      return {
        lastCheck: pubkey.lastCheck,
        pubkey: pk,
        revoked,
        // sort non-revoked first, then non-expired
        sortValue: revoked ? -Infinity : expirationSortValue
      };
    }));
    return parsed.sort((a, b) => b.sortValue - a.sortValue);
  }

  private static getPubkeyId = ({ id, type }: { id: string, type: string }): string => {
    return (type === 'x509') ? (id + x509postfix) : id;
  }

  private static stripFingerprint = (fp: string): string => {
    return fp.endsWith(x509postfix) ? fp.slice(0, -x509postfix.length) : fp;
  }

  private static equalFingerprints = (fp1: string, fp2: string): boolean => {
    return (fp1.endsWith(x509postfix) ? fp1 : (fp1 + x509postfix))
      === (fp2.endsWith(x509postfix) ? fp2 : (fp2 + x509postfix));
  }

  private static createFingerprintRange = (fp: string): IDBKeyRange => {
    const strippedFp = ContactStore.stripFingerprint(fp);
    return IDBKeyRange.bound(strippedFp, strippedFp + x509postfix, false, false);
  }

  private static updateTxPhase2 = (tx: IDBTransaction, email: string, update: ContactUpdate,
    existingPubkey: Pubkey | undefined, revocations: Revocation[]) => {
    let pubkeyEntity: Pubkey | undefined;
    if (update.pubkey) {
      const internalFingerprint = ContactStore.getPubkeyId(update.pubkey!);
      if (update.pubkey.type === 'openpgp' && !update.pubkey.revoked && revocations.some(r => r.fingerprint === internalFingerprint)) {
        // we have this fingerprint revoked but the supplied key isn't
        // so let's not save it
        // pubkeyEntity = undefined
      } else {
        pubkeyEntity = ContactStore.pubkeyObj(update.pubkey, update.pubkeyLastCheck ?? existingPubkey?.lastCheck);
      }
      if (update.pubkey.revoked && !revocations.some(r => r.fingerprint === internalFingerprint)) {
        tx.objectStore('revocations').put(ContactStore.revocationObj(update.pubkey));
      }
      // todo: will we benefit anything when not saving pubkey if it isn't modified?
    } else if (update.pubkeyLastCheck) {
      Catch.report(`Wrongly updating pubkeyLastCheck without specifying pubkey for ${email} - ignoring`);
    }
    const req = tx.objectStore('emails').get(email);
    ContactStore.setReqPipe(req, (emailEntity: Email) => {
      let updatedEmailEntity: Email | undefined;
      if (!emailEntity) {
        updatedEmailEntity = { email, name: null, searchable: [], fingerprints: [], lastUse: null };
      } else if (pubkeyEntity || update.name || update.lastUse) {
        updatedEmailEntity = emailEntity;
      } else {
        updatedEmailEntity = undefined; // not modified
      }
      if (updatedEmailEntity) {
        if (pubkeyEntity) {
          if (!updatedEmailEntity.fingerprints.includes(pubkeyEntity.fingerprint)) {
            updatedEmailEntity.fingerprints.push(pubkeyEntity.fingerprint);
          }
        }
        if (update.name) {
          updatedEmailEntity.name = update.name;
        }
        if (update.lastUse) {
          updatedEmailEntity.lastUse = DateUtility.asNumber(update.lastUse);
        }
        ContactStore.updateSearchable(updatedEmailEntity);
        tx.objectStore('emails').put(updatedEmailEntity);
      }
      if (pubkeyEntity) {
        tx.objectStore('pubkeys').put(pubkeyEntity);
      }
    });
  }

  private static chainExtraction<T>(
    store: IDBObjectStore,
    setup: { keys: IDBValidKey[], values: T[] },
    req?: IDBRequest | undefined): void {
    if (req) {
      ContactStore.setReqPipe(req,
        (value: T) => {
          if (value) {
            setup.values.push(value);
          }
        });
    }
    const key = setup.keys.pop();
    if (key) {
      const reqNext = store.get(key);
      ContactStore.chainExtraction(store, setup, reqNext);
    }
  }

  private static async extractKeyset<T>(db: IDBDatabase, storeName: string, keys: IDBValidKey[], poolSize: number): Promise<T[]> {
    const tx = db.transaction([storeName], 'readonly');
    const setup = { keys, values: [] as T[] };
    await new Promise((resolve, reject) => {
      ContactStore.setTxHandlers(tx, resolve, reject);
      for (let poolCount = 0; poolCount < poolSize; poolCount++) {
        ContactStore.chainExtraction(tx.objectStore(storeName), setup);
      }
    });
    return setup.values;
  }

  private static extractPubkeys = async (db: IDBDatabase | undefined, fingerprints: string[]): Promise<Pubkey[]> => {
    if (!fingerprints.length) {
      return [];
    }
    if (!db) { // relay op through background process
      return await BrowserMsg.send.bg.await.db({ f: 'extractPubkeys', args: [fingerprints] }) as Pubkey[];
    }
    return await ContactStore.extractKeyset(db, 'pubkeys', fingerprints, 10);
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
    if (typeof query.hasPgp === 'undefined' && query.substring) {
      const resultsWithPgp = await ContactStore.rawSearch(db, { substring: query.substring, limit: query.limit, hasPgp: true });
      if (query.limit && resultsWithPgp.length === query.limit) {
        return resultsWithPgp;
      } else {
        const limit = query.limit ? query.limit - resultsWithPgp.length : undefined;
        const resultsWithoutPgp = await ContactStore.rawSearch(db, { substring: query.substring, limit, hasPgp: false });
        return resultsWithPgp.concat(resultsWithoutPgp);
      }
    }
    const emails = db.transaction(['emails'], 'readonly').objectStore('emails');
    const raw: Email[] = await new Promise((resolve, reject) => {
      let search: IDBRequest;
      if (typeof query.hasPgp === 'undefined') { // any query.hasPgp value
        search = emails.openCursor(); // no substring, already covered in `typeof query.hasPgp === 'undefined' && query.substring` above
      } else { // specific query.hasPgp value
        const indexRange = ContactStore.dbIndexRange(query.hasPgp, query.substring ?? '');
        // To find all the index keys starting with a certain sequence of characters (e.g. 'abc')
        // we use a range with inclusive lower boundary and exclusive upper boundary
        // ['t:abc', 't:abd) or ['f:abc', 'f:abd'), so that any key having an arbitrary tail of
        // characters beyond 'abc' falls into this range, and none of the non-matching keys do.
        // Thus we only have to keep complete keywords in the 'search' index.
        const range = IDBKeyRange.bound(indexRange.lowerBound, indexRange.upperBound, false, true);
        search = emails.index('search').openCursor(range);
      }
      const found: Email[] = [];
      ContactStore.setReqPipe(search,
        (cursor: IDBCursorWithValue) => {
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

  private static dbIndex = (hasPgp: boolean, substring: string): string => {
    return (hasPgp ? 't:' : 'f:') + substring;
  }

  private static dbIndexRange = (hasPgp: boolean, substring: string): { lowerBound: string, upperBound: string } => {
    // to find all the keys starting with 'abc', we need to use a range search with exlcusive upper boundary
    // ['t:abc', 't:abd'), that is, we "replace" the last char ('c') with the char having subsequent code ('d')
    // The edge case is when the search string terminates with a certain char X having the max allowed code (65535)
    // or with a sequence of these, e.g. 'abcXXXXX'. In this case, we have to remove the tail of X characters
    // and increase the preceding non-X char, hence, the range would be ['t:abcXXXXX', 't:abd')
    // If the search sequence consists entirely of such symbols, the search range will have
    // the upper boundary of 'f;' or 't;', so this algorithm always works
    const lowerBound = ContactStore.dbIndex(hasPgp, substring);
    let copyLength = lowerBound.length - 1;
    let lastChar = lowerBound.charCodeAt(copyLength);
    while (lastChar >= 65535) {
      lastChar = lowerBound.charCodeAt(--copyLength);
    }
    const upperBound = lowerBound.substring(0, copyLength) + String.fromCharCode(lastChar + 1);
    return { lowerBound, upperBound };
  }

  private static updateSearchable = (emailEntity: Email) => {
    const email = emailEntity.email.toLowerCase();
    const name = emailEntity.name ? emailEntity.name.toLowerCase() : '';
    // we only need the longest word if it starts with a shorter one,
    // e.g. we don't need "flowcrypt" if we have "flowcryptcompatibility"
    const sortedNormalized = [...email.split(/[^a-z0-9]/), ...name.split(/[^a-z0-9]/)].filter(p => !!p)
      .map(ContactStore.normalizeString).sort((a, b) => b.length - a.length);
    emailEntity.searchable = sortedNormalized.filter((value, index, self) => !self.slice(0, index).find((el) => el.startsWith(value)))
      .map(normalized => ContactStore.dbIndex(emailEntity.fingerprints.length > 0, normalized));
  }

  private static dbContactInternalGetOne = async (db: IDBDatabase, emailOrLongid: string): Promise<Contact | undefined> => {
    if (emailOrLongid.includes('@')) { // email
      const contactWithAllPubkeys = await ContactStore.getOneWithAllPubkeys(db, emailOrLongid);
      if (!contactWithAllPubkeys) {
        return contactWithAllPubkeys;
      }
      // pick first usableForEncryption
      let selected = contactWithAllPubkeys.sortedPubkeys.find(entry => !entry.revoked && entry.pubkey.usableForEncryption);
      if (!selected) {
        selected = contactWithAllPubkeys.sortedPubkeys.find(entry => !entry.revoked && entry.pubkey.usableForEncryptionButExpired);
      }
      if (!selected) {
        selected = contactWithAllPubkeys.sortedPubkeys[0];
      }
      return ContactStore.toContactFromKey(contactWithAllPubkeys.info, selected?.pubkey, selected?.lastCheck, Boolean(selected?.revoked));
    }
    // search all longids
    const tx = db.transaction(['emails', 'pubkeys'], 'readonly');
    return await new Promise((resolve, reject) => {
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
                resolve(ContactStore.toContact(db, email, pubkey));
              }
            },
            reject);
        },
        reject);
    });
  }

  private static getKeyAttributes = (key: Key | undefined): PubkeyAttributes => {
    return { fingerprint: key?.id ?? null, expiresOn: DateUtility.asNumber(key?.expiration) };
  }

  private static toContact = async (db: IDBDatabase, email: Email, pubkey: Pubkey | undefined): Promise<Contact | undefined> => {
    if (!email) {
      return;
    }
    const parsed = pubkey ? await KeyUtil.parse(pubkey.armoredKey) : undefined;
    let revokedExternally = false;
    if (parsed && !parsed.revoked) {
      const revocations: Revocation[] = await new Promise((resolve, reject) => {
        const tx = db.transaction(['revocations'], 'readonly');
        const range = ContactStore.createFingerprintRange(parsed!.id);
        const req = tx.objectStore('revocations').getAll(range);
        ContactStore.setReqPipe(req, resolve, reject);
      });
      if (revocations.length) {
        revokedExternally = true;
      }
    }
    return ContactStore.toContactFromKey(email, parsed, parsed ? pubkey!.lastCheck : null, revokedExternally);
  }

  private static toContactFromKey = (email: Email, key: Key | undefined, lastCheck: number | undefined | null, revokedExternally: boolean): Contact | undefined => {
    if (!email) {
      return;
    }
    const safeKey = revokedExternally ? undefined : key;
    return {
      email: email.email,
      name: email.name,
      pubkey: safeKey,
      hasPgp: safeKey ? 1 : 0,
      lastUse: email.lastUse,
      pubkeyLastCheck: lastCheck ?? null,
      ...ContactStore.getKeyAttributes(key),
      revoked: revokedExternally || Boolean(key?.revoked)
    };
  }

  private static toContactPreview = (result: Email): ContactPreview => {
    return { email: result.email, name: result.name, hasPgp: result.fingerprints.length > 0 ? 1 : 0, lastUse: result.lastUse };
  }
}
