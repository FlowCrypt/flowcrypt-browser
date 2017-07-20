/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

(function ( /* ALL TOOLS */ ) {

  var tool = window.tool = {
    str: {
      parse_email: str_parse_email,
      pretty_print: str_pretty_print,
      html_as_text: str_html_as_text,
      normalize_spaces: str_normalize_spaces,
      number_format: str_number_format,
      is_email_valid: str_is_email_valid,
      month_name: str_month_name,
      random: str_random,
      html_attribute_encode: str_html_attribute_encode,
      html_attribute_decode: str_html_attribute_decode,
      html_escape: str_html_escape,
      html_unescape: str_html_unescape,
      as_safe_html: str_untrusted_text_as_sanitized_html,
      base64url_encode: str_base64url_encode,
      base64url_decode: str_base64url_decode,
      from_uint8: str_from_uint8,
      to_uint8: str_to_uint8,
      from_equal_sign_notation_as_utf: str_from_equal_sign_notation_as_utf,
      uint8_as_utf: str_uint8_as_utf,
      to_hex: str_to_hex,
      from_hex: str_from_hex,
      extract_cryptup_attachments: str_extract_cryptup_attachments,
      extract_cryptup_reply_token: str_extract_cryptup_reply_token,
      strip_cryptup_reply_token: str_strip_cryptup_reply_token,
      strip_public_keys: str_strip_public_keys,
      int_to_hex: str_int_to_hex,
      message_difference: str_message_difference,
      capitalize: str_capitalize,
    },
    env: {
      browser: env_browser,
      runtime_id: env_extension_runtime_id,
      is_background_script: env_is_background_script,
      is_extension: env_is_extension,
      url_params: env_url_params,
      url_create: env_url_create,
      key_codes: env_key_codes,
      set_up_require: env_set_up_require,
      increment: env_increment,
      webmails: env_webmails,
    },
    arr: {
      unique: arr_unique,
      from_dome_node_list: arr_from_dome_node_list,
      without_key: arr_without_key,
      without_value: arr_without_value,
      select: arr_select,
      contains: arr_contains,
      sum: arr_sum,
      average: arr_average,
      zeroes: arr_zeroes,
      is: arr_is,
    },
    obj: {
      map: obj_map,
      key_by_value: obj_key_by_value,
    },
    int: {
      random: int_random,
    },
    time: {
      wait: time_wait,
      get_future_timestamp_in_months: time_get_future_timestamp_in_months,
      hours: time_hours,
      expiration_format: time_expiration_format,
      to_utc_timestamp: time_to_utc_timestamp,
    },
    file: {
      download_as_uint8: file_download_as_uint8,
      save_to_downloads: file_save_to_downloads,
      attachment: file_attachment,
      pgp_name_patterns: file_pgp_name_patterns,
      keyinfo_as_pubkey_attachment: file_keyinfo_as_pubkey_attachment,
      treat_as: file_treat_as,
    },
    mime: {
      process: mime_process,
      headers_to_from: mime_headers_to_from,
      reply_headers: mime_reply_headers,
      resembles_message: mime_resembles_message,
      format_content_to_display: mime_format_content_to_display, // todo - should be refactored into two
      decode: mime_decode,
      encode: mime_encode,
      signed: mime_parse_message_with_detached_signature,
    },
    ui: {
      spinner: ui_spinner,
      passphrase_toggle: ui_passphrase_toggle,
      enter: ui_enter,
      build_jquery_selectors: ui_build_jquery_selectors,
      scroll: ui_scroll,
      event: {
        stop: ui_event_stop,
        protect: ui_event_stop_propagation_to_parent_frame,
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
      message_pubkeys: diagnose_message_pubkeys,
      keyserver_pubkeys: diagnose_keyserver_pubkeys,
    },
    crypto: {
      armor: {
        strip: crypto_armor_strip,
        clip: crypto_armor_clip,
        headers: crypto_armor_headers,
        replace_blocks: crypto_armor_replace_blocks,
        normalize: crypto_armor_normalize,
      },
      hash: {
        sha1: crypto_hash_sha1,
        double_sha1_upper: crypto_hash_double_sha1_upper,
        sha256: crypto_hash_sha256,
        challenge_answer: crypto_hash_challenge_answer,
      },
      key: {
        read: crypto_key_read,
        decrypt: crypto_key_decrypt,
        expired_for_encryption: crypto_key_expired_for_encryption,
        normalize: crypto_key_normalize,
        fingerprint: crypto_key_fingerprint,
        longid: crypto_key_longid,
        test: crypto_key_test,
        usable: crypto_key_usable,
      },
      message: {
        sign: crypto_message_sign,
        verify: crypto_message_verify,
        verify_detached: crypto_message_verify_detached,
        decrypt: crypto_message_decrypt,
        encrypt: crypto_message_encrypt,
      },
    },
    api: {
      auth: {
        window: api_auth_window,
        parse_id_token: api_auth_parse_id_token,
      },
      error: {
        network: 'API_ERROR_NETWORK',
      },
      google: {
        user_info: api_google_user_info,
        auth: api_google_auth,
        auth_popup: google_auth_window_show_and_respond_to_auth_request,
      },
      common: {
        message: api_common_email_message_object,
        reply_correspondents: api_common_reply_correspondents,
      },
      gmail: {
        query: {
          or: api_gmail_query_or,
          backups: api_gmail_query_backups,
        },
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
        find_bodies: api_gmail_find_bodies,
        fetch_attachments: api_gmail_fetch_attachments,
        search_contacts: api_gmail_search_contacts,
        extract_armored_block: gmail_api_extract_armored_block,
        fetch_messages_based_on_query_and_extract_first_available_header: api_gmail_fetch_messages_based_on_query_and_extract_first_available_header,
        fetch_key_backups: api_gmail_fetch_key_backups,
      },
      attester: {
        lookup_email: api_attester_lookup_email,
        initial_legacy_submit: api_attester_initial_legacy_submit,
        initial_confirm: api_attester_initial_confirm,
        replace_request: api_attester_replace_request,
        replace_confirm: api_attester_replace_confirm,
        test_welcome: api_attester_test_welcome,
        packet: {
          create_sign: api_attester_packet_create_sign,
          parse: api_attester_packet_parse,
        },
      },
      cryptup: {
        auth_error: api_cryptup_auth_error,
        url: api_cryptup_url,
        help_feedback: api_cryptup_help_feedback,
        help_uninstall: api_cryptup_help_uninstall,
        account_login: api_cryptup_account_login,
        account_check: api_cryptup_account_check,
        account_check_sync: api_cryptup_account_check_sync,
        account_update: api_cryptup_account_update,
        account_subscribe: api_cryptup_account_subscribe,
        message_presign_files: api_cryptup_message_presign_files,
        message_confirm_files: api_cryptup_message_confirm_files,
        message_upload: api_cryptup_message_upload,  // todo - DEPRECATE THIS. Send as JSON to message/store
        message_token: api_cryptup_message_token,
        message_expiration: api_cryptup_message_expiration,
        message_reply: api_cryptup_message_reply,
        message_contact: api_cryptup_message_contact,
        link_message: api_cryptup_link_message,
        link_me: api_cryptup_link_me,
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
    each: function(iterable, looper) {
      for (var k in iterable) {
        if(iterable.hasOwnProperty(k)){
          if(looper(k, iterable[k]) === false) {
            break;
          }
        }
      }
    },
    enums: {
      recovery_email_subjects: ['Your CryptUp Backup', 'Your FlowCrypt Backup', 'Your CryptUP Backup', 'All you need to know about CryptUP (contains a backup)', 'CryptUP Account Backup'],
    },
  };

  var openpgp = window.openpgp;
  var storage = window.flowcrypt_storage;
  if(typeof exports === 'object') {
    exports.tool = tool;
    openpgp = require('openpgp');
    storage = require('js/storage').legacy;
  }

  /* tool.str */

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
    if(typeof obj === 'object') {
      return JSON.stringify(obj, null, 2).replace(/ /g, '&nbsp;').replace(/\n/g, '<br>');
    } else {
      return String(obj);
    }
  }

  function str_html_as_text(html_text, callback) {
    // extracts innerText from a html text in a safe way without executing any contained js
    // firefox does not preserve line breaks of iframe.contentDocument.body.innerText due to a bug - have to guess the newlines with regexes
    // this is still safe because Firefox does strip all other tags
    if(env_browser().name === 'firefox') {
      var br = 'CU_BR_' + str_random(5);
      var block_start = 'CU_BS_' + str_random(5);
      var block_end = 'CU_BE_' + str_random(5);
      html_text = html_text.replace(/<br[^>]*>/gi, br);
      html_text = html_text.replace(/<\/(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, block_end);
      html_text = html_text.replace(/<(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, block_start);
    }
    var e = document.createElement('iframe');
    e.sandbox = 'allow-same-origin';
    e.srcdoc = html_text;
    e.style['display'] = 'none';
    e.onload = function() {
      var text = e.contentDocument.body.innerText;
      if(env_browser().name === 'firefox') {
        text = text.replace(RegExp('(' + block_start + ')+', 'g'), block_start).replace(RegExp('(' + block_end + ')+', 'g'), block_end);
        text = text.split(block_end + block_start).join(br).split(br + block_end).join(br);
        text = text.split(br).join('\n').split(block_start).filter(function(v){return !!v}).join('\n').split(block_end).filter(function(v){return !!v}).join('\n');
        text = text.replace(/\n{2,}/g, '\n\n');
      }
      callback(text.trim());
      document.body.removeChild(e);
    };
    document.body.appendChild(e);
  }

  function str_normalize_spaces(str) {
    return str.replace(RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32)).replace(/\n /g, '\n');
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

  function str_untrusted_text_as_sanitized_html(text_or_html, callback) {
    var nl = '_cryptup_newline_placeholder_' + str_random(3) + '_';
    str_html_as_text(text_or_html.replace(/<br ?\/?> ?\r?\n/gm, nl).replace(/\r?\n/gm, nl).replace(/</g, '&lt;').replace(RegExp(nl, 'g'), '<br>'), function(plain) {
      callback(plain.trim().replace(/</g, '&lt;').replace(/\n/g, '<br>').replace(/ {2,}/g, function (spaces) {
        return '&nbsp;'.repeat(spaces.length);
      }));
    });
  }

  function str_html_escape(str) { // http://stackoverflow.com/questions/1219860/html-encoding-lost-when-attribute-read-from-input-field
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;');
  }

  function str_html_unescape(str){
    return str.replace(/&#x2F;/g, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
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
        if(bytes_left_in_char) { // utf-8 continuation byte missing, assuming the last character was an 8-bit ASCII character
          utf8_string += String.fromCharCode(a[i-1]);
        }
        bytes_left_in_char = 0;
        binary_char = '';
        utf8_string += String.fromCharCode(a[i]);
      } else {
        if(!bytes_left_in_char) { // beginning of new multi-byte character
          if(a[i] >= 128 && a[i] < 192) { //10xx xxxx
            utf8_string += String.fromCharCode(a[i]); // extended 8-bit ASCII compatibility, european ASCII characters
          } else if(a[i] >= 192 && a[i] < 224) { //110x xxxx
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
            console.log('str_uint8_as_utf: invalid utf-8 character beginning byte: ' + a[i]);
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

  function str_to_hex(s) { // http://phpjs.org/functions/bin2hex/, Kevin van Zonneveld (http://kevin.vanzonneveld.net), Onno Marsman, Linuxworld, ntoniazzi
    var i, l, o = '', n;
    s += '';
    for(i = 0, l = s.length; i < l; i++) {
      n = s.charCodeAt(i).toString(16);
      o += n.length < 2 ? '0' + n : n;
    }
    return o;
  }

  function str_from_hex(hex) {
    var str = '';
    for (var i = 0; i < hex.length; i += 2) {
      var v = parseInt(hex.substr(i, 2), 16);
      if (v) str += String.fromCharCode(v);
    }
    return str;
  }

  function str_int_to_hex(int_as_string) { // http://stackoverflow.com/questions/18626844/convert-a-large-integer-to-a-hex-string-in-javascript (Collin Anderson)
    var dec = int_as_string.toString().split(''), sum = [], hex = [], i, s;
    while(dec.length){
      s = 1 * dec.shift();
      for(i = 0; s || i < sum.length; i++){
        s += (sum[i] || 0) * 10;
        sum[i] = s % 16;
        s = (s - sum[i]) / 16
      }
    }
    while(sum.length){
      hex.push(sum.pop().toString(16))
    }
    return hex.join('')
  }

  function str_strip_cryptup_reply_token(decrypted_content) {
    return decrypted_content.replace(/<div[^>]+class="cryptup_reply"[^>]+><\/div>/, '');
  }

  function str_strip_public_keys(decrypted_content, found_public_keys) {
    tool.each(crypto_armor_detect_blocks(decrypted_content), function(i, block) {
      if(block.type === 'public_key') {
        found_public_keys.push(block.content);
        decrypted_content = decrypted_content.replace(block.content, '');
      }
    });
    return decrypted_content;
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

  function message_to_comparable_format(encrypted_message) {
    return encrypted_message.substr(0, 5000).replace(/[^a-zA-Z0-9]+/g, ' ').trim().substr(0, 4000).trim().split(' ').reduce(function(arr, word) {
      if(word.length > 20) {
        arr.push(word);
      }
      return arr;
    }, []);
  }

  function str_message_difference(msg_1, msg_2) {
    var msg = [message_to_comparable_format(msg_1), message_to_comparable_format(msg_2)];
    var difference = [0, 0];
    tool.each(msg[0], function(i, word) {
      difference[0] += !tool.value(word).in(msg[1]);
    });
    if(!difference[0]) {
      return 0;
    }
    tool.each(msg[1], function(i, word) {
      difference[1] += !tool.value(word).in(msg[0]);
    });
    return Math.min(difference[0], difference[1]);
  }

  function str_capitalize(string) {
    return string.trim().split(' ').map(function(s) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }).join(' ');
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

  function env_extension_runtime_id(original) {
    if(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      if(original === true) {
        return chrome.runtime.id;
      } else {
        return chrome.runtime.id.replace(/[^a-z0-9]/gi, '');
      }
    }
    return null;
  }

  function env_is_background_script() {
    return window.location && tool.value('_generated_background_page.html').in(window.location.href);
  }

  function env_is_extension() {
    return env_extension_runtime_id() !== null;
  }

  var env_url_param_decode_dict = {
    '___cu_true___': true,
    '___cu_false___': false,
    '___cu_null___': null,
  };

  function env_url_params(expected_keys, string) {
    var raw_url_data = (string || window.location.search.replace('?', '')).split('&');
    var url_data = {};
    tool.each(raw_url_data, function (i, pair_string) {
      var pair = pair_string.split('=');
      if(tool.value(pair[0]).in(expected_keys)) {
        url_data[pair[0]] = typeof env_url_param_decode_dict[pair[1]] !== 'undefined' ? env_url_param_decode_dict[pair[1]] : decodeURIComponent(pair[1]);
      }
    });
    return url_data;
  }

  function env_url_create(link, params) {
    tool.each(params, function(key, value) {
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
    if(typeof storage.get === 'function' && typeof chrome === 'object') {
      if(!known_metric_types[type]) {
        catcher.report('Unknown metric type "' + type + '"');
      }
      storage.get(null, ['metrics'], function (s) {
        var metrics_k = known_metric_types[type];
        if(!s.metrics) {
          s.metrics = {};
        }
        if(!s.metrics[metrics_k]) {
          s.metrics[metrics_k] = 1;
        } else {
          s.metrics[metrics_k] += 1;
        }
        storage.set(null, { metrics: s.metrics }, function () {
          browser_message_send(null, 'update_uninstall_url', null, callback);
        });
      });
    } else if (typeof callback === 'function') {
      callback();
    }
  }

  function env_webmails(cb) {
    cb(['gmail', 'inbox']);
  }

  /* tool.arr */

  function arr_unique(array) {
    var unique = [];
    tool.each(array, function (i, v) {
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
    tool.each(array, function (i, value) {
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

  function arr_zeroes(length) {
    return new Array(length).map(function() { return 0 });
  }

  function arr_is(object_to_identify) { // http://stackoverflow.com/questions/4775722/check-if-object-is-array
    return Object.prototype.toString.call(object_to_identify) === '[object Array]';
  }

  function arr_sum(arr) {
    return arr.reduce(function(a, b) { return a + b; }, 0);
  }

  function arr_average(arr) {
    return arr_sum(arr) / arr.length;
  }

  /* tool.obj */

  function obj_map(original_obj, f) {
    var mapped = {};
    tool.each(original_obj, function(k, v) {
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

  /* tool.int */

  function int_random(min_value, max_value) {
    return min_value + Math.round(Math.random() * (max_value - min_value))
  }

  /* tool.time */

  function time_wait(until_this_function_evaluates_true) {
    return catcher.Promise(function (success, error) {
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

  function time_expiration_format(date) {
    return str_html_escape(date.substr(0, 10));
  }

  function time_to_utc_timestamp(datetime_string, as_string) {
    if(!as_string) {
      return Date.parse(datetime_string);
    } else {
      return String(Date.parse(datetime_string));
    }
  }

  /* tools.file */

  function file_download_as_uint8(url, progress, callback) {
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    if(typeof progress === 'function') {
      request.onprogress = function (evt) {
        progress(evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : null, evt.loaded, evt.total);
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
      name: name || '',
      type: type || 'application/octet-stream',
      content: content,
      size: size || content.length,
      url: url || null,
    };
  }

  function file_pgp_name_patterns() {
    return ['*.pgp', '*.gpg', '*.asc', 'noname', 'message', 'PGPMIME version identification'];
  }

  function file_keyinfo_as_pubkey_attachment(keyinfo) {
    return file_attachment('0x' + keyinfo.longid + '.asc', 'application/pgp-keys', keyinfo.public);
  }

  /* tool.mime */

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
      return node.headers['content-type'][0].params.name;
    }
  }

  function mime_content_node(MimeBuilder, type, content) {
    var node = new MimeBuilder(type).setContent(content);
    if(type === 'text/plain') {
      node.addHeader('Content-Transfer-Encoding', 'quoted-printable'); // gmail likes this
    }
    return node;
  }

  /*
   body: either string (plaintext) or a dict {'text/plain': ..., 'text/html': ...}
   headers: at least {To, From, Subject}
   attachments: [{name: 'some.txt', type: 'text/plain', content: uint8}]
   */
  function mime_encode(body, headers, attachments, mime_message_callback) {
    mime_require('builder', function (MimeBuilder) {
      var root_node = new MimeBuilder('multipart/mixed');
      tool.each(headers, function (key, header) {
        root_node.addHeader(key, header);
      });
      if(typeof body === 'string') {
        body = {'text/plain': body};
      }
      if(Object.keys(body).length === 1) {
        var content_node = mime_content_node(MimeBuilder, Object.keys(body)[0], body[Object.keys(body)[0]]);
      } else {
        var content_node = new MimeBuilder('multipart/alternative');
        tool.each(body, function (type, content) {
          content_node.appendChild(mime_content_node(MimeBuilder, type, content));
        });
      }
      root_node.appendChild(content_node);
      tool.each(attachments || [], function (i, attachment) {
        root_node.appendChild(new MimeBuilder(attachment.type + '; name="' + attachment.name + '"', { filename: attachment.name }).setHeader({
          'Content-Disposition': 'attachment',
          'X-Attachment-Id': 'f_' + tool.str.random(10),
          'Content-Transfer-Encoding': 'base64',
        }).setContent(attachment.content));
      });
      mime_message_callback(root_node.build());
    });
  }

  function mime_headers_to_from(parsed_mime_message) {
    var header_to = [];
    var header_from;
    if(parsed_mime_message.headers.from && parsed_mime_message.headers.from.length && parsed_mime_message.headers.from[0] && parsed_mime_message.headers.from[0].address) {
      header_from = parsed_mime_message.headers.from[0].address;
    }
    if(parsed_mime_message.headers.to && parsed_mime_message.headers.to.length) {
      tool.each(parsed_mime_message.headers.to, function (i, to) {
        if(to.address) {
          header_to.push(to.address);
        }
      });
    }
    return { from: header_from, to: header_to };
  }

  function mime_reply_headers(parsed_mime_message) {
    var message_id = parsed_mime_message.headers['message-id'] || '';
    var references = parsed_mime_message.headers['in-reply-to'] || '';
    return { 'in-reply-to': message_id, 'references': references + ' ' + message_id };
  }

  function mime_resembles_message(message) {
    var m = message.toLowerCase();
    if(m.match(/content-type: +[0-9a-z\-\/]+/) === null) {
      return false;
    }
    return Boolean(m.match(/content-transfer-encoding: +[0-9a-z\-\/]+/) || m.match(/content-disposition: +[0-9a-z\-\/]+/) || m.match(/; boundary=/) || m.match(/; charset=/));
  }

  function mime_format_content_to_display(text, full_mime_message) {
    // todo - this function is very confusing, and should be split into two:
    // ---> format_mime_plaintext_to_display(text, charset)
    // ---> get_charset(full_mime_message)
    if(/<((br)|(div)|p) ?\/?>/.test(text)) {
      return text;
    }
    text = (text || '').replace(/\r?\n/g, '<br>\n');
    if(text && full_mime_message && full_mime_message.match(/^Charset: iso-8859-2/m) !== null) {
      return window.iso88592.decode(text);
    }
    return text;
  }

  function mime_require(group, callback) {
    if(group === 'parser') {
      if(typeof MimeParser !== 'undefined') { // browser
        callback(MimeParser);
      } else if (typeof exports === 'object') { // electron
        callback(require('emailjs-mime-parser'));
      } else { // RequireJS
        tool.env.set_up_require();
        require(['emailjs-mime-parser'], callback);
      }
    } else {
      if(typeof MimeBuilder !== 'undefined') { // browser
        callback(MimeBuilder);
      } else if (typeof exports === 'object') { // electron
        callback(require('emailjs-mime-builder'));
      } else { // RequireJS
        tool.env.set_up_require();
        require(['emailjs-mime-builder'], callback);
      }
    }
  }

  function mime_process(mime_message, callback) {
    mime_decode(mime_message, function (success, decoded) {
      var blocks = crypto_armor_detect_blocks(decoded.text);
      tool.each(decoded.attachments, function(i, file) {
        var treat_as = file_treat_as(file);
        if(treat_as === 'message') {
          var armored = crypto_armor_clip(file.content);
          if(armored) {
            blocks.push(crypto_armor_block_object('message', armored));
          }
        } else if(treat_as === 'signature') {
          decoded.signature = decoded.signature || file.content;
        } else if(treat_as === 'public_key') {
          blocks = blocks.concat(crypto_armor_detect_blocks(file.content));
        }
      });
      if(decoded.signature) {
        tool.each(blocks, function(i, block) {
          if(block.type === 'text') {
            block.type = 'signed_message';
            block.signature = decoded.signature;
            return false;
          }
        });
      }
      callback({headers: decoded.headers, blocks: blocks});
    });
  }

  function mime_decode(mime_message, callback) {
    var mime_message_contents = {attachments: [], headers: {}, text: undefined, html: undefined, signature: undefined};
    mime_require('parser', function (emailjs_mime_parser) {
      try {
        var parser = new emailjs_mime_parser();
        var parsed = {};
        parser.onheader = function (node) {
          if(!String(node.path.join("."))) { // root node headers
            tool.each(node.headers, function (name, header) {
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
          tool.each(parsed, function (path, node) {
            if(mime_node_type(node) === 'application/pgp-signature') {
              mime_message_contents.signature = tool.str.uint8_as_utf(node.content);
            } else if(mime_node_type(node) === 'text/html' && !mime_node_filename(node)) {
              mime_message_contents.html = tool.str.uint8_as_utf(node.content);
            } else if(mime_node_type(node) === 'text/plain' && !mime_node_filename(node)) {
              mime_message_contents.text = tool.str.uint8_as_utf(node.content);
            } else {
              var node_content = tool.str.from_uint8(node.content);
              mime_message_contents.attachments.push(file_attachment(mime_node_filename(node), mime_node_type(node), node_content));
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

  function mime_parse_message_with_detached_signature(mime_message) {
    /*
     Trying to grab the full signed content that may look like this in its entirety (it's a signed mime message. May also be signed plain text)
     Unfortunately, emailjs-mime-parser was not able to do this, or I wasn't able to use it properly

     --eSmP07Gus5SkSc9vNmF4C0AutMibfplSQ
     Content-Type: multipart/mixed; boundary="XKKJ27hlkua53SDqH7d1IqvElFHJROQA1"
     From: Henry Electrum <henry.electrum@gmail.com>
     To: tom@cryptup.org
     Message-ID: <abd68ba1-35c3-ee8a-0d60-0319c608d56b@gmail.com>
     Subject: compatibility - simples signed email

     --XKKJ27hlkua53SDqH7d1IqvElFHJROQA1
     Content-Type: text/plain; charset=utf-8
     Content-Transfer-Encoding: quoted-printable

     content

     --XKKJ27hlkua53SDqH7d1IqvElFHJROQA1--
     */
    var signed_header_index = mime_message.substr(0, 100000).toLowerCase().indexOf('content-type: multipart/signed');
    if(signed_header_index !== -1) {
      mime_message = mime_message.substr(signed_header_index);
      var first_boundary_index = mime_message.substr(0, 1000).toLowerCase().indexOf('boundary=');
      if(first_boundary_index) {
        var boundary = mime_message.substr(first_boundary_index, 100);
        console.log(boundary);
        boundary = (boundary.match(/boundary="[^"]{1,70}"/gi) || boundary.match(/boundary=[a-z0-9][a-z0-9 ]{0,68}[a-z0-9]/gi) || [])[0];
        if(boundary) {
          boundary = boundary.replace(/^boundary="?|"$/gi, '');
          var boundary_begin = '\r\n--' + boundary + '\r\n';
          var boundary_end = '--' + boundary + '--';
          var end_index = mime_message.indexOf(boundary_end);
          if(end_index !== -1) {
            mime_message = mime_message.substr(0, end_index + boundary_end.length);
            if(mime_message) {
              var result = { full: mime_message, signed: null, signature: null };
              var first_part_start_index = mime_message.indexOf(boundary_begin);
              if(first_part_start_index !== -1) {
                first_part_start_index += boundary_begin.length;
                var first_part_end_index = mime_message.indexOf(boundary_begin, first_part_start_index);
                var second_part_start_index = first_part_end_index + boundary_begin.length;
                var second_part_end_index = mime_message.indexOf(boundary_end, second_part_start_index);
                if(second_part_end_index !== -1) {
                  var first_part = mime_message.substr(first_part_start_index, first_part_end_index - first_part_start_index);
                  var second_part = mime_message.substr(second_part_start_index, second_part_end_index - second_part_start_index);
                  if(first_part.match(/^content-type: application\/pgp-signature/gi) !== null && tool.value('-----BEGIN PGP SIGNATURE-----').in(first_part) && tool.value('-----END PGP SIGNATURE-----').in(first_part)) {
                    result.signature = crypto_armor_clip(first_part);
                    result.signed = second_part;
                  } else {
                    result.signature = crypto_armor_clip(second_part);
                    result.signed = first_part;
                  }
                  return result;
                }
              }
            }
          }
        }
      }
    }
  }

  /* tool.ui */

  function  ui_event_stop_propagation_to_parent_frame() {
    // prevent events that could potentially leak information about sensitive info from bubbling above the frame
    $('body').on('keyup keypress keydown click drag drop dragover dragleave dragend submit', function(e) {
      // don't ask me how come Chrome allows it to bubble cross-domain
      // should be used in embedded frames where the parent cannot be trusted (eg parent is webmail)
      // should be further combined with iframe type=content + sandboxing, but these could potentially be changed by the parent frame
      // so this indeed seems like the only defense
      // happened on only one machine, but could potentially happen to other users as well
      // if you know more than I do about the hows and whys of events bubbling out of iframes on different domains, let me know
      e.stopPropagation();
    });
  }

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
          // if(meta.name === 'parallel') - id was found - means the event handling is still being processed. Do not call back
          if(meta.name === 'double') {
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

  function ui_event_stop() {
    return function(e) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };
  }

  function ui_spinner(color, placeholder_class) {
    var path = '/img/svgs/spinner-' + color + '-small.svg';
    var url = typeof chrome !== 'undefined' && chrome.extension && chrome.extension.getURL ? chrome.extension.getURL(path) : path;
    return '<i class="' + (placeholder_class || 'small_spinner') + '"><img src="' + url + '" /></i>';
  }

  function ui_scroll(selector, repeat) {
    var el = $(selector).first()[0];
    if(el) {
      el.scrollIntoView();
      tool.each(repeat, function(i, delay) { // useful if mobile keyboard is about to show up
        setTimeout(function() {
          el.scrollIntoView();
        }, delay);
      });
    }
  }

  function ui_passphrase_toggle(pass_phrase_input_ids, force_initial_show_or_hide) {
    var button_hide = '<img src="/img/svgs/eyeclosed-icon.svg" class="eye-closed"><br>hide';
    var button_show = '<img src="/img/svgs/eyeopen-icon.svg" class="eye-open"><br>show';
    storage.get(null, ['hide_pass_phrases'], function (s) {
      if(force_initial_show_or_hide === 'hide') {
        var show = false;
      } else if(force_initial_show_or_hide === 'show') {
        var show = true;
      } else {
        var show = !s.hide_pass_phrases;
      }
      tool.each(pass_phrase_input_ids, function (i, id) {
        $('#' + id).addClass('toggled_passphrase');
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
            storage.set(null, { hide_pass_phrases: false, });
          } else {
            $('#' + id).attr('type', 'password');
            $(this).html(button_show);
            storage.set(null, { hide_pass_phrases: true, });
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
            catcher.report('unknown selector name: ' + name);
          }
          cache[name] = $(selectors[name]);
        }
        return cache[name];
      },
      now: function(name) {
        if(typeof selectors[name] === 'undefined') {
          catcher.report('unknown selector name: ' + name);
        }
        return $(selectors[name]);
      },
      selector: function (name) {
        if(typeof selectors[name] === 'undefined') {
          catcher.report('unknown selector name: ' + name);
        }
        return selectors[name];
      }
    };
  }

  /* tools.browser.message */

  var background_script_registered_handlers;
  var frame_registered_handlers = {};
  var standard_handlers = {
    set_css: function (data) {
      $(data.selector).css(data.css);
    },
  };

  function destination_parse(destination_string) {
    var parsed = { tab: null, frame: null };
    if(destination_string) {
      parsed.tab = Number(destination_string.split(':')[0]);
      parsed.frame = !isNaN(destination_string.split(':')[1]) ? Number(destination_string.split(':')[1]) : null;
    }
    return parsed;
  }

  function browser_message_send(destination_string, name, data, callback) {
    var msg = { name: name, data: data, to: destination_string || null, respondable: !!(callback), uid: tool.str.random(10), stack: typeof catcher !== 'undefined' ? catcher.stack_trace() : 'unknown' };
    var is_background_page = env_is_background_script();
    if (is_background_page && background_script_registered_handlers && msg.to === null) {
      background_script_registered_handlers[msg.name](msg.data, null, callback); // calling from background script to background script: skip messaging completely
    } else if(is_background_page) {
      chrome.tabs.sendMessage(destination_parse(msg.to).tab, msg, undefined, function(r) {
        catcher.try(function() {
          if(typeof callback !== 'undefined') {
            callback(r);
          }
        })();
      });
    } else {
      chrome.runtime.sendMessage(msg, function(r) {
        catcher.try(function() {
          if(typeof callback !== 'undefined') {
            callback(r);
          }
        })();
      });
    }
  }

  function browser_message_tab_id(callback) {
    browser_message_send(null, '_tab_', null, callback);
  }

  function browser_message_listen_background(handlers) {
    if(!background_script_registered_handlers) {
      background_script_registered_handlers = handlers;
    } else {
      tool.each(handlers, function(name, handler) {
        background_script_registered_handlers[name] = handler;
      });
    }
    chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
      var safe_respond = function (response) {
        try { // avoiding unnecessary errors when target tab gets closed
          respond(response);
        } catch(e) {
          if(e.message !== 'Attempting to use a disconnected port object') {
            catcher.handle_exception(e);
            throw e;
          }
        }
      };
      if(msg.to && msg.to !== 'broadcast') {
        msg.sender = sender;
        chrome.tabs.sendMessage(destination_parse(msg.to).tab, msg, undefined, safe_respond);
      } else if(tool.value(msg.name).in(Object.keys(background_script_registered_handlers))) {
        background_script_registered_handlers[msg.name](msg.data, sender, safe_respond);
      } else if(msg.to !== 'broadcast') {
        catcher.report('tool.browser.message.listen_background error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
      }
      return msg.respondable === true;
    });
  }

  function browser_message_listen(handlers, listen_for_tab_id) {
    tool.each(handlers, function(name, handler) {
      // newly registered handlers with the same name will overwrite the old ones if browser_message_listen is declared twice for the same frame
      // original handlers not mentioned in newly set handlers will continue to work
      frame_registered_handlers[name] = handler;
    });
    tool.each(standard_handlers, function(name, handler) {
      if(frame_registered_handlers[name] !== 'function') {
        frame_registered_handlers[name] = handler; // standard handlers are only added if not already set above
      }
    });
    var processed = [];
    chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
      return catcher.try(function () {
        if(msg.to === listen_for_tab_id || msg.to === 'broadcast') {
          if(!tool.value(msg.uid).in(processed)) {
            processed.push(msg.uid);
            if(typeof frame_registered_handlers[msg.name] !== 'undefined') {
              frame_registered_handlers[msg.name](msg.data, sender, respond);
            } else if(msg.name !== '_tab_' && msg.to !== 'broadcast') {
              if(destination_parse(msg.to).frame !== null) { // only consider it an error if frameId was set because of firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1354337
                catcher.report('tool.browser.message.listen error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
              } else { // once firefox fixes the bug, it will behave the same as Chrome and the following will never happen.
                console.log('tool.browser.message.listen ignoring missing handler "' + msg.name + '" due to Firefox Bug');
              }
            }
          }
        }
        return msg.respondable === true;
      })();
    });
  }

  /* tool.diagnose */

  function diagnose_message_pubkeys(account_email, message) {
    var message_key_ids = message.getEncryptionKeyIds();
    var local_key_ids = crypto_key_ids(storage.keys_get(account_email, 'primary').public);
    var diagnosis = { found_match: false, receivers: message_key_ids.length };
    tool.each(message_key_ids, function (i, msg_k_id) {
      tool.each(local_key_ids, function (j, local_k_id) {
        if(msg_k_id === local_k_id) {
          diagnosis.found_match = true;
          return false;
        }
      });
    });
    return diagnosis;
  }

  function diagnose_keyserver_pubkeys(account_email, callback) {
    var diagnosis = { has_pubkey_missing: false, has_pubkey_mismatch: false, results: {} };
    storage.get(account_email, ['addresses'], function (s) {
      api_attester_lookup_email(tool.arr.unique([account_email].concat(s.addresses || []))).then(function(pubkey_search_results) {
        tool.each(pubkey_search_results.results, function (i, pubkey_search_result) {
          if (!pubkey_search_result.pubkey) {
            diagnosis.has_pubkey_missing = true;
            diagnosis.results[pubkey_search_result.email] = {attested: false, pubkey: null, match: false};
          } else {
            var match = true;
            if (!tool.value(crypto_key_longid(pubkey_search_result.pubkey)).in(arr_select(storage.keys_get(account_email), 'longid'))) {
              diagnosis.has_pubkey_mismatch = true;
              match = false;
            }
            diagnosis.results[pubkey_search_result.email] = {
              pubkey: pubkey_search_result.pubkey,
              attested: pubkey_search_result.attested,
              match: match
            };
          }
        });
        callback(diagnosis);
      }, function(error) {
        callback();
      });
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
    tool.each(newlines, function (i, newline) {
      pgp_block_text = pgp_block_text.replace(newline, '\n');
    });
    if(debug) {
      console.log('pgp_block_2');
      console.log(pgp_block_text);
    }
    tool.each(removes, function (i, remove) {
      pgp_block_text = pgp_block_text.replace(remove, '');
    });
    if(debug) {
      console.log('pgp_block_3');
      console.log(pgp_block_text);
    }
    tool.each(spaces, function (i, space) {
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

  var crypto_armor_header_max_length = 50;

  var crypto_armor_headers_dict = {
    null: { begin: '-----BEGIN', end: '-----END' },
    public_key: { begin: '-----BEGIN PGP PUBLIC KEY BLOCK-----', end: '-----END PGP PUBLIC KEY BLOCK-----', replace: true },
    private_key: { begin: '-----BEGIN PGP PRIVATE KEY BLOCK-----', end: '-----END PGP PRIVATE KEY BLOCK-----' },
    attest_packet: { begin: '-----BEGIN ATTEST PACKET-----', end: '-----END ATTEST PACKET-----', replace: true },
    cryptup_verification: { begin: '-----BEGIN CRYPTUP VERIFICATION-----', end: '-----END CRYPTUP VERIFICATION-----', replace: true },
    signed_message: { begin: '-----BEGIN PGP SIGNED MESSAGE-----', middle: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: true },
    signature: { begin: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----' },
    message: { begin: '-----BEGIN PGP MESSAGE-----', end: '-----END PGP MESSAGE-----', replace: true },
    password_message: { begin: 'This message is encrypted: Open Message', end: /https:(\/|&#x2F;){2}(cryptup\.org|flowcrypt\.com)(\/|&#x2F;)[a-zA-Z0-9]{10}(\n|$)/, replace: true},
  };

  function crypto_armor_headers(block_type, format) {
    if(format === 're') {
      var h = crypto_armor_headers_dict[block_type || null];
      if(typeof h.exec === 'function') {
        return h;
      }
      return obj_map(h, function (header_value) {
        if(typeof h === 'string') {
          return header_value.replace(/ /g, '\\\s'); // regexp match friendly
        } else {
          return header_value;
        }
      });
    } else {
      return crypto_armor_headers_dict[block_type || null];
    }
  }

  function crypto_armor_clip(text) {
    if(text && tool.value(crypto_armor_headers_dict[null].begin).in(text) && tool.value(crypto_armor_headers_dict[null].end).in(text)) {
      var match = text.match(/(-----BEGIN PGP (MESSAGE|SIGNED MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----[^]+-----END PGP (MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----)/gm);
      return(match !== null && match.length) ? match[0] : null;
    }
    return null;
  }

  var password_sentence_present_test = /https:\/\/cryptup\.(org|io)\/[a-zA-Z0-9]{10}/;
  var password_sentences = [
    /This\smessage\sis\sencrypted.+\n\n?/gm, // todo - should be in a common place as the code that generated it
    /.*https:\/\/cryptup\.(org|io)\/[a-zA-Z0-9]{10}.*\n\n?/gm,
  ];

  function crypto_armor_normalize(armored, type) {
    if(tool.value(type).in(['message', 'public_key', 'private_key', 'key'])) {
      armored = armored.replace(/\r?\n/g, '\n').trim();
      var nl_2 = armored.match(/\n\n/g);
      var nl_3 = armored.match(/\n\n\n/g);
      var nl_4 = armored.match(/\n\n\n\n/g);
      var nl_6 = armored.match(/\n\n\n\n\n\n/g);
      if (nl_3 && nl_6 && nl_3.length > 1 && nl_6.length === 1) {
        return armored.replace(/\n\n\n/g, '\n'); // newlines tripled: fix
      } else if(nl_2 && nl_4 && nl_2.length > 1 && nl_4.length === 1) {
        return armored.replace(/\n\n/g, '\n'); // newlines doubled.GPA on windows does this, and sometimes message can get extracted this way from html
      }
      return armored;
    } else {
      return armored;
    }
  }

  function crypto_armor_block_object(type, content, missing_end) {
    return {type: type, content: content, complete: !missing_end};
  }

  function crypto_armor_detect_block_next(original_text, start_at) {
    var result = {found: [], continue_at: null};
    var begin = original_text.indexOf(crypto_armor_headers(null).begin, start_at);
    if(begin !== -1) { // found
      var potential_begin_header = original_text.substr(begin, crypto_armor_header_max_length);
      tool.each(crypto_armor_headers_dict, function(type, block_header) {
        if(block_header.replace) {
          var index_of_confirmed_begin = potential_begin_header.indexOf(block_header.begin);
          if(index_of_confirmed_begin === 0 || (type === 'password_message' && index_of_confirmed_begin < 15)) { // identified beginning of a specific block
            if(begin > start_at) {
              var potential_text_before_block_begun = original_text.substring(start_at, begin).trim();
              if(potential_text_before_block_begun) {
                result.found.push(crypto_armor_block_object('text', potential_text_before_block_begun));
              }
            }
            if(typeof block_header.end === 'string') {
              var end = original_text.indexOf(block_header.end, begin + block_header.begin.length);
            } else { // regexp
              var end = original_text.match(block_header.end);
              end = end || -1; // useful below to mimic indexOf
              if(end !== -1) {
                block_header.end.length = end[0].length; // another hack to mimic results of indexOf
                end = end.index; // one more
              }
            }
            if(end !== -1) { // identified end of the same block
              if(type !== 'password_message') {
                result.found.push(crypto_armor_block_object(type, original_text.substring(begin, end + block_header.end.length).trim()));
              } else {
                var pm_full_text = original_text.substring(begin, end + block_header.end.length).trim();
                var pm_short_id_match = pm_full_text.match(/[a-zA-Z0-9]{10}$/);
                if(pm_short_id_match) {
                  result.found.push(crypto_armor_block_object(type, pm_short_id_match[0]));
                } else {
                  result.found.push(crypto_armor_block_object('text', pm_full_text));
                }
              }
              result.continue_at = end + block_header.end.length;
            } else { // corresponding end not found
              result.found.push(crypto_armor_block_object(type, original_text.substr(begin), true));
            }
            return false;
          }
        }
      });
    } else {
      var potential_text = original_text.substr(start_at).trim();
      if(potential_text) {
        result.found.push(crypto_armor_block_object('text', potential_text));
      }
    }
    return result;
  }

  function crypto_armor_detect_blocks(original_text) {
    var structure = [];
    original_text = str_normalize_spaces(original_text);
    var start_at = 0;
    while(true) {
      var r = crypto_armor_detect_block_next(original_text, start_at);
      if(r.found) {
        structure = structure.concat(r.found);
      }
      if(!r.continue_at) {
        return structure;
      } else {
        start_at = r.continue_at;
      }
    }
  }

  function crypto_armor_replace_blocks(factory, original_text, message_id, sender_email, is_outgoing) {
    var blocks = crypto_armor_detect_blocks(original_text);
    if(blocks.length === 1 && blocks[0].type === 'text') {
      return;
    }
    var r = '';
    tool.each(blocks, function(i, block) {
      if(block.type === 'text') {
        r += (Number(i) ? '\n\n' : '') + str_html_escape(block.content) + '\n\n';
      } else if (block.type === 'message') {
        r += factory.embedded.message(block.complete ? crypto_armor_normalize(block.content, 'message') : '', message_id, is_outgoing, sender_email, false);
      } else if (block.type === 'signed_message') {
        r += factory.embedded.message(block.content, message_id, is_outgoing, sender_email, false);
      } else if (block.type === 'public_key') {
        r += factory.embedded.pubkey(crypto_armor_normalize(block.content, 'public_key'), is_outgoing);
      } else if (block.type === 'password_message') {
        r += factory.embedded.message('', message_id, is_outgoing, sender_email, true, null, block.content); // here block.content is message short id
      } else if (block.type === 'attest_packet') {
        r += factory.embedded.attest(block.content);
      } else if (block.type === 'cryptup_verification') {
        r += factory.embedded.verification(block.content);
      } else {
        catcher.report('dunno how to process block type: ' + block.type);
      }
    });
    return r;
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

  function crypto_key_read(armored_key) {
    return openpgp.key.readArmored(armored_key).keys[0];
  }

  function crypto_key_ids(armored_pubkey) {
    return openpgp.key.readArmored(armored_pubkey).keys[0].getKeyIds();
  }

  function crypto_key_decrypt(prv, passphrase) { // {success: true|false, error: undefined|str}
    try {
      return {success: prv.decrypt(passphrase)};
    } catch(primary_e) {
      if(!tool.value(primary_e.message).in(['Unknown s2k type.', 'Invalid enum value.'])) {
        return {success: false, error: 'primary decrypt error: "' + primary_e.message + '"'}; // unknown exception for master key
      } else if(prv.subKeys !== null && prv.subKeys.length) {
        var subkes_succeeded = 0;
        var subkeys_unusable = 0;
        var unknown_exception;
        tool.each(prv.subKeys, function(i, subkey) {
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
          return {success: false, error: 'subkey decrypt error: "' + unknown_exception.message + '"'};
        }
        return {success: subkes_succeeded > 0 && (subkes_succeeded + subkeys_unusable) === prv.subKeys.length};
      } else {
        return {success: false, error: 'primary decrypt error and no subkeys to try: "' + primary_e.message + '"'};
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
    tool.each(key.subKeys, function (i, sub_key) {
      if(sub_key.verify(key) === openpgp.enums.keyStatus.expired && openpgpjs_original_isValidEncryptionKeyPacket(sub_key.subKey, sub_key.bindingSignature)) {
        found_expired_subkey = true;
        return false;
      }
    });
    return found_expired_subkey;
  }

  function crypto_key_usable(armored) { // is pubkey usable for encrytion?
    if(!crypto_key_fingerprint(armored)) {
      return false;
    }
    var pubkey = openpgp.key.readArmored(armored).keys[0];
    if(!pubkey) {
      return false;
    }
    patch_public_keys_to_ignore_expiration([pubkey]);
    return pubkey.getEncryptionKeyPacket() !== null;
  }

  function crypto_key_normalize(armored) {
    try {
      armored = crypto_armor_normalize(armored, 'key');
      var key;
      if(RegExp(crypto_armor_headers('public_key', 're').begin).test(armored)) {
        key = openpgp.key.readArmored(armored).keys[0];
      } else if(RegExp(crypto_armor_headers('message', 're').begin).test(armored)) {
        key = openpgp.key.Key(openpgp.message.readArmored(armored).packets);
      }
      if(key) {
        return key.armor();
      } else {
        return armored;
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
      openpgp.encrypt({ data: 'this is a test', armor: true, publicKeys: [openpgp.key.readArmored(armored).keys[0].toPublic()] }).then(function (result) {
        var prv = openpgp.key.readArmored(armored).keys[0];
        crypto_key_decrypt(prv, passphrase);
        openpgp.decrypt({ message: openpgp.message.readArmored(result.data), format: 'utf8', privateKey: prv }).then(function () {
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
    keys.potentially_matching = storage.keys_get(account_email, keys.encrypted_for);
    if(keys.potentially_matching.length === 0) { // not found any matching keys, or list of encrypted_for was not supplied in the message. Just try all keys.
      keys.potentially_matching = storage.keys_get(account_email);
    }
    keys.with_passphrases = [];
    keys.without_passphrases = [];
    tool.each(keys.potentially_matching, function (i, keyinfo) {
      var passphrase = storage.passphrase_get(account_email, keyinfo.longid);
      if(passphrase !== null) {
        var key = openpgp.key.readArmored(keyinfo.private).keys[0];
        if(crypto_key_decrypt(key, passphrase).success) {
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
      storage.db_contact_get(db, keys.signed_by, function (verification_contacts) {
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
    return { decrypted: 0, potentially_matching_keys: keys ? keys.potentially_matching.length : 0, rounds: keys ? keys.with_passphrases.length : 0, attempts: 0, key_mismatch: 0, wrong_password: 0, unsecure_mdc: 0 };
  }

  function increment_decrypt_error_counts(counts, other_errors, one_time_message_password, decrypt_error) {
    if(String(decrypt_error) === "Error: Error decrypting message: Cannot read property 'isDecrypted' of null" && !one_time_message_password) {
      counts.key_mismatch++; // wrong private key
    } else if(String(decrypt_error) === 'Error: Error decrypting message: Invalid session key for decryption.' && !one_time_message_password) {
      counts.key_mismatch++; // attempted opening password only message with key
    } else if(one_time_message_password && tool.value(String(decrypt_error)).in(['Error: Error decrypting message: Invalid enum value.', 'Error: Error decrypting message: CFB decrypt: invalid key'])) {
      counts.wrong_password++; // wrong password
    } else if(String(decrypt_error) === 'Error: Error decrypting message: Decryption failed due to missing MDC in combination with modern cipher.') {
      counts.unsecure_mdc++;
    } else {
      other_errors.push(String(decrypt_error));
    }
    counts.attempts++;
  }

  function finally_callback_result(callback, result) {
    if(result.success) {
      callback(result); // callback the moment there is successful decrypt
    } else if(result.counts.attempts === result.counts.rounds && !result.counts.decrypted) {
      callback(result); // or callback if no success and this was the last attempt
    }
  }

  function get_decrypt_options(message, keyinfo, is_armored, one_time_message_password, force_output_format) {
    var options = { message: message, format: is_armored ? force_output_format || 'utf8' : force_output_format || 'binary' };
    if(!one_time_message_password) {
      options.privateKey = keyinfo.decrypted;
    } else {
      options.password = crypto_hash_challenge_answer(one_time_message_password);
    }
    return options;
  }

  function crypto_message_verify(message, keys_for_verification, optional_contact) {
    var signature = { signer: null, contact: optional_contact || null,  match: null, error: null };
    try {
      tool.each(message.verify(keys_for_verification), function (i, verify_result) {
        signature.match = tool.value(signature.match).in([true, null]) && verify_result.valid; // this will probably falsely show as not matching in some rare cases. Needs testing.
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

  function crypto_message_verify_detached(db, account_email, plaintext, signature_text, callback) {
    var message = openpgp.message.readSignedContent(plaintext, signature_text);
    get_sorted_keys_for_message(db, account_email, message, function(keys) {
      callback(crypto_message_verify(message, keys.for_verification, keys.verification_contacts[0]));
    });
  }

  function crypto_message_decrypt(db, account_email, encrypted_data, one_time_message_password, callback, force_output_format) {
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
      callback({success: false, counts: zeroed_decrypt_error_counts(), format_error: format_error.message, errors: other_errors, encrypted: null, signature: null});
      return;
    }
    get_sorted_keys_for_message(db, account_email, message, function (keys) {
      var counts = zeroed_decrypt_error_counts(keys);
      if(armored_signed_only) {
        if(!message.text) {
          var sm_headers = crypto_armor_headers('signed_message', 're');
          var text = encrypted_data.match(RegExp(sm_headers.begin + '\nHash:\s[A-Z0-9]+\n([^]+)\n' + sm_headers.middle + '[^]+' + sm_headers.end, 'm'));
          message.text = text && text.length === 2 ? text[1] : encrypted_data;
        }
        callback({success: true, content: { data: message.text }, encrypted: false, signature: crypto_message_verify(message, keys.for_verification, keys.verification_contacts[0])});
      } else {
        var missing_passphrases = keys.without_passphrases.map(function (keyinfo) { return keyinfo.longid; });
        if(!keys.with_passphrases.length && !one_time_message_password) {
          callback({success: false, signature: null, message: message, counts: counts, unsecure_mdc: !!counts.unsecure_mdc, encrypted_for: keys.encrypted_for, missing_passphrases: missing_passphrases, errors: other_errors});
        } else {
          tool.each(keys.with_passphrases, function (i, keyinfo) {
            if(!counts.decrypted) {
              try {
                openpgp.decrypt(get_decrypt_options(message, keyinfo, armored_encrypted || armored_signed_only, one_time_message_password, force_output_format)).then(function (decrypted) {
                  catcher.try(function () {
                    if(decrypted.data !== null) {
                      if(!counts.decrypted++) { // don't call back twice if encrypted for two of my keys
                        finally_callback_result(callback, {success: true, content: decrypted, encrypted: true, signature: keys.signed_by.length ? crypto_message_verify(message, keys.for_verification, keys.verification_contacts[0]) : false});
                      }
                    } else {
                      other_errors.push(decrypted.err instanceof Array ? decrypted.err.join(', ') : 'Decrypted data is null. Please write me at tom@cryptup.org to fix this.');
                      counts.attempts++;
                      finally_callback_result(callback, {success: false, signature: null, message: message, counts: counts, unsecure_mdc: !!counts.unsecure_mdc, encrypted_for: keys.encrypted_for, missing_passphrases: missing_passphrases, errors: other_errors});
                    }
                  })();
                }).catch(function (decrypt_error) {
                  catcher.try(function () {
                    increment_decrypt_error_counts(counts, other_errors, one_time_message_password, decrypt_error);
                    finally_callback_result(callback, {success: false, signature: null, message: message, counts: counts, unsecure_mdc: !!counts.unsecure_mdc, encrypted_for: keys.encrypted_for, missing_passphrases: missing_passphrases, errors: other_errors});
                  })();
                });
              } catch(decrypt_exception) {
                other_errors.push(String(decrypt_exception));
                counts.attempts++;
                finally_callback_result(callback, {success: false, signature: null, message: message, counts: counts, unsecure_mdc: !!counts.unsecure_mdc, encrypted_for: keys.encrypted_for, missing_passphrases: missing_passphrases, errors: other_errors});
              }
            }
          });
        }
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
    tool.each(keys, function (i, key) {
      tool.each(key.subKeys || [], function (i, sub_key) {
        sub_key.isValidEncryptionKey = ignore_expiration_isValidEncryptionKey;
      });
    });
  }

  function crypto_message_encrypt(armored_pubkeys, signing_prv, challenge, data, filename, armor, callback) {
    var options = { data: data, armor: armor };
    if(filename) {
      options.filename = filename;
    }
    var used_challange = false;
    if(armored_pubkeys) {
      options.publicKeys = [];
      tool.each(armored_pubkeys, function (i, armored_pubkey) {
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

  /* tool.api */

  function get_ajax_progress_xhr(progress_callbacks) {
    var progress_reporting_xhr = new window.XMLHttpRequest();
    if(typeof progress_callbacks.upload === 'function') {
      progress_reporting_xhr.upload.addEventListener("progress", function(evt) {
        progress_callbacks.upload(evt.lengthComputable ? parseInt((evt.loaded / evt.total) * 100) : null);
      }, false);
    }
    if(typeof progress_callbacks.download === 'function') {
      progress_reporting_xhr.onprogress = function (evt) {
        progress_callbacks.download(evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : null, evt.loaded, evt.total);
      };
    }
    return progress_reporting_xhr;
  }

  function api_auth_window(auth_url, window_closed_by_user) {
    var auth_code_window = window.open(auth_url, '_blank', 'height=600,left=100,menubar=no,status=no,toolbar=no,top=100,width=500');
    var window_closed_timer = setInterval(function () {
      if(auth_code_window.closed) {
        clearInterval(window_closed_timer);
        window_closed_by_user();
      }
    }, 500);
    return function() {
      clearInterval(window_closed_timer);
      auth_code_window.close();
    };
  }

  function api_call(base_url, path, values, format, progress, headers, response_format, method) {
    progress = progress || {};
    if(format === 'JSON' && values === null) {
      var formatted_values = undefined;
      var content_type = undefined;
    } else if(format === 'JSON') {
      var formatted_values = JSON.stringify(values);
      var content_type = 'application/json; charset=UTF-8';
    } else if(format === 'FORM') {
      var formatted_values = new FormData();
      tool.each(values, function (name, value) {
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
    return catcher.Promise(function(resolve, reject) {
      $.ajax({
        xhr: function() {
          return get_ajax_progress_xhr(progress);
        },
        url: base_url + path,
        method: method || 'POST',
        data: formatted_values,
        dataType: response_format || 'json',
        crossDomain: true,
        headers: headers || undefined,
        processData: false,
        contentType: content_type,
        async: true,
        timeout: typeof progress.upload === 'function' || typeof progress.download === 'function' ? undefined : 20000,
        success: function (response) {
          catcher.try(function () {
            if(response && typeof response === 'object' && typeof response.error === 'object') {
              reject(response.error);
            } else {
              resolve(response);
            }
          })();
        },
        error: function (XMLHttpRequest, status, error) {
          catcher.try(function () {
            if(XMLHttpRequest.status === 0) {
              reject({code: null, message: 'Internet connection not available', internal: 'network'});
            } else {
              reject({code: XMLHttpRequest.status, message: String(error)});
            }
          })();
        },
      });
    });
  }

  function api_auth_parse_id_token(id_token) {
    return JSON.parse(atob(id_token.split(/\./g)[1]));
  }

  /* tool.api.common */

  function api_common_email_message_object(account_email, from, to, subject, body, attachments, thread_referrence) {
    from = from || '';
    to = to || '';
    subject = subject || '';
    return {
      headers: (typeof exports !== 'object') ? { // todo - make it work in electron as well
        OpenPGP: 'id=' + storage.keys_get(account_email, 'primary').fingerprint,
      } : {},
      from: from,
      to: typeof to === 'object' ? to : to.split(','),
      subject: subject,
      body: typeof body === 'object' ? body : {'text/plain': body},
      attachments: attachments || [],
      thread: thread_referrence || null,
    };
  }

  function api_common_reply_correspondents(account_email, addresses, last_message_sender, last_message_recipients) {
    var reply_to_estimate = [last_message_sender].concat(last_message_recipients);
    var reply_to = [];
    var my_email = account_email;
    tool.each(reply_to_estimate, function (i, email) {
      if(email) {
        if(tool.value(tool.str.parse_email(email).email).in(addresses)) { // my email
          my_email = email;
        } else if(!tool.value(tool.str.parse_email(email).email).in(reply_to)) { // skip duplicates
          reply_to.push(tool.str.parse_email(email).email); // reply to all except my emails
        }
      }
    });
    if(!reply_to.length) { // happens when user sends email to itself - all reply_to_estimage contained his own emails and got removed
      reply_to = tool.arr.unique(reply_to_estimate);
    }
    return {to: reply_to, from: my_email};
  }

  /* tool.api.google */

  var google_oauth2 = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest ? chrome.runtime.getManifest().oauth2 : null;
  var api_google_auth_responders = {};
  var API_GOOGLE_AUTH_RESPONDED = 'RESPONDED';

  function api_google_auth(auth_request, respond) {
    browser_message_tab_id(function(tab_id) {
      auth_request.tab_id = tab_id;
      storage.get(auth_request.account_email, ['google_token_access', 'google_token_expires', 'google_token_refresh', 'google_token_scopes'], function (s) {
        if (typeof s.google_token_access === 'undefined' || typeof s.google_token_refresh === 'undefined' || api_google_has_new_scope(auth_request.scopes, s.google_token_scopes, auth_request.omit_read_scope)) {
          if(!env_is_background_script()) {
            google_auth_window_show_and_respond_to_auth_request(auth_request, s.google_token_scopes, respond);
          } else {
            respond({success: false, error: 'Cannot produce auth window from background script'});
          }
        } else {
          google_auth_refresh_token(s.google_token_refresh, function (success, result) {
            if (!success && result === tool.api.error.network) {
              respond({success: false, error: tool.api.error.network});
            } else if (typeof result.access_token !== 'undefined') {
              google_auth_save_tokens(auth_request.account_email, result, s.google_token_scopes, function () {
                respond({ success: true, message_id: auth_request.message_id, account_email: auth_request.account_email }); //todo: email should be tested first with google_auth_check_email?
              });
            } else if(!env_is_background_script()) {
              google_auth_window_show_and_respond_to_auth_request(auth_request, s.google_token_scopes, respond);
            } else {
              respond({success: false, error: 'Cannot show auth window from background script'});
            }
          });
        }
      });
    });
  }

  function api_google_has_new_scope(new_scopes, original_scopes, omit_read_scope) {
    if(!(original_scopes || []).length) { // no original scopes
      return true;
    }
    if(!(new_scopes || []).length) { // no new scopes specified
      return(original_scopes.length === 2 && !omit_read_scope); // however, previously there were only two of three scopes, and third was not omitted this time
    }
    for(var i = 0; i < new_scopes.length; i++) {
      if(!tool.value(new_scopes[i]).in(original_scopes)) {
        return true; // found a new scope
      }
    }
    return false; // no new scope found
  }

  function api_google_auth_state_pack(status_object) {
    return google_oauth2.state_header + JSON.stringify(status_object);
  }

  function api_google_auth_code_url(auth_request) {
    return env_url_create(google_oauth2.url_code, {
      client_id: google_oauth2.client_id,
      response_type: 'code',
      access_type: 'offline',
      state: api_google_auth_state_pack(auth_request),
      redirect_uri: google_oauth2.url_redirect,
      scope: auth_request.scopes.join(' '),
      login_hint: auth_request.account_email,
    });
  }

  function google_auth_window_show_and_respond_to_auth_request(auth_request, current_google_token_scopes, respond) {
    auth_request.auth_responder_id = tool.str.random(20);
    api_google_auth_responders[auth_request.auth_responder_id] = respond;
    auth_request.scopes = auth_request.scopes || [];
    tool.each(google_oauth2.scopes, function (i, scope) {
      if(!tool.value(scope).in(auth_request.scopes)) {
        if(scope !== tool.api.gmail.scope('read') || !auth_request.omit_read_scope) { // leave out read messages permission if user chose so
          auth_request.scopes.push(scope);
        }
      }
    });
    tool.each(current_google_token_scopes || [], function (i, scope) {
      if(!tool.value(scope).in(auth_request.scopes)) {
        auth_request.scopes.push(scope);
      }
    });
    var result_listener = { google_auth_window_result: function(result, sender, respond) { google_auth_window_result_handler(auth_request.auth_responder_id, result, respond); } };
    if(auth_request.tab_id !== null) {
      browser_message_listen(result_listener, auth_request.tab_id);
    } else {
      browser_message_listen_background(result_listener);
    }
    var auth_code_window = window.open(api_google_auth_code_url(auth_request), '_blank', 'height=600,left=100,menubar=no,status=no,toolbar=no,top=100,width=500');
    // auth window will show up. Inside the window, google_auth_code.js gets executed which will send
    // a "gmail_auth_code_result" chrome message to "google_auth.google_auth_window_result_handler" and close itself
    if(env_browser().name !== 'firefox') {
      var window_closed_timer = setInterval(api_google_auth_window_closed_watcher, 250);
    }

    function api_google_auth_window_closed_watcher() {
      if(auth_code_window !== null && typeof auth_code_window !== 'undefined' && auth_code_window.closed) { // on firefox it seems to be sometimes returning a null, due to popup blocking
        clearInterval(window_closed_timer);
        if(api_google_auth_responders[auth_request.auth_responder_id] !== API_GOOGLE_AUTH_RESPONDED) {
          // if user did clock Allow/Deny on auth, race condition is prevented, because auth_responders[] are always marked as RESPONDED before closing window.
          // thus it's impossible for another process to try to respond before the next line
          // that also means, if window got closed and it's not marked as RESPONDED, it was the user closing the window manually, which is what we're watching for.
          api_google_auth_responders[auth_request.auth_responder_id]({success: false, result: 'closed', account_email: auth_request.account_email, message_id: auth_request.message_id});
          api_google_auth_responders[auth_request.auth_responder_id] = API_GOOGLE_AUTH_RESPONDED;
        }
      }
    }
  }

  function google_auth_save_tokens(account_email, tokens_object, scopes, callback) {
    var to_save = {
      google_token_access: tokens_object.access_token,
      google_token_expires: new Date().getTime() + tokens_object.expires_in * 1000,
      google_token_scopes: scopes,
    };
    if(typeof tokens_object.refresh_token !== 'undefined') {
      to_save.google_token_refresh = tokens_object.refresh_token;
    }
    storage.set(account_email, to_save, callback);
  }

  function google_auth_get_tokens(code, callback, retries_left) {
    $.ajax({
      url: tool.env.url_create(google_oauth2.url_tokens, { grant_type: 'authorization_code', code: code, client_id: google_oauth2.client_id, redirect_uri: google_oauth2.url_redirect }),
      method: 'POST',
      crossDomain: true,
      async: true,
      success: function (response) {
        callback(response);
      },
      error: function (XMLHttpRequest, status, error) {
        if(!retries_left) {
          callback({ request: XMLHttpRequest, status: status, error: error });
        } else {
          setTimeout(function () { // retry again
            google_auth_get_tokens(code, callback, retries_left - 1);
          }, 2000);
        }
      },
    });
  }

  function google_auth_refresh_token(refresh_token, callback) {
    $.ajax({
      url: tool.env.url_create(google_oauth2.url_tokens, { grant_type: 'refresh_token', refresh_token: refresh_token, client_id: google_oauth2.client_id }),
      method: 'POST',
      crossDomain: true,
      async: true,
      success: function (response) {
        callback(true, response);
      },
      error: function (XMLHttpRequest, status, error) {
        if(XMLHttpRequest.status === 0 && status === 'error') { // connection error
          callback(false, tool.api.error.network);
        } else {
          callback(false, { request: XMLHttpRequest, status: status, error: error });
        }
      },
    });
  }

  function google_auth_check_email(expected_email, access_token, callback) {
    $.ajax({
      url: 'https://www.googleapis.com/gmail/v1/users/me/profile',
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + access_token },
      crossDomain: true,
      contentType: 'application/json; charset=UTF-8',
      async: true,
      success: function (response) {
        callback(response.emailAddress);
      },
      error: function (response) {
        console.log('google_auth_check_email error');
        console.log(expected_email);
        console.log(response);
        callback(expected_email); //todo - handle better. On a network error, this could result in saving this wrongly. Should re-try two times with some delay, then call back.
      },
    });
  }

  function google_auth_window_result_handler(expected_responder_id, result, close_auth_window) {
    if(result.state.auth_responder_id === expected_responder_id) {
      var auth_responder = api_google_auth_responders[result.state.auth_responder_id];
      if(auth_responder !== API_GOOGLE_AUTH_RESPONDED) {
        api_google_auth_responders[result.state.auth_responder_id] = API_GOOGLE_AUTH_RESPONDED;
        close_auth_window();
        switch(result.result) {
          case 'Success':
            google_auth_get_tokens(result.params.code, function (tokens_object) {
              if(typeof tokens_object.access_token !== 'undefined') {
                google_auth_check_email(result.state.account_email, tokens_object.access_token, function (account_email) {
                  google_auth_save_tokens(account_email, tokens_object, result.state.scopes, function () {
                    auth_responder({account_email: account_email, success: true, result: 'success', message_id: result.state.message_id});
                  });
                });
              } else { // got code but failed to use the code to fetch tokens
                auth_responder({success: false, result: 'success', account_email: result.state.account_email, message_id: result.state.message_id});
              }
            }, 2);
            break;
          case 'Denied':
            auth_responder({success: false, result: 'denied', error: result.params.error, account_email: result.state.account_email, message_id: result.state.message_id});
            break;
          case 'Error':
            auth_responder({success: false, result: 'error', error: result.params.error, account_email: result.state.account_email, message_id: result.state.message_id});
            break;
        }
      } else {
        console.log('Ignoring expected_responder_id ' + expected_responder_id + ': API_GOOGLE_AUTH_RESPONDED previously');
      }
    }
  }

  function api_google_call(account_email, method, url, parameters, callback, fail_on_auth) {
    storage.get(account_email, ['google_token_access', 'google_token_expires'], function (auth) {
      var data = method === 'GET' || method === 'DELETE' ? parameters : JSON.stringify(parameters);
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
            catcher.try(function () {
              callback(true, response);
            })();
          },
          error: function (response) {
            try {
              var error_obj = JSON.parse(response.responseText);
              if(typeof error_obj.error !== 'undefined' && error_obj.error.message === "Invalid Credentials") {
                google_api_handle_auth_error(account_email, method, url, parameters, callback, fail_on_auth, response, api_google_call);
              } else {
                response._error = error_obj.error;
                catcher.try(function () {
                  callback(false, response);
                })();
              }
            } catch(err) {
              catcher.try(function () {
                response._error = {};
                var re_title = /<title>([^<]+)<\/title>/mgi;
                var title_match = re_title.exec(response.responseText);
                if(title_match) {
                  response._error.message = title_match[1];
                }
                callback(false, response);
              })();
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

  function api_gmail_call(account_email, method, resource, parameters, callback, fail_on_auth, progress, content_type) {
    if(!account_email) {
      throw new Error('missing account_email in api_gmail_call');
    }
    progress = progress || {};
    storage.get(account_email, ['google_token_access', 'google_token_expires'], function (auth) {
      if(typeof auth.google_token_access !== 'undefined' && auth.google_token_expires > new Date().getTime()) { // have a valid gmail_api oauth token
        if(typeof progress.upload === 'function') {
          var url = 'https://www.googleapis.com/upload/gmail/v1/users/me/' + resource + '?uploadType=multipart';
          var data = parameters;
        } else {
          var url = 'https://www.googleapis.com/gmail/v1/users/me/' + resource;
          if(method === 'GET' || method === 'DELETE') {
            var data = parameters;
          } else {
            var data = JSON.stringify(parameters);
          }
        }
        $.ajax({
          xhr: function () {
            return get_ajax_progress_xhr(progress);
          },
          url: url,
          method: method,
          data: data,
          headers: { 'Authorization': 'Bearer ' + auth.google_token_access },
          crossDomain: true,
          contentType: content_type || 'application/json; charset=UTF-8',
          async: true,
          success: function (response) {
            catcher.try(function () {
              if(callback) {
                callback(true, response);
              }
            })();
          },
          error: function (response) {
            try {
              var error_obj = JSON.parse(response.responseText);
              if(typeof error_obj.error !== 'undefined' && error_obj.error.message === "Invalid Credentials") {
                google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, response, api_gmail_call, progress, content_type);
              } else {
                response._error = error_obj.error;
                if(callback) {
                  catcher.try(function () {
                    callback(false, response);
                  })();
                }
              }
            } catch(err) {
              catcher.try(function () {
                response._error = {};
                var re_title = /<title>([^<]+)<\/title>/mgi;
                var title_match = re_title.exec(response.responseText);
                if(title_match) {
                  response._error.message = title_match[1];
                }
                if(callback) {
                  callback(false, response);
                }
              })();
            }
          },
        });
      } else { // no valid gmail_api oauth token
        google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, null, api_gmail_call, progress, content_type);
      }
    });
  }

  function google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, error_response, base_api_function, progress, content_type) {
    if(fail_on_auth !== true) {
      api_google_auth({ account_email: account_email }, function (response) {
        if(response && response.success === false && response.error === tool.api.error.network) {
          callback(false, tool.api.error.network);
        } else { //todo: error handling for other bad situations
          base_api_function(account_email, method, resource, parameters, callback, true, progress, content_type);
        }
      });
    } else {
      callback(false, error_response);
    }
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

  function encode_as_multipart_related(parts) { // todo - this could probably be achieved with emailjs-mime-builder
    var boundary = 'this_sucks_' + str_random(10);
    var body = '';
    tool.each(parts, function(type, data) {
      body += '--' + boundary + '\n';
      body += 'Content-Type: ' + type + '\n';
      if(tool.value('json').in(type)) {
        body += '\n' + data + '\n\n';
      } else {
        body += 'Content-Transfer-Encoding: base64\n';
        body += '\n' + btoa(data) + '\n\n';
      }
    });
    body += '--' + boundary + '--';
    return { content_type: 'multipart/related; boundary=' + boundary, body: body };
  }

  function api_gmail_message_send(account_email, message, callback, progress_callback) {
    message.headers.From = message.from;
    message.headers.To = message.to.join(',');
    message.headers.Subject = message.subject;
    mime_encode(message.body, message.headers, message.attachments, function(mime_message) {
      var request = encode_as_multipart_related({ 'application/json; charset=UTF-8': JSON.stringify({threadId: message.thread}), 'message/rfc822': mime_message });
      api_gmail_call(account_email, 'POST', 'messages/send', request.body, callback, undefined, {upload: progress_callback || function () {}}, request.content_type);
    });
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
        api_gmail_call(account_email, 'GET', 'messages/' + id, { format: format || 'full' }, function (success, response) {
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
      api_gmail_call(account_email, 'GET', 'messages/' + message_id, { format: format || 'full' }, callback);
    }
  }

  function api_gmail_message_attachment_get(account_email, message_id, attachment_id, callback, progress_callback) {
    api_gmail_call(account_email, 'GET', 'messages/' + message_id + '/attachments/' + attachment_id, {}, callback, undefined, {download: progress_callback});
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
      tool.each(gmail_email_object.parts, function (i, part) {
        api_gmail_find_attachments(part, internal_results, internal_message_id);
      });
    }
    if(typeof gmail_email_object.body !== 'undefined' && typeof gmail_email_object.body.attachmentId !== 'undefined') {
      var attachment = {
        message_id: internal_message_id,
        id: gmail_email_object.body.attachmentId,
        size: gmail_email_object.body.size,
        name: gmail_email_object.filename,
        type: gmail_email_object.mimeType,
        inline: (api_gmail_find_header(gmail_email_object, 'content-disposition') || '').toLowerCase().indexOf('inline') === 0,
      };
      attachment.treat_as = file_treat_as(attachment);
      internal_results.push(attachment);
    }
    return internal_results;
  }

  function file_treat_as(attachment) {
    if(tool.value(attachment.name).in(['PGPexch.htm.pgp', 'PGPMIME version identification'])) {
      return 'hidden';  // PGPexch.htm.pgp is html alternative of textual body content produced by PGP Desktop and GPG4o
    } else if(attachment.name === '') {
      return attachment.size < 100 ? 'hidden' : 'message';
    } else if(attachment.name.match(/(\.pgp$)|(\.gpg$)|(\.[a-zA-Z0-9]{3,4}\.asc$)/g)) { // ends with one of .gpg, .pgp, .???.asc, .????.asc
      return 'encrypted';
    } else if(attachment.name === 'signature.asc') {
      return  'signature';
    } else if(attachment.name.match(/^(0|0x)?[A-F0-9]{8}([A-F0-9]{8})?\.asc$/g)) { // name starts with a key id
      return 'public_key';
    } else if((attachment.name.match(/\.asc$/) && attachment.size < 100000 && !attachment.inline) || tool.value(attachment.name).in(['message', 'message.asc', 'encrypted.asc'])) {
      return 'message';
    } else {
      return 'standard';
    }
  }

  function api_gmail_find_bodies(gmail_email_object, internal_results) {
    if(!internal_results) {
      internal_results = {};
    }
    if(typeof gmail_email_object.payload !== 'undefined') {
      api_gmail_find_bodies(gmail_email_object.payload, internal_results);
    }
    if(typeof gmail_email_object.parts !== 'undefined') {
      tool.each(gmail_email_object.parts, function (i, part) {
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
    var node = api_gmail_message_object.payload ? api_gmail_message_object.payload : api_gmail_message_object;
    if(typeof node.headers !== 'undefined') {
      for(var i = 0; i < node.headers.length; i++) {
        if(node.headers[i].name.toLowerCase() === header_name.toLowerCase()) {
          return node.headers[i].value;
        }
      }
    }
    return null;
  }

  function api_gmail_search_contacts(account_email, user_query, known_contacts, callback) {
    var gmail_query = ['is:sent', USELESS_CONTACTS_FILTER];
    if(user_query) {
      var variations_of_to = user_query.split(/[ \.]/g).filter(function(v) {!tool.value(v).in(['com', 'org', 'net']);});
      if(!tool.value(user_query).in(variations_of_to)) {
        variations_of_to.push(user_query);
      }
      gmail_query.push('(to:' + variations_of_to.join(' OR to:') + ')');
    }
    tool.each(known_contacts, function (i, contact) {
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

  function api_gmail_fetch_key_backups(account_email, callback) {
    tool.api.gmail.message_list(account_email, tool.api.gmail.query.backups(account_email), true, function (success, response) {
      if(success) {
        if(response.messages) {
          var message_ids = response.messages.map(function(m) { return m.id});
          tool.api.gmail.message_get(account_email, message_ids, 'full', function (success, messages) {
            if(success) {
              var attachments = [];
              tool.each(messages, function (i, message) {
                attachments = attachments.concat(tool.api.gmail.find_attachments(message));
              });
              tool.api.gmail.fetch_attachments(account_email, attachments, function (success, downloaded_attachments) {
                var keys = [];
                tool.each(downloaded_attachments, function (i, downloaded_attachment) {
                  try {
                    var armored_key = tool.str.base64url_decode(downloaded_attachment.data);
                    var key = openpgp.key.readArmored(armored_key).keys[0];
                    if(key.isPrivate()) {
                      keys.push(key);
                    }
                  } catch(err) {}
                });
                callback(success, keys);
              });
            } else {
              callback(false, 'Connection dropped while checking for backups. Please try again.');
            }
          });
        } else {
          callback(true, null);
        }
      } else {
        callback(false, 'Connection dropped while checking for backups. Please try again.');
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
        tool.each(header_names, function (i, header_name) {
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
  function gmail_api_extract_armored_block(account_email, message_id, format, success_callback, error_callback) {
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
            tool.each(attachments, function (i, attachment_meta) {
              if(attachment_meta.treat_as === 'message') {
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

  /* tool.api.gmail.query */

  function api_gmail_query_or(arr, quoted) {
    if(quoted) {
      return '("' + arr.join('") OR ("') + '")';
    } else {
      return '(' + arr.join(') OR (') + ')';
    }
  }

  function api_gmail_query_backups(account_email) {
    return [
      'from:' + account_email,
      'to:' + account_email,
      '(subject:"' + tool.enums.recovery_email_subjects.join('" OR subject: "') + '")',
      '-is:spam',
    ].join(' ');
  }

  /* tool.api.attester */

  function api_attester_call(path, values, format) {
    return api_call('https://attester.cryptup.io/', path, values, format || 'JSON', null, {'api-version': 3});
    // return api_call('http://127.0.0.1:5002/', path, values, format || 'JSON', null, {'api-version': 3});
  }

  function api_attester_lookup_email(email) {
    return api_attester_call('lookup/email', {
      email: (typeof email === 'string') ? tool.str.parse_email(email).email : email.map(function(a) {return tool.str.parse_email(a).email; }),
    });
  }

  function api_attester_initial_legacy_submit(email, pubkey, attest) {
    return api_attester_call('initial/legacy_submit', {
      email: tool.str.parse_email(email).email,
      pubkey: pubkey.trim(),
      attest: attest || false,
    });
  }

  function api_attester_initial_confirm(signed_attest_packet) {
    return api_attester_call('initial/confirm', {
      signed_message: signed_attest_packet,
    });
  }

  function api_attester_replace_request(email, signed_attest_packet, new_pubkey) {
    return api_attester_call('replace/request', {
      signed_message: signed_attest_packet,
      new_pubkey: new_pubkey,
      email: email,
    });
  }

  function api_attester_replace_confirm(signed_attest_packet) {
    return api_attester_call('replace/confirm', {
      signed_message: signed_attest_packet,
    });
  }

  function api_attester_test_welcome(email, pubkey) {
    return api_attester_call('test/welcome', {
      email: email,
      pubkey: pubkey,
    });
  }

  function api_attester_packet_armor(content_text) {
    return crypto_armor_headers('attest_packet').begin + '\n' + content_text + '\n' + crypto_armor_headers('attest_packet').end;
  }

  function api_attester_packet_create_sign(values, decrypted_prv) {
    return catcher.Promise(function (resolve, reject) {
      var lines = [];
      tool.each(values, function (key, value) {
        lines.push(key + ':' + value);
      });
      var content_text = lines.join('\n');
      var packet = api_attester_packet_parse(api_attester_packet_armor(content_text));
      if(packet.success !== true) {
        reject({code: null, message: packet.error, internal: 'parse'});
      } else {
        crypto_message_sign(decrypted_prv, content_text, true, function (success, signed_attest_packet) {
          resolve(signed_attest_packet);
        });
      }
    });
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
      tool.each(lines, function (i, line) {
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

  function api_cryptup_call(path, values, format) {
    return api_call(api_cryptup_url('api'), path, values, format || 'JSON', null, {'api-version': 3});
    // return api_call('http://127.0.0.1:5001/', path, values, format || 'JSON', null, {'api-version': 3});
  }

  function api_cryptup_url(type, variable) {
    return {
      'api': 'https://api.cryptup.io/',
      'me': 'https://cryptup.org/me/' + variable,
      'pubkey': 'https://cryptup.org/pub/' + variable,
      'decrypt': 'https://cryptup.org/' + variable,
      'web': 'https://cryptup.org/',
    }[type];
  }

  var api_cryptup_auth_error = {code: 401, message: 'Could not log in', internal: 'auth'};

  function api_cryptup_help_feedback(account_email, message) {
    return api_cryptup_call('help/feedback', {
      email: account_email,
      message: message,
    });
  }

  function api_cryptup_help_uninstall(email, client, metrics) {
    return api_cryptup_call('help/uninstall', {
      email: email,
      client: client,
      metrics: metrics,
    });
  }

  function api_cryptup_account_check(emails) {
    return api_cryptup_call('account/check', {
      emails: emails,
    });
  }

  function api_cryptup_account_login(account_email, token) {
    return catcher.Promise(function(resolve, reject) {
      storage.auth_info(function (registered_email, registered_uuid, already_verified) {
        var uuid = registered_uuid || tool.crypto.hash.sha1(tool.str.random(40));
        var email = registered_email || account_email;
        api_cryptup_call('account/login', {
          account: email,
          uuid: uuid, token: token || null,
        }).validate(function (r) {return r.registered === true;}).then(function (response) {
          var to_save = {cryptup_account_email: email, cryptup_account_uuid: uuid, cryptup_account_verified: response.verified === true, cryptup_account_subscription: response.subscription};
          storage.set(null, to_save, function () {
            resolve({verified: response.verified === true, subscription: response.subscription});
          });
        }, reject);
      });
    });
  }

  function api_cryptup_account_subscribe(product, method, payment_source_token) {
    return catcher.Promise(function(resolve, reject) {
      storage.auth_info(function (email, uuid, verified) {
        if(verified) {
          api_cryptup_call('account/subscribe', {
            account: email,
            uuid: uuid,
            method: method,
            source: payment_source_token,
            product: product,
          }).then(function(response) {
            storage.set(null, { cryptup_account_subscription: response.subscription }, function () {
              resolve(response);
            });
          }, reject);
        } else {
          reject(api_cryptup_auth_error);
        }
      });
    });
  }

  function api_cryptup_account_update(update_values) {
    return catcher.Promise(function(resolve, reject) {
      storage.auth_info(function (email, uuid, verified) {
        if(verified) {
          var request = {account: email, uuid: uuid};
          tool.each(update_values || {}, function(k, v) { request[k] = v; });
          api_cryptup_call('account/update', request).validate(function(r) {return typeof r.result === 'object' }).then(resolve, reject);
        } else {
          reject(api_cryptup_auth_error);
        }
      });
    });
  }

  function api_cryptup_message_presign_files(attachments, auth_method) {
    return catcher.Promise(function (resolve, reject) {
      var lengths = attachments.map(function (a) { return a.size; });
      if(!auth_method) {
        api_cryptup_call('message/presign_files', {
          lengths: lengths,
        }).then(resolve, reject);
      } else if(auth_method === 'uuid') {
        storage.auth_info(function (email, uuid, verified) {
          if(verified) {
            api_cryptup_call('message/presign_files', {
              account: email,
              uuid: uuid,
              lengths: lengths,
            }).then(resolve, reject);
          } else {
            reject(api_cryptup_auth_error);
          }
        });
      } else {
        api_cryptup_call('message/presign_files', {
          message_token_account: auth_method.account,
          message_token: auth_method.token,
          lengths: attachments.map(function(a) { return a.size; }),
        }).then(resolve, reject);
      }
    });
  }

  function api_cryptup_message_confirm_files(identifiers) {
    return api_cryptup_call('message/confirm_files', {
      identifiers: identifiers,
    });
  }

  function api_cryptup_message_upload(encrypted_data_armored, auth_method) { // todo - DEPRECATE THIS. Send as JSON to message/store
    return catcher.Promise(function (resolve, reject) {
      if(encrypted_data_armored.length > 100000) {
        reject({code: null, message: 'Message text should not be more than 100 KB. You can send very long texts as attachments.'});
      } else {
        var content = file_attachment('cryptup_encrypted_message.asc', 'text/plain', encrypted_data_armored);
        if(!auth_method) {
          api_cryptup_call('message/upload', {
            content: content,
          }, 'FORM').then(resolve, reject);
        } else {
          storage.auth_info(function (email, uuid, verified) {
            if(verified) {
              api_cryptup_call('message/upload', {
                account: email,
                uuid: uuid,
                content: content,
              }, 'FORM').then(resolve, reject);
            } else {
              reject(api_cryptup_auth_error);
            }
          });
        }
      }
    });
  }

  function api_cryptup_message_expiration(admin_codes, add_days) {
    return catcher.Promise(function (resolve, reject) {
      storage.auth_info(function (email, uuid, verified) {
        if(verified) {
          api_cryptup_call('message/expiration', {
            account: email,
            uuid: uuid,
            admin_codes: admin_codes,
            add_days: add_days || null,
          }).then(resolve, reject);
        } else {
          reject(api_cryptup_auth_error);
        }
      });
    });
  }

  function api_cryptup_message_token() {
    return catcher.Promise(function (resolve, reject) {
      storage.auth_info(function (email, uuid, verified) {
        if(verified) {
          api_cryptup_call('message/token', {
            account: email,
            uuid: uuid,
          }).then(resolve, reject);
        } else {
          reject(api_cryptup_auth_error);
        }
      });
    });
  }

  function api_cryptup_message_reply(short, token, from, to, subject, message) {
    return api_cryptup_call('message/reply', {
      short: short,
      token: token,
      from: from,
      to: to,
      subject: subject,
      message: message,
    });
  }

  function api_cryptup_message_contact(sender, message, message_token) {
    return api_cryptup_call('message/contact', {
      message_token_account: message_token.account,
      message_token: message_token.token,
      sender: sender,
      message: message,
    });
  }

  function api_cryptup_link_message(short) {
    return api_cryptup_call('link/message', {
      short: short,
    });
  }

  function api_cryptup_link_me(alias) {
    return api_cryptup_call('link/me', {
      alias: alias,
    });
  }

  function api_cryptup_account_check_sync(callback) { // callbacks true on updated, false not updated, null for could not fetch
    callback = typeof callback === 'function' ? callback : function() {};
    storage.account_emails_get(function(emails) {
      if(emails.length) {
        tool.api.cryptup.account_check(emails).then(function(response) {
          storage.auth_info(function (cryptup_account_email, cryptup_account_uuid, cryptup_account_verified) {
            storage.subscription(function(stored_level, stored_expire, stored_active, stored_method) {
              var local_storage_update = {};
              if(response.email) {
                if((response.email && !cryptup_account_email) || (response.email && cryptup_account_email !== response.email)) {
                  // this will of course fail auth on the server when used. The user will be prompted to verify this new device when that happens.
                  local_storage_update['cryptup_account_email'] = response.email;
                  local_storage_update['cryptup_account_uuid'] = tool.crypto.hash.sha1(tool.str.random(40));
                  local_storage_update['cryptup_account_verified'] = true;
                }
              } else {
                if(cryptup_account_email) {
                  local_storage_update['cryptup_account_email'] = null;
                  local_storage_update['cryptup_account_uuid'] = null;
                  local_storage_update['cryptup_account_verified'] = false;
                }
              }
              if(response.subscription) {
                var rs = response.subscription;
                if(rs.level !== stored_level || rs.method !== stored_method || rs.expire !== stored_expire || stored_active !== !rs.expired) {
                  local_storage_update['cryptup_account_subscription'] = response.subscription;
                }
              } else {
                if(stored_level || stored_expire || stored_active || stored_method) {
                  local_storage_update['cryptup_account_subscription'] = null;
                }
              }
              if(Object.keys(local_storage_update).length) {
                catcher.log('updating account subscription from ' + stored_level + ' to ' + (response.subscription ? response.subscription.level : null), response);
                storage.set(null, local_storage_update, function() {
                  callback(true);
                });
              } else {
                callback(false);
              }
            });
          });
        }, function(error) {
          catcher.log('could not check account subscription', error);
          callback(null);
        });
      } else {
        callback(null);
      }
    });
  }

  /* tool.api.aws */

  function api_aws_s3_upload(items, progress_callback) {
    if (!items.length) {
      callback(false);
      return;
    }
    var progress = arr_zeroes(items.length);
    var promises = [];
    tool.each(items, function (i, item) {
      var values = item.fields;
      values.file = file_attachment('encrpted_attachment', 'application/octet-stream', item.attachment.content);
      promises.push(api_call(item.base_url, '', values, 'FORM', {upload: function(single_file_progress) {
        progress[i] = single_file_progress;
        ui_event_prevent(ui_event_spree(), function() {
          progress_callback(arr_average(progress)); // this should of course be weighted average. How many years until someone notices?
        })();
      }}));
    });
    return Promise.all(promises);
  }

})();


(function ( /* ERROR HANDLING */ ) {

  var tool = typeof tool === 'object' ? tool : window.tool;

  var RUNTIME = {};
  figure_out_cryptup_runtime();

  var original_on_error = window.onerror;
  window.onerror = handle_error;
  window.onunhandledrejection = handle_promise_error;

  function handle_promise_error(e) {
    if(e && typeof e === 'object' && typeof e.reason === 'object' && e.reason.message) {
      handle_exception(e.reason); // actual exception that happened in Promise, unhandled
    } else {
      log('unhandled_promise_reject_object', e); // some x that was called with reject(x) and later not handled
    }
  }

  function handle_error(error_message, url, line, col, error, is_manually_called, version, env) {
    if(typeof error === 'string') {
      error_message = error;
      error = { name: 'thrown_string', message: error_message, stack: error_message };
    }
    if(error_message && url && typeof line !== 'undefined' && !col && !error && !is_manually_called && !version && !env) { // safari has limited support
      error = { name: 'safari_error', message: error_message, stack: error_message };
    }
    if(typeof error_message === 'undefined' && line === 0 && col === 0 && is_manually_called && typeof error === 'object' && !(error instanceof Error)) {
      try { // this sometimes happen with unhandled Promise.then(_, reject)
        var stringified = JSON.stringify(error);
      } catch(cannot) {
        var stringified = 'typeof: ' + (typeof error) + '\n' + String(error);
      }
      error = { name: 'thrown_object', message: error.message || '(unknown)', stack: stringified};
      error_message = 'thrown_object'
    }
    var user_log_message = ' Please report errors above to tom@cryptup.org. I fix errors VERY promptly.';
    var ignored_errors = [
      'Invocation of form get(, function) doesn\'t match definition get(optional string or array or object keys, function callback)', // happens in gmail window when reloaded extension + now reloading gmail
      'Invocation of form set(, function) doesn\'t match definition set(object items, optional function callback)', // happens in gmail window when reloaded extension + now reloading gmail
      'Invocation of form runtime.connect(null, ) doesn\'t match definition runtime.connect(optional string extensionId, optional object connectInfo)',
    ];
    if(!error) {
      return;
    }
    if(ignored_errors.indexOf(error.message) !== -1) {
      return true;
    }
    if(error.stack) {
      console.log('%c[' + error_message + ']\n' + error.stack, 'color: #F00; font-weight: bold;');
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
        url: 'https://api.cryptup.io/help/error',
        method: 'POST',
        data: JSON.stringify({
          name: (error.name || '').substring(0, 50),
          message: (error_message || '').substring(0, 200),
          url: (url || '').substring(0, 100),
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
      if(typeof storage.get === 'function' && typeof storage.set === 'function') {
        tool.env.increment('error');
        storage.get(null, ['errors'], function (s) {
          if(typeof s.errors === 'undefined') {
            s.errors = [];
          }
          s.errors.unshift(error.stack || error_message);
          storage.set(null, s);
        });
      }
    } catch (storage_err) {
      console.log('failed to locally log error "' + String(error_message) + '" because: ' + storage_err.message);
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
      var matched = caller_line.match(/\.js:([0-9]+):([0-9]+)\)?/);
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

  function report(name, details) {
    try {
      throw new Error(name);
    } catch(e) {
      if(typeof details !== 'string') {
        try {
          details = JSON.stringify(details);
        } catch(stringify_error) {
          details = '(could not stringify details "' + String(details) + '" in catcher.report because: ' + stringify_error.message + ')';
        }
      }
      e.stack = e.stack + '\n\n\ndetails: ' + details;
      handle_exception(e);
    }
  }

  function log(name, details) {
    name = 'catcher.log: ' + name;
    console.log(name);
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
      try {
        storage.get(null, ['errors'], function (s) {
          if(typeof s.errors === 'undefined') {
            s.errors = [];
          }
          s.errors.unshift(e.stack || error_message);
          storage.set(null, s);
        });
      } catch (storage_err) {
        console.log('failed to locally log info "' + String(name) + '" because: ' + storage_err.message);
      }
    }
  }

  function promise_error_alert(note) {
    return function (error) {
      console.log(error);
      alert(note);
    };
  }

  function wrapped_Promise(f) {
    return new Promise(function(resolve, reject) {
      try {
        f(resolve, reject);
      } catch(e) {
        handle_exception(e);
        reject({code: null, message: 'Error happened, please write me at tom@cryptup.org to fix this\n\nError: ' + e.message, internal: 'exception'});
      }
    })
  }

  function environment(url) {
    if(!url) {
      url = window.location.href;
    }
    var browser_name = tool.env.browser().name;
    var env = 'unknown';
    if(url.indexOf('bnjglocicd') !== -1) {
      env = 'ex:prod';
    } else if(url.indexOf('nmelpmhpel') !== -1 || url.indexOf('blfdgihad') !== -1) {
      env = 'ex:dev';
    } else if(url.indexOf('himcfccebk') !== -1) {
      env = 'ex:test';
    } else if (url.indexOf('l.cryptup.org') !== -1 || url.indexOf('l.cryptup.io') !== -1) {
      env = 'web:local';
    } else if (url.indexOf('cryptup.org') !== -1 || url.indexOf('cryptup.io') !== -1) {
      env = 'web:prod';
    } else if (/chrome-extension:\/\/[a-z]{32}\/.+/.test(url)) {
      env = 'ex:fork';
    } else if (url.indexOf('mail.google.com') !== -1) {
      env = 'ex:script:gmail';
    } else if (url.indexOf('inbox.google.com') !== -1) {
      env = 'ex:script:inbox';
    } else if (/moz-extension:\/\/.+/.test(url)) {
      env = 'ex';
    }
    return browser_name + ':' + env;
  }

  function test() {
    this_will_fail();
  }

  function cryptup_version(format) {
    if(format === 'int') {
      return RUNTIME.version ? Number(RUNTIME.version.replace(/\./g, '')) : null;
    } else {
      return RUNTIME.version || null;
    }
  }

  function figure_out_cryptup_runtime() {
    if(window.is_bare_engine !== true) {
      try {
        RUNTIME.version = chrome.runtime.getManifest().version;
      } catch(err) {
      }
      RUNTIME.environment = environment();
      if(!tool.env.is_background_script() && tool.env.is_extension()) {
        tool.browser.message.send(null, 'runtime', null, function (extension_runtime) {
          if(typeof extension_runtime !== 'undefined') {
            RUNTIME = extension_runtime;
          } else {
            setTimeout(figure_out_cryptup_runtime, 200);
          }
        });
      }
    }
  }

  function produce_new_stack_trace() {
    try {
      test();
    } catch(e) {
      return e.stack.split('\n').splice(3).join('\n'); // return stack after removing first 3 lines
    }
  }

  var _c = { // web and extension code
    handle_error: handle_error,
    handle_exception: handle_exception,
    report: report,
    log: log,
    version: cryptup_version,
    try: try_wrapper,
    environment: environment,
    test: test,
    Promise: wrapped_Promise,
    promise_error_alert: promise_error_alert,
    stack_trace: produce_new_stack_trace,
  };

  if(window.is_bare_engine !== true) {
    window.catcher = _c;
  }

  if(typeof exports === 'object') {
    exports.catcher = _c;
  }

})();


(function ( /* EXTENSIONS AND CONFIG */ ) {

  if(typeof window.openpgp !== 'undefined' && typeof window.openpgp.config !== 'undefined' && typeof window.openpgp.config.versionstring !== 'undefined' && typeof window.openpgp.config.commentstring !== 'undefined') {
    window.openpgp.config.versionstring = 'CryptUp ' + (catcher.version() || '') + ' Gmail Encryption https://cryptup.org';
    window.openpgp.config.commentstring = 'Seamlessly send, receive and search encrypted email';
  }

  RegExp.escape = function (s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  };

  if(typeof $ === 'function') {
    $.fn.reverse = [].reverse;
  } else if(typeof jQuery === 'function') {
    jQuery.fn.reverse = [].reverse;
  }

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

  Promise.prototype.validate = Promise.prototype.validate || function(validity_checker) {
      var original_promise = this;
      return catcher.Promise(function(resolve, reject) {
        original_promise.then(function(response) {
          if(typeof response === 'object') {
            if(validity_checker(response)) {
              resolve(response);
            } else {
              reject({code: null, message: 'Could not validate result', internal: 'validate'});
            }
          } else {
            reject({code: null, message: 'Could not validate result: not an object', internal: 'validate'});
          }
        }, reject);
      });
    };

  Promise.prototype.done = Promise.prototype.done || function(next) {
      return this.then(function(x) {
        next(true, x);
      }, function(x) {
        next(false, x);
      });
    };

})();
