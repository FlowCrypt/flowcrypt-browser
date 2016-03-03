'use strict';

var global_storage_scope = 'global';

function pubkey_cache_retrieve() {
  if(typeof localStorage.pubkey_cache === 'undefined') {
    localStorage.pubkey_cache = JSON.stringify({});
  }
  return JSON.parse(localStorage.pubkey_cache);
}

function pubkey_cache_add(email, pubkey) {
  var storage = pubkey_cache_retrieve();
  storage[email] = pubkey;
  localStorage.pubkey_cache = JSON.stringify(storage);
}

function pubkey_cache_get(email) {
  var storage = pubkey_cache_retrieve();
  if(typeof storage[email] !== 'undefined') {
    return storage[email];
  }
  return null;
}

function pubkey_cache_search(query, max, highlight) {
  var storage = pubkey_cache_retrieve();
  var matches = [];
  for(var email in storage) {
    if(email.indexOf(query) !== -1) {
      if(highlight === true) {
        matches.push(email.replace(query, '<b>' + query + '</b>'));
      } else {
        matches.push(email);
      }
      if(matches.length === (max || -1)) {
        return matches;
      }
    }
  }
  return matches;
}

function pubkey_cache_flush() {
  localStorage.pubkey_cache = JSON.stringify({});
}

function account_storage_key(account_key_or_list, key) {
  if(typeof account_key_or_list === 'object') {
    var all_results = [];
    for(var i in account_key_or_list) {
      all_results = all_results.concat(account_storage_key(account_key_or_list[i], key));
    }
    return all_results;
  } else {
    var prefix = 'cryptup_' + account_key_or_list.replace(/[^A-Za-z0-9]+/g, '') + '_';
    if(typeof key === 'object') {
      var account_storage_keys = [];
      for(var i = 0; i < key.length; i++) {
        account_storage_keys.push(prefix + key[i]);
      }
      return account_storage_keys;
    } else {
      return prefix + key;
    }
  }
}


function account_storage_object_keys_to_original(account_or_accounts, storage_object) {
  if(typeof account_or_accounts === 'string') {
    var fixed_keys_object = {};
    for(var account_key in storage_object) {
      var fixed_key = account_key.replace(account_storage_key(account_or_accounts, ''), '');
      if(fixed_key !== account_key) {
        fixed_keys_object[fixed_key] = storage_object[account_key];
      }
    }
    return fixed_keys_object;
  } else {
    var results_by_account = {};
    for(var i in account_or_accounts) {
      results_by_account[account_or_accounts[i]] = account_storage_object_keys_to_original(account_or_accounts[i], storage_object);
    }
    return results_by_account;
  }
}

function restricted_account_storage_set(account_email, key, value) {
  var account_key = account_storage_key(account_email, key);
  if(typeof value === 'undefined') {
    localStorage.removeItem('account_key');
  } else if(value === null) {
    localStorage[account_key] = 'null#null';
  } else if(value === true || value === false) {
    localStorage[account_key] = 'bool#' + value;
  } else if(value + 0 === value) {
    localStorage[account_key] = 'int#' + value;
  } else {
    localStorage[account_key] = 'str#' + value;
  }

}

function restricted_account_storage_get(account_email, key) {
  var value = localStorage[account_storage_key(account_email, key)];
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
  } else {
    return value.replace('str#', '', 1);
  }
}

function account_storage_set(gmail_account_email, values, callback) {
  if(!gmail_account_email) {
    gmail_account_email = global_storage_scope;
  }
  var storage_update = {};
  for(var key in values) {
    storage_update[account_storage_key(gmail_account_email, key)] = values[key];
  }
  chrome.storage.local.set(storage_update, function() {
    if(typeof callback !== 'undefined') {
      callback();
    }
  });
}

function account_storage_get(account_or_accounts, keys, callback) {
  if(!account_or_accounts) {
    account_or_accounts = global_storage_scope;
  }
  chrome.storage.local.get(account_storage_key(account_or_accounts, keys), function(storage_object) {
    callback(account_storage_object_keys_to_original(account_or_accounts, storage_object));
  });
}

function account_storage_remove(gmail_account_email, key_or_keys, callback) {
  if(!gmail_account_email) {
    gmail_account_email = global_storage_scope;
  }
  chrome.storage.local.remove(account_storage_key(gmail_account_email, key_or_keys), callback);
}
