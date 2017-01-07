'use strict';

var global_storage_scope = 'global';

function account_storage_key(account_key_or_list, key) {
  if(typeof account_key_or_list === 'object') {
    var all_results = [];
    $.each(account_key_or_list, function(i, account_key) {
      all_results = all_results.concat(account_storage_key(account_key, key));
    });
    return all_results;
  } else {
    var prefix = 'cryptup_' + account_key_or_list.replace(/[^A-Za-z0-9]+/g, '') + '_';
    if(typeof key === 'object') {
      var account_storage_keys = [];
      $.each(key, function(i, k) {
        account_storage_keys.push(prefix + k);
      });
      return account_storage_keys;
    } else {
      return prefix + key;
    }
  }
}


function account_storage_object_keys_to_original(account_or_accounts, storage_object) {
  if(typeof account_or_accounts === 'string') {
    var fixed_keys_object = {};
    $.each(storage_object, function(k, v) {
      var fixed_key = k.replace(account_storage_key(account_or_accounts, ''), '');
      if(fixed_key !== k) {
        fixed_keys_object[fixed_key] = v;
      }
    });
    return fixed_keys_object;
  } else {
    var results_by_account = {};
    $.each(account_or_accounts, function(i, account) {
      results_by_account[account] = account_storage_object_keys_to_original(account, storage_object);
    });
    return results_by_account;
  }
}

function get_storage(storage_type) {
  try {
    if(storage_type === 'local') {
      return localStorage;
    } else if(storage_type === 'session') {
      return sessionStorage;
    } else {
      throw 'unknown type of storage: "' + storage_type + '", use either "local" or "session"'
    }
  } catch(error) {
    if(error.name === 'SecurityError') {
      return null;
    } else {
      throw error;
    }
  }
}

function notify_about_storage_access_error(account_email, parent_tab_id) {
  if(parent_tab_id) {
    chrome_message_send(parent_tab_id, 'notification_show', {
      notification: 'Some browser settings are keeping CryptUP from working properly. <a href="chrome-extension://bnjglocicdkmhmoohhfkfkbbkejdhdgc/chrome/settings/index.htm?account_email=' + encodeURIComponent(account_email) + '&page=%2Fchrome%2Ftexts%2Fchrome_content_settings.htm" target="cryptup">Click here to fix it</a>. When fixed, <a href="#" class="reload">reload this page</a>.',
    });
  } else {
    console.log('SecurityError: cannot access localStorage or sessionStorage');
  }
}

function private_storage_get(storage_type, account_email, key, parent_tab_id) {
  var storage = get_storage(storage_type);
  if(storage === null) {
    notify_about_storage_access_error(account_email, parent_tab_id);
    return;
  }
  var value = storage[account_storage_key(account_email, key)];
  if(typeof value === 'undefined') {
    return value;
  } else if(value === 'null#null') {
    return null;
  } else if(value === 'bool#true') {
    return true;
  } else if(value === 'bool#false') {
    return false;
  } else if(value.indexOf('int#') === 0) {
    return Number(value.replace('int#', '', 1));
  } else if(value.indexOf('json#') === 0) {
    return JSON.parse(value.replace('json#', '', 1));
  } else {
    return value.replace('str#', '', 1);
  }
}

function private_storage_set(storage_type, account_email, key, value) {
  var storage = get_storage(storage_type);
  var account_key = account_storage_key(account_email, key);
  if(typeof value === 'undefined') {
    storage.removeItem(account_key);
  } else if(value === null) {
    storage[account_key] = 'null#null';
  } else if(value === true || value === false) {
    storage[account_key] = 'bool#' + value;
  } else if(value + 0 === value) {
    storage[account_key] = 'int#' + value;
  } else if(typeof value === 'object') {
    storage[account_key] = 'json#' + JSON.stringify(value);
  } else {
    storage[account_key] = 'str#' + value;
  }
}

function save_passphrase(storage_type, account_email, longid, passphrase) {
  var master_prv_longid = key_longid(private_storage_get('local', account_email, 'master_public_key')); //todo - migration needed
  if(longid && longid !== master_prv_longid) {
    private_storage_set(storage_type, account_email, 'passphrase_' + longid, passphrase);
  } else {
    private_storage_set(storage_type, account_email, 'master_passphrase', passphrase);
  }
}

