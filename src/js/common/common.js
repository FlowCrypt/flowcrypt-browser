'use strict';

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

function unique(array) {
  var unique = [];
  $.each(array, function(i, v) {
    if(unique.indexOf(v) === -1) {
      unique.push(v);
    }
  });
  return unique;
}

function trim_lower(email) {
  if(email.indexOf('<') !== -1 && email.indexOf('>') !== -1) {
    email = email.substr(email.indexOf('<') + 1, email.indexOf('>') - email.indexOf('<') - 1);
  }
  return email.trim().toLowerCase();
}

function get_future_timestamp_in_months(months_to_add) {
  return new Date().getTime() + 1000 * 3600 * 24 * 30 * months_to_add;
}

function as_html_formatted_string(obj) {
  return JSON.stringify(obj, null, 2).replace(/ /g, '&nbsp;').replace(/\n/g, '<br>');
}

function get_passphrase(account_email) {
  if(private_storage_get(localStorage, account_email, 'master_passphrase_needed') === false) {
    return '';
  }
  var stored = private_storage_get(localStorage, account_email, 'master_passphrase');
  if(stored) {
    return stored;
  }
  var temporary = private_storage_get(sessionStorage, account_email, 'master_passphrase');
  if(temporary) {
    return temporary;
  }
  return null;
}

