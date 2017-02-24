/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

(function ( /* ERROR HANDLING */ ) {

  var original_on_error = window.onerror;
  window.onerror = handle_error;

  function handle_error(error_message, url, line, col, error, is_manually_called, version, env) {
    if(typeof error === 'string') {
      error_message = error;
      error = { name: 'thrown_string', message: error_message, stack: error_message };
    }
    if(error_message && url && typeof line !== 'undefined' && !col && !error && !is_manually_called && !version && !env) { // safari has limited support
      error = { name: 'safari_error', message: error_message, stack: error_message };
    }
    var user_log_message = ' Please report errors above to tom@cryptup.org. I fix errors VERY promptly.';
    var ignored_errors = [
      'Invocation of form get(, function) doesn\'t match definition get(optional string or array or object keys, function callback)', // happens in gmail window when reloaded extension + now reloading gmail
      'Invocation of form set(, function) doesn\'t match definition set(object items, optional function callback)', // happens in gmail window when reloaded extension + now reloading gmail
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
    if(is_manually_called !== true && original_on_error && original_on_error !== handle_error) {
      original_on_error.apply(this, arguments); // Call any previously assigned handler
    }
    if((error.stack || '').indexOf('PRIVATE') !== -1) {
      return;
    }
    try {
      $.ajax({
        url: 'https://cryptup.herokuapp.com/help/error',
        method: 'POST',
        data: JSON.stringify({
          name: (error.name || '').substring(0, 50),
          message: (error_message || '').substring(0, 200),
          url: (url || '').substring(0, 300),
          line: line || 0,
          col: col || 0,
          trace: error.stack || '',
          version: version || cryptup_version() || 'unknown',
          environment: env || environment(),
        }),
        dataType: 'json',
        crossDomain: true,
        contentType: 'application/json; charset=UTF-8',
        async: true,
        success: function (response) {
          if(response.saved === true) {
            console.log('%cCRYPTUP ERROR:' + user_log_message, 'font-weight: bold;');
          } else {
            console.log('%cCRYPTUP EXCEPTION:' + user_log_message, 'font-weight: bold;');
          }
        },
        error: function (XMLHttpRequest, status, error) {
          console.log('%cCRYPTUP FAILED:' + user_log_message, 'font-weight: bold;');
        },
      });
    } catch(ajax_err) {
      console.log(ajax_err.message);
      console.log('%cCRYPTUP ISSUE:' + user_log_message, 'font-weight: bold;');
    }
    try {
      tool.env.increment('error');
      account_storage_get(null, ['errors'], function (storage) {
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

  function try_wrapper(code) {
    return function () {
      try {
        return code();
      } catch(code_err) {
        handle_exception(code_err);
      }
    };
  }

  function handle_exception(exception) {
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
      tool.browser.message.send(null, 'runtime', null, function (runtime) {
        handle_error(exception.message, window.location.href, line, col, exception, true, runtime.version, runtime.environment);
      });
    } catch(message_err) {
      handle_error(exception.message, window.location.href, line, col, exception, true);
    }
  }

  function log(name, details) {
    try {
      throw new Error(name);
    } catch(e) {
      if(typeof details !== 'string') {
        try {
          details = JSON.stringify(details);
        } catch(stringify_error) {
          details = '(could not stringify details "' + String(details) + '" in catcher.log because: ' + stringify_error.message + ')';
        }
      }
      e.stack = e.stack + '\n\n\ndetails: ' + details;
      handle_exception(e);
    }
  }

  function environment(url) {
    if(!url) {
      url = window.location.href;
    }
    if(url.indexOf('bnjglocicd') !== -1) {
      return 'prod';
    } else if(url.indexOf('nmelpmhpel') !== -1) {
      return 'dev';
    } else if(url.indexOf('himcfccebk') !== -1) {
      return 'test';
    } else if (url.indexOf('l.cryptup.org') !== -1) {
      return 'local'
    } else if (url.indexOf('cryptup.org') !== -1) {
      return 'web'
    } else {
      return 'content_script';
    }
  }

  function test() {
    this_will_fail();
  }

  function cryptup_version(format) {
    try {
      var v = window.chrome.runtime.getManifest().version;
      if(format === 'int') {
        return Number(v.replace(/\./g, ''));
      } else {
        return v;
      }
    } catch(err) {}
  }

  window.catcher = {
    handle_error: handle_error,
    handle_exception: handle_exception,
    log: log,
    version: cryptup_version,
    try: try_wrapper,
    environment: environment,
    test: test,
  };

})();

(function ( /* EXTENSIONS AND CONFIG */ ) {

  if(typeof window.openpgp !== 'undefined' && typeof window.openpgp.config !== 'undefined' && typeof window.openpgp.config.versionstring !== 'undefined' && typeof window.openpgp.config.commentstring !== 'undefined') {
    window.openpgp.config.versionstring = 'CryptUp ' + (catcher.version() || '') + ' Easy Gmail Encryption https://cryptup.org';
    window.openpgp.config.commentstring = 'Seamlessly send, receive and search encrypted email';
  }

  RegExp.escape = function (s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  };

  String.prototype.repeat = String.prototype.repeat || function(count) {
    if (this == null) {
      throw new TypeError('can\'t convert ' + this + ' to object');
    }
    var str = '' + this;
    count = +count;
    if (count != count) {
      count = 0;
    }
    if (count < 0) {
      throw new RangeError('repeat count must be non-negative');
    }
    if (count == Infinity) {
      throw new RangeError('repeat count must be less than infinity');
    }
    count = Math.floor(count);
    if (str.length == 0 || count == 0) {
      return '';
    }
    // Ensuring count is a 31-bit integer allows us to heavily optimize the
    // main part. But anyway, most current (August 2014) browsers can't handle
    // strings 1 << 28 chars or longer, so:
    if (str.length * count >= 1 << 28) {
      throw new RangeError('repeat count must not overflow maximum string size');
    }
    var rpt = '';
    for (;;) {
      if ((count & 1) == 1) {
        rpt += str;
      }
      count >>>= 1;
      if (count == 0) {
        break;
      }
      str += str;
    }
    // Could we try:
    // return Array(count + 1).join(this);
    return rpt;
  };

})();

(function ( /* ALL TOOLS */ ) {

  window.tool = {
    str: {
      trim_lower: str_trim_lower, //todo - deprecate in favor of parse_email
      parse_email: str_parse_email,
      pretty_print: str_pretty_print,
      inner_text: str_inner_text,
      number_format: str_number_format,
      is_email_valid: str_is_email_valid,
      month_name: str_month_name,
      random: str_random,
      html_attribute_encode: str_html_attribute_encode,
      html_attribute_decode: str_html_attribute_decode,
      html_escape: str_html_escape,
      html_unescape: str_html_unescape,
      base64url_encode: str_base64url_encode,
      base64url_decode: str_base64url_decode,
      from_uint8: str_from_uint8,
      to_uint8: str_to_uint8,
      from_equal_sign_notation_as_utf: str_from_equal_sign_notation_as_utf,
      uint8_as_utf: str_uint8_as_utf,
      to_hex: str_to_hex,
      extract_cryptup_attachments: str_extract_cryptup_attachments,
      extract_cryptup_reply_token: str_extract_cryptup_reply_token,
    },
    env: {
      browser: env_browser,
      url_params: env_url_params,
      url_create: env_url_create,
      key_codes: env_key_codes,
      set_up_require: env_set_up_require,
      increment: env_increment,
    },
    arr: {
      unique: arr_unique,
      from_dome_node_list: arr_from_dome_node_list,
      without_key: arr_without_key,
      without_value: arr_without_value,
      select: arr_select,
      contains: arr_contains,
    },
    obj: {
      map: obj_map,
      key_by_value: obj_key_by_value,
    },
    time: {
      wait: time_wait,
      get_future_timestamp_in_months: time_get_future_timestamp_in_months,
      hours: time_hours,
    },
    file: {
      download_as_uint8: file_download_as_uint8,
      save_to_downloads: file_save_to_downloads,
      attachment: file_attachment,
    },
    mime: {
      headers_to_from: mime_headers_to_from,
      resembles_message: mime_resembles_message,
      format_content_to_display: mime_format_content_to_display, // todo - should be refactored into two
      decode: mime_decode,
      encode: mime_encode,
    },
    ui: {
      spinner: ui_spinner,
      passphrase_toggle: ui_passphrase_toggle,
      enter: ui_enter,
      build_jquery_selectors: ui_build_jquery_selectors,
      event: {
        double: ui_event_double,
        parallel: ui_event_parallel,
        spree: ui_event_spree,
        prevent: ui_event_prevent,
        release: ui_event_release, // todo - I may have forgot to use this somewhere, used only parallel() - if that's how it works
      },
    },
    browser: {
      message: {
        send: browser_message_send,
        tab_id: browser_message_tab_id,
        listen: browser_message_listen,
        listen_background: browser_message_listen_background,
      },
    },
    diagnose: {
      message_pubkeys: giagnose_message_pubkeys,
      keyserver_fingerprints: diagnose_keyserver_fingerprints,
      keyserver_pubkeys: diagnose_keyserver_pubkeys,
    },
    crypto: {
      armor: {
        strip: crypto_armor_strip,
        clip: crypto_armor_clip,
        headers: crypto_armor_headers,
      },
      hash: {
        sha1: crypto_hash_sha1,
        double_sha1_upper: crypto_hash_double_sha1_upper,
        sha256: crypto_hash_sha256,
        challenge_answer: crypto_hash_challenge_answer,
      },
      key: {
        decrypt: crypto_key_decrypt,
        expired_for_encryption: crypto_key_expired_for_encryption,
        normalize: crypto_key_normalize,
        fingerprint: crypto_key_fingerprint,
        longid: crypto_key_longid,
        test: crypto_key_test,
      },
      message: {
        sign: crypto_message_sign,
        verify: crypto_message_verify_signature,
        decrypt: crypto_message_decrypt,
        encrypt: crypto_message_encrypt,
        format_text: crypto_message_format_text,
      },
    },
    api: {
      error: {
        network: 'API_ERROR_NETWORK',
      },
      google: {
        user_info: api_google_user_info,
      },
      gmail: {
        scope: api_gmail_scope,
        has_scope: api_gmail_has_scope,
        thread_get: api_gmail_thread_get,
        draft_create: api_gmail_draft_create,
        draft_delete: api_gmail_draft_delete,
        draft_update: api_gmail_draft_update,
        draft_get: api_gmail_draft_get,
        draft_send: api_gmail_draft_send, // todo - not used yet, and should be
        message_send: api_gmail_message_send,
        message_list: api_gmail_message_list,
        message_get: api_gmail_message_get,
        attachment_get: api_gmail_message_attachment_get,
        find_header: api_gmail_find_header,
        find_attachments: api_gmail_find_attachments,
        fetch_attachments: api_gmail_fetch_attachments,
        search_contacts: api_gmail_search_contacts,
        extract_armored_message: gmail_api_extract_armored_message,
        fetch_messages_based_on_query_and_extract_first_available_header: api_gmail_fetch_messages_based_on_query_and_extract_first_available_header,
      },
      attester: {
        lookup_email: api_attester_lookup_email,
        initial_legacy_submit: api_attester_initial_legacy_submit,
        initial_confirm: api_attester_initial_confirm,
        replace_request: api_attester_replace_request,
        replace_confirm: api_attester_replace_confirm,
        packet: {
          create_sign: api_attester_packet_create_sign,
          parse: api_attester_packet_parse,
        },
      },
      cryptup: {
        auth_error: api_cryptup_auth_error,
        error_text: api_cryptup_error_text,
        help_feedback: api_cryptup_help_feedback,
        account_login: api_cryptup_account_login,
        account_subscribe: api_cryptup_account_subscribe,
        message_presign_files: api_cryptup_message_presign_files,
        message_confirm_files: api_cryptup_message_confirm_files,
        message_upload: api_cryptup_message_upload,  // todo - DEPRECATE THIS. Send as JSON to message/store
        message_token: api_cryptup_message_token,
        message_reply: api_cryptup_message_reply,
        link_message: api_cryptup_link_message,
      },
      aws: {
        s3_upload: api_aws_s3_upload, // ([{base_url, fields, attachment}, ...], cb)
      }
    },
    value: function(v) {
      return {
        in: function(array_or_str) { return arr_contains(array_or_str, v); } // tool.value(v).in(array_or_string)
      };
    },
    e: function(name, attrs) {
      return $('<' + name + ' />', attrs)[0].outerHTML;
    },
  };

  /* tool.str */

  function str_trim_lower(email) {
    if(tool.value('<').in(email) && tool.value('>').in(email)) {
      email = email.substr(email.indexOf('<') + 1, email.indexOf('>') - email.indexOf('<') - 1);
    }
    return email.trim().toLowerCase();
  }

  function str_parse_email(email_string) {
    if(tool.value('<').in(email_string) && tool.value('>').in(email_string)) {
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

  function str_pretty_print(obj) {
    return JSON.stringify(obj, null, 2).replace(/ /g, '&nbsp;').replace(/\n/g, '<br>');
  }

  function str_inner_text(html_text) {
    var e = document.createElement('div');
    e.innerHTML = html_text;
    return e.innerText;
  }

  function str_number_format(nStr) { // http://stackoverflow.com/questions/3753483/javascript-thousand-separator-string-format
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

  function str_is_email_valid(email) {
    return /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i.test(email);
  }

  function str_month_name(month_index) {
    return ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month_index];
  }

  function str_random(length) {
    var id = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    for(var i = 0; i < (length || 5); i++) {
      id += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return id;
  }

  function str_html_escape(str) { // http://stackoverflow.com/questions/1219860/html-encoding-lost-when-attribute-read-from-input-field
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function str_html_unescape(str){
    return str.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  }

  function str_html_attribute_encode(values) {
    return str_base64url_encode(JSON.stringify(values));
  }

  function str_html_attribute_decode(encoded) {
    return JSON.parse(str_base64url_decode(encoded));
  }

  function str_base64url_encode(str) {
    if(typeof str === 'undefined') {
      return str;
    }
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function str_base64url_decode(str) {
    if(typeof str === 'undefined') {
      return str;
    }
    return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  }

  function str_from_uint8(u8a) {
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

  function str_from_equal_sign_notation_as_utf(str) {
    return str.replace(/(=[A-F0-9]{2})+/g, function (equal_sign_utf_part) {
      return str_uint8_as_utf(equal_sign_utf_part.replace(/^=/, '').split('=').map(function (two_hex_digits) { return parseInt(two_hex_digits, 16); }));
    });
  }

  function str_uint8_as_utf(a) { //tom
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

  function str_to_hex(s) { //http://phpjs.org/functions/bin2hex/, Kevin van Zonneveld (http://kevin.vanzonneveld.net), Onno Marsman, Linuxworld, ntoniazzi
    var i, l, o = '',
      n;
    s += '';
    for(i = 0, l = s.length; i < l; i++) {
      n = s.charCodeAt(i).toString(16);
      o += n.length < 2 ? '0' + n : n;
    }
    return o;
  }

  function str_extract_cryptup_reply_token(decrypted_content) {
    var cryptup_token_element = $(tool.e('div', {html: decrypted_content})).find('.cryptup_reply');
    if(cryptup_token_element.length && cryptup_token_element.attr('cryptup-data')) {
      return str_html_attribute_decode(cryptup_token_element.attr('cryptup-data'));
    }
  }

  function str_extract_cryptup_attachments(decrypted_content, cryptup_attachments) {
    if(tool.value('cryptup_file').in(decrypted_content)) {
      decrypted_content = decrypted_content.replace(/<a[^>]+class="cryptup_file"[^>]+>[^<]+<\/a>/g, function (found_link) {
        var element = $(found_link);
        var attachment_data = str_html_attribute_decode(element.attr('cryptup-data'));
        cryptup_attachments.push(file_attachment(attachment_data.name, attachment_data.type, null, attachment_data.size, element.attr('href')));
        return '';
      });
    }
    return decrypted_content;
  }

  /* tool.env */

  function env_browser() {  // http://stackoverflow.com/questions/4825498/how-can-i-find-out-which-browser-a-user-is-using
    if (/Firefox[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return {name: 'firefox', v: Number(RegExp.$1)};
    } else if (/MSIE (\d+\.\d+);/.test(navigator.userAgent)) {
      return {name: 'ie', v: Number(RegExp.$1)};
    } else if (/Chrome[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return {name: 'chrome', v: Number(RegExp.$1)};
    } else if (/Opera[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return {name: 'opera', v: Number(RegExp.$1)};
    } else if (/Safari[\/\s](\d+\.\d+)/.test(navigator.userAgent)) {
      return {name: 'safari', v: Number(RegExp.$1)};
    } else {
      return {name: 'unknown', v: null};
    }
  }

  var env_url_param_decode_dict = {
    '___cu_true___': true,
    '___cu_false___': false,
    '___cu_null___': null,
  };

  function env_url_params(expected_keys, string) {
    var raw_url_data = (string || window.location.search.replace('?', '')).split('&');
    var url_data = {};
    $.each(raw_url_data, function (i, pair_string) {
      var pair = pair_string.split('=');
      if(tool.value(pair[0]).in(expected_keys)) {
        url_data[pair[0]] = typeof env_url_param_decode_dict[pair[1]] !== 'undefined' ? env_url_param_decode_dict[pair[1]] : decodeURIComponent(pair[1]);
      }
    });
    return url_data;
  }

  function env_url_create(link, params) {
    $.each(params, function(key, value) {
      if(typeof value !== 'undefined') {
        var transformed = obj_key_by_value(env_url_param_decode_dict, value);
        link += (!tool.value('?').in(link) ? '?' : '&') + key + '=' + encodeURIComponent(typeof transformed !== 'undefined' ? transformed : value);
      }
    });
    return link;
  }

  function env_key_codes() {
    return { a: 97, r: 114, A: 65, R: 82, f: 102, F: 70, backspace: 8, tab: 9, enter: 13, comma: 188, };
  }

  function env_set_up_require() {
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

  var known_metric_types = {
    'compose': 'c',
    'view': 'w',
    'reply': 'r',
    'attach': 'a',
    'download': 'd',
    'setup': 's',
    'error': 'e',
    'upgrade_notify_attach_nonpgp': 'unan',
    'upgrade_notify_attach_size': 'unas',
    'upgrade_dialog_show': 'uds',
    'upgrade_dialog_register_click': 'udrc',
    'upgrade_verification_embedded_show': 'uves',
    'upgrade_done': 'ud',
  };

  function env_increment(type, callback) {
    if(!known_metric_types[type]) {
      catcher.log('Unknown metric type "' + type + '"');
    }
    account_storage_get(null, ['metrics'], function (storage) {
      var metrics_k = known_metric_types[type];
      if(!storage.metrics) {
        storage.metrics = {};
      }
      if(!storage.metrics[metrics_k]) {
        storage.metrics[metrics_k] = 1;
      } else {
        storage.metrics[metrics_k] += 1;
      }
      account_storage_set(null, { metrics: storage.metrics, }, function () {
        browser_message_send(null, 'update_uninstall_url', null, callback);
      });
    });
  }

  /* tool.arr */

  function arr_unique(array) {
    var unique = [];
    $.each(array, function (i, v) {
      if(!tool.value(v).in(unique)) {
        unique.push(v);
      }
    });
    return unique;
  }

  function arr_from_dome_node_list(obj) { // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
    var array = [];
    // iterate backwards ensuring that length is an UInt32
    for(var i = obj.length >>> 0; i--;) {
      array[i] = obj[i];
    }
    return array;
  }

  function arr_without_key(array, i) {
    return array.splice(0, i).concat(array.splice(i + 1, array.length));
  }

  function arr_without_value(array, without_value) {
    var result = [];
    $.each(array, function (i, value) {
      if(value !== without_value) {
        result.push(value);
      }
    });
    return result;
  }

  function arr_select(array, mapped_object_key) {
    return array.map(function(obj) {
      return obj[mapped_object_key];
    });
  }

  function arr_contains(arr, value) {
    return arr && typeof arr.indexOf === 'function' && arr.indexOf(value) !== -1;
  }

  /* tool.obj */

  function obj_map(original_obj, f) {
    var mapped = {};
    $.each(original_obj, function(k, v) {
      mapped[k] = f(v);
    });
    return mapped;
  }

  function obj_key_by_value(obj, v) {
    for(var k in obj) {
      if(obj.hasOwnProperty(k) && obj[k] === v) {
        return k;
      }
    }
  }

  /* tool.time */

  function time_wait(until_this_function_evaluates_true) {
    return new Promise(function (success, error) {
      var interval = setInterval(function () {
        var result = until_this_function_evaluates_true();
        if(result === true) {
          clearInterval(interval);
          if(success) {
            success();
          }
        } else if(result === false) {
          clearInterval(interval);
          if(error) {
            error();
          }
        }
      }, 50);
    });
  }

  function time_get_future_timestamp_in_months(months_to_add) {
    return new Date().getTime() + 1000 * 3600 * 24 * 30 * months_to_add;
  }

  function time_hours(h) {
    return h * 1000 * 60 * 60; // hours in miliseconds
  }

  /* tools.file */

  function file_download_as_uint8(url, progress, callback) {
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    if(typeof progress === 'function') {
      request.onprogress = function (e) {
        progress(e.loaded, e.total);
      };
    }
    request.onerror = function (e) {
      callback(false, e);
    };
    request.onload = function (e) {
      callback(true, new Uint8Array(request.response));
    };
    request.send();
  }

  function file_save_to_downloads(name, type, content) {
    var blob = new Blob([content], { type: type });
    if(window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveBlob(blob, name);
    } else {
      var a = window.document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = name;
      if(env_browser().name === 'firefox') {
        document.body.appendChild(a);
      }
      if(typeof a.click === 'function') {
        a.click();
      } else { // safari
        var e = document.createEvent('MouseEvents');
        e.initMouseEvent('click', true, true, window);
        a.dispatchEvent(e);
      }
      if(env_browser().name === 'firefox') {
        document.body.removeChild(a);
      }
      window.URL.revokeObjectURL(a.href);
    }
  }

  function file_attachment(name, type, content, size, url) { // todo - refactor as (content, name, type, LENGTH, url), making all but content voluntary
    return { // todo: accept any type of content, then add getters for content(str, uint8, blob) and fetch(), also size('formatted')
      name: name,
      type: type || 'application/octet-stream',
      content: content,
      size: size || content.length,
      url: url || null,
    };
  }

  /* tool.mime */

  function node_type(node) {
    if(node.headers['content-type'] && node.headers['content-type'][0]) {
      return node.headers['content-type'][0].value;
    }
  }

  function node_filename(node) {
    if(node.headers['content-disposition'] && node.headers['content-disposition'][0] && node.headers['content-disposition'][0].params && node.headers['content-disposition'][0].params.filename) {
      return node.headers['content-disposition'][0].params.filename;
    }
    if(node.headers['content-type'] && node.headers['content-type'][0] && node.headers['content-type'][0].params && node.headers['content-type'][0].params.name) {
      return node.headers['content-disposition'][0].params.name;
    }
  }

  function mime_headers_to_from(parsed_mime_message) {
    var header_to = [];
    var header_from;
    if(parsed_mime_message.headers.from && parsed_mime_message.headers.from.length && parsed_mime_message.headers.from[0] && parsed_mime_message.headers.from[0].address) {
      header_from = parsed_mime_message.headers.from[0].address;
    }
    if(parsed_mime_message.headers.to && parsed_mime_message.headers.to.length) {
      $.each(parsed_mime_message.headers.to, function (i, to) {
        if(to.address) {
          header_to.push(to.address);
        }
      });
    }
    return { from: header_from, to: header_to, };
  }

  function mime_resembles_message(message) {
    var m = message.toLowerCase();
    var has_content_type = m.match(/content-type: +[0-9a-z\-\/]+/) !== null;
    var has_content_transfer_encoding = m.match(/content-transfer-encoding: +[0-9a-z\-\/]+/) !== null;
    var has_content_disposition = m.match(/content-disposition: +[0-9a-z\-\/]+/) !== null;
    return has_content_type && (has_content_transfer_encoding || has_content_disposition);
  }

  function mime_format_content_to_display(text, full_mime_message) {
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

  function mime_decode(mime_message, callback) {
    tool.env.set_up_require();
    var mime_message_contents = {
      attachments: [],
      headers: {},
      text: undefined,
      html: undefined,
      signature: undefined,
    };
    require(['emailjs-mime-parser'], function (MimeParser) {
      try {
        var parser = new MimeParser();
        var parsed = {};
        parser.onheader = function (node) {
          if(!String(node.path.join("."))) { // root node headers
            $.each(node.headers, function (name, header) {
              mime_message_contents.headers[name] = header[0].value;
            });
          }
        };
        parser.onbody = function (node, chunk) {
          var path = String(node.path.join("."));
          if(typeof parsed[path] === 'undefined') {
            parsed[path] = node;
          }
        };
        parser.onend = function () {
          $.each(parsed, function (path, node) {
            if(node_type(node) === 'application/pgp-signature') {
              mime_message_contents.signature = tool.str.uint8_as_utf(node.content);
            } else if(node_type(node) === 'text/html' && !node_filename(node)) {
              mime_message_contents.html = tool.str.uint8_as_utf(node.content);
            } else if(node_type(node) === 'text/plain' && !node_filename(node)) {
              mime_message_contents.text = tool.str.uint8_as_utf(node.content);
            } else {
              var node_content = tool.str.from_uint8(node.content);
              mime_message_contents.attachments.push({
                name: node_filename(node),
                size: node_content.length,
                type: node_type(node),
                data: node_content,
              });
            }
          });
          catcher.try(function () {
            callback(true, mime_message_contents);
          })();
        };
        parser.write(mime_message); //todo - better chunk it for very big messages containing attachments? research
        parser.end();
      } catch(e) {
        catcher.handle_exception(e);
        catcher.try(function () {
          callback(false, mime_message_contents);
        })();
      }
    });
  }

  /* tool.ui */

  var events_fired = {};
  var DOUBLE_MS = 1000;
  var SPREE_MS = 50;
  var SLOW_SPREE_MS = 200;
  var VERY_SLOW_SPREE_MS = 500;

  function ui_event_double() {
    return { name: 'double', id: tool.str.random(10), };
  }

  function ui_event_parallel() {
    return { name: 'parallel', id: tool.str.random(10), };
  }

  function ui_event_spree(type) {
    return { name: (type || '') + 'spree', id: tool.str.random(10), };
  }

  function ui_event_prevent(meta, callback) { //todo: messy + needs refactoring
    return function () {
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
          } else if(meta.name === 'double') {
            if(Date.now() - events_fired[meta.id] > DOUBLE_MS) {
              events_fired[meta.id] = Date.now();
              callback(this, meta.id);
            }
          }
        } else {
          events_fired[meta.id] = Date.now();
          callback(this, meta.id);
        }
      }
    };
  }

  function ui_event_release(id) {
    if(id in events_fired) {
      var ms_to_release = DOUBLE_MS + events_fired[id] - Date.now();
      if(ms_to_release > 0) {
        setTimeout(function () {
          delete events_fired[id];
        }, ms_to_release);
      } else {
        delete events_fired[id];
      }
    }
  }

  function ui_spinner(color, placeholder_class) {
    var url = '/img/svgs/spinner-' + color + '-small.svg';
    if (window.chrome && window.chrome.runtime && window.chrome.runtime.id) {
      var url = 'chrome-extension://' + chrome.runtime.id + url;
    }
    return '<i class="' + (placeholder_class || 'small_spinner') + '"><img src="' + url + '" /></i>';
  }

  function ui_passphrase_toggle(pass_phrase_input_ids, force_initial_show_or_hide) {
    var button_hide = '<img src="/img/svgs/eyeclosed-icon.svg" class="eye-closed"><br>hide';
    var button_show = '<img src="/img/svgs/eyeopen-icon.svg" class="eye-open"><br>show';
    account_storage_get(null, ['hide_pass_phrases'], function (storage) {
      if(force_initial_show_or_hide === 'hide') {
        var show = false;
      } else if(force_initial_show_or_hide === 'show') {
        var show = true;
      } else {
        var show = !storage.hide_pass_phrases;
      }
      $.each(pass_phrase_input_ids, function (i, id) {
        if(show) {
          $('#' + id).after('<label href="#" id="toggle_' + id + '" class="toggle_show_hide_pass_phrase" for="' + id + '">' + button_hide + '</label>');
          $('#' + id).attr('type', 'text');
        } else {
          $('#' + id).after('<label href="#" id="toggle_' + id + '" class="toggle_show_hide_pass_phrase" for="' + id + '">' + button_show + '</label>');
          $('#' + id).attr('type', 'password');
        }
        $('#toggle_' + id).click(function () {
          if($('#' + id).attr('type') === 'password') {
            $('#' + id).attr('type', 'text');
            $(this).html(button_hide);
            account_storage_set(null, { hide_pass_phrases: false, });
          } else {
            $('#' + id).attr('type', 'password');
            $(this).html(button_show);
            account_storage_set(null, { hide_pass_phrases: true, });
          }
        });
      });
    });
  }

  function ui_enter(callback) {
    return function(e) {
      if (e.which == env_key_codes().enter) {
        callback();
      }
    };
  }

  function ui_build_jquery_selectors(selectors) {
    var cache = {};
    return {
      cached: function(name) {
        if(!cache[name]) {
          if(typeof selectors[name] === 'undefined') {
            catcher.log('unknown selector name: ' + name);
          }
          cache[name] = $(selectors[name]);
        }
        return cache[name];
      },
      now: function(name) {
        if(typeof selectors[name] === 'undefined') {
          catcher.log('unknown selector name: ' + name);
        }
        return $(selectors[name]);
      },
      selector: function (name) {
        if(typeof selectors[name] === 'undefined') {
          catcher.log('unknown selector name: ' + name);
        }
        return selectors[name];
      }
    };
  }

  /* tools.browser.message */

  var background_script_shortcut_handlers;

  function destination_parse(destination_string) {
    var parsed = { tab: null, frame: null, };
    if(destination_string) {
      parsed.tab = Number(destination_string.split(':')[0]);
      parsed.frame = Number(destination_string.split(':')[1]);
    }
    return parsed;
  }

  function browser_message_send(destination_string, name, data, callback) {
    var msg = { name: name, data: data, to: destination_string || null, respondable: !!(callback), uid: tool.str.random(10), };
    if(background_script_shortcut_handlers && msg.to === null) {
      background_script_shortcut_handlers[name](data, null, callback); // calling from background script to background script: skip messaging completely
    } else if(tool.value('_generated_background_page.html').in(window.location.href)) {
      chrome.tabs.sendMessage(destination_parse(destination_string).tab, msg, undefined, callback);
    } else {
      chrome.runtime.sendMessage(msg, callback);
    }
  }

  function browser_message_tab_id(callback) {
    browser_message_send(null, '_tab_', null, callback);
  }

  function browser_message_listen_background(handlers) {
    background_script_shortcut_handlers = handlers;
    chrome.runtime.onMessage.addListener(function (request, sender, respond) {
      var safe_respond = function (response) {
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
        chrome.tabs.sendMessage(destination_parse(request.to).tab, request, undefined, safe_respond);
      } else {
        handlers[request.name](request.data, sender, safe_respond);
      }
      return request.respondable === true;
    });
  }

  function browser_message_listen(handlers, listen_for_tab_id) {
    var processed = [];
    chrome.runtime.onMessage.addListener(function (request, sender, respond) {
      return catcher.try(function () {
        if(request.to === listen_for_tab_id) {
          if(!tool.value(request.uid).in(processed)) {
            processed.push(request.uid);
            if(typeof handlers[request.name] !== 'undefined') {
              handlers[request.name](request.data, sender, respond);
            } else {
              if(request.name !== '_tab_') {
                catcher.try(function () {
                  throw new Error('tool.browser.message.listen error: handler "' + request.name + '" not set');
                })();
              } else {
                // console.log('tool.browser.message.listen tab_id ' + listen_for_tab_id + ' notification: threw away message "' + request.name + '" meant for background tab');
              }
            }
          } else {
            // console.log('tool.browser.message.listen tab_id ' + listen_for_tab_id + ' notification: threw away message "' + request.name + '" duplicate');
          }
        } else {
          // console.log('tool.browser.message.listen tab_id ' + listen_for_tab_id + ' notification: threw away message "' + request.name + '" meant for tab_id ' + request.to);
        }
        return request.respondable === true;
      })();
    });
  }

  /* tool.diagnose */

  function giagnose_message_pubkeys(account_email, message) {
    var message_key_ids = message.getEncryptionKeyIds();
    var local_key_ids = crypto_key_ids(private_storage_get('local', account_email, 'master_public_key'));
    var diagnosis = { found_match: false, receivers: message_key_ids.length, };
    $.each(message_key_ids, function (i, msg_k_id) {
      $.each(local_key_ids, function (j, local_k_id) {
        if(msg_k_id === local_k_id) {
          diagnosis.found_match = true;
          return false;
        }
      });
    });
    return diagnosis;
  }

  function diagnose_keyserver_pubkeys(account_email, callback) {
    var diagnosis = { has_pubkey_missing: false, has_pubkey_mismatch: false, results: {}, };
    account_storage_get(account_email, ['addresses'], function (storage) {
      api_attester_lookup_email(tool.arr.unique([account_email].concat(storage.addresses || [])), function (success, pubkey_search_results) {
        if(success) {
          $.each(pubkey_search_results.results, function (i, pubkey_search_result) {
            if(!pubkey_search_result.pubkey) {
              diagnosis.has_pubkey_missing = true;
              diagnosis.results[pubkey_search_result.email] = { attested: false, pubkey: null, match: false, };
            } else {
              var match = true;
              var local_fingerprint = crypto_key_fingerprint(private_storage_get('local', account_email, 'master_public_key'));
              if(crypto_key_fingerprint(pubkey_search_result.pubkey) !== local_fingerprint) {
                diagnosis.has_pubkey_mismatch = true;
                match = false;
              }
              diagnosis.results[pubkey_search_result.email] = { pubkey: pubkey_search_result.pubkey, attested: pubkey_search_result.attested, match: match, };
            }
          });
          callback(diagnosis);
        } else {
          callback();
        }
      });
    });
  }

  function diagnose_keyserver_fingerprints() {
    get_account_emails(function (account_emails) {
      if(account_emails && account_emails.length) {
        account_storage_get(account_emails, ['setup_done'], function (multi_storage) {
          var emails_setup_done = [];
          $.each(multi_storage, function (account_email, storage) {
            if(storage.setup_done) {
              emails_setup_done.push(account_email);
            }
          });
          api_attester_legacy_keys_check(emails_setup_done, function (success, response) {
            if(success && response.fingerprints && response.fingerprints.length === emails_setup_done.length) {
              var save_result = {};
              $.each(emails_setup_done, function (i, account_email) {
                save_result[account_email] = response.fingerprints[i];
              });
              account_storage_set(null, { keyserver_fingerprints: save_result });
            }
          });
        });
      }
    });
  }

  /* tool.crypto.armor */

  function crypto_armor_strip(pgp_block_text) {
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
    $.each(newlines, function (i, newline) {
      pgp_block_text = pgp_block_text.replace(newline, '\n');
    });
    if(debug) {
      console.log('pgp_block_2');
      console.log(pgp_block_text);
    }
    $.each(removes, function (i, remove) {
      pgp_block_text = pgp_block_text.replace(remove, '');
    });
    if(debug) {
      console.log('pgp_block_3');
      console.log(pgp_block_text);
    }
    $.each(spaces, function (i, space) {
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

  var crypto_armor_headers_dict = {
      null: { begin: '-----BEGIN', end: '-----END' },
      public_key: { begin: '-----BEGIN PGP PUBLIC KEY BLOCK-----', end: '-----END PGP PUBLIC KEY BLOCK-----' },
      private_key: { begin: '-----BEGIN PGP PRIVATE KEY BLOCK-----', end: '-----END PGP PRIVATE KEY BLOCK-----' },
      attest_packet: { begin: '-----BEGIN ATTEST PACKET-----', end: '-----END ATTEST PACKET-----' },
      cryptup_verification: { begin: '-----BEGIN CRYPTUP VERIFICATION-----', end: '-----END CRYPTUP VERIFICATION-----' },
      signed_message: { begin: '-----BEGIN PGP SIGNED MESSAGE-----', middle: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----' },
      signature: { begin: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----' },
      message: { begin: '-----BEGIN PGP MESSAGE-----', end: '-----END PGP MESSAGE-----' },
  };

  function crypto_armor_headers(block_type, format) {
    if(format === 're') {
      return obj_map(crypto_armor_headers_dict[block_type || null], function (header_value) {
        return header_value.replace(/ /g, '\\\s'); // regexp match friendly
      });
    } else {
      return crypto_armor_headers_dict[block_type || null];
    }
  }

  function crypto_armor_clip(text) {
    if(text && tool.value(crypto_armor_headers_dict[null].begin).in(text) && tool.value(crypto_armor_headers_dict[null].end).in(text)) {
      var match = text.match(/(-----BEGIN PGP (MESSAGE|SIGNED MESSAGE)-----[^]+-----END PGP (MESSAGE|SIGNATURE)-----)/gm);
      return(match !== null && match.length) ? match[0] : null;
    }
  }

  /* tool.crypto.hash */

  function crypto_hash_sha1(string) {
    return tool.str.to_hex(tool.str.from_uint8(openpgp.crypto.hash.sha1(string)));
  }

  function crypto_hash_double_sha1_upper(string) {
    return crypto_hash_sha1(crypto_hash_sha1(string)).toUpperCase();
  }

  function crypto_hash_sha256(string) {
    return tool.str.to_hex(tool.str.from_uint8(openpgp.crypto.hash.sha256(string)));
  }

  function crypto_hash_sha256_loop(string, times) {
    for(var i = 0; i < (times || 100000); i++) {
      string = crypto_hash_sha256(string);
    }
    return string;
  }

  function crypto_hash_challenge_answer(answer) {
    return crypto_hash_sha256_loop(answer);
  }

  /* tool.crypto.key */

  function crypto_key_ids(armored_pubkey) {
    return openpgp.key.readArmored(armored_pubkey).keys[0].getKeyIds();
  }

  function crypto_key_decrypt(prv, passphrase) { // returns true, false, or RETURNS a caught known exception
    try {
      return prv.decrypt(passphrase);
    } catch(primary_e) {
      if(!tool.value(primary_e.message).in(['Unknown s2k type.', 'Invalid enum value.'])) {
        return new Error('primary decrypt error: "' + primary_e.message + '"'); // unknown exception for master key
      } else if(prv.subKeys.length) {
        var subkes_succeeded = 0;
        var subkeys_unusable = 0;
        var unknown_exception;
        $.each(prv.subKeys, function(i, subkey) {
          try {
            subkes_succeeded += subkey.subKey.decrypt(passphrase);
          } catch(subkey_e) {
            subkeys_unusable++;
            if(!tool.value(subkey_e.message).in(['Key packet is required for this signature.', 'Unknown s2k type.', 'Invalid enum value.'])) {
              unknown_exception = subkey_e;
              return false;
            }
          }
        });
        if(unknown_exception) {
          return new Error('subkey decrypt error: "' + unknown_exception.message + '"');
        }
        return subkes_succeeded > 0 && (subkes_succeeded + subkeys_unusable) === prv.subKeys.length;
      } else {
        return new Error('primary decrypt error and no subkeys to try: "' + primary_e.message + '"');
      }
    }
  }

  function crypto_key_expired_for_encryption(key) {
    if(key.getEncryptionKeyPacket() !== null) {
      return false;
    }
    if(key.verifyPrimaryKey() === openpgp.enums.keyStatus.expired) {
      return true;
    }
    var found_expired_subkey = false;
    $.each(key.subKeys, function (i, sub_key) {
      if(sub_key.verify(key) === openpgp.enums.keyStatus.expired && openpgpjs_original_isValidEncryptionKeyPacket(sub_key.subKey, sub_key.bindingSignature)) {
        found_expired_subkey = true;
        return false;
      }
    });
    return found_expired_subkey;
  }

  function crypto_key_normalize(armored) {
    try {
      if(RegExp(crypto_armor_headers('public_key', 're').begin).test(armored)) {
        var key = openpgp.key.readArmored(armored).keys[0];
      } else if(RegExp(crypto_armor_headers('message', 're').begin).test(armored)) {
        var key = openpgp.key.Key(openpgp.message.readArmored(armored).packets);
      } else {
        var key = undefined;
      }
      if(key) {
        return key.armor();
      }
    } catch(error) {
      catcher.handle_exception(error);
    }
  }

  function crypto_key_fingerprint(key, formatting) {
    if(key === null || typeof key === 'undefined') {
      return null;
    } else if(typeof key.primaryKey !== 'undefined') {
      if(key.primaryKey.fingerprint === null) {
        return null;
      }
      try {
        var fp = key.primaryKey.fingerprint.toUpperCase();
        if(formatting === 'spaced') {
          return fp.replace(/(.{4})/g, "$1 ").trim();
        }
        return fp;
      } catch(error) {
        console.log(error);
        return null;
      }
    } else {
      try {
        return crypto_key_fingerprint(openpgp.key.readArmored(key).keys[0], formatting);
      } catch(error) {
        if(error.message === 'openpgp is not defined') {
          catcher.handle_exception(error);
        }
        console.log(error);
        return null;
      }
    }
  }

  function crypto_key_longid(key_or_fingerprint_or_bytes) {
    if(key_or_fingerprint_or_bytes === null || typeof key_or_fingerprint_or_bytes === 'undefined') {
      return null;
    } else if(key_or_fingerprint_or_bytes.length === 8) {
      return tool.str.to_hex(key_or_fingerprint_or_bytes).toUpperCase();
    } else if(key_or_fingerprint_or_bytes.length === 40) {
      return key_or_fingerprint_or_bytes.substr(-16);
    } else if(key_or_fingerprint_or_bytes.length === 49) {
      return key_or_fingerprint_or_bytes.replace(/ /g, '').substr(-16);
    } else {
      return crypto_key_longid(crypto_key_fingerprint(key_or_fingerprint_or_bytes));
    }
  }

  function crypto_key_test(armored, passphrase, callback) {
    try {
      openpgp.encrypt({
        data: 'this is a test encrypt/decrypt loop to discover certain browser inabilities to create proper keys with openpgp.js',
        armor: true,
        publicKeys: [openpgp.key.readArmored(armored).keys[0].toPublic()],
      }).then(function (result) {
        var prv = openpgp.key.readArmored(armored).keys[0];
        crypto_key_decrypt(prv, passphrase);
        openpgp.decrypt({
          message: openpgp.message.readArmored(result.data),
          format: 'utf8',
          privateKey: prv,
        }).then(function () {
          callback(true);
        }).catch(function (error) {
          callback(false, error.message);
        });
      }).catch(function (error) {
        callback(false, error.message);
      });
    } catch(error) {
      callback(false, error.message);
    }
  }

  /* tool.crypo.message */

  function crypto_message_sign(signing_prv, data, armor, callback) {
    var options = { data: data, armor: armor, privateKeys: signing_prv, };
    openpgp.sign(options).then(function(result) {callback(true, result.data)}, function (error) {callback(false, error.message)});
  }

  function get_sorted_keys_for_message(db, account_email, message, callback) {
    var keys = {};
    keys.verification_contacts = [];
    keys.for_verification = [];
    if(message.getEncryptionKeyIds) {
      keys.encrypted_for = (message.getEncryptionKeyIds() || []).map(function (id) {
        return crypto_key_longid(id.bytes);
      });
    } else {
      keys.encrypted_for = [];
    }
    keys.signed_by = (message.getSigningKeyIds() || []).map(function (id) {
      return crypto_key_longid(id.bytes);
    });
    keys.potentially_matching = private_keys_get(account_email, keys.encrypted_for);
    if(keys.potentially_matching.length === 0) { // not found any matching keys, or list of encrypted_for was not supplied in the message. Just try all keys.
      keys.potentially_matching = private_keys_get(account_email);
    }
    keys.with_passphrases = [];
    keys.without_passphrases = [];
    $.each(keys.potentially_matching, function (i, keyinfo) {
      var passphrase = get_passphrase(account_email, keyinfo.longid);
      if(passphrase !== null) {
        var key = openpgp.key.readArmored(keyinfo.armored).keys[0];
        var decrypted = crypto_key_decrypt(key, passphrase);
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
      db_contact_get(db, keys.signed_by, function (verification_contacts) {
        keys.verification_contacts = verification_contacts.filter(function (contact) {
          return contact !== null;
        });
        keys.for_verification = [].concat.apply([], keys.verification_contacts.map(function (contact) {
          return openpgp.key.readArmored(contact.pubkey).keys;
        }));
        callback(keys);
      });
    } else {
      callback(keys);
    }
  }

  function zeroed_decrypt_error_counts(keys) {
    return { decrypted: 0, potentially_matching_keys: keys ? keys.potentially_matching.length : 0, attempts: 0, key_mismatch: 0, wrong_password: 0, format_error: 0, };
  }

  function increment_decrypt_error_counts(counts, other_errors, one_time_message_password, decrypt_error) {
    if(String(decrypt_error) === "Error: Error decrypting message: Cannot read property 'isDecrypted' of null" && !one_time_message_password) {
      counts.key_mismatch++; // wrong private key
    } else if(String(decrypt_error) === 'Error: Error decrypting message: Invalid session key for decryption.' && !one_time_message_password) {
      counts.key_mismatch++; // attempted opening password only message with key
    } else if(one_time_message_password && tool.value(String(decrypt_error)).in(['Error: Error decrypting message: Invalid enum value.', 'Error: Error decrypting message: CFB decrypt: invalid key'])) {
      counts.wrong_password++; // wrong password
    } else {
      other_errors.push(String(decrypt_error));
    }
    counts.attempts++;
  }

  function wait_and_callback_decrypt_errors_if_failed(message, private_keys, counts, other_errors, callback) {
    var wait_for_all_attempts_interval = setInterval(function () { //todo - promises are better
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
            missing_passphrases: private_keys.without_passphrases.map(function (keyinfo) { return keyinfo.longid; }),
            errors: other_errors,
          });
        }
      }
    }, 100);
  }

  function get_decrypt_options(message, keyinfo, is_armored, one_time_message_password) {
    var options = { message: message, format: (is_armored) ? 'utf8' : 'binary', };
    if(!one_time_message_password) {
      options.privateKey = keyinfo.decrypted;
    } else {
      options.password = crypto_hash_challenge_answer(one_time_message_password);
    }
    return options;
  }

  function crypto_message_verify_signature(message, keys) {
    var signature = {
      signer: null,
      contact: keys.verification_contacts.length ? keys.verification_contacts[0] : null,
      match: true,
      error: null,
    };
    try {
      $.each(message.verify(keys.for_verification), function (i, verify_result) {
        if(verify_result.valid !== true) {
          signature.match = false;
        }
        if(!signature.signer) {
          signature.signer = crypto_key_longid(verify_result.keyid.bytes);
        }
      });
    } catch(verify_error) {
      signature.match = null;
      if(verify_error.message === 'Can only verify message with one literal data packet.') {
        signature.error = 'CryptUp is not equipped to verify this message (err 101)';
      } else {
        signature.error = 'CryptUp had trouble verifying this message (' + verify_error.message + ')';
        catcher.handle_exception(verify_error);
      }
    }
    return signature;
  }

  function crypto_message_decrypt(db, account_email, encrypted_data, one_time_message_password, callback) {
    var armored_encrypted = tool.value(crypto_armor_headers('message').begin).in(encrypted_data);
    var armored_signed_only = tool.value(crypto_armor_headers('signed_message').begin).in(encrypted_data);
    var other_errors = [];
    try {
      if(armored_encrypted) {
        var message = openpgp.message.readArmored(encrypted_data);
      } else if(armored_signed_only) {
        var message = openpgp.cleartext.readArmored(encrypted_data);
      } else {
        var message = openpgp.message.read(tool.str.to_uint8(encrypted_data));
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
    get_sorted_keys_for_message(db, account_email, message, function (keys) {
      var counts = zeroed_decrypt_error_counts(keys);
      if(armored_signed_only) {
        if(!message.text) {
          var sm_headers = crypto_armor_headers('signed_message', 're');
          var text = encrypted_data.match(RegExp(sm_headers.begin + '\nHash:\s[A-Z0-9]+\n([^]+)\n' + sm_headers.middle + '[^]+' + sm_headers.end, 'm'));
          if(text && text.length === 2) {
            message.text = text[1];
          } else {
            message.text = encrypted_data;
          }
        }
        callback({
          success: true,
          content: { data: message.text, },
          encrypted: false,
          signature: crypto_message_verify_signature(message, keys),
        });
      } else {
        $.each(keys.with_passphrases, function (i, keyinfo) {
          if(!counts.decrypted) {
            try {
              openpgp.decrypt(get_decrypt_options(message, keyinfo, armored_encrypted || armored_signed_only, one_time_message_password)).then(function (decrypted) {
                catcher.try(function () {
                  if(decrypted.data !== null) {
                    if(!counts.decrypted++) { // don't call back twice if encrypted for two of my keys
                      callback({
                        success: true,
                        content: decrypted,
                        encrypted: true,
                        signature: keys.signed_by.length ? crypto_message_verify_signature(message, keys) : false,
                      });
                    }
                  } else {
                    other_errors.push(decrypted.err instanceof Array ? decrypted.err.join(', ') : 'Decrypted data is null. Please write me at tom@cryptup.org to fix this.');
                    counts.attempts++;
                  }
                })();
              }).catch(function (decrypt_error) {
                catcher.try(function () {
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
    $.each(keys, function (i, key) {
      $.each(key.subKeys || [], function (i, sub_key) {
        sub_key.isValidEncryptionKey = ignore_expiration_isValidEncryptionKey;
      });
    });
  }

  function crypto_message_encrypt(armored_pubkeys, signing_prv, challenge, data, armor, callback) {
    var options = { data: data, armor: armor, };
    var used_challange = false;
    if(armored_pubkeys) {
      options.publicKeys = [];
      $.each(armored_pubkeys, function (i, armored_pubkey) {
        options.publicKeys = options.publicKeys.concat(openpgp.key.readArmored(armored_pubkey).keys);
      });
      patch_public_keys_to_ignore_expiration(options.publicKeys);
    }
    if(challenge && challenge.answer) {
      options.passwords = [crypto_hash_challenge_answer(challenge.answer)];
      used_challange = true;
    }
    if(!armored_pubkeys && !used_challange) {
      alert('Internal error: don\'t know how to encryt message. Please refresh the page and try again, or contact me at tom@cryptup.org if this happens repeatedly.');
      throw new Error('no-pubkeys-no-challenge');
    }
    if(signing_prv && typeof signing_prv.isPrivate !== 'undefined' && signing_prv.isPrivate()) {
      options.privateKeys = [signing_prv];
      console.log('singing oonly');
    }
    openpgp.encrypt(options).then(function (result) {
      catcher.try(function () { // todo - this is very awkward, should create a Try wrapper with a better api
        callback(result);
      })();
    }, function (error) {
      console.log(error);
      alert('Error encrypting message, please try again. If you see this repeatedly, contact me at tom@cryptup.org.');
      //todo: make the UI behave well on errors
    });
  }

  function crypto_message_format_text(text_or_html) {
    return tool.str.inner_text(text_or_html.replace(/<br ?\/?>[\r?\n]/gm, '<br>')).trim().replace(/\n/g, '<br>').replace(/^(<br>)+|(<br>)+$/, '').replace(/ {2,}/g, function (spaces) {
      return '&nbsp;'.repeat(spaces.length);
    });
  }

  /* tool.api */

  function api_call(base_url, path, values, callback, format) {
    if(format === 'JSON') {
      var formatted_values = JSON.stringify(values);
      var content_type = 'application/json; charset=UTF-8';
    } else if(format === 'FORM') {
      var formatted_values = new FormData();
      $.each(values, function (name, value) {
        if(typeof value === 'object' && value.name && value.content && value.type) {
          formatted_values.append(name, new Blob([value.content], { type: value.type }), value.name); // todo - type should be just app/pgp? for privacy
        } else {
          formatted_values.append(name, value);
        }
      });
      var content_type = false;
    } else {
      throw Error('unknown format:' + String(format));
    }
    return $.ajax({
      url: base_url + path,
      method: 'POST',
      data: formatted_values,
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

  /* tool.api.google */

  function api_google_call(account_email, method, url, parameters, callback, fail_on_auth) {
    account_storage_get(account_email, ['google_token_access', 'google_token_expires'], function (auth) {
      if(method === 'GET' || method === 'DELETE') {
        var data = parameters;
      } else {
        var data = JSON.stringify(parameters);
      }
      if(typeof auth.google_token_access !== 'undefined' && auth.google_token_expires > new Date().getTime()) { // have a valid gmail_api oauth token
        $.ajax({
          url: url,
          method: method,
          data: data,
          headers: { 'Authorization': 'Bearer ' + auth.google_token_access },
          crossDomain: true,
          contentType: 'application/json; charset=UTF-8',
          async: true,
          success: function (response) {
            callback(true, response);
          },
          error: function (response) {
            try {
              var error_obj = JSON.parse(response.responseText);
              if(typeof error_obj.error !== 'undefined' && error_obj.error.message === "Invalid Credentials") {
                google_api_handle_auth_error(account_email, method, url, parameters, callback, fail_on_auth, response, api_gmail_call);
              } else {
                response._error = error_obj.error;
                callback(false, response);
              }
            } catch(err) {
              response._error = {};
              var re_title = /<title>([^<]+)<\/title>/mgi;
              var title_match = re_title.exec(response.responseText);
              if(title_match) {
                response._error.message = title_match[1];
              }
              callback(false, response);
            }
          },
        });
      } else { // no valid gmail_api oauth token
        google_api_handle_auth_error(account_email, method, url, parameters, callback, fail_on_auth, null, api_google_call);
      }
    });
  }

  function api_google_user_info(account_email, callback) {
    api_google_call(account_email, 'GET', 'https://www.googleapis.com/oauth2/v1/userinfo', {
      alt: 'json'
    }, callback);
  }

  /* tool.api.gmail */

  var USELESS_CONTACTS_FILTER = '-to:txt.voice.google.com -to:reply.craigslist.org -to:sale.craigslist.org -to:hous.craigslist.org';
  var api_gmail_scope_dict = {
      read: 'https://www.googleapis.com/auth/gmail.readonly',
      compose: 'https://www.googleapis.com/auth/gmail.compose',
  };

  function api_gmail_scope(scope) {
    return (typeof scope === 'string') ? api_gmail_scope_dict[scope] : scope.map(api_gmail_scope);
  }

  function api_gmail_has_scope(scopes, scope) {
    return scopes && tool.value(api_gmail_scope_dict[scope]).in(scopes)
  }

  function api_gmail_call(account_email, method, resource, parameters, callback, fail_on_auth) {
    if(!account_email) {
      throw new Error('missing account_email in api_gmail_call');
    }
    account_storage_get(account_email, ['google_token_access', 'google_token_expires'], function (auth) {
      if(method === 'GET' || method === 'DELETE') {
        var data = parameters;
      } else {
        var data = JSON.stringify(parameters);
      }
      if(typeof auth.google_token_access !== 'undefined' && auth.google_token_expires > new Date().getTime()) { // have a valid gmail_api oauth token
        $.ajax({
          url: 'https://www.googleapis.com/gmail/v1/users/me/' + resource,
          method: method,
          data: data,
          headers: { 'Authorization': 'Bearer ' + auth.google_token_access },
          crossDomain: true,
          contentType: 'application/json; charset=UTF-8',
          async: true,
          success: function (response) {
            if(callback) {
              callback(true, response);
            }
          },
          error: function (response) {
            try {
              var error_obj = JSON.parse(response.responseText);
              if(typeof error_obj.error !== 'undefined' && error_obj.error.message === "Invalid Credentials") {
                google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, response, api_gmail_call);
              } else {
                response._error = error_obj.error;
                if(callback) {
                  callback(false, response);
                }
              }
            } catch(err) {
              response._error = {};
              var re_title = /<title>([^<]+)<\/title>/mgi;
              var title_match = re_title.exec(response.responseText);
              if(title_match) {
                response._error.message = title_match[1];
              }
              if(callback) {
                callback(false, response);
              }
            }
          },
        });
      } else { // no valid gmail_api oauth token
        google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, null, api_gmail_call);
      }
    });
  }

  function google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, error_response, base_api_function) {
    if(fail_on_auth !== true) {
      tool.browser.message.send(null, 'google_auth', { account_email: account_email, }, function (response) {
        if(response && response.success === false && response.error === tool.api.error.network) {
          callback(false, tool.api.error.network);
        } else { //todo: error handling for other bad situations
          base_api_function(account_email, method, resource, parameters, callback, true);
        }
      });
    } else {
      callback(false, error_response);
    }
  }

  /*
    body: either string (plaintext) or a dict {'text/plain': ..., 'text/html': ...}
    headers: at least {To, From, Subject}
    attachments: [{name: 'some.txt', type: 'text/plain', content: uint8}]
  */
  function mime_encode(account_email, body, headers, attachments, mime_message_callback) {
    tool.env.set_up_require();
    require(['emailjs-mime-builder'], function (MimeBuilder) {
      var root_node = new MimeBuilder('multipart/mixed');
      $.each(headers, function (key, header) {
        root_node.addHeader(key, header);
      });
      root_node.addHeader('OpenPGP', 'id=' + tool.crypto.key.fingerprint(private_storage_get('local', account_email, 'master_public_key')));
      var text_node = new MimeBuilder('multipart/alternative');
      if(typeof body === 'string') {
        text_node.appendChild(new MimeBuilder('text/plain').setContent(body));
      } else {
        $.each(body, function (type, content) {
          text_node.appendChild(new MimeBuilder(type).setContent(content));
        });
      }
      root_node.appendChild(text_node);
      $.each(attachments || [], function (i, attachment) {
        root_node.appendChild(new MimeBuilder(attachment.type + '; name="' + attachment.name + '"', { filename: attachment.name }).setHeader({
          'Content-Disposition': 'attachment',
          'X-Attachment-Id': 'f_' + tool.str.random(10),
          'Content-Transfer-Encoding': 'base64',
        }).setContent(attachment.content));
      });
      mime_message_callback(root_node.build());
    });
  }

  function api_gmail_thread_get(account_email, thread_id, format, get_thread_callback) {
    api_gmail_call(account_email, 'GET', 'threads/' + thread_id, {
      format: format
    }, get_thread_callback);
  }

  function api_gmail_draft_create(account_email, mime_message, thread_id, callback) {
    api_gmail_call(account_email, 'POST', 'drafts', {
      message: {
        raw: tool.str.base64url_encode(mime_message),
        threadId: thread_id || null,
      },
    }, callback);
  }

  function api_gmail_draft_delete(account_email, id, callback) {
    api_gmail_call(account_email, 'DELETE', 'drafts/' + id, null, callback);
  }

  function api_gmail_draft_update(account_email, id, mime_message, callback) {
    api_gmail_call(account_email, 'PUT', 'drafts/' + id, {
      message: {
        raw: tool.str.base64url_encode(mime_message),
      },
    }, callback);
  }

  function api_gmail_draft_get(account_email, id, format, callback) {
    api_gmail_call(account_email, 'GET', 'drafts/' + id, {
      format: format || 'full'
    }, callback);
  }

  function api_gmail_draft_send(account_email, id, callback) {
    api_gmail_call(account_email, 'POST', 'drafts/send', {
      id: id,
    }, callback);
  }

  function api_gmail_message_send(account_email, mime_message, thread_id, callback) {
    api_gmail_call(account_email, 'POST', 'messages/send', {
      raw: tool.str.base64url_encode(mime_message),
      threadId: thread_id || null,
    }, callback);
  }

  function api_gmail_message_list(account_email, q, include_deleted, callback) {
    api_gmail_call(account_email, 'GET', 'messages', {
      q: q,
      includeSpamTrash: include_deleted || false,
    }, callback);
  }

  function api_gmail_message_get(account_email, message_id, format, callback, results) { //format: raw, full or metadata
    if(typeof message_id === 'object') { // todo: chained requests are messy and slow. parallel processing with promises would be better
      if(!results) {
        results = {};
      }
      if(message_id.length) {
        var id = message_id.pop();
        api_gmail_call(account_email, 'GET', 'messages/' + id, { format: format || 'full', }, function (success, response) {
          if(success) {
            results[id] = response;
            api_gmail_message_get(account_email, message_id, format, callback, results);
          } else {
            callback(success, response, results);
          }
        });
      } else {
        callback(true, results);
      }
    } else {
      api_gmail_call(account_email, 'GET', 'messages/' + message_id, { format: format || 'full', }, callback);
    }
  }

  function api_gmail_message_attachment_get(account_email, message_id, attachment_id, callback) {
    api_gmail_call(account_email, 'GET', 'messages/' + message_id + '/attachments/' + attachment_id, {}, callback);
  }

  function api_gmail_find_attachments(gmail_email_object, internal_results, internal_message_id) {
    if(!internal_results) {
      internal_results = [];
    }
    if(typeof gmail_email_object.payload !== 'undefined') {
      internal_message_id = gmail_email_object.id;
      api_gmail_find_attachments(gmail_email_object.payload, internal_results, internal_message_id);
    }
    if(typeof gmail_email_object.parts !== 'undefined') {
      $.each(gmail_email_object.parts, function (i, part) {
        api_gmail_find_attachments(part, internal_results, internal_message_id);
      });
    }
    if(typeof gmail_email_object.body !== 'undefined' && typeof gmail_email_object.body.attachmentId !== 'undefined') {
      internal_results.push({
        message_id: internal_message_id,
        id: gmail_email_object.body.attachmentId,
        size: gmail_email_object.body.size,
        name: gmail_email_object.filename,
        type: gmail_email_object.mimeType,
      });
    }
    return internal_results;
  }

  function api_gmail_find_bodies(gmail_email_object, internal_results) {
    if(!internal_results) {
      internal_results = {};
    }
    if(typeof gmail_email_object.payload !== 'undefined') {
      api_gmail_find_bodies(gmail_email_object.payload, internal_results);
    }
    if(typeof gmail_email_object.parts !== 'undefined') {
      $.each(gmail_email_object.parts, function (i, part) {
        api_gmail_find_bodies(part, internal_results);
      });
    }
    if(typeof gmail_email_object.body !== 'undefined' && typeof gmail_email_object.body.data !== 'undefined' && typeof gmail_email_object.body.size !== 0) {
      internal_results[gmail_email_object.mimeType] = gmail_email_object.body.data;
    }
    return internal_results;
  }

  function api_gmail_fetch_attachments(account_email, attachments, callback, results) { //todo: parallelize with promises
    if(!results) {
      results = [];
    }
    var attachment = attachments[results.length];
    api_gmail_message_attachment_get(account_email, attachment.message_id, attachment.id, function (success, response) {
      if(success) {
        attachment.data = response.data;
        results.push(attachment);
        if(results.length === attachments.length) {
          callback(true, results);
        } else {
          api_gmail_fetch_attachments(account_email, attachments, callback, results);
        }
      } else {
        callback(success, response);
      }
    });
  }

  function api_gmail_find_header(api_gmail_message_object, header_name) {
    if(typeof api_gmail_message_object.payload.headers !== 'undefined') {
      for(var i = 0; i < api_gmail_message_object.payload.headers.length; i++) {
        if(api_gmail_message_object.payload.headers[i].name.toLowerCase() === header_name.toLowerCase()) {
          return api_gmail_message_object.payload.headers[i].value;
        }
      }
    }
    return null;
  }

  function api_gmail_search_contacts(account_email, user_query, known_contacts, callback) {
    var gmail_query = ['is:sent', USELESS_CONTACTS_FILTER];
    if(user_query) {
      gmail_query.push();
      var variations_of_to = user_query.split(/[ \.]/g);
      if(!tool.value(user_query).in(variations_of_to)) {
        variations_of_to.push(user_query);
      }
      gmail_query.push('(to:' + variations_of_to.join(' OR to:') + ')');
    }
    $.each(known_contacts, function (i, contact) {
      gmail_query.push('-to:"' + contact.email + '"');
    });
    api_gmail_loop_through_emails_to_compile_contacts(account_email, gmail_query.join(' '), callback);
  }

  function api_gmail_loop_through_emails_to_compile_contacts(account_email, query, callback, results) {
    results = results || [];
    api_gmail_fetch_messages_based_on_query_and_extract_first_available_header(account_email, query, ['to', 'date'], function (headers) {
      if(headers && headers.to) {
        var result = headers.to.split(/, ?/).map(tool.str.parse_email).map(function (r) {
          r.date = headers.date;
          return r;
        });
        var add_filter = result.map(function (email) {
          return ' -to:"' + email.email + '"';
        }).join('');
        results = results.concat(result);
        callback({ new: result, all: results, });
        api_gmail_loop_through_emails_to_compile_contacts(account_email, query + add_filter, callback, results);
      } else {
        callback({ new: [], all: results, });
      }
    });
  }

  function api_gmail_fetch_messages_based_on_query_and_extract_first_available_header(account_email, q, header_names, callback) {
    api_gmail_message_list(account_email, q, false, function (success, message_list_response) {
      if(success && typeof message_list_response.messages !== 'undefined') {
        api_gmail_fetch_messages_sequentially_from_list_and_extract_first_available_header(account_email, message_list_response.messages, header_names, callback);
      } else {
        callback(); // if the request is !success, it will just return undefined, which may not be the best
      }
    });
  }

  function api_gmail_fetch_messages_sequentially_from_list_and_extract_first_available_header(account_email, messages, header_names, callback, i) {
    // this won a prize for the most precisely named function in the hostory of javascriptkind
    i = i || 0;
    api_gmail_message_get(account_email, messages[i].id, 'metadata', function (success, message_get_response) {
      var header_values = {};
      var missing_header = false;
      if(success) { // non-mission critical - just skip failed requests
        $.each(header_names, function (i, header_name) {
          header_values[header_name] = api_gmail_find_header(message_get_response, header_name);
          if(!header_values[header_name]) {
            missing_header = true;
          }
        });
      }
      if(!missing_header) {
        callback(header_values);
      } else if(i + 1 < messages.length) {
        api_gmail_fetch_messages_sequentially_from_list_and_extract_first_available_header(account_email, messages, header_names, callback, i + 1);
      } else {
        callback();
      }
    });
  }

  /*
   * Extracts the encrypted message from gmail api. Sometimes it's sent as a text, sometimes html, sometimes attachments in various forms.
   * success_callback(str armored_pgp_message)
   * error_callback(str error_type, str html_formatted_data_to_display_to_user)
   *    ---> html_formatted_data_to_display_to_user might be unknown type of mime message, or pgp message with broken format, etc.
   *    ---> The motivation is that user might have other tool to process this. Also helps debugging issues in the field.
   */
  function gmail_api_extract_armored_message(account_email, message_id, format, success_callback, error_callback) {
    api_gmail_message_get(account_email, message_id, format, function (get_message_success, gmail_message_object) {
      if(get_message_success) {
        if(format === 'full') {
          var bodies = api_gmail_find_bodies(gmail_message_object);
          var attachments = api_gmail_find_attachments(gmail_message_object);
          var armored_message_from_bodies = tool.crypto.armor.clip(tool.str.base64url_decode(bodies['text/plain'])) || tool.crypto.armor.clip(tool.crypto.armor.strip(tool.str.base64url_decode(bodies['text/html'])));
          if(armored_message_from_bodies) {
            success_callback(armored_message_from_bodies);
          } else if(attachments.length) {
            var found = false;
            $.each(attachments, function (i, attachment_meta) {
              if(attachment_meta.name.match(/\.asc$/)) {
                found = true;
                api_gmail_fetch_attachments(account_email, [attachment_meta], function (fetch_attachments_success, attachment) {
                  if(fetch_attachments_success) {
                    var armored_message_text = tool.str.base64url_decode(attachment[0].data);
                    var armored_message = tool.crypto.armor.clip(armored_message_text);
                    if(armored_message) {
                      success_callback(armored_message);
                    } else {
                      error_callback('format', armored_message_text);
                    }
                  } else {
                    error_callback('connection');
                  }
                });
                return false;
              }
            });
            if(!found) {
              error_callback('format', tool.str.pretty_print(gmail_message_object.payload));
            }
          } else {
            error_callback('format', tool.str.pretty_print(gmail_message_object.payload));
          }
        } else { // format === raw
          tool.mime.decode(tool.str.base64url_decode(gmail_message_object.raw), function (success, mime_message) {
            if(success) {
              var armored_message = tool.crypto.armor.clip(mime_message.text); // todo - the message might be in attachments
              if(armored_message) {
                success_callback(armored_message);
              } else {
                error_callback('format');
              }
            } else {
              error_callback('format');
            }
          });
        }
      } else {
        error_callback('connection');
      }
    });
  }

  /* tool.api.attester */

  function api_attester_call(path, values, callback, format) {
    api_call('https://attester.herokuapp.com/', path, values, callback, format || 'JSON');
    // api_call('http://127.0.0.1:5002/', path, values, callback, format || 'JSON');
  }

  function api_attester_lookup_email(email, callback) {
    return api_attester_call('lookup/email', {
      email: (typeof email === 'string') ? tool.str.trim_lower(email) : email.map(tool.str.trim_lower),
    }, callback);
  }

  function api_attester_initial_legacy_submit(email, pubkey, attest, callback) {
    return api_attester_call('initial/legacy_submit', {
      email: tool.str.trim_lower(email),
      pubkey: pubkey.trim(),
      attest: attest || false,
    }, callback);
  }

  function api_attester_legacy_keys_check(emails, callback) {
    api_call('https://cryptup-keyserver.herokuapp.com/', 'keys/check', { // should deprecate it soon
      emails: emails.map(tool.str.trim_lower),
    }, callback, 'JSON');
  }

  function api_attester_initial_confirm(signed_attest_packet, callback) {
    return api_attester_call('initial/confirm', {
      signed_message: signed_attest_packet,
    }, callback);
  }

  function api_attester_replace_request(email, signed_attest_packet, new_pubkey, callback) {
    return api_attester_call('replace/request', {
      signed_message: signed_attest_packet,
      new_pubkey: new_pubkey,
      email: email,
    }, callback);
  }

  function api_attester_replace_confirm(signed_attest_packet, callback) {
    return api_attester_call('replace/confirm', {
      signed_message: signed_attest_packet,
    }, callback);
  }

  function api_attester_packet_armor(content_text) {
    return crypto_armor_headers('attest_packet').begin + '\n' + content_text + '\n' + crypto_armor_headers('attest_packet').end;
  }

  function api_attester_packet_create_sign(values, decrypted_prv, callback) {
    var lines = [];
    $.each(values, function (key, value) {
      lines.push(key + ':' + value);
    });
    var content_text = lines.join('\n');
    var packet = api_attester_packet_parse(api_attester_packet_armor(content_text));
    if(packet.success !== true) {
      callback(false, packet.error);
    } else {
      crypto_message_sign(decrypted_prv, content_text, true, function (success, signed_attest_packet) {
        callback(success, signed_attest_packet);
      });
    }
  }

  function api_attester_packet_parse(text) {
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
    var packet_headers = crypto_armor_headers('attest_packet', 're');
    var matches = text.match(RegExp(packet_headers.begin + '([^]+)' + packet_headers.end, 'm'));
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
        if(result.content.str_random && result.content.str_random.length !== 40) {
          result.error = 'Wrong RAN line value format';
          result.content = {};
          return result;
        }
        if(result.content.fingerprint_old && result.content.fingerprint_old.length !== 40) {
          result.error = 'Wrong OLD line value format';
          result.content = {};
          return result;
        }
        if(result.content.action && !tool.value(result.content.action).in(['INITIAL', 'REQUEST_REPLACEMENT', 'CONFIRM_REPLACEMENT'])) {
          result.error = 'Wrong ACT line value format';
          result.content = {};
          return result;
        }
        if(result.content.attester && !tool.value(result.content.attester).in(['CRYPTUP'])) {
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

  /* tool.api.cryptup */

  function api_cryptup_call(path, values, callback, format) {
    api_call('https://cryptup.herokuapp.com/', path, values, callback, format || 'JSON');
    // api_call('http://127.0.0.1:5001/', path, values, callback, format || 'JSON');
  }

  function api_cryptup_auth_error() {
    throw Error('tool.api.cryptup.auth_error not callable');
  }

  function api_cryptup_error_text(server_call_response) {
    if(server_call_response instanceof Array) {
      var results;
      $.each(server_call_response, function(i, v) {
        results += (i + 1) + ': ' + api_cryptup_error_text(v) + '\n';
      });
      return results.trim();
    } else {
      if(server_call_response && server_call_response.error) {
        if(typeof server_call_response.error === 'object' && (server_call_response.error.internal_msg || server_call_response.error.public_msg)) {
          return String(server_call_response.error.public_msg) + ' (' + server_call_response.error.internal_msg + ')';
        } else {
          return String(server_call_response.error);
        }
      } else if(server_call_response) {
        return 'unknown';
      } else {
        return 'Internet connection problem, please try again';
      }
    }
  }

  function api_cryptup_response_formatter(callback) {
    return function (success, response) {
      if(response && response.error && typeof response.error === 'object' && response.error.internal_msg === 'auth') {
        callback(api_cryptup_auth_error);
      } else {
        callback(success, response);
      }
    };
  }

  function api_cryptup_help_feedback(account_email, message, callback) {
    return api_cryptup_call('help/feedback', {
      email: account_email,
      message: message,
    }, api_cryptup_response_formatter(callback));
  }

  function api_cryptup_account_login(account_email, token, callback) {
    storage_cryptup_auth_info(function (registered_email, registered_uuid, already_verified) {
      var uuid = registered_uuid || tool.crypto.hash.sha1(tool.str.random(40));
      var email = registered_email || account_email;
      api_cryptup_call('account/login', { account: email, uuid: uuid, token: token || null, }, function (success, result) {
        if(success) {
          if(result.registered === true) {
            account_storage_set(null, { cryptup_account_email: email, cryptup_account_uuid: uuid, cryptup_account_verified: result.verified === true, cryptup_account_subscription: result.subscription, }, function () {
              callback(true, result.verified === true, result.subscription);
            });
          } else {
            if(typeof result.error === 'object') {
              catcher.log('account/login fail response: ' + JSON.stringify(result.error));
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

  function api_cryptup_account_subscribe(product, callback) {
    storage_cryptup_auth_info(function (email, uuid, verified) {
      if(verified) {
        api_cryptup_call('account/subscribe', {
          account: email,
          uuid: uuid,
          product: product,
        }, api_cryptup_response_formatter(function (success_or_auth_error, result) {
          if(success_or_auth_error === true) {
            account_storage_set(null, { cryptup_account_subscription: result.subscription }, function () {
              callback(true, result);
            });
          } else if(success_or_auth_error === false) {
            callback(false, result);
          } else {
            callback(success_or_auth_error);
          }
        }));
      } else {
        callback(api_cryptup_auth_error);
      }
    });
  }

  function api_cryptup_message_presign_files(attachments, callback) {
    storage_cryptup_auth_info(function (email, uuid, verified) {
      if(verified) {
        api_cryptup_call('message/presign_files', {
          account: email,
          uuid: uuid,
          lengths: attachments.map(function(a) { return a.size; }),
        }, api_cryptup_response_formatter(callback));
      } else {
        callback(api_cryptup_auth_error);
      }
    });
  }

  function api_cryptup_message_confirm_files(identifiers, callback) {
    storage_cryptup_auth_info(function (email, uuid, verified) {
      if(verified) {
        api_cryptup_call('message/confirm_files', {
          account: email,
          uuid: uuid,
          identifiers: identifiers,
        }, api_cryptup_response_formatter(callback));
      } else {
        callback(api_cryptup_auth_error);
      }
    });
  }

  function api_cryptup_message_upload(encrypted_data_armored, callback) { // todo - DEPRECATE THIS. Send as JSON to message/store
    if(encrypted_data_armored.length > 100000) {
      callback(false, {error: 'Message text should not be more than 100 KB. You can send very long texts as attachments.'});
    } else {
      api_cryptup_call('message/upload', {
        content: file_attachment('cryptup_encrypted_message.asc', 'text/plain', encrypted_data_armored),
      }, api_cryptup_response_formatter(callback), 'FORM');
    }
  }

  function api_cryptup_message_token(callback) {
    storage_cryptup_auth_info(function (email, uuid, verified) {
      if(verified) {
        api_cryptup_call('message/token', {
          account: email,
          uuid: uuid,
        }, api_cryptup_response_formatter(callback));
      } else {
        callback(api_cryptup_auth_error);
      }
    });
  }

  function api_cryptup_message_reply(short, token, from, to, subject, message, callback) {
    api_cryptup_call('message/reply', {
      short: short,
      token: token,
      from: from,
      to: to,
      subject: subject,
      message: message,
    }, api_cryptup_response_formatter(callback));
  }

  function api_cryptup_link_message(short, callback) {
    return api_cryptup_call('link/message', {
      short: short,
    }, api_cryptup_response_formatter(callback));
  }

  /* tool.api.aws */

  function api_aws_s3_upload(items, callback) {
    if (!items.length) {
      callback(false);
      return;
    }
    var results = new Array(items.length);
    $.each(items, function (i, item) {
      var values = item.fields;
      values.file = file_attachment('encrpted_attachment', 'application/octet-stream', item.attachment.content);
      api_call(item.base_url, '', values, function(success) {
        results[i] = success;
        if(results.reduce(function(sum, r) { return sum + (typeof r !== 'undefined') }, 0) === results.length) { // no undefined left
          callback(results.reduce(function(s, v) { return s + v; }, 0) === results.length, results); // callback(all_good, results);
        }
      }, 'FORM');
    });
  }

})();
