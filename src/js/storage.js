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

function account_storage_key(gmail_account_email, key) {
  var prefix = 'cryptup_' + gmail_account_email.replace(/[^A-Za-z0-9]+/g, '') + '_';
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

function account_storage_object_keys_to_original(gmail_account_email, storage_object) {
  var fixed_keys_object = {};
  for(var account_key in storage_object) {
    var fixed_key = account_key.replace(account_storage_key(gmail_account_email, ''), '');
    fixed_keys_object[fixed_key] = storage_object[account_key];
  }
  return fixed_keys_object;
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

function account_storage_get(gmail_account_email, key_or_keys, callback) {
  if(!gmail_account_email) {
    gmail_account_email = global_storage_scope;
  }
  if(typeof key_or_keys === 'object') {
    chrome.storage.local.get(account_storage_key(gmail_account_email, key_or_keys), function(storage_object) {
      callback(account_storage_object_keys_to_original(gmail_account_email, storage_object));
    });
  } else {
    var account_key = account_storage_key(gmail_account_email, key_or_keys);
    chrome.storage.local.get([account_key], function(storage_object) {
      callback(storage_object[account_key]);
    });
  }
}

function account_storage_remove(gmail_account_email, key_or_keys, callback) {
  if(!gmail_account_email) {
    gmail_account_email = global_storage_scope;
  }
  chrome.storage.local.remove(account_storage_key(gmail_account_email, key_or_keys), callback);
}
