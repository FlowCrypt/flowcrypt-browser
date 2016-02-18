'use strict';

function get_pubkey(email, callback, ignore_cached) {
  email = email.trim();
  if(ignore_cached !== true) {
    var cached = pubkey_cache_get(email);
    if(cached !== null) {
      callback(cached);
    } else {
      get_pubkey(email, callback, true);
    }
  } else {
    keyserver_keys_find(email, function(success, response) {
      if(success) {
        if(response.pubkey !== null) {
          pubkey_cache_add(email, response.pubkey);
        }
        callback(response.pubkey); // can be null
      } else {
        console.log(['keyserver error', response]);
        callback(null);
      }
    });
  }
}
