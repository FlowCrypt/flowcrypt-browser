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

function get_pubkey(email, callback) { //add a callback here to do something when I have the info
    var mit_db_url = 'https://pgp.mit.edu/pks/lookup';
    email = email.trim();
    search_email = fake_db_get_primary_email(email);
    $.ajax({
        url: mit_db_url,
        data: {search: search_email, op: 'index', exact: 'on'},
        type: 'GET',
        error: function(XMLHttpRequest, textStatus, errorThrown) {
            callback(null);
        },
        success: function(text) {
            var m = new RegExp(/pub[^<]+<\a href="([^"]+)">[A-Z0-9]+<\/\a>[^>]+>([^<]+)<\/\a>/g).exec(text);
            if (m === null) {
                callback(null);
            } else {
                search_query = m[1].split("search=");
                name_email = m[2];
                $.ajax({
                    url: mit_db_url,
                    data: {op: 'get', search: search_query[1]},
                    type: 'GET',
                    error: function(XMLHttpRequest, textStatus, errorThrown){
                        console.log(mit_db_url + ' fetch resulted in 404 for ' + email);
                        callback(null);
                    },
                    success: function(pubkey_text) {
                        var pubkey_m = new RegExp(/-----BEGIN PGP PUBLIC KEY BLOCK-----[^-]+-----END PGP PUBLIC KEY BLOCK-----/g).exec(pubkey_text);
                        if (pubkey_m !== null) {
                            callback({'name': name_email, 'key': pubkey_m[0], 'email': email});
                        } else {
                            console.log([mit_db_url, {op: 'get', search: search_query[1]}])
                            console.log(pubkey_text);
                            console.log(pubkey_m);
                            console.log('Found a match with corresponding email address for ' + email + ', but followup link did not contain a PGP public block');
                            callback(null);
                        }
                    }
                });
            }
        }
    });
}
