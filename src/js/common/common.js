/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var original_on_error = window.onerror;
window.onerror = cryptup_error_handler;

function cryptup_error_handler(error_message, url, line, col, error, is_manually_called, version, environment) {
  if(typeof error === 'string') {
    error_message = error;
    error = {
      name: 'thrown_string',
      message: error_message,
      stack: error_message,
    };
  }
  var user_log_message = ' Please report errors above to tom@cryptup.org. I fix errors VERY promptly.';
  var ignored_errors = [
    // happens in gmail window when reloaded extension + now reloading the gmail
    'Invocation of form get(, function) doesn\'t match definition get(optional string or array or object keys, function callback)',
  ];
  if(!error) {
    return;
  }
  if(ignored_errors.indexOf(error.message) !== -1) {
    return true;
  }
  if(error.stack) {
    console.log('%c' + error.stack, 'color: #F00; font-weight: bold;');
  } else {
    console.log('%c' + error_message, 'color: #F00; font-weight: bold;');
  }
  if(is_manually_called !== true && original_on_error && original_on_error !== cryptup_error_handler) {
    original_on_error.apply(this, arguments); // Call any previously assigned handler
  }
  if((error.stack || '').indexOf('PRIVATE') !== -1) {
    return;
  }
  if(!version) {
    if(chrome.runtime.getManifest) {
      version = chrome.runtime.getManifest().version;
    } else {
      version = 'unknown';
    }
  }
  if(!environment) {
    environment = get_environment();
  }
  try {
    $.ajax({
      url: 'https://cryptup-keyserver.herokuapp.com/help/error',
      method: 'POST',
      data: JSON.stringify({
        name: (error.name || '').substring(0, 50),
        message: (error_message || '').substring(0, 200),
        url: (url || '').substring(0, 300),
        line: line,
        col: col,
        trace: error.stack,
        version: version,
        environment: environment,
      }),
      dataType: 'json',
      crossDomain: true,
      contentType: 'application/json; charset=UTF-8',
      async: true,
      success: function(response) {
        if(response.saved === true) {
          console.log('%cCRYPTUP ERROR:' + user_log_message, 'font-weight: bold;');
        } else {
          console.log('%cCRYPTUP EXCEPTION:' + user_log_message, 'font-weight: bold;');
        }
      },
      error: function(XMLHttpRequest, status, error) {
        console.log('%cCRYPTUP FAILED:' + user_log_message, 'font-weight: bold;');
      },
    });
  } catch(ajax_err) {
    console.log(ajax_err.message);
    console.log('%cCRYPTUP ISSUE:' + user_log_message, 'font-weight: bold;');
  }
  try {
    increment_metric('error');
    account_storage_get(null, ['errors'], function(storage) {
      if(typeof storage.errors === 'undefined') {
        storage.errors = [];
      }
      storage.errors.unshift(error.stack || error_message);
      account_storage_set(null, storage);
    });
  } catch(storage_err) {

  }
  return true;
}

function Try(code) {
  return function() {
    try {
      return code();
    } catch(code_err) {
      cryptup_error_handler_manual(code_err);
    }
  };
}

function cryptup_error_handler_manual(exception) {
  try {
    var caller_line = exception.stack.split('\n')[1];
    var matched = caller_line.match(/\.js\:([0-9]+)\:([0-9]+)\)?/);
    var line = Number(matched[1]);
    var col = Number(matched[2]);
  } catch(line_err) {
    var line = 0;
    var col = 0;
  }
  try {
    chrome_message_send(null, 'runtime', null, function(runtime) {
      cryptup_error_handler(exception.message, window.location.href, line, col, exception, true, runtime.version, runtime.environment);
    });
  } catch(message_err) {
    cryptup_error_handler(exception.message, window.location.href, line, col, exception, true);
  }
}

function cryptup_error_log(name, details) {
  try {
    throw new Error(name);
  } catch(e) {
    if(typeof details !== 'string') {
      try {
        details = JSON.stringify(details);
      } catch(stringify_error) {
        details = '(could not stringify details "' + String(details) + '" in cryptup_error_log because: ' + stringify_error.message + ')';
      }
    }
    e.stack = e.stack + '\n\n\ndetails: ' + details;
    cryptup_error_handler_manual(e);
  }
}

function WrapWithTryIfContentScript(code) {
  if(get_environment() === 'content_script') {
    return Try(code);
  } else {
    return code;
  }
}

function TrySetTimeout(code, delay) {
  return setTimeout(Try(code), delay);
}

