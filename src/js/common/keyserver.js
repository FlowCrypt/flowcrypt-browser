'use strict';

function keyserver_keys_find(email, callback) {
  if(typeof email === 'string') {
    email = trim_lower(email);
  } else {
    $.each(email, function(i, address) {
      email[i] = trim_lower(address);
    });
  }
  return keyserver_call('keys/find', {
    email: email,
  }, callback);
}

function keyserver_keys_submit(email, pubkey, callback) {
  return keyserver_call('keys/submit', {
    'email': trim_lower(email),
    'pubkey': pubkey.trim(),
  }, callback);
}

function keyserver_call(path, data, callback) {
  return $.ajax({
    url: 'https://cryptup-keyserver.herokuapp.com/' + path,
    method: 'POST',
    data: JSON.stringify(data),
    dataType: 'json',
    crossDomain: true,
    contentType: 'application/json; charset=UTF-8',
    async: true,
    success: function(response) {
      callback(true, response);
    },
    error: function(XMLHttpRequest, status, error) {
      callback(false, {
        request: XMLHttpRequest,
        status: status,
        error: error
      });
    },
  });
}
