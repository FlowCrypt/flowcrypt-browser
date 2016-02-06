

function pubkey_cache_add(email, pubkey){
  if(typeof localStorage.pubkey_cache === 'undefined') {
    var storage = {};
  }
  else {
    var storage = JSON.parse(localStorage.pubkey_cache);
  }
  storage[email] = pubkey;
  localStorage.pubkey_cache = JSON.stringify(storage);
}

function pubkey_cache_get(email){
  if(typeof localStorage.pubkey_cache === 'undefined') {
    localStorage.pubkey_cache = JSON.stringify({});
    return null;
  }
  var storage = JSON.parse(localStorage.pubkey_cache);
  if(typeof storage[email] !== 'undefined') {
    return storage[email];
  }
  return null;
}

function account_storage_key(gmail_account_email, key) {
  var prefix = 'cryptup_' + gmail_account_email.replace(/[^A-Za-z0-9]+/g, '') + '_';
  if(typeof key === 'object') {
    var account_storage_keys = [];
    for(var i=0; i<key.length; i++) {
      account_storage_keys.push(prefix + key[i]);
    }
    return account_storage_keys;
  }
  else {
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

function account_storage_set(gmail_account_email, key, value, callback) {
  var storage_key = account_storage_key(gmail_account_email, key);
  var storage_update = {};
  storage_update[storage_key] = value;
  chrome.storage.local.set(storage_update, function() {
    if(typeof callback !== 'undefined') {
      callback();
    }
  });
}

function account_storage_get(gmail_account_email, key, callback) {
  if(typeof key === 'object') {
    chrome.storage.local.get(account_storage_key(gmail_account_email, key), function(storage_object) {
      callback(account_storage_object_keys_to_original(gmail_account_email, storage_object));
    });
  }
  else {
    var account_key = account_storage_key(gmail_account_email, key);
    chrome.storage.local.get([account_key], function(storage_object) {
      callback(storage_object[account_key]);
    });
  }
}