function TrySetInterval(code, delay) {
  return setInterval(Try(code), delay);
}

function get_environment(url) {
  if(!url) {
    url = window.location.href;
  }
  if(url.indexOf('bnjglocicd') !== -1) {
    return 'prod';
  } else if(url.indexOf('nmelpmhpel') !== -1) {
    return 'dev';
  } else {
    return 'content_script';
  }
}

if(typeof window.openpgp !== 'undefined' && typeof window.openpgp.config !== 'undefined' && typeof window.openpgp.config.versionstring !== 'undefined' && typeof window.openpgp.config.commentstring !== 'undefined') {
  window.openpgp.config.versionstring = 'CryptUP ' + chrome.runtime.getManifest().version + ' Easy Gmail Encryption https://cryptup.org';
  window.openpgp.config.commentstring = 'Seamlessly send, receive and search encrypted email';
}

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

function cryptup_version_integer() {
  return Number(chrome.runtime.getManifest().version.replace(/\./g, ''));
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

function to_array(obj) { // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
  var array = [];
  // iterate backwards ensuring that length is an UInt32
  for(var i = obj.length >>> 0; i--;) {
    array[i] = obj[i];
  }
  return array;
}

function wait(until_this_function_evaluates_true) {
  return new Promise(function(success, error) {
    var interval = setInterval(function() {
      var result = until_this_function_evaluates_true();
      if(result === true) {
        clearInterval(interval);
        success();
      } else if(result === false) {
        clearInterval(interval);
        error();
      }
    }, 50);
  });
}

function trim_lower(email) {
  if(email.indexOf('<') !== -1 && email.indexOf('>') !== -1) {
    email = email.substr(email.indexOf('<') + 1, email.indexOf('>') - email.indexOf('<') - 1);
  }
  return email.trim().toLowerCase();
}

function parse_email_string(email_string) {
  if(email_string.indexOf('<') !== -1 && email_string.indexOf('>') !== -1) {
    return {
      email: email_string.substr(email_string.indexOf('<') + 1, email_string.indexOf('>') - email_string.indexOf('<') - 1).replace(/["']/g, '').trim().toLowerCase(),
      name: email_string.substr(0, email_string.indexOf('<')).replace(/["']/g, '').trim(),
    };
  }
  return {
    email: email_string.replace(/["']/g, '').trim().toLowerCase(),
    name: null,
  };
}

function get_future_timestamp_in_months(months_to_add) {
  return new Date().getTime() + 1000 * 3600 * 24 * 30 * months_to_add;
}

function as_html_formatted_string(obj) {
  return JSON.stringify(obj, null, 2).replace(/ /g, '&nbsp;').replace(/\n/g, '<br>');
}

function inner_text(html_text) {
  var e = document.createElement('div');
  e.innerHTML = html_text;
  return e.innerText;
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

function mime_headers_to_from(parsed_mime_message) {
  var header_to = [];
  var header_from = undefined;
  if(parsed_mime_message.headers.from && parsed_mime_message.headers.from.length && parsed_mime_message.headers.from[0] && parsed_mime_message.headers.from[0].address) {
    var header_from = parsed_mime_message.headers.from[0].address;
  }
  if(parsed_mime_message.headers.to && parsed_mime_message.headers.to.length) {
    $.each(parsed_mime_message.headers.to, function(i, to) {
      if(to.address) {
        header_to.push(to.address);
      }
    });
  }
  return {
    from: header_from,
    to: header_to,
  };
}

function could_be_mime_message(message) {
  var m = message.toLowerCase();
  var has_content_type = m.match(/content-type: +[0-9a-z\-\/]+/) !== null;
  var has_content_transfer_encoding = m.match(/content-transfer-encoding: +[0-9a-z\-\/]+/) !== null;
  var has_content_disposition = m.match(/content-disposition: +[0-9a-z\-\/]+/) !== null;
  return has_content_type && (has_content_transfer_encoding || has_content_disposition);
}

function format_mime_plaintext_to_display(text, full_mime_message) {
  // todo - this function is very confusing, and should be split into two:
  // ---> format_mime_plaintext_to_display(text, charset)
  // ---> get_charset(full_mime_message)
  if(/<((br)|(div)|p) ?\/?>/.test(text)) {
    return text;
  }
  text = (text || '').replace(/\n/g, '<br>\n');
  if(text && full_mime_message && full_mime_message.match(/^Charset: iso-8859-2/m) !== null) {
    return window.iso88592.decode(text);
  }
  return text;
}

function parse_mime_message(mime_message, callback) {
  set_up_require();
  var mime_message_contents = {
    attachments: [],
    headers: {},
    text: undefined,
    html: undefined,
    signature: undefined,
  };
  require(['emailjs-mime-parser'], function(MimeParser) {
    try {
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
        Try(function() {
          callback(true, mime_message_contents);
        })();
      }
      parser.write(mime_message); //todo - better chunk it for very big messages containing attachments? research
      parser.end();
    } catch(e) {
      cryptup_error_handler_manual(e);
      Try(function() {
        callback(false, mime_message_contents);
      })();
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

function open_settings_page(path, account_email, page) {
  if(account_email) {
    window.open(chrome.extension.getURL('chrome/settings/' + (path || 'index.htm') + '?account_email=' + encodeURIComponent(account_email) + '&page=' + encodeURIComponent(page)), 'cryptup');
  } else {
    get_account_emails(function(account_emails) {
      window.open(chrome.extension.getURL('chrome/settings/' + (path || 'index.htm') + '?account_email=' + (account_emails[0] || '') + '&page=' + encodeURIComponent(page)), 'cryptup');
    });
  }
}

function is_email_valid(email) {
  return /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i.test(email);
}

function month_name(month_index) {
  return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month_index];
}

function get_account_emails(callback) {
  account_storage_get(null, ['account_emails'], function(storage) {
    var account_emails = [];
    if(typeof storage.account_emails !== 'undefined') {
      $.each(JSON.parse(storage.account_emails), function(i, account_email) {
        if(account_emails.indexOf(account_email.toLowerCase()) === -1) {
          account_emails.push(account_email.toLowerCase());
        }
      });
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

function check_keyserver_pubkey_fingerprints() {
  get_account_emails(function(account_emails) {
    if(account_emails && account_emails.length) {
      account_storage_get(account_emails, ['setup_done'], function(multi_storage) {
        var emails_setup_done = [];
        $.each(multi_storage, function(account_email, storage) {
          if(storage.setup_done) {
            emails_setup_done.push(account_email);
          }
        });
        keyserver_keys_check(emails_setup_done, function(success, response) {
          if(success && response.fingerprints && response.fingerprints.length === emails_setup_done.length) {
            var save_result = {};
            $.each(emails_setup_done, function(i, account_email) {
              save_result[account_email] = response.fingerprints[i];
            });
            account_storage_set(null, {
              keyserver_fingerprints: save_result
            });
          }
        });
      });
    }
  });
}

function get_spinner() {
  return '&nbsp;<i class="fa fa-spinner fa-spin"></i>&nbsp;';
  // Updated spinner still broken.
  // return '&nbsp;<div class="inline_loader" title="0"><svg version="1.1" id="loader-1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="20px" height="20px" viewBox="0 0 40 40" enable-background="new 0 0 40 40" xml:space="preserve"><path opacity="0.1" fill="#088447" d="M20.201,5.169c-8.254,0-14.946,6.692-14.946,14.946c0,8.255,6.692,14.946,14.946,14.946s14.946-6.691,14.946-14.946C35.146,11.861,28.455,5.169,20.201,5.169z M20.201,31.749c-6.425,0-11.634-5.208-11.634-11.634c0-6.425,5.209-11.634,11.634-11.634c6.425,0,11.633,5.209,11.633,11.634C31.834,26.541,26.626,31.749,20.201,31.749z" /><path fill="#088447" d="M26.013,10.047l1.654-2.866c-2.198-1.272-4.743-2.012-7.466-2.012h0v3.312h0C22.32,8.481,24.301,9.057,26.013,10.047z"><animateTransform attributeType="xml" attributeName="transform" type="rotate" from="0 20 20" to="360 20 20" dur="0.5s" repeatCount="indefinite" /></path></svg></div>&nbsp;';
}

function add_show_hide_passphrase_toggle(pass_phrase_input_ids, force_initial_show_or_hide) {
  var button_hide = '<i class="fa fa-eye-slash"></i><br>hide';
  var button_show = '<i class="fa fa-eye"></i><br>show';
  account_storage_get(null, ['hide_pass_phrases'], function(storage) {
    if(force_initial_show_or_hide === 'hide') {
      var show = false;
    } else if(force_initial_show_or_hide === 'show') {
      var show = true;
    } else {
      var show = !storage.hide_pass_phrases;
    }
    $.each(pass_phrase_input_ids, function(i, id) {
      if(show) {
        $('#' + id).after('<label href="#" id="toggle_' + id + '" class="toggle_show_hide_pass_phrase" for="' + id + '">' + button_hide + '</label>');
        $('#' + id).attr('type', 'text');
      } else {
        $('#' + id).after('<label href="#" id="toggle_' + id + '" class="toggle_show_hide_pass_phrase" for="' + id + '">' + button_show + '</label>');
        $('#' + id).attr('type', 'password');
      }
      $('#toggle_' + id).click(function() {
        if($('#' + id).attr('type') === 'password') {
          $('#' + id).attr('type', 'text');
          $(this).html(button_hide);
          account_storage_set(null, {
            hide_pass_phrases: false,
          });
        } else {
          $('#' + id).attr('type', 'password');
          $(this).html(button_show);
          account_storage_set(null, {
            hide_pass_phrases: true,
          });
        }
      });
    });
  });
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

function map_select(mapped_object_key) {
  return function(mapped_object) {
    return mapped_object[mapped_object_key];
  };
}

function check_pubkeys_message(account_email, message) {
  var message_key_ids = message.getEncryptionKeyIds();
  var local_key_ids = extract_key_ids(private_storage_get('local', account_email, 'master_public_key'));
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
  var diagnosis = {
    has_pubkey_missing: false,
    has_pubkey_mismatch: false,
    results: {},
  };
  account_storage_get(account_email, ['addresses'], function(storage) {
    keyserver_keys_find(storage.addresses || [account_email], function(success, pubkey_search_results) {
      if(success) {
        $.each(pubkey_search_results.results, function(i, pubkey_search_result) {
          if(!pubkey_search_result.pubkey) {
            diagnosis.has_pubkey_missing = true;
            diagnosis.results[pubkey_search_result.email] = {
              attested: false,
              pubkey: null,
              match: false,
            }
          } else {
            var match = true;
            var local_fingerprint = key_fingerprint(private_storage_get('local', account_email, 'master_public_key'));
            if(key_fingerprint(pubkey_search_result.pubkey) !== local_fingerprint) {
              diagnosis.has_pubkey_mismatch = true;
              match = false;
            }
            diagnosis.results[pubkey_search_result.email] = {
              pubkey: pubkey_search_result.pubkey,
              attested: pubkey_search_result.attested,
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

/* -------------------- CRYPTO ----------------------------------------------------*/

function sign(signing_prv, data, armor, callback) {
  var options = {
    data: data,
    armor: armor,
    privateKeys: signing_prv,
  };
  openpgp.sign(options).then(callback, function(error) {
    console.log(error); // todo - better handling. Alerts suck.
    alert('Error signing message, please try again. If you see this repeatedly, contact me at tom@cryptup.org.');
  });
}

function get_sorted_keys_for_message(db, account_email, message, callback) {
  var keys = {};
  keys.verification_contacts = [];
  keys.for_verification = [];
  if(message.getEncryptionKeyIds) {
    keys.encrypted_for = (message.getEncryptionKeyIds() || []).map(function(id) {
      return key_longid(id.bytes);
    });
  } else {
    keys.encrypted_for = [];
  }
  keys.signed_by = (message.getSigningKeyIds() || []).map(function(id) {
    return key_longid(id.bytes);
  });
  keys.potentially_matching = private_keys_get(account_email, keys.encrypted_for);
  if(keys.potentially_matching.length === 0) { // not found any matching keys, or list of encrypted_for was not supplied in the message. Just try all keys.
    keys.potentially_matching = private_keys_get(account_email);
  }
  keys.with_passphrases = [];
  keys.without_passphrases = [];
  $.each(keys.potentially_matching, function(i, keyinfo) {
    var passphrase = get_passphrase(account_email, keyinfo.longid);
    if(passphrase !== null) {
      var key = openpgp.key.readArmored(keyinfo.armored).keys[0];
      var decrypted = decrypt_key(key, passphrase);
      if(decrypted === true) {
        keyinfo.decrypted = key;
        keys.with_passphrases.push(keyinfo);
      } else {
        keys.without_passphrases.push(keyinfo);
      }
    } else {
      keys.without_passphrases.push(keyinfo);
    }
  });
  if(keys.signed_by.length) {
    db_contact_get(db, keys.signed_by, function(verification_contacts) {
      keys.verification_contacts = verification_contacts.filter(function(contact) {
        return contact !== null;
      });
      keys.for_verification = [].concat.apply([], keys.verification_contacts.map(function(contact) {
        return openpgp.key.readArmored(contact.pubkey).keys;
      }));
      callback(keys);
    });
  } else {
    callback(keys);
  }
}

function zeroed_decrypt_error_counts(keys) {
  return {
    decrypted: 0,
    potentially_matching_keys: keys ? keys.potentially_matching.length : 0,
    attempts: 0,
    key_mismatch: 0,
    wrong_password: 0,
    format_error: 0,
  };
}

function increment_decrypt_error_counts(counts, other_errors, one_time_message_password, decrypt_error) {
  if(String(decrypt_error) === "Error: Error decrypting message: Cannot read property 'isDecrypted' of null" && !one_time_message_password) {
    counts.key_mismatch++; // wrong private key
  } else if(String(decrypt_error) === 'Error: Error decrypting message: Invalid session key for decryption.' && !one_time_message_password) {
    counts.key_mismatch++; // attempted opening password only message with key
  } else if(String(decrypt_error) === 'Error: Error decrypting message: Invalid enum value.' && one_time_message_password) {
    counts.wrong_password++; // wrong password
  } else {
    other_errors.push(String(decrypt_error));
  }
  counts.attempts++;
}

function wait_and_callback_decrypt_errors_if_failed(message, private_keys, counts, other_errors, callback) {
  var wait_for_all_attempts_interval = setInterval(function() { //todo - promises are better
    if(counts.decrypted) {
      clearInterval(wait_for_all_attempts_interval);
    } else {
      if(counts.attempts === private_keys.with_passphrases.length) { // decrypting attempted with all keys, no need to wait longer - can evaluate result now, otherwise wait
        clearInterval(wait_for_all_attempts_interval);
        callback({
          success: false,
          signature: null,
          message: message,
          counts: counts,
          encrypted_for: private_keys.encrypted_for,
          missing_passphrases: private_keys.without_passphrases.map(function(keyinfo) {
            return keyinfo.longid;
          }),
          errors: other_errors,
        });
      }
    }
  }, 100);
}

function get_decrypt_options(message, keyinfo, is_armored, one_time_message_password) {
  var options = {
    message: message,
    format: (is_armored) ? 'utf8' : 'binary',
  };
  if(!one_time_message_password) {
    options.privateKey = keyinfo.decrypted;
  } else {
    options.password = challenge_answer_hash(one_time_message_password);
  }
  return options
}

function verify_message_signature(message, keys) {
  var signature = {
    signer: null,
    contact: keys.verification_contacts.length ? keys.verification_contacts[0] : null,
    match: true,
    error: null,
  };
  try {
    $.each(message.verify(keys.for_verification), function(i, verify_result) {
      if(verify_result.valid !== true) {
        signature.match = false;
      }
      if(!signature.signer) {
        signature.signer = key_longid(verify_result.keyid.bytes);
      }
    });
  } catch(verify_error) {
    signature.match = null;
    if(verify_error.message === 'Can only verify message with one literal data packet.') {
      signature.error = 'CryptUP is not equipped to verify this message (err 101)';
    } else {
      signature.error = 'CryptUP had trouble verifying this message (' + verify_error.message + ')';
      cryptup_error_handler_manual(verify_error);
    }
  }
  return signature;
}

function decrypt_key(prv, passphrase) { // returns true, false, or RETURNS a cought known exception
  try {
    return prv.decrypt(passphrase);
  } catch(e) {
    if(e.message === 'Unknown s2k type.' && prv.subKeys.length) {
      try { // may be a key that only contains subkeys as in https://alexcabal.com/creating-the-perfect-gpg-keypair/
        return prv.subKeys.length === prv.subKeys.reduce(function(successes, subkey) {
          return successes + Number(subkey.subKey.decrypt(passphrase));
        }, 0);
      } catch(subkey_e) {
        return subkey_e;
      }
    } else if(e.message === 'Invalid enum value.') {
      return subkey_e;
    } else {
      throw e;
    }
  }
}

function decrypt(db, account_email, encrypted_data, one_time_message_password, callback) {
  var armored_encrypted = encrypted_data.indexOf('-----BEGIN PGP MESSAGE-----') !== -1;
  var armored_signed_only = encrypted_data.indexOf('-----BEGIN PGP SIGNED MESSAGE-----') !== -1;
  var other_errors = [];
  try {
    if(armored_encrypted) {
      var message = openpgp.message.readArmored(encrypted_data);
    } else if(armored_signed_only) {
      var message = openpgp.cleartext.readArmored(encrypted_data);
    } else {
      var message = openpgp.message.read(str_to_uint8(encrypted_data));
    }
  } catch(format_error) {
    callback({
      success: false,
      counts: zeroed_decrypt_error_counts(),
      format_error: format_error.message,
      errors: other_errors,
      encrypted: null,
      signature: null,
    });
    return;
  }
  get_sorted_keys_for_message(db, account_email, message, function(keys) {
    var counts = zeroed_decrypt_error_counts(keys);
    if(armored_signed_only) {
      if(!message.text) {
        var text = encrypted_data.match(/-----BEGIN\sPGP\sSIGNED\sMESSAGE-----\nHash:\s[A-Z0-9]+\n([^]+)\n-----BEGIN\sPGP\sSIGNATURE-----[^]+-----END\sPGP\sSIGNATURE-----/m);
        if(text && text.length === 2) {
          message.text = text[1];
        } else {
          message.text = encrypted_data;
        }
      }
      callback({
        success: true,
        content: {
          data: message.text,
        },
        encrypted: false,
        signature: verify_message_signature(message, keys),
      });
    } else {
      $.each(keys.with_passphrases, function(i, keyinfo) {
        if(!counts.decrypted) {
          try {
            openpgp.decrypt(get_decrypt_options(message, keyinfo, armored_encrypted || armored_signed_only, one_time_message_password)).then(function(decrypted) {
              Try(function() {
                if(!counts.decrypted++) { // don't call back twice if encrypted for two of my keys
                  callback({
                    success: true,
                    content: decrypted,
                    encrypted: true,
                    signature: keys.signed_by.length ? verify_message_signature(message, keys) : false,
                  });
                }
              })();
            }).catch(function(decrypt_error) {
              Try(function() {
                increment_decrypt_error_counts(counts, other_errors, one_time_message_password, decrypt_error);
              })();
            });
          } catch(decrypt_exception) {
            other_errors.push(String(decrypt_exception));
            counts.attempts++;
          }
        }
      });
      wait_and_callback_decrypt_errors_if_failed(message, keys, counts, other_errors, callback);
    }
  });
}

function openpgpjs_original_isValidEncryptionKeyPacket(keyPacket, signature) {
  return keyPacket.algorithm !== openpgp.enums.read(openpgp.enums.publicKey, openpgp.enums.publicKey.dsa) && keyPacket.algorithm !== openpgp.enums.read(openpgp.enums.publicKey, openpgp.enums.publicKey.rsa_sign) && (!signature.keyFlags || (signature.keyFlags[0] & openpgp.enums.keyFlags.encrypt_communication) !== 0 || (signature.keyFlags[0] & openpgp.enums.keyFlags.encrypt_storage) !== 0);
}

function patch_public_keys_to_ignore_expiration(keys) {
  function ignore_expiration_isValidEncryptionKey(primaryKey) {
    var verifyResult = this.verify(primaryKey);
    return(verifyResult === openpgp.enums.keyStatus.valid || verifyResult === openpgp.enums.keyStatus.expired) && openpgpjs_original_isValidEncryptionKeyPacket(this.subKey, this.bindingSignature);
  }
  $.each(keys, function(i, key) {
    $.each(key.subKeys, function(i, sub_key) {
      sub_key.isValidEncryptionKey = ignore_expiration_isValidEncryptionKey;
    });
  });
}

function is_public_key_expired_for_encryption(key) {
  if(key.getEncryptionKeyPacket() !== null) {
    return false;
  }
  if(key.verifyPrimaryKey() === openpgp.enums.keyStatus.expired) {
    return true;
  }
  var found_expired_subkey = false;
  $.each(key.subKeys, function(i, sub_key) {
    if(sub_key.verify(key) === openpgp.enums.keyStatus.expired && openpgpjs_original_isValidEncryptionKeyPacket(sub_key.subKey, sub_key.bindingSignature)) {
      found_expired_subkey = true;
      return false;
    }
  });
  return found_expired_subkey;
}

function encrypt(armored_pubkeys, signing_prv, challenge, data, armor, callback) {
  var options = {
    data: data,
    armor: armor,
  };
  var used_challange = false;
  if(armored_pubkeys) {
    options.publicKeys = [];
    $.each(armored_pubkeys, function(i, armored_pubkey) {
      options.publicKeys = options.publicKeys.concat(openpgp.key.readArmored(armored_pubkey).keys);
    });
    patch_public_keys_to_ignore_expiration(options.publicKeys);
  }
  if(challenge && challenge.question && challenge.answer) {
    options.passwords = [challenge_answer_hash(challenge.answer)];
    used_challange = true;
  }
  if(!armored_pubkeys && !used_challange) {
    alert('Internal error: don\'t know how to encryt message. Please refresh the page and try again, or contact me at tom@cryptup.org if this happens repeatedly.');
    throw new Error('no-pubkeys-no-challenge');
  }
  if(signing_prv && typeof signing_prv.isPrivate !== 'undefined' && signing_prv.isPrivate()) {
    options.privateKeys = [signing_prv];
    console.log('singing oonly')
  }
  openpgp.encrypt(options).then(callback, function(error) {
    console.log(error);
    alert('Error encrypting message, please try again. If you see this repeatedly, contact me at tom@cryptup.org.');
    //todo: make the UI behave well on errors
  });
}

function key_normalize(armored) {
  try {
    if(/-----BEGIN\sPGP\sPUBLIC\sKEY\sBLOCK-----/.test(armored)) {
      var key = openpgp.key.readArmored(armored).keys[0];
    } else if(/-----BEGIN\sPGP\sMESSAGE-----/.test(armored)) {
      var key = openpgp.key.Key(openpgp.message.readArmored(armored).packets);
    } else {
      var key = undefined;
    }
    if(key) {
      return key.armor();
    }
  } catch(error) {
    cryptup_error_handler_manual(error);
  }
}

function key_fingerprint(key, formatting) {
  if(key === null || typeof key === 'undefined') {
    return null;
  } else if(typeof key.primaryKey !== 'undefined') {
    if(key.primaryKey.fingerprint === null) {
      return null;
    }
    try {
      var fp = key.primaryKey.fingerprint.toUpperCase();
      if(formatting === 'spaced') {
        return fp.replace(/(.{4})/g, "$1 ");
      }
      return fp;
    } catch(error) {
      console.log(error);
      return null;
    }
  } else {
    try {
      return key_fingerprint(openpgp.key.readArmored(key).keys[0], formatting);
    } catch(error) {
      console.log(error);
      return null;
    }
  }
}

function key_longid(key_or_fingerprint_or_bytes) {
  if(key_or_fingerprint_or_bytes === null || typeof key_or_fingerprint_or_bytes === 'undefined') {
    return null;
  } else if(key_or_fingerprint_or_bytes.length === 8) {
    return bin_to_hex(key_or_fingerprint_or_bytes).toUpperCase();
  } else if(key_or_fingerprint_or_bytes.length === 40) {
    return key_or_fingerprint_or_bytes.substr(-16);
  } else if(key_or_fingerprint_or_bytes.length === 49) {
    return key_or_fingerprint_or_bytes.replace(/ /g, '').substr(-16);
  } else {
    return key_longid(key_fingerprint(key_or_fingerprint_or_bytes));
  }
}

function extract_armored_message_from_text(text) {
  if(text && text.indexOf('-----BEGIN') !== -1 && text.indexOf('-----END') !== -1) {
    var match = text.match(/(-----BEGIN PGP (MESSAGE|SIGNED MESSAGE)-----[^]+-----END PGP (MESSAGE|SIGNATURE)-----)/gm);
    return(match !== null && match.length) ? match[0] : null;
  }
}

function test_private_key(armored, passphrase, callback) {
  try {
    openpgp.encrypt({
      data: 'this is a test encrypt/decrypt loop to discover certain browser inabilities to create proper keys with openpgp.js',
      armor: true,
      publicKeys: [openpgp.key.readArmored(armored).keys[0].toPublic()],
    }).then(function(result) {
      var prv = openpgp.key.readArmored(armored).keys[0];
      decrypt_key(prv, passphrase);
      openpgp.decrypt({
        message: openpgp.message.readArmored(result.data),
        format: 'utf8',
        privateKey: prv,
      }).then(function() {
        callback(true);
      }).catch(function(error) {
        callback(false, error.message);
      });
    }).catch(function(error) {
      callback(false, error.message);
    });
  } catch(error) {
    callback(false, error.message);
  }
}

/* -------------------- METRICS ----------------------------------------------------*/

function increment_metric(type, callback) {
  if(['compose', 'view', 'reply', 'attach', 'download', 'setup', 'error'].indexOf(type) === -1) {
    console.log('Unknown metric type"' + type + '"');
  }
  account_storage_get(null, ['metrics'], function(storage) {
    if(!storage.metrics) {
      storage.metrics = {};
    }
    if(!storage.metrics[type]) {
      storage.metrics[type] = 1;
    } else {
      storage.metrics[type] += 1;
    }
    account_storage_set(null, {
      metrics: storage.metrics,
    }, function() {
      chrome_message_send(null, 'update_uninstall_url', null, callback);
    });
  });
}

/* -------------------- CHROME PLUGIN MESSAGING ----------------------------------- */

var background_script_shortcut_handlers = undefined;

function chrome_message_destination_parse(destination_string) {
  var parsed = {
    tab: null,
    frame: null,
  };
  if(destination_string) {
    parsed.tab = Number(destination_string.split(':')[0]);
    parsed.frame = Number(destination_string.split(':')[1]);
  }
  return parsed;
}

function chrome_message_send(destination_string, name, data, callback) {
  var msg = {
    name: name,
    data: data,
    to: destination_string || null,
    respondable: (callback) ? true : false,
    uid: random_string(10),
  };
  if(background_script_shortcut_handlers && msg.to === null) {
    background_script_shortcut_handlers[name](data, null, callback); // calling from background script to background script: skip messaging completely
  } else if(window.location.href.indexOf('_generated_background_page.html') !== -1) {
    chrome.tabs.sendMessage(chrome_message_destination_parse(destination_string).tab, msg, undefined, callback);
  } else {
    chrome.runtime.sendMessage(msg, callback);
  }
}

function chrome_message_get_tab_id(callback) {
  chrome_message_send(null, '_tab_', null, callback);
}

function chrome_message_background_listen(handlers) {
  background_script_shortcut_handlers = handlers;
  chrome.runtime.onMessage.addListener(function(request, sender, respond) {
    var safe_respond = function(response) {
      try { // avoiding unnecessary errors when target tab gets closed
        respond(response);
      } catch(e) {
        if(e.message !== 'Attempting to use a disconnected port object') {
          throw e;
        }
      }
    };
    if(request.to) {
      request.sender = sender;
      chrome.tabs.sendMessage(chrome_message_destination_parse(request.to).tab, request, undefined, safe_respond);
    } else {
      handlers[request.name](request.data, sender, safe_respond);
    }
    return request.respondable === true;
  });
}

function chrome_message_listen(handlers, listen_for_tab_id) {
  var processed = [];
  chrome.runtime.onMessage.addListener(function(request, sender, respond) {
    return WrapWithTryIfContentScript(function() {
      if(request.to === listen_for_tab_id) {
        if(processed.indexOf(request.uid) === -1) {
          processed.push(request.uid);
          if(typeof handlers[request.name] !== 'undefined') {
            handlers[request.name](request.data, sender, respond);
          } else {
            if(request.name !== '_tab_') {
              Try(function() {
                throw new Error('chrome_message_listen error: handler "' + request.name + '" not set');
              })();
            } else {
              // console.log('chrome_message_listen tab_id ' + listen_for_tab_id + ' notification: threw away message "' + request.name + '" meant for background tab');
            }
          }
        } else {
          // console.log('chrome_message_listen tab_id ' + listen_for_tab_id + ' notification: threw away message "' + request.name + '" duplicate');
        }
      } else {
        // console.log('chrome_message_listen tab_id ' + listen_for_tab_id + ' notification: threw away message "' + request.name + '" meant for tab_id ' + request.to);
      }
      return request.respondable === true;
    })();
  });
}

/******************************************* STRINGS **********************************/

function base64url_encode(str) {
  if(typeof str === 'undefined') {
    return str;
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64url_decode(str) {
  if(typeof str === 'undefined') {
    return str;
  }
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

function utf8_from_str_with_equal_sign_notation(str) {
  return str.replace(/(=[A-F0-9]{2})+/g, function(equal_sign_utf_part) {
    return uint8_as_utf(equal_sign_utf_part.replace(/^=/, '').split('=').map(function(two_hex_digits) {
      return parseInt(two_hex_digits, 16);
    }));
  });
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

function sha1(string) {
  return bin_to_hex(uint8_to_str(openpgp.crypto.hash.sha1(string)));
}

function double_sha1_upper(string) {
  return sha1(sha1(string)).toUpperCase();
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
var VERY_SLOW_SPREE_MS = 500;

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
    name: (type || '') + 'spree',
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
    } else if(meta.name === 'veryslowspree') {
      clearTimeout(events_fired[meta.id]);
      events_fired[meta.id] = setTimeout(callback, VERY_SLOW_SPREE_MS);
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