function private_keys_get(account_email, longid) {
  var keys = [];
  var private_keys = private_storage_get('local', account_email, 'private_keys');
  var contains_primary = false;
  $.each(private_keys || [], function(i, keyinfo) {
    if(keyinfo.primary === true) {
      contains_primary = true;
    }
    keys.push(keyinfo);
  });
  var primary_key_armored = private_storage_get('local', account_email, 'master_private_key');
  if(!contains_primary && primary_key_armored) {
    keys.push({
      armored: primary_key_armored,
      primary: true,
      longid: key_longid(primary_key_armored),
    });
  }
  if(typeof longid !== 'undefined') { // looking for a specific key(s)
    if(typeof longid === 'object') { // looking for an array of keys
      var found = [];
      $.each(keys, function(i, keyinfo) {
        if(longid.indexOf(keyinfo.longid) !== -1) {
          found.push(keyinfo);
        }
      });
    } else { // looking for a single key
      var found = null;
      $.each(keys, function(i, keyinfo) {
        if(keyinfo.longid === longid) {
          found = keyinfo;
        }
      });
    }
    return found;
  } else {
    return keys;
  }
}

function private_keys_add(account_email, new_key_armored) {
  var private_keys = private_keys_get(account_email);
  var do_add = true;
  var new_key_longid = key_longid(new_key_armored);
  if(new_key_longid) {
    $.each(private_keys, function(i, keyinfo) {
      if(new_key_longid === keyinfo.longid) {
        do_add = false;
      }
    });
  } else {
    do_add = false;
  }
  if(do_add) {
    private_keys.push({
      armored: new_key_armored,
      longid: new_key_longid,
      primary: false,
    });
    private_storage_set('local', account_email, 'private_keys', private_keys);
  }
}

function private_keys_remove(account_email, remove_longid) {
  var private_keys = private_keys_get(account_email);
  var filtered_private_keys = [];
  $.each(private_keys, function(i, keyinfo) {
    if(keyinfo.longid !== remove_longid) {
      filtered_private_keys.push(keyinfo);
    }
  });
  private_storage_set('local', account_email, 'private_keys', filtered_private_keys);
}

function account_storage_set(gmail_account_email, values, callback) {
  if(!gmail_account_email) {
    gmail_account_email = global_storage_scope;
  }
  var storage_update = {};
  $.each(values, function(key, value) {
    storage_update[account_storage_key(gmail_account_email, key)] = value;
  });
  chrome.storage.local.set(storage_update, function() {
    Try(function() {
      if(typeof callback !== 'undefined') {
        callback();
      }
    })();
  });
}

function account_storage_get(account_or_accounts, keys, callback) {
  if(!account_or_accounts) {
    account_or_accounts = global_storage_scope;
  }
  chrome.storage.local.get(account_storage_key(account_or_accounts, keys), function(storage_object) {
    Try(function() {
      callback(account_storage_object_keys_to_original(account_or_accounts, storage_object));
    })();
  });
}

function account_storage_remove(gmail_account_email, key_or_keys, callback) {
  if(!gmail_account_email) {
    gmail_account_email = global_storage_scope;
  }
  chrome.storage.local.remove(account_storage_key(gmail_account_email, key_or_keys), function() {
    Try(function() {
      if(typeof callback !== 'undefined') {
        callback();
      }
    })();
  });
}

function normalize_string(str) {
  return str.normalize('NFKD').replace(/[\u0300-\u036F]/g, '').toLowerCase();
}

function db_open(callback) {
  var open_db = indexedDB.open('cryptup_t7');
  open_db.onupgradeneeded = function() {
    var contacts = open_db.result.createObjectStore('contacts', {
      keyPath: 'email',
    });
    contacts.createIndex('search', 'searchable', {
      multiEntry: true,
    });
    contacts.createIndex('index_has_pgp', 'has_pgp');
    contacts.createIndex('index_pending_lookup', 'pending_lookup');
  };
  open_db.onsuccess = function() {
    callback(open_db.result);
  };
}

function db_index(has_pgp, substring) {
  if(!substring) {
    throw 'db_index has to include substring';
  }
  return(has_pgp ? 't:' : 'f:') + substring;
}

