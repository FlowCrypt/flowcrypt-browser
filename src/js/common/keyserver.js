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

function keyserver_keys_submit(email, pubkey, attest, callback) {
  return keyserver_call('keys/submit', {
    'email': trim_lower(email),
    'pubkey': pubkey.trim(),
    'attest': attest || false,
  }, callback);
}

function keyserver_keys_attest(signed_attest_packet, callback) {
  return keyserver_call('keys/attest', {
    'packet': signed_attest_packet,
  }, callback);
}

function keyserver_replace_request(email, signed_attest_packet, new_pubkey, callback) {
  return keyserver_call('replace/request', {
    'signed_message': signed_attest_packet,
    'new_pubkey': new_pubkey,
    'email': email,
  }, callback);
}

function keyserver_replace_confirm(signed_attest_packet, callback) {
  return keyserver_call('replace/confirm', {
    'signed_message': signed_attest_packet,
  }, callback);
}

function keyserver_call(path, data, callback) {
  return $.ajax({
    url: 'https://cryptup-keyserver.herokuapp.com/' + path,
    // url: 'http://127.0.0.1:5000/' + path,
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

var ATTEST_PACKET_BEGIN = '-----BEGIN ATTEST PACKET-----\n';
var ATTEST_PACKET_END = '\n-----END ATTEST PACKET-----';

function attest_packet_armor(content_text) {
  return ATTEST_PACKET_BEGIN + content_text + ATTEST_PACKET_END;
}

function attest_packet_create_sign(values, decrypted_prv, callback) {
  var lines = [];
  $.each(values, function(key, value) {
    lines.push(key + ':' + value);
  });
  var content_text = lines.join('\n');
  var packet = attest_packet_parse(attest_packet_armor(content_text));
  if(packet.success !== true) {
    callback(false, packet.error);
  } else {
    sign(decrypted_prv, content_text, true, function(signed_attest_packet) {
      callback(true, signed_attest_packet.data);
    });
  }
}

function attest_packet_parse(text) {
  var accepted_values = {
    'ACT': 'action',
    'ATT': 'attester',
    'ADD': 'email_hash',
    'PUB': 'fingerprint',
    'OLD': 'fingerprint_old',
    'RAN': 'random',
  };
  var result = {
    success: false,
    content: {},
    error: null,
    text: null,
  };
  var matches = text.match(/-----BEGIN ATTEST PACKET-----((.|[\r?\n])+)-----END ATTEST PACKET-----/m);
  if(matches && matches[1]) {
    result.text = matches[1].replace(/^\s+|\s+$/g, '');
    var lines = result.text.split('\n');
    $.each(lines, function(i, line) {
      var line_parts = line.replace('\n', '').replace(/^\s+|\s+$/g, '').split(':');
      if(line_parts.length !== 2) {
        result.error = 'Wrong content line format';
        return false;
      }
      if(!accepted_values[line_parts[0]]) {
        result.error = 'Unknown line key';
        return false;
      }
      if(result.content[accepted_values[line_parts[0]]]) {
        result.error = 'Duplicate line key';
        return false;
      }
      result.content[accepted_values[line_parts[0]]] = line_parts[1];
    });
    if(result.error !== null) {
      result.content = {};
      return result;
    } else {
      if(result.content.fingerprint && result.content.fingerprint.length !== 40) { //todo - we should use regex here, everywhere
        result.error = 'Wrong PUB line value format';
        result.content = {};
        return result;
      }
      if(result.content.email_hash && result.content.email_hash.length !== 40) {
        result.error = 'Wrong ADD line value format';
        result.content = {};
        return result;
      }
      if(result.content.random && result.content.random.length !== 40) {
        result.error = 'Wrong RAN line value format';
        result.content = {};
        return result;
      }
      if(result.content.fingerprint_old && result.content.fingerprint_old.length !== 40) {
        result.error = 'Wrong OLD line value format';
        result.content = {};
        return result;
      }
      if(result.content.action && ['INITIAL', 'REQUEST_REPLACEMENT', 'CONFIRM_REPLACEMENT'].indexOf(result.content.action) === -1) {
        result.error = 'Wrong ACT line value format';
        result.content = {};
        return result;
      }
      if(result.content.attester && ['CRYPTUP'].indexOf(result.content.attester) === -1) {
        result.error = 'Wrong ATT line value format';
        result.content = {};
        return result;
      }
      result.success = true;
      return result;
    }
  } else {
    result.error = 'Could not locate packet headers';
    result.content = {};
    return result;
  }
}
