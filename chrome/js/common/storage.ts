/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

class Store {

  private static global_storage_scope = 'global';
  private static db_query_keys = ['limit', 'substring', 'has_pgp'];

  private static env_is_background_script() {
    return window.location && tool.value('_generated_background_page.html').in(window.location.href);
  }

  static key(account_key_or_list: string|string[], key: string|string[]) {
    if(Array.isArray(account_key_or_list)) {
      let all_results: string[] = [];
      for(let account_key of account_key_or_list) {
        all_results = all_results.concat(Store.key(account_key, key));
      }
      return all_results;
    } else {
      let prefix = 'cryptup_' + account_key_or_list.replace(/[^A-Za-z0-9]+/g, '').toLowerCase() + '_';
      if(Array.isArray(key)) {
        return key.map(k => prefix + k);
      } else {
        return prefix + key;
      }
    }
  }

  // todo: how does this deal with null?
  private static account_storage_object_keys_to_original(account_or_accounts: string|string[]|null, storage_object: Dict<string>) {
    if(typeof account_or_accounts === 'string') {
      let fixed_keys_object: Dict<string> = {};
      tool.each(storage_object, (k: string, v) => {
        // @ts-ignore
        let fixed_key = k.replace(Store.key(account_or_accounts, ''), '');
        if(fixed_key !== k) {
          fixed_keys_object[fixed_key] = v;
        }
      });
      return fixed_keys_object;
    } else {
      let results_by_account: Dict<string[]> = {};
      // @ts-ignore - look into this later
      for(let account of account_or_accounts) {
        results_by_account[account] = Store.account_storage_object_keys_to_original(account, storage_object) as any as string[];
      }
      return results_by_account;
    }
  }

  static session_get(account_email: string, key: string) {
    return new Promise((resolve: Callback, reject: Callback) => {
      if(Store.env_is_background_script()) {
        resolve(window.sessionStorage[Store.key(account_email, key) as string]);
      } else {
        tool.browser.message.send(null, 'session_get', {account_email: account_email, key: key}, resolve);
      }
    });
  }

  static session_set(account_email: string, key: string, value: string|undefined) {
    return new Promise((resolve: Callback, reject: Callback) => {
      if(Store.env_is_background_script()) {
        if(typeof value !== 'undefined') {
          sessionStorage[Store.key(account_email, key) as string] = String(value);
        } else {
          sessionStorage.removeItem(Store.key(account_email, key) as string);
        }
        resolve();
      } else {
        tool.browser.message.send(null, 'session_set', {account_email: account_email, key: key, value: value}, resolve);
      }
    });
  }

  static passphrase_save(storage_type: StorageType, account_email: string, longid: string, passphrase: string|undefined) {
    return new Promise((resolve: Callback, reject: Callback) => {
      let storage_k = 'passphrase_' + longid;
      if (storage_type === 'session') {
        Store.session_set(account_email, storage_k, passphrase).then(resolve, reject);
      } else {
        if(typeof passphrase === 'undefined') {
          Store.remove(account_email, [storage_k], resolve);
        } else {
          let to_save: Dict<string> = {};
          to_save[storage_k] = passphrase;
          Store.set(account_email, to_save, resolve);
        }
      }
    });
  }

  static passphrase_get(account_email: string, longid: string, ignore_session:boolean=false): Promise<string|null> {
    return new Promise((resolve: (passphrase: string|null) => void, reject: Callback) => {
      let storage_k = 'passphrase_' + longid;
      Store.get(account_email, [storage_k], (storage: Storage) => {
        if(typeof storage[storage_k] === 'string') {
          resolve(storage[storage_k]);
        } else {
          Store.session_get(account_email, storage_k).then(from_session => {
            resolve(from_session && !ignore_session ? from_session : null);
          });
        }
      });
    });
  }