function db_create_search_index_list(email, name, has_pgp) {
  email = email.toLowerCase();
  name = name ? name.toLowerCase() : '';
  var parts = [email, name];
  parts = parts.concat(email.split(/[^a-z0-9]/));
  parts = parts.concat(name.split(/[^a-z0-9]/));
  var index = [];
  $.each(parts, function(i, part) {
    if(part) {
      var substring = '';
      $.each(part.split(''), function(i, letter) {
        substring += letter;
        var normalized = normalize_string(substring);
        if(index.indexOf(normalized) === -1) {
          index.push(db_index(has_pgp, normalized));
        }
      });
    }
  });
  return index;
}

function db_contact_object(email, name, client, pubkey, attested, pending_lookup, last_use) {
  return {
    email: email,
    name: name || null,
    pubkey: pubkey,
    has_pgp: Number(Boolean(pubkey)),
    searchable: db_create_search_index_list(email, name, Boolean(pubkey)),
    client: pubkey ? client : null,
    attested: pubkey ? Boolean(attested) : null,
    fingerprint: pubkey ? key_fingerprint(pubkey) : null,
    longid: pubkey ? key_longid(pubkey) : null,
    keywords: pubkey ? mnemonic(key_longid(pubkey)) : null,
    pending_lookup: pubkey ? 0 : Number(Boolean(pending_lookup)),
    last_use: last_use || null,
  };
}

function db_contact_save(db, contact, callback) {
  var tx = db.transaction('contacts', 'readwrite');
  var contacts = tx.objectStore('contacts');
  contacts.put(contact);
  tx.oncomplete = callback; // todo - shouldn't I do success instead?
}

function db_contact_update(db, email, update, callback) {
  db_contact_get(db, email, function(original) {
    var updated = {};
    $.each(original, function(k, original_value) {
      if(k in update) {
        updated[k] = update[k];
      } else {
        updated[k] = original_value;
      }
    });
    var tx = db.transaction('contacts', 'readwrite');
    var contacts = tx.objectStore('contacts');
    contacts.put(db_contact_object(email, updated.name, updated.client, updated.pubkey, updated.attested, updated.pending_lookup, updated.last_use));
    tx.oncomplete = callback; // todo - shouldn't I do success instead?
  });
}

function db_contact_get(db, email, callback) {
  if(typeof email !== 'object') {
    var get = db.transaction('contacts', 'readonly').objectStore('contacts').get(email);
    get.onsuccess = function() {
      if(get.result !== undefined) {
        callback(get.result);
      } else {
        callback(null);
      }
    };
  } else {
    var results = Array(email.length);
    var finished = 0;
    $.each(email, function(i, single_email) {
      db_contact_get(db, single_email, function(contact) {
        results[i] = contact;
        if(++finished >= email.length) {
          callback(results);
        }
      });
    });
  }
}

var db_query_keys = ['limit', 'substring', 'has_pgp'];

// query: substring, has_pgp, limit. All voluntary
function db_contact_search(db, query, callback) {
  $.each(query, function(key, value) {
    if(db_query_keys.indexOf(key) === -1) {
      throw 'db_contact_search: unknown key: ' + key;
    }
  });
  var contacts = db.transaction('contacts', 'readonly').objectStore('contacts');
  if(typeof query.has_pgp === 'undefined') { // any query.has_pgp value
    query.substring = normalize_string(query.substring);
    if(query.substring) {
      var with_pgp = {
        substring: query.substring,
        limit: query.limit,
        has_pgp: true,
      };
      db_contact_search(db, with_pgp, function(results_with_pgp) {
        if(query.limit && results_with_pgp.length === query.limit) {
          callback(results_with_pgp);
        } else {
          var without_pgp = {
            substring: query.substring,
            limit: query.limit ? query.limit - results_with_pgp.length : undefined,
            has_pgp: false,
          };
          db_contact_search(db, without_pgp, function(results_without_pgp) {
            callback(results_with_pgp.concat(results_without_pgp));
          });
        }
      });
    } else {
      var search = contacts.openCursor();
    }
  } else { // specific query.has_pgp value
    if(query.substring) {
      var search = contacts.index('search').openCursor(IDBKeyRange.only(db_index(query.has_pgp, query.substring)));
    } else {
      var search = contacts.index('index_has_pgp').openCursor(IDBKeyRange.only(Number(query.has_pgp)));
    }
  }
  if(typeof search !== 'undefined') {
    var found = [];
    search.onsuccess = function() {
      var cursor = search.result;
      if(!cursor || found.length === query.limit) {
        callback(found);
      } else {
        found.push(cursor.value);
        cursor.continue();
      }
    };
  }
}
