'use strict';

function fake_db_get_pubkey_email(email) {
  var email_mask = {
    'tom@cryptup.org': 'tom@bitoasis.net',
    'tom@nvimp.com': 'tom@bitoasis.net',
    'info@nvimp.com': 'tom@bitoasis.net',
    'tomas.holub@gmail.com': 'tom@bitoasis.net',
    'tom@holub.me': 'tom@bitoasis.net',
    'tom@coinbaseorders.com': 'tom@bitoasis.net',
    'tom@treatyvisa.com': 'tom@bitoasis.net',
  };
  if(email in email_mask) {
    return email_mask[email];
  }
  return email;
}

function get_pubkey(email, callback, ignore_cached) {
  email = email.trim();
  var search_email = fake_db_get_pubkey_email(email);
  if(ignore_cached !== true) {
    var cached = pubkey_cache_get(search_email);
    if(cached !== null) {
      callback(cached);
    } else {
      get_pubkey(email, callback, true);
    }
  } else {
    keyserver_keys_find(search_email, function(success, response) {
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
