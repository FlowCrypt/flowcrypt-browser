function get_url_params(expected_keys, string) {
  var raw_url_data = (string || window.location.search.replace('?', '')).split('&');
  var url_data = {};
  $.each(raw_url_data, function(i, pair_string) {
    var pair = pair_string.split('=');
    if(expected_keys.indexOf(pair[0]) !== -1) {
      url_data[pair[0]] = decodeURIComponent(pair[1]);
    }
  });
  return url_data;
}

function is_email_valid(email) {
  return /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i.test(email);
}

function get_account_emails(callback) {
  account_storage_get(null, ['account_emails'], function(storage) {
    var account_emails = [];
    if(typeof storage['account_emails'] !== 'undefined') {
      account_emails = JSON.parse(storage['account_emails']);
    }
    callback(account_emails);
  });
}

function for_each_known_account_email(callback) {
  get_account_emails(function(account_emails) {
    $.each(account_emails, function(i, account_email) {
      callback(account_emails[i]);
    });
  });
}

function add_account_email_to_list_of_accounts(account_email, callback) { //todo: concurrency issues with another tab loaded at the same time
  get_account_emails(function(account_emails) {
    if(account_emails.indexOf(account_email) === -1) {
      account_emails.push(account_email);
      account_storage_set(null, {
        'account_emails': JSON.stringify(account_emails)
      }, callback);
    } else if(typeof callback !== 'undefined') {
      callback();
    }
  });
}

function get_spinner() {
  return '&nbsp;<i class="fa fa-spinner fa-spin"></i>&nbsp;';
}

function random_string(length) {
  var id = "";
  var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  for(var i = 0; i < (length || 5); i++) {
    id += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return id;
}

function array_without_key(array, i) {
  return array.splice(0, i).concat(array.splice(i + 1, array.length));
}

function array_without_value(array, without_value) {
  var result = [];
  $.each(array, function(i, value) {
    if(value !== without_value) {
      result.push(value);
    }
  });
  return result;
}

/* -------------------- CHROME PLUGIN MESSAGING ----------------------------------- */

var background_script_shortcut_handlers = undefined;

function chrome_message_send(tab_id, name, data, callback) {
  var msg = {
    name: name,
    data: data,
    to: Number(tab_id) || null,
    respondable: (callback) ? true : false,
  };
  if(!background_script_shortcut_handlers) {
    chrome.runtime.sendMessage(msg, callback);
  } else { // calling from background script to background script: skip messaging completely
    background_script_shortcut_handlers[name](data, null, callback);
  }
}

function chrome_message_get_tab_id(callback) {
  chrome_message_send(null, '_tab_', null, callback);
}

function chrome_message_background_listen(handlers) {
  background_script_shortcut_handlers = handlers;
  chrome.runtime.onMessage.addListener(function(request, sender, respond) {
    handlers._tab_ = function(request, sender, respond) {
      respond(sender.tab.id);
    }
    if(request.to) {
      request.sender = sender;
      chrome.tabs.sendMessage(request.to, request, respond);
    } else {
      handlers[request.name](request.data, sender, respond);
    }
    return request.respondable === true;
  });
}

function chrome_message_listen(handlers) {
  chrome.runtime.onMessage.addListener(function(request, sender, respond) {
    handlers[request.name](request.data, sender, respond);
    return request.respondable === true;
  });
}

function base64url_encode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64url_decode(str) {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

function uint8_to_str(u8a) {
  var CHUNK_SZ = 0x8000;
  var c = [];
  for(var i = 0; i < u8a.length; i += CHUNK_SZ) {
    c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
  }
  return c.join("");
}

function str_to_uint8(string) {
  var string = btoa(unescape(encodeURIComponent(string)));
  var charList = string.split('');
  var uintArray = [];
  for(var i = 0; i < charList.length; i++) {
    uintArray.push(charList[i].charCodeAt(0));
  }
  return new Uint8Array(uintArray);
}


/* -------------------- DOUBLE CLICK/PARALLEL PROTECTION FOR JQUERY ----------------------------------- */

var events_fired = {};
var DOUBLECLICK_MS = 1000;

function doubleclick() {
  return {
    name: 'doubleclick',
    id: random_string(10),
  };
}

function parallel() {
  return {
    name: 'parallel',
    id: random_string(10),
  };
}

function prevent(meta, callback) {
  return function() {
    if(meta.id in events_fired) {
      if(meta.name === 'parallel') {
        return; // id was found - means the event handling is still being processed. Do not call back
      } else if(meta.name === 'doubleclick') {
        if(Date.now() - events_fired[meta.id] > DOUBLECLICK_MS) {
          events_fired[meta.id] = Date.now();
          callback(this, meta.id);
        }
      }
    } else {
      events_fired[meta.id] = Date.now();
      callback(this, meta.id);
    }
  }
}

function release(id) {
  if(id in events_fired) {
    var ms_to_release = DOUBLECLICK_MS + events_fired[id] - Date.now();
    if(ms_to_release > 0) {
      setTimeout(function() {
        delete events_fired[id];
      }, ms_to_release);
    } else {
      delete events_fired[id];
    }
  }
}
