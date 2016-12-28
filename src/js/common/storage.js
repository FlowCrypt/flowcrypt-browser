'use strict';

var global_storage_scope = 'global';

function pubkey_cache_retrieve() {
  var storage = get_storage('local');
  if(storage === null) {
    throw 'oy';
  }
  if(typeof storage.pubkey_cache === 'undefined') {
    storage.pubkey_cache = JSON.stringify({});
  }
  return JSON.parse(storage.pubkey_cache);
}

function pubkey_object(pubkey, name, has_cryptup, attested) {
  if(typeof mnemonic !== 'undefined') {
    var keywords = mnemonic(key_longid(pubkey));
  } else {
    var keywords = undefined;
  }
  return {
    pubkey: pubkey,
    fingerprint: key_fingerprint(pubkey, 'spaced'),
    keywords: keywords,
    name: name,
    has_cryptup: has_cryptup === true,
    attested: attested,
  };
}

function pubkey_cache_add(email, pubkey_or_obj, name, has_cryptup, attested) {
  // can work with result of pubkey_object directly. If supplied individual arguments, will convert using  pubkey_object first.
  if(typeof pubkey_or_obj === 'object') {
    var storage = pubkey_cache_retrieve();
    storage[trim_lower(email)] = pubkey_or_obj;
    localStorage.pubkey_cache = JSON.stringify(storage);
  } else {
    pubkey_cache_add(email, pubkey_object(pubkey_or_obj, name, has_cryptup, attested));
  }
}

function pubkey_cache_remove(email) {
  var storage = pubkey_cache_retrieve();
  delete storage[trim_lower(email)];
  localStorage.pubkey_cache = JSON.stringify(storage);
}

function pubkey_cache_get(email) {
  var storage = pubkey_cache_retrieve();
  var stored = storage[trim_lower(email)];
  if(typeof stored !== 'undefined') {
    if(typeof stored.keywords === 'undefined' && typeof mnemonic !== 'undefined') { // saved in old version of CryptUP, and can be updated now
      pubkey_cache_add(email, stored.pubkey, stored.name, stored.has_cryptup, stored.attested); // this will update the fingerprints and keywords
      return pubkey_cache_get(email);
    } else {
      return stored;
    }
  }
  return null;
}

function pubkey_cache_search(query, max) {
  var storage = pubkey_cache_retrieve();
  var matches = [];
  for(var email in storage) {
    if(storage.hasOwnProperty(email)) {
      if(email.indexOf(trim_lower(query)) !== -1) {
        var match = storage[email];
        match.email = email;
        match.email_highlighted = email.replace(trim_lower(query), '<b>' + trim_lower(query) + '</b>');
        matches.push(match);
        if(matches.length === (max || -1)) {
          return matches;
        }
      }
    }
  }
  return matches;
}

function pubkey_cache_flush() {
  localStorage.pubkey_cache = JSON.stringify({});
}

function get_pubkeys(emails, callback, ignore_cached) {
  emails = emails.map(Function.prototype.call, String.prototype.trim);
  var results = Array(emails.length);
  var get_from_keyserver = [];
  $.each(emails, function(i, email) {
    if(ignore_cached !== true) {
      results[i] = pubkey_cache_get(email) || undefined;
      if(typeof results[i] === 'undefined' || typeof results[i].attested === 'undefined') {
        get_from_keyserver.push(email);
      }
    } else {
      get_from_keyserver.push(email);
    }
  });
  if(get_from_keyserver.length === 0) {
    callback(results);
  } else {
    keyserver_keys_find(get_from_keyserver, function(success, keyserver_results) {
      if(success) {
        $.each(keyserver_results.results, function(i, keyserver_result) {
          var pubkey_obj = pubkey_object(keyserver_result.pubkey, keyserver_result.name, keyserver_result.has_cryptup, keyserver_result.attested);
          results[emails.indexOf(get_from_keyserver[i])] = pubkey_obj;
          if(keyserver_result.pubkey) {
            pubkey_cache_add(keyserver_result.email, pubkey_obj);
          }
        });
        callback(results);
      } else {
        callback(undefined);
      }
    });
  }
}

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
  var primary_armored_key = private_storage_get('local', account_email, 'master_private_key');
  if(!contains_primary && primary_armored_key) {
    keys.push({
      armored: primary_armored_key,
      primary: true,
    });
  }
  if(typeof longid !== 'undefined') { // looking for a specific key(s)
    if(typeof longid === 'object') { // looking for an array of keys
      var found = [];
      $.each(keys, function(i, keyinfo) {
        if(longid.indexOf(key_longid(keyinfo.armored)) !== -1) {
          found.push(keyinfo);
        }
      });
    } else { // looking for a single key
      var found = null;
      $.each(keys, function(i, keyinfo) {
        if(key_longid(keyinfo.armored) === longid) {
          found = keyinfo;
        }
      });
    }
    return found;
  } else {
    return keys;
  }
}

function private_keys_add(account_email, armored) {
  var private_keys = private_keys_get(account_email);
  var do_add = true;
  var longid = key_longid(armored);
  if(longid) {
    $.each(private_keys, function(i, keyinfo) {
      if(key_longid(keyinfo.armored) === longid) {
        do_add = false;
      }
    });
  } else {
    do_add = false;
  }
  if(do_add) {
    private_keys.push({
      armored: armored,
      primary: false,
    });
    private_storage_set('local', account_email, 'private_keys', private_keys);
  }
}

function private_keys_remove(account_email, longid) {
  var private_keys = private_keys_get(account_email);
  var filtered_private_keys = [];
  $.each(private_keys, function(i, keyinfo) {
    if(key_longid(keyinfo.armored) !== longid) {
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