function download_file(filename, type, data) {
  var blob = new Blob([data], {
    type: type
  });
  var a = document.createElement('a');
  var url = window.URL.createObjectURL(blob);
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

function key_codes() {
  return {
    a: 97,
    r: 114,
    A: 65,
    R: 82,
    f: 102,
    F: 70,
    backspace: 8,
    tab: 9,
    enter: 13,
    comma: 188,
  };
}

function mime_node_type(node) {
  if(node.headers['content-type'] && node.headers['content-type'][0]) {
    return node.headers['content-type'][0].value;
  }
}

function mime_node_filename(node) {
  if(node.headers['content-disposition'] && node.headers['content-disposition'][0] && node.headers['content-disposition'][0].params && node.headers['content-disposition'][0].params.filename) {
    return node.headers['content-disposition'][0].params.filename;
  }
  if(node.headers['content-type'] && node.headers['content-type'][0] && node.headers['content-type'][0].params && node.headers['content-type'][0].params.name) {
    return node.headers['content-disposition'][0].params.name;
  }
}

function parse_mime_message(mime_message, callback) {
  set_up_require();
  var mime_message_contents = {
    attachments: [],
    headers: {},
  };
  require(['emailjs-mime-parser'], function(MimeParser) {
    try {
      //todo - handle mime formatting errors and such, with callback(false, 'XX went wrong');
      var parser = new MimeParser();
      var parsed = {};
      parser.onheader = function(node) {
        if(!String(node.path.join("."))) { // root node headers
          $.each(node.headers, function(name, header) {
            mime_message_contents.headers[name] = header[0].value;
          });
        }
      };
      parser.onbody = function(node, chunk) {
        var path = String(node.path.join("."));
        if(typeof parsed[path] === 'undefined') {
          parsed[path] = node;
        }
      };
      parser.onend = function() {
        $.each(parsed, function(path, node) {
          if(mime_node_type(node) === 'application/pgp-signature') {
            mime_message_contents.signature = uint8_as_utf(node.content);
          } else if(mime_node_type(node) === 'text/html' && !mime_node_filename(node)) {
            mime_message_contents.html = uint8_as_utf(node.content);
          } else if(mime_node_type(node) === 'text/plain' && !mime_node_filename(node)) {
            mime_message_contents.text = uint8_as_utf(node.content);
          } else {
            var node_content = uint8_to_str(node.content);
            mime_message_contents.attachments.push({
              name: mime_node_filename(node),
              size: node_content.length,
              type: mime_node_type(node),
              data: node_content,
            });
          }
        });
        callback(true, mime_message_contents);
      }
      parser.write(mime_message); //todo - better chunk it for very big messages containing attachments? research
      parser.end();
    } catch(e) {
      console.log(e + JSON.stringify(e)); // todo - this will catch on errors inside callback() which is not good
      // todo - rather should only catch parse error and return through callback(false, ...)
      throw e;
    }
  });
}

function number_format(nStr) { // http://stackoverflow.com/questions/3753483/javascript-thousand-separator-string-format
  nStr += '';
  var x = nStr.split('.');
  var x1 = x[0];
  var x2 = x.length > 1 ? '.' + x[1] : '';
  var rgx = /(\d+)(\d{3})/;
  while(rgx.test(x1)) {
    x1 = x1.replace(rgx, '$1' + ',' + '$2');
  }
  return x1 + x2;
}

function set_up_require() {
  require.config({
    baseUrl: '/lib',
    paths: {
      'emailjs-addressparser': './emailjs/emailjs-addressparser',
      'emailjs-mime-builder': './emailjs/emailjs-mime-builder',
      'emailjs-mime-codec': './emailjs/emailjs-mime-codec',
      'emailjs-mime-parser': './emailjs/emailjs-mime-parser',
      'emailjs-mime-types': './emailjs/emailjs-mime-types',
      'emailjs-stringencoding': './emailjs/emailjs-stringencoding',
      'punycode': './emailjs/punycode',
      'sinon': './emailjs/sinon',
      'quoted-printable': './emailjs/quoted-printable',
    }
  });
}

function open_settings_page(page, account_email) {
  if(account_email) {
    window.open(chrome.extension.getURL('chrome/settings/' + page) + '?account_email=' + encodeURIComponent(account_email), 'cryptup');
  } else {
    window.open(chrome.extension.getURL('chrome/settings/' + (page || 'index.htm')), 'cryptup');
  }
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

function strip_pgp_armor(pgp_block_text) {
  if(!pgp_block_text) {
    return pgp_block_text;
  }
  var debug = false;
  if(debug) {
    console.log('pgp_block_1');
    console.log(pgp_block_text);
  }
  var newlines = [/<div><br><\/div>/g, /<\/div><div>/g, /<[bB][rR]( [a-zA-Z]+="[^"]*")* ?\/? ?>/g, /<div ?\/?>/g];
  var spaces = [/&nbsp;/g];
  var removes = [/<wbr ?\/?>/g, /<\/?div>/g];
  $.each(newlines, function(i, newline) {
    pgp_block_text = pgp_block_text.replace(newline, '\n');
  });
  if(debug) {
    console.log('pgp_block_2');
    console.log(pgp_block_text);
  }
  $.each(removes, function(i, remove) {
    pgp_block_text = pgp_block_text.replace(remove, '');
  });
  if(debug) {
    console.log('pgp_block_3');
    console.log(pgp_block_text);
  }
  $.each(spaces, function(i, space) {
    pgp_block_text = pgp_block_text.replace(space, ' ');
  });
  if(debug) {
    console.log('pgp_block_4');
    console.log(pgp_block_text);
  }
  pgp_block_text = pgp_block_text.replace(/\r\n/g, '\n');
  if(debug) {
    console.log('pgp_block_5');
    console.log(pgp_block_text);
  }
  pgp_block_text = $('<div>' + pgp_block_text + '</div>').text();
  if(debug) {
    console.log('pgp_block_6');
    console.log(pgp_block_text);
  }
  var double_newlines = pgp_block_text.match(/\n\n/g);
  if(double_newlines !== null && double_newlines.length > 2) { //a lot of newlines are doubled
    pgp_block_text = pgp_block_text.replace(/\n\n/g, '\n');
    if(debug) {
      console.log('pgp_block_removed_doubles');
    }
  }
  if(debug) {
    console.log('pgp_block_7');
    console.log(pgp_block_text);
  }
  pgp_block_text = pgp_block_text.replace(/^ +/gm, '');
  if(debug) {
    console.log('pgp_block_final');
    console.log(pgp_block_text);
  }
  return pgp_block_text;
}

function get_spinner() {
  return '&nbsp;<i class="fa fa-spinner fa-spin"></i>&nbsp;';
  // Updated spinner still broken.
  // return '&nbsp;<div class="inline_loader" title="0"><svg version="1.1" id="loader-1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" viewBox="0 0 40 40" enable-background="new 0 0 40 40" xml:space="preserve"><path opacity="0.1" fill="#088447" d="M20.201,5.169c-8.254,0-14.946,6.692-14.946,14.946c0,8.255,6.692,14.946,14.946,14.946s14.946-6.691,14.946-14.946C35.146,11.861,28.455,5.169,20.201,5.169z M20.201,31.749c-6.425,0-11.634-5.208-11.634-11.634c0-6.425,5.209-11.634,11.634-11.634c6.425,0,11.633,5.209,11.633,11.634C31.834,26.541,26.626,31.749,20.201,31.749z" /><path fill="#088447" d="M26.013,10.047l1.654-2.866c-2.198-1.272-4.743-2.012-7.466-2.012h0v3.312h0C22.32,8.481,24.301,9.057,26.013,10.047z"><animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="0.5s" repeatCount="indefinite" /></path></svg></div>&nbsp;';
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

function extract_key_ids(armored_pubkey) {
  return openpgp.key.readArmored(armored_pubkey).keys[0].getKeyIds();
}

function key_ids_match(first, second) {
  if(first.length !== second.length) {
    return false;
  }
  for(var i = 0; i < first.length; i++) {
    if(first[i].bytes !== second[i].bytes) {
      return false;
    }
  }
  return true;
}

function check_pubkeys_message(account_email, message) {
  var message_key_ids = message.getEncryptionKeyIds();
  var local_key_ids = extract_key_ids(private_storage_get(localStorage, account_email, 'master_public_key'));
  var diagnosis = {
    found_match: false,
    receivers: message_key_ids.length,
  };
  $.each(message_key_ids, function(i, msg_k_id) {
    $.each(local_key_ids, function(j, local_k_id) {
      if(msg_k_id === local_k_id) {
        diagnosis.found_match = true;
        return false;
      }
    });
  });
  return diagnosis;
}

function check_pubkeys_keyserver(account_email, callback) {
  var local_key_ids = extract_key_ids(private_storage_get(localStorage, account_email, 'master_public_key'));
  var diagnosis = {
    has_pubkey_missing: false,
    has_pubkey_mismatch: false,
    results: {},
  };
  account_storage_get(account_email, ['addresses'], function(storage) {
    keyserver_keys_find(storage.addresses, function(success, pubkey_search_results) {
      if(success) {
        $.each(pubkey_search_results.results, function(i, pubkey_search_result) {
          if(!pubkey_search_result.pubkey) {
            diagnosis.has_pubkey_missing = true;
            diagnosis.results[pubkey_search_result.email] = {
              pubkey: null,
              pubkey_ids: null,
              match: null,
            }
          } else {
            var match = true;
            if(!key_ids_match(extract_key_ids(pubkey_search_result.pubkey), local_key_ids)) {
              diagnosis.has_pubkey_mismatch = true;
              match = false;
            }
            diagnosis.results[pubkey_search_result.email] = {
              pubkey: pubkey_search_result.pubkey,
              pubkey_ids: extract_key_ids(pubkey_search_result.pubkey),
              match: match,
            }
          }
        });
        callback(diagnosis);
      } else {
        callback();
      }
    });
  });
}

RegExp.escape = function(s) {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};
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
    if(typeof handlers[request.name] !== 'undefined') {
      handlers[request.name](request.data, sender, respond);
    } else {
      throw 'chrome_message_listen error: handler "' + request.name + '" not set';
    }
    return request.respondable === true;
  });
}

/******************************************* STRINGS **********************************/

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

function str_to_uint8(raw) {
  var rawLength = raw.length;
  var uint8 = new Uint8Array(new ArrayBuffer(rawLength));
  for(var i = 0; i < rawLength; i++) {
    uint8[i] = raw.charCodeAt(i);
  }
  return uint8;
}

function uint8_as_utf(a) { //tom
  var length = a.length;
  var bytes_left_in_char = 0;
  var utf8_string = '';
  var binary_char = '';
  for(var i = 0; i < length; i++) {
    if(a[i] < 128) {
      if(bytes_left_in_char) {
        console.log('uint8_to_utf_str: utf-8 continuation byte missing, multi-byte character cut short and omitted');
      }
      bytes_left_in_char = 0;
      binary_char = '';
      utf8_string += String.fromCharCode(a[i]);
    } else {
      if(!bytes_left_in_char) { // beginning of new multi-byte character
        if(a[i] >= 192 && a[i] < 224) { //110x xxxx
          bytes_left_in_char = 1;
          binary_char = a[i].toString(2).substr(3);
        } else if(a[i] >= 224 && a[i] < 240) { //1110 xxxx
          bytes_left_in_char = 2;
          binary_char = a[i].toString(2).substr(4);
        } else if(a[i] >= 240 && a[i] < 248) { //1111 0xxx
          bytes_left_in_char = 3;
          binary_char = a[i].toString(2).substr(5);
        } else if(a[i] >= 248 && a[i] < 252) { //1111 10xx
          bytes_left_in_char = 4;
          binary_char = a[i].toString(2).substr(6);
        } else if(a[i] >= 252 && a[i] < 254) { //1111 110x
          bytes_left_in_char = 5;
          binary_char = a[i].toString(2).substr(7);
        } else {
          console.log('uint8_to_utf_str: invalid utf-8 character beginning byte: ' + a[i]);
        }
      } else { // continuation of a multi-byte character
        binary_char += a[i].toString(2).substr(2);
        bytes_left_in_char--;
      }
      if(binary_char && !bytes_left_in_char) {
        utf8_string += String.fromCharCode(parseInt(binary_char, 2));
        binary_char = '';
      }
    }
  }
  return utf8_string;
}

function bin_to_hex(s) { //http://phpjs.org/functions/bin2hex/, Kevin van Zonneveld (http://kevin.vanzonneveld.net), Onno Marsman, Linuxworld, ntoniazzi
  var i, l, o = '',
    n;
  s += '';
  for(i = 0, l = s.length; i < l; i++) {
    n = s.charCodeAt(i).toString(16);
    o += n.length < 2 ? '0' + n : n;
  }
  return o;
}

function sha256(string) {
  return bin_to_hex(uint8_to_str(openpgp.crypto.hash.sha256(string)));
}

function sha256_loop(string, times) {
  for(var i = 0; i < (times || 100000); i++) {
    string = sha256(string);
  }
  return string;
}

function challenge_answer_hash(answer) {
  return sha256_loop(answer);
}

/* -------------------- DOUBLE CLICK/PARALLEL PROTECTION FOR JQUERY ----------------------------------- */

var events_fired = {};
var DOUBLECLICK_MS = 1000;
var SPREE_MS = 50;
var SLOW_SPREE_MS = 200;

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

function spree(type) {
  return {
    name: (type === 'slow') ? 'slowspree' : 'spree',
    id: random_string(10),
  }
}

function prevent(meta, callback) { //todo: messy + needs refactoring
  return function() {
    if(meta.name === 'spree') {
      clearTimeout(events_fired[meta.id]);
      events_fired[meta.id] = setTimeout(callback, SPREE_MS);
    } else if(meta.name === 'slowspree') {
      clearTimeout(events_fired[meta.id]);
      events_fired[meta.id] = setTimeout(callback, SLOW_SPREE_MS);
    } else {
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