  static keys_get(account_email: string, longid:string|null=null) {
    return new Promise((resolve: Callback, reject: Callback) => {
      Store.get(account_email, ['keys'], (storage: {keys: KeyInfo[]|undefined}) => {
        let keys = storage.keys || [];
        if(typeof longid !== 'undefined' && longid !== null) { // looking for a specific key(s)
          let found: KeyInfo|KeyInfo[]|null;
          if(Array.isArray(longid)) { // looking for an array of keys
            found = [];
            for(let keyinfo of keys) {
              if(tool.value(keyinfo.longid).in(longid) || (tool.value('primary').in(longid) && keyinfo.primary)) {
                found.push(keyinfo);
              }
            }
          } else { // looking for a single key
            found = null;
            for(let keyinfo of keys) {
              if(keyinfo.longid === longid || (longid === 'primary' && keyinfo.primary)) {
                found = keyinfo;
                break;
              }
            }
          }
          resolve(found);
        } else { // return all keys
          resolve(keys);
        }
      });
    });
  }

  static keys_object(armored_prv: string, primary=false) {
    let longid = tool.crypto.key.longid(armored_prv)!;
    return { // todo - should we not be checking longid!==null? or is it checked before calling this?
      private: armored_prv,
      public: tool.crypto.key.read(armored_prv).toPublic().armor(),
      primary: primary,
      longid: longid,
      fingerprint: tool.crypto.key.fingerprint(armored_prv)!,
      keywords: (window as FlowCryptWindow).mnemonic(longid),
    };
  }

  static keys_add(account_email: string, new_key_armored: string) { // todo: refactor setup.js -> backup.js flow so that keys are never saved naked, then re-enable naked key check
    return new Promise((resolve: Callback, reject: Callback) => {
      Store.keys_get(account_email).then((keyinfos: KeyInfo[]) => {
        let updated = false;
        let new_key_longid = tool.crypto.key.longid(new_key_armored);
        if (new_key_longid) {
          for(let i in keyinfos) {
            if (new_key_longid === keyinfos[i].longid) { // replacing a key
              keyinfos[i] = Store.keys_object(new_key_armored, keyinfos[i].primary) as KeyInfo;
              updated = true;
            }
          }
          if (!updated) {
            keyinfos.push(Store.keys_object(new_key_armored, keyinfos.length === 0));
          }
          // @ts-ignore - look into this later
          Store.set(account_email, {keys: keyinfos}, resolve);
        } else {
          resolve();
        }
      });
    });
  }

  static keys_remove(account_email: string, remove_longid: string) {
    return new Promise((resolve: Callback, reject: Callback) => {
      Store.keys_get(account_email).then(private_keys => {
        let filtered_private_keys: KeyInfo[] = [];
        tool.each(private_keys, (i, keyinfo) => {
          if(keyinfo.longid !== remove_longid) {
            filtered_private_keys.push(keyinfo);
          }
        });
        Store.set(account_email, {keys: filtered_private_keys as any as Serializable[]}, resolve);
      });
    });
  }

  static set(account_email: string|null, values: Dict<Serializable[]|Serializable>, callback?: VoidCallback) {
    if(!account_email) {
      account_email = Store.global_storage_scope;
    }
    let storage_update = {};
    tool.each(values, (key, value) => {
      // @ts-ignore
      storage_update[Store.key(account_email, key)] = value;
    });
    chrome.storage.local.set(storage_update, () => {
      catcher.try(() => {
        if(typeof callback === 'function') {
          callback();
        }
      })();
    });
  }

  static get(account_or_accounts: string|string[]|null, keys: string[], callback: Callback) {
    if(!account_or_accounts) {
      account_or_accounts = Store.global_storage_scope;
    }
    chrome.storage.local.get(Store.key(account_or_accounts, keys), storage_object => {
      catcher.try(() => {
        callback(Store.account_storage_object_keys_to_original(account_or_accounts, storage_object));
      })();
    });
  }

  static remove(account_email: string|null, key_or_keys: string[], callback?: VoidCallback) {
    if(!account_email) {
      account_email = Store.global_storage_scope;
    }
    chrome.storage.local.remove(Store.key(account_email, key_or_keys), () => {
      catcher.try(() => {
        if(typeof callback !== 'undefined') {
          callback();
        }
      })();
    });
  }

