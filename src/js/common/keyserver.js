/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function keyserver_keys_find(email, callback) {
  return keyserver_call('keys/find', {
    email: (typeof email === 'string') ? trim_lower(email) : email.map(trim_lower),
  }, callback);
}

function keyserver_keys_submit(email, pubkey, attest, callback) {
  return keyserver_call('keys/submit', {
    email: trim_lower(email),
    pubkey: pubkey.trim(),
    attest: attest || false,
  }, callback);
}

function keyserver_keys_check(emails, callback) {
  return keyserver_call('keys/check', {
    emails: emails.map(trim_lower),
  }, callback);
}

function keyserver_keys_attest(signed_attest_packet, callback) {
  return keyserver_call('keys/attest', {
    packet: signed_attest_packet,
  }, callback);
}

function keyserver_replace_request(email, signed_attest_packet, new_pubkey, callback) {
  return keyserver_call('replace/request', {
    signed_message: signed_attest_packet,
    new_pubkey: new_pubkey,
    email: email,
  }, callback);
}

function keyserver_replace_confirm(signed_attest_packet, callback) {
  return keyserver_call('replace/confirm', {
    signed_message: signed_attest_packet,
  }, callback);
}

function cryptup_auth_info(callback) {
  account_storage_get(null, ['cryptup_account_email', 'cryptup_account_uuid', 'cryptup_account_verified'], function (storage) {
    callback(storage.cryptup_account_email, storage.cryptup_account_uuid, storage.cryptup_account_verified);
  });
}

function cryptup_subscription(callback) {
  account_storage_get(null, ['cryptup_account_email', 'cryptup_account_uuid', 'cryptup_account_verified', 'cryptup_account_subscription'], function (s) {
    if(s.cryptup_account_email && s.cryptup_account_uuid && s.cryptup_account_verified && s.cryptup_account_subscription && s.cryptup_account_subscription.level) {
      var active = true; // todo: check cryptup_subscription.expire
      callback(cryptup_subscription.level, cryptup_subscription.expiration, active);
    } else {
      callback(null, null, false);
    }
  });
}

function cryptup_auth_error() {
  throw Error('cryptup_auth_error not callable');
}

function cryptup_account_login(account_email, token, callback) {
  cryptup_auth_info(function (registered_email, registered_uuid, already_verified) {
    var uuid = registered_uuid || sha1(random_string(40));
    var email = registered_email || account_email;
    cryptup_server_call('account/login', { account: email, uuid: uuid, token: token || null, }, function (success, result) {
      if(success) {
        if(result.registered === true) {
          account_storage_set(null, { cryptup_account_email: email, cryptup_account_uuid: uuid, cryptup_account_verified: result.verified === true, cryptup_account_subscription: result.subscription, }, function () {
            callback(true, result.verified === true, result.subscription);
          });
        } else {
          if(typeof result.error === 'object') {
            cryptup_error_log('account/login fail response: ' + JSON.stringify(result.error));
            callback(false, false, null, result.error.public_msg);
          } else {
            callback(false, false, null, result.error);
          }
        }
      } else {
        callback(false, false, null, 'connection error');
      }
    });
  });
}

function cryptup_account_subscribe(product, callback) {
  cryptup_auth_info(function (email, uuid, verified) {
    if(verified) {
      cryptup_server_call('account/subscribe', {
        account: email,
        uuid: uuid,
        product: product,
      }, function (success, result) {
        if(success) {
          account_storage_set(null, { cryptup_account_subscription: result.subscription, }, function () {
            callback(true, result.subscription, result.error);
          });
        } else {
          callback(false, result.subscription, result.error);
        }
      });
    } else {
      callback(cryptup_auth_error);
    }
  });
}

function cryptup_account_store_attachment(attachment, callback) {
  cryptup_auth_info(function (email, uuid, verified) {
    if(verified) {
      cryptup_server_call('account/store', {
        account: email,
        uuid: uuid,
        data: attachment,
        type: attachment.type,
        role: 'attachment',
      }, callback, 'FORM');
    } else {
      callback(cryptup_auth_error);
    }
  });
}

function keyserver_call(path, data, callback, format) {
  if(format !== 'FORM') {
    var data_formatted = JSON.stringify(data);
    var content_type = 'application/json; charset=UTF-8';
  } else {
    var data_formatted = new FormData();
    $.each(data, function (name, value) {
      if(typeof value === 'object' && value.name && value.content && value.type) {
        data_formatted.append(name, new Blob([value.content], { type: value.type }), value.name); // todo - type should be just app/pgp?
      } else {
        data_formatted.append(name, value);
      }
    });
    var content_type = false;
  }
  console.log('replace_to_prod_server');
  return $.ajax({
    // url: 'https://cryptup-keyserver.herokuapp.com/' + path,
    url: 'http://127.0.0.1:5000/' + path,
    method: 'POST',
    data: data_formatted,
    dataType: 'json',
    crossDomain: true,
    processData: false,
    contentType: content_type,
    async: true,
    success: function (response) {
      callback(true, response);
    },
    error: function (XMLHttpRequest, status, error) {
      callback(false, { request: XMLHttpRequest, status: status, error: error });
    },
  });
}

var cryptup_server_call = keyserver_call; // this will be separated in the future

var ATTEST_PACKET_BEGIN = '-----BEGIN ATTEST PACKET-----\n';
var ATTEST_PACKET_END = '\n-----END ATTEST PACKET-----';

function attest_packet_armor(content_text) {
  return ATTEST_PACKET_BEGIN + content_text + ATTEST_PACKET_END;
}

function attest_packet_create_sign(values, decrypted_prv, callback) {
  var lines = [];
  $.each(values, function (key, value) {
    lines.push(key + ':' + value);
  });
  var content_text = lines.join('\n');
  var packet = attest_packet_parse(attest_packet_armor(content_text));
  if(packet.success !== true) {
    callback(false, packet.error);
  } else {
    sign(decrypted_prv, content_text, true, function (signed_attest_packet) {
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
  var matches = text.match(/-----BEGIN ATTEST PACKET-----([^]+)-----END ATTEST PACKET-----/m);
  if(matches && matches[1]) {
    result.text = matches[1].replace(/^\s+|\s+$/g, '');
    var lines = result.text.split('\n');
    $.each(lines, function (i, line) {
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
