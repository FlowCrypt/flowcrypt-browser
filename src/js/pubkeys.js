function fake_db_get_primary_email(email) {
  email_mask = {
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

function get_pubkey(email, callback) {
  email = email.trim();
  search_email = fake_db_get_primary_email(email);
  keyserver_keys_find(search_email, function(success, response){
    if(success) {
      if(response.pubkey === null){
        callback(null);
      }
      else{
        callback({'name': null, 'key': response.pubkey, 'email': email});
      }
    }
    else {
      console.log(['keyserver error', response]);
      callback(null);
    }
  });
}