  static account_emails_get(callback: (emails: string[]) => void) {
    Store.get(null, ['account_emails'], storage => {
      let account_emails: string[] = [];
      if(typeof storage.account_emails !== 'undefined') {
        tool.each(JSON.parse(storage.account_emails), function (i, account_email) {
          if(!tool.value(account_email.toLowerCase()).in(account_emails)) {
            account_emails.push(account_email.toLowerCase());
          }
        });
      }
      callback(account_emails);
    });
  }

  static account_emails_add(account_email: string, callback?: VoidCallback) { //todo: concurrency issues with another tab loaded at the same time
    Store.account_emails_get(function (account_emails) {
      if(!account_email) {
        catcher.report('attempting to save empty account_email: ' + account_email);
      }
      if(!tool.value(account_email).in(account_emails) && account_email) {
        account_emails.push(account_email);
        Store.set(null, { account_emails: JSON.stringify(account_emails) }, () => {
          tool.browser.message.send(null, 'update_uninstall_url', null, callback);
        });
      } else if(typeof callback !== 'undefined') {
        callback();
      }
    });
  }

  static auth_info(callback: (registered_email: string|null, registered_uuid: string|null, already_verified: boolean) => void) {
    Store.get(null, ['cryptup_account_email', 'cryptup_account_uuid', 'cryptup_account_verified'], storage => {
      callback(storage.cryptup_account_email, storage.cryptup_account_uuid, storage.cryptup_account_verified);
    });
  }

  static subscription(callback: (stored_level: 'pro'|null, stored_expire:string|null, stored_active: boolean, stored_method: 'stripe'|'trial'|'group'|null) => void) {
    Store.get(null, ['cryptup_account_email', 'cryptup_account_uuid', 'cryptup_account_verified', 'cryptup_account_subscription'], s => {
      if(s.cryptup_account_email && s.cryptup_account_uuid && s.cryptup_account_subscription && s.cryptup_account_subscription.level) {
        callback(s.cryptup_account_subscription.level, s.cryptup_account_subscription.expire, !s.cryptup_account_subscription.expired, s.cryptup_account_subscription.method || 'trial');
      } else {
        callback(null, null, false, null);
      }
    });
  }

  /* db */

