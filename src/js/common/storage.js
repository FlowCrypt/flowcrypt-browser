'use strict';

var global_storage_scope = 'global';

function pubkey_cache_retrieve() {
  if(typeof localStorage.pubkey_cache === 'undefined') {
    localStorage.pubkey_cache = JSON.stringify({});
  }
  return JSON.parse(localStorage.pubkey_cache);
}

function pubkey_cache_add(email, pubkey, name, has_cryptup) {
  var storage = pubkey_cache_retrieve();
  storage[trim_lower(email)] = {
    pubkey: pubkey,
    name: name,
    has_cryptup: has_cryptup === true,
  };
  localStorage.pubkey_cache = JSON.stringify(storage);
}

function pubkey_cache_remove(email) {
  var storage = pubkey_cache_retrieve();
  delete storage[trim_lower(email)];
  localStorage.pubkey_cache = JSON.stringify(storage);
}

function pubkey_cache_get(email) {
  var storage = pubkey_cache_retrieve();
  if(typeof storage[trim_lower(email)] !== 'undefined') {
    return storage[trim_lower(email)];
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
      if(typeof results[i] === 'undefined') {
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
          results[emails.indexOf(get_from_keyserver[i])] = {
            pubkey: keyserver_result.pubkey,
            name: keyserver_result.name,
            has_cryptup: keyserver_result.has_cryptup
          };
          if(keyserver_result.pubkey) {
            pubkey_cache_add(keyserver_result.email, keyserver_result.pubkey, keyserver_result.name, keyserver_result.has_cryptup);
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
  if(storage_type === 'local') {
    return localStorage;
  } else if(storage_type === 'session') {
    return sessionStorage;
  } else {
    throw 'unknown type of storage: "' + storage_type + '", use either "local" or "session"'
  }
}

function notify_about_storage_access_error(parent_tab_id) {
  if(parent_tab_id) {
    chrome_message_send(parent_tab_id, 'notification_show', {
      notification: 'Some browser settings are keeping CryptUP from working properly. Please go to "Chrome Settings -> Advanced Settings-> Privacy -> Content Settings" and un-check "Block third-party cookies and site data" in Cookies section. When the checkbox is empty, <a href="#" class="reload">reload this page</a>.',
    });
  }
}

function private_storage_get(storage_type, account_email, key, parent_tab_id) {

  try {
    var storage = get_storage(storage_type);
  } catch(error) {
    console.log(error.name);
    if(error.name === 'SecurityError') {
      notify_about_storage_access_error(parent_tab_id);
    }
    throw error;
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
  } else {
    storage[account_key] = 'str#' + value;
  }
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
