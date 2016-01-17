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
  email = email.trim();
  search_email = fake_db_get_primary_email(email);
  $.ajax({
    url: 'https://cryptup-keyserver.herokuapp.com/keys/find',
    method: 'POST',
    data: JSON.stringify({'email': search_email}),
    dataType: 'json',
    crossDomain: true,
    contentType: 'application/json; charset=UTF-8',
    async: true,
    success: function(response) {
      if(response.pubkey === null){
        callback(null);
      }
      else{
        callback({'name': null, 'key': response.pubkey, 'email': email});
      }
    },
    error: function(XMLHttpRequest, textStatus, errorThrown){
        console.log(['keyserver error', textStatus, errorThrown]);
        callback(null);
    },
  });
}