  private static normalize_string(str: string) {
    return str.normalize('NFKD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
  }

  private static db_error_handle(exception: Error, error_stack: string, callback: ((r: false|null) => void)|null) {
    exception.stack = error_stack.replace(/^Error/, String(exception));
    if(exception.message === 'Internal error opening backing store for indexedDB.open.') {
      if(callback) {
        callback(false);
      }
    } else {
      catcher.handle_exception(exception);
      if(callback) {
        callback(null);
      }
    }
  }

  static db_open(callback: (db: IDBDatabase|null|false) => void) {
    let open_db: IDBOpenDBRequest;
    open_db = indexedDB.open('cryptup', 2);
    open_db.onupgradeneeded = function (event) {
      let contacts;
      if(event.oldVersion < 1) {
        contacts = open_db.result.createObjectStore('contacts', { keyPath: 'email', });
        contacts.createIndex('search', 'searchable', { multiEntry: true, });
        contacts.createIndex('index_has_pgp', 'has_pgp');
        contacts.createIndex('index_pending_lookup', 'pending_lookup');
      }
      if(event.oldVersion < 2) {
        contacts = open_db.transaction.objectStore('contacts');
        contacts.createIndex('index_longid', 'longid');
      }
    };
    let handled = 0; // the indexedDB docs don't say if onblocked and onerror can happen in the same request, or if the event/exception bubbles to both
    open_db.onsuccess = catcher.try(() => {
      handled++;
      callback(open_db.result);
    });
    let stack_fill = String((new Error()).stack);
    open_db.onblocked = catcher.try(() => Store.db_error_handle(open_db.error, stack_fill, handled++ ? null : callback));
    open_db.onerror = catcher.try(() => Store.db_error_handle(open_db.error, stack_fill, handled++ ? null : callback));
  }

  private static db_index(has_pgp: boolean, substring: string) {
    if(!substring) {
      throw new Error('db_index has to include substring');
    }
    return(has_pgp ? 't:' : 'f:') + substring;
  }

  private static db_create_search_index_list(email: string, name: string|null, has_pgp: boolean) {
    email = email.toLowerCase();
    name = name ? name.toLowerCase() : '';
    let parts = [email, name];
    parts = parts.concat(email.split(/[^a-z0-9]/));
    parts = parts.concat(name.split(/[^a-z0-9]/));
    let index: string[] = [];
    tool.each(parts, (i, part) => {
      if(part) {
        let substring = '';
        tool.each(part.split(''), (i, letter) => {
          substring += letter;
          let normalized = Store.normalize_string(substring);
          if(!tool.value(normalized).in(index)) {
            index.push(Store.db_index(has_pgp, normalized));
          }
        });
      }
    });
    return index;
  }

  static db_contact_object(email: string, name: string|null, client: string|null, pubkey: string|null, attested: boolean|null, pending_lookup:boolean|number, last_use: number|null) {
    let fingerprint = pubkey ? tool.crypto.key.fingerprint(pubkey) : null;
    return {
      email: email,
      name: name || null,
      pubkey: pubkey,
      has_pgp: Number(Boolean(pubkey)), // number because we use it for sorting
      searchable: Store.db_create_search_index_list(email, name, Boolean(pubkey)),
      client: pubkey ? client : null,
      attested: pubkey ? Boolean(attested) : null,
      fingerprint: fingerprint,
      longid: fingerprint ? tool.crypto.key.longid(fingerprint) : null,
      keywords: fingerprint ? (window as FlowCryptWindow).mnemonic(tool.crypto.key.longid(fingerprint)!) : null,
      pending_lookup: pubkey ? 0 : Number(Boolean(pending_lookup)),
      last_use: last_use || null,
    } as Contact;
  }

  static db_contact_save(db: IDBDatabase|null, contact: Contact|Contact[], callback: VoidCallback) {
    if(db === null) { // relay op through background process
      tool.browser.message.send(null, 'db', {f: 'db_contact_save', args: [contact]}, callback);
    } else {
      if (Array.isArray(contact)) {
        let processed = 0;
        tool.each(contact, (i, single_contact) => {
          Store.db_contact_save(db, single_contact, () => {
            if (++processed === contact.length && typeof callback === 'function') {
              callback();
            }
          });
        });
      } else {
        let tx = db.transaction('contacts', 'readwrite');
        let contacts = tx.objectStore('contacts');
        contacts.put(contact);
        tx.oncomplete = catcher.try(callback);
        let stack_fill = String((new Error()).stack);
        tx.onabort = catcher.try(() => Store.db_error_handle(tx.error, stack_fill, callback));
      }
    }
  }

  static db_contact_update(db: IDBDatabase|null, email: string, update: Contact, callback: VoidCallback) {
    if(db === null) { // relay op through background process
      tool.browser.message.send(null, 'db', {f: 'db_contact_update', args: [email, update]}, callback);
    } else {
      if(Array.isArray(email)) {
        let processed = 0;
        tool.each(email, (i, single_email) => {
          Store.db_contact_update(db, single_email, update, () => {
            if(++processed === email.length && typeof callback === 'function') {
              callback();
            }
          });
        });
      } else {
        Store.db_contact_get(db, email, (original_contact: Contact) => {
          // @ts-ignore
          let updated: Contact = {};
          tool.each(original_contact, (k, original_value) => {
            if(k in update) {
              // @ts-ignore
              updated[k] = update[k];
            } else {
              // @ts-ignore
              updated[k] = original_value;
            }
          });
          let tx = db.transaction('contacts', 'readwrite');
          let contacts = tx.objectStore('contacts');
          contacts.put(Store.db_contact_object(email, updated.name, updated.client, updated.pubkey, updated.attested, updated.pending_lookup, updated.last_use));
          tx.oncomplete = catcher.try(callback);
          let stack_fill = String((new Error()).stack);
          tx.onabort = catcher.try(() => Store.db_error_handle(tx.error, stack_fill, callback));
        });
      }
    }
  }

  static db_contact_get(db: null|IDBDatabase, email_or_longid: string[]|string, callback: (contacts: Contact[]|Contact|null) => void) {
    if(db === null) { // relay op through background process
      tool.browser.message.send(null, 'db', {f: 'db_contact_get', args: [email_or_longid]}, callback);
    } else {
      if(typeof email_or_longid !== 'object') {
        let get: IDBRequest;
        if(!(/^[A-F0-9]{16}$/g).test(email_or_longid)) { // email
          get = db.transaction('contacts', 'readonly').objectStore('contacts').get(email_or_longid);
        } else { // longid
          get = db.transaction('contacts', 'readonly').objectStore('contacts').index('index_longid').get(email_or_longid);
        }
        get.onsuccess = catcher.try(() => {
          if(get.result !== undefined) {
            callback(get.result);
          } else {
            callback(null);
          }
        });
        let stack_fill = String((new Error()).stack);
        get.onerror = function () {
          // @ts-ignore
          Store.db_error_handle(get.error, stack_fill, callback);
        };
      } else {
        let results = new Array(email_or_longid.length);
        let finished = 0;
        tool.each(email_or_longid, (i: number, single_email_or_longid) => {
          Store.db_contact_get(db, single_email_or_longid, contact => {
            results[i] = contact;
            if(++finished >= email_or_longid.length) {
              callback(results);
            }
          });
        });
      }
    }
  }

  static db_contact_search(db: IDBDatabase|null, query: DbContactFilter, callback: (contacts: Contact[]) => void) {
    if(db === null) { // relay op through background process
      tool.browser.message.send(null, 'db', {f: 'db_contact_search', args: [query]}, callback);
    } else {
      tool.each(query, (key, value) => {
        if(!tool.value(key).in(Store.db_query_keys)) {
          throw new Error('db_contact_search: unknown key: ' + key);
        }
      });
      let contacts = db.transaction('contacts', 'readonly').objectStore('contacts');
      let search: IDBRequest|undefined = undefined;
      if(typeof query.has_pgp === 'undefined') { // any query.has_pgp value
        query.substring = Store.normalize_string(query.substring || '');
        if(query.substring) {
          Store.db_contact_search(db, { substring: query.substring, limit: query.limit, has_pgp: true, }, (results_with_pgp) => {
            if(query.limit && results_with_pgp.length === query.limit) {
              callback(results_with_pgp);
            } else {
              Store.db_contact_search(db, { substring: query.substring, limit: query.limit ? query.limit - results_with_pgp.length : undefined, has_pgp: false, }, results_without_pgp => {
                callback(results_with_pgp.concat(results_without_pgp));
              });
            }
          });
        } else {
          search = contacts.openCursor();
        }
      } else { // specific query.has_pgp value
        if(query.substring) {
          search = contacts.index('search').openCursor(IDBKeyRange.only(Store.db_index(query.has_pgp, query.substring)));
        } else {
          search = contacts.index('index_has_pgp').openCursor(IDBKeyRange.only(Number(query.has_pgp)));
        }
      }
      if(typeof search !== 'undefined') {
        let found: Contact[] = [];
        search.onsuccess = catcher.try(() => {
          let cursor = search!.result; // set it above
          if(!cursor || found.length === query.limit) {
            callback(found);
          } else {
            found.push(cursor.value);
            cursor.continue();
          }
        });
        let stack_fill = String((new Error()).stack);
        // @ts-ignore
        search.onerror = catcher.try(() => Store.db_error_handle(search!.error, stack_fill, callback)); // set it above
      }
    }
  }

}