

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
  return 'cryptup_' + gmail_account_email.replace(/[^A-Za-z0-9]+/g, '') + '_' + key;
}

function account_storage_set(gmail_account_email, key, value, callback) {
  var storage_key = account_storage_key(gmail_account_email, key);
  var storage_update = {};
  storage_update[storage_key] = value;
  chrome.storage.local.set(storage_update, function() {
    callback();
  });
}

function account_storage_get(gmail_account_email, key, callback) {
  var storage_key = account_storage_key(gmail_account_email, key);
  chrome.storage.local.get([storage_key], function(storage) {
    callback(storage[storage_key]);
  });
}
