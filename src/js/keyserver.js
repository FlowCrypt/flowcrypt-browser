'use strict';

function keyserver_keys_find(email, callback) {
  keyserver_call('keys/find', {'email': email.trim()}, callback);
}

function keyserver_keys_submit(email, pubkey, callback) {
  keyserver_call('keys/submit', {'email': email.trim(), 'pubkey': pubkey.trim()}, callback);
}

function keyserver_call(path, data, callback) {
  $.ajax({
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
    error: function(XMLHttpRequest, status, error){
      callback(false, {request: XMLHttpRequest, status: status, error: error});
    },
  });
}
