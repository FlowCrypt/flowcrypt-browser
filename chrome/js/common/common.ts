/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />
/// <reference path="common.d.ts" />
/// // <reference path="../../../node_modules/@types/openpgp/index.d.ts" />

'use strict';

declare let openpgp: any; // todo - how to make this understand openpgp types from above?
declare let $_HOST_html_to_text: (html: string) => string, MimeParser: any, MimeBuilder: any;
declare var require: any;
declare var exports: any;

class UnreportableError extends Error {
}

let tool = {
  str: {
    parse_email: (email_string: string) => {
      if(tool.value('<').in(email_string) && tool.value('>').in(email_string)) {
        return {
          email: email_string.substr(email_string.indexOf('<') + 1, email_string.indexOf('>') - email_string.indexOf('<') - 1).replace(/["']/g, '').trim().toLowerCase(),
          name: email_string.substr(0, email_string.indexOf('<')).replace(/["']/g, '').trim(),
          full: email_string,
        };
      }
      return {
        email: email_string.replace(/["']/g, '').trim().toLowerCase(),
        name: null,
        full: email_string,
      };
    },
    pretty_print: (obj: any) => (typeof obj === 'object') ? JSON.stringify(obj, null, 2).replace(/ /g, '&nbsp;').replace(/\n/g, '<br>') : String(obj),
    html_as_text: (html_text: string, callback: (t: string) => void) => {
      // extracts innerText from a html text in a safe way without executing any contained js
      // firefox does not preserve line breaks of iframe.contentDocument.body.innerText due to a bug - have to guess the newlines with regexes
      // this is still safe because Firefox does strip all other tags
      let br: string, block_start: string, block_end: string;
      if(tool.env.browser().name === 'firefox') {
        br = 'CU_BR_' + tool.str.random(5);
        block_start = 'CU_BS_' + tool.str.random(5);
        block_end = 'CU_BE_' + tool.str.random(5);
        html_text = html_text.replace(/<br[^>]*>/gi, br);
        html_text = html_text.replace(/<\/(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, block_end);
        html_text = html_text.replace(/<(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, block_start);
      }
      let e = document.createElement('iframe');
      (e as any).sandbox = 'allow-same-origin';
      e.srcdoc = html_text;
      e.style['display'] = 'none';
      e.onload = function() {
        if(e.contentDocument === null) {
          tool.catch.report('e.contentDocument null');
          return;
        }
        let text = e.contentDocument.body.innerText;
        if(tool.env.browser().name === 'firefox') {
          text = text.replace(RegExp('(' + block_start + ')+', 'g'), block_start).replace(RegExp('(' + block_end + ')+', 'g'), block_end);
          text = text.split(block_end + block_start).join(br).split(br + block_end).join(br);
          text = text.split(br).join('\n').split(block_start).filter(function(v){return !!v}).join('\n').split(block_end).filter(function(v){return !!v}).join('\n');
          text = text.replace(/\n{2,}/g, '\n\n');
        }
        callback(text.trim());
        document.body.removeChild(e);
      };
      document.body.appendChild(e);
    },
    normalize_spaces: (str: string) =>  str.replace(RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32)).replace(/\n /g, '\n'),
    number_format: (number: number) => { // http://stackoverflow.com/questions/3753483/javascript-thousand-separator-string-format
      let nStr: string = number + '';
      let x = nStr.split('.');
      let x1 = x[0];
      let x2 = x.length > 1 ? '.' + x[1] : '';
      let rgx = /(\d+)(\d{3})/;
      while(rgx.test(x1)) {
        x1 = x1.replace(rgx, '$1' + ',' + '$2');
      }
      return x1 + x2;
    },
    is_email_valid: (email: string) => /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i.test(email),
    month_name: (month_index: number) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month_index],
    random: (length:number=5) => {
      let id = '';
      let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      for(let i = 0; i < length; i++) {
        id += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      return id;
    },
    html_attribute_encode: (values: object): string => tool._.str_base64url_utf_encode(JSON.stringify(values)),
    html_attribute_decode: (encoded: string): object => JSON.parse(tool._.str_base64url_utf_decode(encoded)),
    html_escape: (str: string) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;'), // http://stackoverflow.com/questions/1219860/html-encoding-lost-when-attribute-read-from-input-field
    html_unescape: (str: string) => str.replace(/&#x2F;/g, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
    as_safe_html: (text_or_html: string, callback: (t: string) => void) => {
      let nl = '_cryptup_newline_placeholder_' + tool.str.random(3) + '_';
      tool.str.html_as_text(text_or_html.replace(/<br ?\/?> ?\r?\n/gm, nl).replace(/\r?\n/gm, nl).replace(/</g, '&lt;').replace(RegExp(nl, 'g'), '<br>'), (plain) => {
        callback(plain.trim().replace(/</g, '&lt;').replace(/\n/g, '<br>').replace(/ {2,}/g, (spaces) => '&nbsp;'.repeat(spaces.length)));
      });
    },
    base64url_encode: (str: string) => (typeof str === 'undefined') ? str : btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), // used for 3rd party API calls - do not change w/o testing Gmail api attachments
    base64url_decode: (str: string) => (typeof str === 'undefined') ? str : atob(str.replace(/-/g, '+').replace(/_/g, '/')), // used for 3rd party API calls - do not change w/o testing Gmail api attachments
    from_uint8: (u8a: Uint8Array): string =>{
      let CHUNK_SZ = 0x8000;
      let c = [];
      for(let i = 0; i < u8a.length; i += CHUNK_SZ) {
        c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
      }
      return c.join('');
    },
    to_uint8: (raw: string): Uint8Array => {
      let rawLength = raw.length;
      let uint8 = new Uint8Array(new ArrayBuffer(rawLength));
      for(let i = 0; i < rawLength; i++) {
        uint8[i] = raw.charCodeAt(i);
      }
      return uint8;
    },
    from_equal_sign_notation_as_utf: (str: string): string => {
      return str.replace(/(=[A-F0-9]{2})+/g, function (equal_sign_utf_part) {
        return tool.str.uint8_as_utf(equal_sign_utf_part.replace(/^=/, '').split('=').map((two_hex_digits) => parseInt(two_hex_digits, 16)));
      });
    },
    uint8_as_utf: (a: Uint8Array|number[]) => { //tom
      let length = a.length;
      let bytes_left_in_char = 0;
      let utf8_string = '';
      let binary_char = '';
      for(let i = 0; i < length; i++) {
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
              console.log('tool.str.uint8_as_utf: invalid utf-8 character beginning byte: ' + a[i]);
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
    },
    to_hex: (s: string): string => { // http://phpjs.org/functions/bin2hex/, Kevin van Zonneveld (http://kevin.vanzonneveld.net), Onno Marsman, Linuxworld, ntoniazzi
      let i, l, o = '', n;
      s += '';
      for(i = 0, l = s.length; i < l; i++) {
        n = s.charCodeAt(i).toString(16);
        o += n.length < 2 ? '0' + n : n;
      }
      return o;
    },
    from_hex: (hex: string): string => {
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        let v = parseInt(hex.substr(i, 2), 16);
        if (v) str += String.fromCharCode(v);
      }
      return str;
    },
    extract_cryptup_attachments: (decrypted_content: string, cryptup_attachments: Attachment[]) => {
      if(tool.value('cryptup_file').in(decrypted_content)) {
        decrypted_content = decrypted_content.replace(/<a[^>]+class="cryptup_file"[^>]+>[^<]+<\/a>/g, function (found_link) {
          let element = $(found_link);
          let cryptup_data = element.attr('cryptup-data');
          if(cryptup_data) {
            let attachment_data = tool.str.html_attribute_decode(cryptup_data) as Attachment;
            cryptup_attachments.push(tool.file.attachment(attachment_data.name, attachment_data.type, null, attachment_data.size, element.attr('href')));  
          }
          return '';
        });
      }
      return decrypted_content;
    },
    extract_cryptup_reply_token: (decrypted_content: string) => {
      let cryptup_token_element = $(tool.e('div', {html: decrypted_content})).find('.cryptup_reply');
      if(cryptup_token_element.length) {
        let cryptup_data = cryptup_token_element.attr('cryptup-data');
        if(cryptup_data) {
          return tool.str.html_attribute_decode(cryptup_data);
        }
      }
    },
    strip_cryptup_reply_token: (decrypted_content: string) => decrypted_content.replace(/<div[^>]+class="cryptup_reply"[^>]+><\/div>/, ''),
    strip_public_keys: (decrypted_content: string, found_public_keys: string[]) => {
      decrypted_content = tool.str.normalize_spaces(decrypted_content);
      for(let block of tool.crypto.armor.detect_blocks(decrypted_content)) {
        if(block.type === 'public_key') {
          found_public_keys.push(block.content);
          decrypted_content = decrypted_content.replace(block.content, '');
        }
      }
      return decrypted_content;
    },
    int_to_hex: (int_as_string: string|number): string => { // http://stackoverflow.com/questions/18626844/convert-a-large-integer-to-a-hex-string-in-javascript (Collin Anderson)
      let dec = int_as_string.toString().split(''), sum = [], hex = [], i, s;
      while(dec.length) {
        s = Number(dec.shift());
        for(i = 0; s || i < sum.length; i++){
          s += (sum[i] || 0) * 10;
          sum[i] = s % 16;
          s = (s - sum[i]) / 16;
        }
      }
      while(sum.length){
        hex.push(sum.pop()!.toString(16));
      }
      return hex.join('');
    },
    capitalize: (string: string): string => {
      return string.trim().split(' ').map(function(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
      }).join(' ');
    },
  },
  env: {
    browser: () => {  // http://stackoverflow.com/questions/4825498/how-can-i-find-out-which-browser-a-user-is-using
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
    },
    runtime_id: (original=false) => {
      if(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        if(original === true) {
          return chrome.runtime.id;
        } else {
          return chrome.runtime.id.replace(/[^a-z0-9]/gi, '');
        }
      }
      return null;
    },
    is_background_script: () => Boolean(window.location && tool.value('_generated_background_page.html').in(window.location.href)),
    is_extension: () => tool.env.runtime_id() !== null,
    url_params: (expected_keys: string[], string:string|null=null) => {
      let url = (string || window.location.search.replace('?', ''));
      let value_pairs = url.split('?').pop()!.split('&'); // str.split('?') string[].length will always be >= 1
      let url_data: UrlParams = {};
      for(let value_pair of value_pairs) {
        let pair = value_pair.split('=');
        if(tool.value(pair[0]).in(expected_keys)) {
          url_data[pair[0]] = typeof tool._.var.env_url_param_DICT[pair[1]] !== 'undefined' ? tool._.var.env_url_param_DICT[pair[1]] : decodeURIComponent(pair[1]);
        }
      }
      return url_data;
    },
    url_create: (link: string, params: UrlParams) => {
      for(let key of Object.keys(params)) {
        let value = params[key];
        if(typeof value !== 'undefined') {
          let transformed = tool.obj.key_by_value(tool._.var.env_url_param_DICT, value);
          link += (!tool.value('?').in(link) ? '?' : '&') + key + '=' + encodeURIComponent(String(typeof transformed !== 'undefined' ? transformed : value));
        }
      }
      return link;
    },
    key_codes: () => ({ a: 97, r: 114, A: 65, R: 82, f: 102, F: 70, backspace: 8, tab: 9, enter: 13, comma: 188, }),
    require: (lib_name: 'emailjs-mime-codec'): Promise<any> => {
      return new Promise(resolve => {
        tool.env.set_up_require();
        require([lib_name], resolve);
      });
    },
    set_up_require: () => {
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
    },
    webmails: (cb: (wm: string[]) => void): void => {
      cb(['gmail', 'inbox']);
    },
  },
  arr: {
    unique: (array: any[]) => {
      let unique:any[] = [];
      for(let v of array) {
        if(!tool.value(v).in(unique)) {
          unique.push(v);
        }
      }
      return unique;
    },
    from_dom_node_list: (obj: NodeList|JQuery<HTMLElement>): Node[] => { // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
      let array = [];
      for(let i = obj.length >>> 0; i--;) { // iterate backwards ensuring that length is an UInt32
        array[i] = obj[i];
      }
      return array;
    },
    without_key: (array: any[], i: number) => array.splice(0, i).concat(array.splice(i + 1, array.length)),
    without_value: (array: any[], without_value: any) => {
      let result: any[] = [];
      for(let value of array) {
        if(value !== without_value) {
          result.push(value);
        }
      }
      return result;
    },
    contains: (arr: any[]|string, value: any): boolean => Boolean(arr && typeof arr.indexOf === 'function' && (arr as any[]).indexOf(value) !== -1),
    sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
    average: (arr: number[]) => tool.arr.sum(arr) / arr.length,
    zeroes: (length: number): number[] => new Array(length).map(() => 0),
  },
  obj: {
    key_by_value: (obj: Dict<any>, v: any) => {
      for(let k in obj) {
        if(obj.hasOwnProperty(k) && obj[k] === v) {
          return k;
        }
      }
    },
  },
  int: {
    random: (min_value: number, max_value: number) => min_value + Math.round(Math.random() * (max_value - min_value)),
  },
  time: {
    wait: (until_this_function_evaluates_true: () => boolean|undefined): FcPromise<void> => {
      return tool.catch.Promise(function (success, error) {
        let interval = setInterval(function () {
          let result = until_this_function_evaluates_true();
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
    },
    get_future_timestamp_in_months: (months_to_add: number) => new Date().getTime() + 1000 * 3600 * 24 * 30 * months_to_add,
    hours: (h: number) =>  h * 1000 * 60 * 60, // hours in miliseconds
    expiration_format: (date: string) => tool.str.html_escape(date.substr(0, 10)),
    to_utc_timestamp: (datetime_string: string, as_string:boolean=false) => as_string ? String(Date.parse(datetime_string)) : Date.parse(datetime_string),
  },
  file: {
    object_url_create: (content: Uint8Array|string) => window.URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' })),
    object_url_consume: (url: string) => {
      return tool.catch.Promise(function(resolve, reject) {
        tool.file.download_as_uint8(url, null, function (success, uint8) {
          window.URL.revokeObjectURL(url);
          if(success) {
            resolve(uint8);
          } else {
            reject({error: 'could not consume object url', detail: url});
          }
        });
      });
    },
    download_as_uint8: (url: string, progress:ApiCallProgressCallback|null=null, callback: (success: boolean, uint8: Uint8Array|ErrorEvent) => void) => {
      let request = new XMLHttpRequest();
      request.open('GET', url, true);
      request.responseType = 'arraybuffer';
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
    },
    save_to_downloads: (name: string, type: string, content: Uint8Array|string|Blob, render_in:JQuery<HTMLElement>|null=null) => {
      let blob = new Blob([content], { type: type });
      if(window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, name);
      } else {
        let a = window.document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = name;
        if(render_in) {
          a.textContent = 'DECRYPTED FILE';
          a.style.cssText = 'font-size: 16px; font-weight: bold;';
          render_in.html('<div style="font-size: 16px;padding: 17px 0;">File is ready.<br>Right-click the link and select <b>Save Link As</b></div>');
          render_in.append(a);
          render_in.css('height', 'auto');
          render_in.find('a').click(function (e) {
            alert('Please use right-click and select Save Link As');
            e.preventDefault();
            e.stopPropagation();
            return false;
          });
        } else {
          if(typeof a.click === 'function') {
            a.click();
          } else { // safari
            let e = document.createEvent('MouseEvents');
            // @ts-ignore - safari only. expected 15 arguments, but works well with 4
            e.initMouseEvent('click', true, true, window);
            a.dispatchEvent(e);
          }
          if(tool.env.browser().name === 'firefox') {
            try {
              document.body.removeChild(a);
            } catch(err) {
              if(err.message !== 'Node was not found') {
                throw err;
              }
            }
          }
          setTimeout(function () {
            window.URL.revokeObjectURL(a.href);
          }, 0);
        }
      }
    },
    attachment: (name='', type='application/octet-stream', content: string|Uint8Array|null, size:number|null=null, url:string|null=null): Attachment => { // todo - refactor as (content, name, type, LENGTH, url), making all but content voluntary
      // todo: accept any type of content, then add getters for content(str, uint8, blob) and fetch(), also size('formatted')
      return {name: name, type: type, content: content, size: size || (content || '').length, url: url};
    },
    pgp_name_patterns: () => ['*.pgp', '*.gpg', '*.asc', 'noname', 'message', 'PGPMIME version identification', ''],
    keyinfo_as_pubkey_attachment: (ki: KeyInfo) => tool.file.attachment(`0x${ki.longid}.asc`, 'application/pgp-keys', ki.public),
    treat_as: (attachment: Attachment) => {
      if(tool.value(attachment.name).in(['PGPexch.htm.pgp', 'PGPMIME version identification'])) {
        return 'hidden';  // PGPexch.htm.pgp is html alternative of textual body content produced by PGP Desktop and GPG4o
      } else if(attachment.name === 'signature.asc' || attachment.type === 'application/pgp-signature') {
        return  'signature';
      } else if(!attachment.name && !tool.value('image/').in(attachment.type)) { // attachment.name may be '' or undefined - catch either
        return attachment.size < 100 ? 'hidden' : 'message';
      } else if(tool.value(attachment.name).in(['message', 'message.asc', 'encrypted.asc', 'encrypted.eml.pgp'])) {
        return 'message';
      } else if(attachment.name.match(/(\.pgp$)|(\.gpg$)|(\.[a-zA-Z0-9]{3,4}\.asc$)/g)) { // ends with one of .gpg, .pgp, .???.asc, .????.asc
        return 'encrypted';
      } else if(attachment.name.match(/^(0|0x)?[A-F0-9]{8}([A-F0-9]{8})?.*\.asc$/g)) { // name starts with a key id
        return 'public_key';
      } else if(tool.value('public').in(attachment.name.toLowerCase()) && attachment.name.match(/[A-F0-9]{8}.*\.asc$/g)) { // name contains the word "public", any key id and ends with .asc
        return 'public_key';
      } else if(attachment.name.match(/\.asc$/) && attachment.size < 100000 && !attachment.inline) {
        return 'message';
      } else {
        return 'standard';
      }
    },
  },
  mime: {
    process: (mime_message: string, callback: (processed: MimeAsHeadersAndBlocks) => void) => {
      tool.mime.decode(mime_message, function (success, decoded) {
        if(typeof decoded.text === 'undefined' && typeof decoded.html !== 'undefined' && typeof $_HOST_html_to_text === 'function') { // android
          decoded.text = $_HOST_html_to_text(decoded.html); // temporary solution
        }
        let blocks: MessageBlock[] = [];
        if(decoded.text) {  // may be undefined or empty
          blocks = blocks.concat(tool.crypto.armor.detect_blocks(decoded.text));
        }
        for(let file of decoded.attachments) {
          let treat_as = tool.file.treat_as(file);
          if(treat_as === 'message') {
            let armored = tool.crypto.armor.clip(file.content as string); // todo - what if file.content is uint8?
            if(armored) {
              blocks.push(tool._.crypto_armor_block_object('message', armored));
            }
          } else if(treat_as === 'signature') {
            decoded.signature = decoded.signature || file.content as string; // todo - what if file.content is uint8?
          } else if(treat_as === 'public_key') {
            blocks = blocks.concat(tool.crypto.armor.detect_blocks(file.content as string)); // todo - what if file.content is uint8?
          }
        }
        if(decoded.signature) {
          for(let block of blocks) {
            if(block.type === 'text') {
              block.type = 'signed_message';
              block.signature = decoded.signature;
              return false;
            }
          }
        }
        callback({headers: decoded.headers, blocks: blocks});
      });
    },
    headers_to_from: (parsed_mime_message: MimeContent): FromToHeaders => {
      let header_to: string[] = [];
      let header_from;
      // @ts-ignore - I should check this - does it really have .address?
      if(parsed_mime_message.headers.from && parsed_mime_message.headers.from.length && parsed_mime_message.headers.from[0] && parsed_mime_message.headers.from[0].address) {
        // @ts-ignore - I should check this - does it really have .address?
        header_from = parsed_mime_message.headers.from[0].address;
      }
      if(parsed_mime_message.headers.to && parsed_mime_message.headers.to.length) {
        for(let to of parsed_mime_message.headers.to) {
          // @ts-ignore - I should check this - does it really have .address?
          if(to.address) {
            // @ts-ignore - I should check this - does it really have .address?
            header_to.push(to.address);
          }
        }
      }
      return { from: header_from, to: header_to };
    },
    reply_headers: (parsed_mime_message: MimeContent) => {
      let message_id = parsed_mime_message.headers['message-id'] || '';
      let references = parsed_mime_message.headers['in-reply-to'] || '';
      return { 'in-reply-to': message_id, 'references': references + ' ' + message_id };
    },
    resembles_message: (message: string|Uint8Array) => {
      let m = message.slice(0, 1000);
      // noinspection SuspiciousInstanceOfGuard
      if(m instanceof Uint8Array) {
        m = tool.str.from_uint8(m);
      }
      m = m.toLowerCase();
      let contentType = m.match(/content-type: +[0-9a-z\-\/]+/);
      if(contentType === null) {
        return false;
      }
      if(m.match(/content-transfer-encoding: +[0-9a-z\-\/]+/) || m.match(/content-disposition: +[0-9a-z\-\/]+/) || m.match(/; boundary=/) || m.match(/; charset=/)) {
        return true;
      }
      return Boolean(contentType.index === 0 && m.match(/boundary=/));
    },
    format_content_to_display: (text: string, full_mime_message: string) => {
      // todo - this function is very confusing, and should be split into two:
      // ---> format_mime_plaintext_to_display(text, charset)
      // ---> get_charset(full_mime_message)
      if(/<((br)|(div)|p) ?\/?>/.test(text)) {
        return text;
      }
      text = (text || '').replace(/\r?\n/g, '<br>\n');

      if(text && full_mime_message && full_mime_message.match(/^Charset: iso-8859-2/m) !== null) {
        return (window as FcWindow).iso88592.decode(text);  // todo - use iso88592.labels for detection
      }

      let chunk = text.substring(0, 1000).split('');
      let c_cross_d = chunk.filter(c => c === 'Ð').length;
      let c_confirm = chunk.filter(c => 'Ñ²¸»'.indexOf(c) !== -1).length;
      if(chunk && c_cross_d > 1 && c_cross_d / chunk.length > 0.02 && c_confirm / chunk.length > 0.01) {
        // guessed based on the test above that the text needs to be explicitly decoded as utf8 to become utf string
        return tool.str.uint8_as_utf(tool.str.to_uint8(text));
      }

      return text;
    },
    decode: (mime_message: string, callback: (success: boolean, decoded: MimeContent) => void) => {
      let mime_content = {attachments: [], headers: {} as FlatHeaders, text: undefined, html: undefined, signature: undefined} as MimeContent;
      tool._.mime_require('parser', function (emailjs_mime_parser: any) {
        try {
          let parser = new emailjs_mime_parser();
          let parsed: {[key: string]: MimeParserNode} = {};
          parser.onheader = function (node: MimeParserNode) {
            if(!String(node.path.join('.'))) { // root node headers
              for(let name of Object.keys(node.headers)) {
                mime_content.headers[name] = node.headers[name][0].value;
              }
            }
          };
          parser.onbody = function (node: MimeParserNode) {
            let path = String(node.path.join('.'));
            if(typeof parsed[path] === 'undefined') {
              parsed[path] = node;
            }
          };
          parser.onend = function () {
            for(let node of Object.values(parsed)) {
              if(tool._.mime_node_type(node) === 'application/pgp-signature') {
                mime_content.signature = node.rawContent;
              } else if(tool._.mime_node_type(node) === 'text/html' && !tool._.mime_node_filename(node)) {
                mime_content.html = node.rawContent;
              } else if(tool._.mime_node_type(node) === 'text/plain' && !tool._.mime_node_filename(node)) {
                mime_content.text = node.rawContent;
              } else {
                let node_content = tool.str.from_uint8(node.content);
                mime_content.attachments.push(tool.file.attachment(tool._.mime_node_filename(node), tool._.mime_node_type(node), node_content));
              }
            }
            tool.catch.try(() => callback(true, mime_content))();
          };
          parser.write(mime_message); //todo - better chunk it for very big messages containing attachments? research
          parser.end();
        } catch(e) {
          tool.catch.handle_exception(e);
          tool.catch.try(() => callback(false, mime_content))();
        }
      });
    },
    encode: (body:string|SendableMessageBody, headers: RichHeaders, attachments:Attachment[]=[], mime_message_callback: (mime_message: string) => void) => {
      tool._.mime_require('builder', function (MimeBuilder: any) {
        let root_node = new MimeBuilder('multipart/mixed');
        for(let key of Object.keys(headers)) {
          root_node.addHeader(key, headers[key]);
        }
        if(typeof body === 'string') {
          body = {'text/plain': body};
        }
        let content_node: MimeParserNode;
        if(Object.keys(body).length === 1) {
          content_node = tool._.mime_content_node(MimeBuilder, Object.keys(body)[0], body[Object.keys(body)[0] as "text/plain"|"text/html"] || '');
        } else {
          content_node = new MimeBuilder('multipart/alternative');
          for(let type of Object.keys(body)) {
            content_node.appendChild(tool._.mime_content_node(MimeBuilder, type, body[type]!)); // already present, that's why part of for loop
          }
        }
        root_node.appendChild(content_node);
        for(let attachment of attachments) {
          root_node.appendChild(new MimeBuilder(attachment.type + '; name="' + attachment.name + '"', { filename: attachment.name }).setHeader({
            'Content-Disposition': 'attachment',
            'X-Attachment-Id': 'f_' + tool.str.random(10),
            'Content-Transfer-Encoding': 'base64',
          }).setContent(attachment.content));
        }
        mime_message_callback(root_node.build());
      });
    },
    signed: (mime_message: string) => {
      /*
        Trying to grab the full signed content that may look like this in its entirety (it's a signed mime message. May also be signed plain text)
        Unfortunately, emailjs-mime-parser was not able to do this, or I wasn't able to use it properly
  
        --eSmP07Gus5SkSc9vNmF4C0AutMibfplSQ
        Content-Type: multipart/mixed; boundary="XKKJ27hlkua53SDqH7d1IqvElFHJROQA1"
        From: Henry Electrum <henry.electrum@gmail.com>
        To: human@flowcrypt.com
        Message-ID: <abd68ba1-35c3-ee8a-0d60-0319c608d56b@gmail.com>
        Subject: compatibility - simples signed email
  
        --XKKJ27hlkua53SDqH7d1IqvElFHJROQA1
        Content-Type: text/plain; charset=utf-8
        Content-Transfer-Encoding: quoted-printable
  
        content
  
        --XKKJ27hlkua53SDqH7d1IqvElFHJROQA1--
        */
      let signed_header_index = mime_message.substr(0, 100000).toLowerCase().indexOf('content-type: multipart/signed');
      if(signed_header_index !== -1) {
        mime_message = mime_message.substr(signed_header_index);
        let first_boundary_index = mime_message.substr(0, 1000).toLowerCase().indexOf('boundary=');
        if(first_boundary_index) {
          let boundary = mime_message.substr(first_boundary_index, 100);
          boundary = (boundary.match(/boundary="[^"]{1,70}"/gi) || boundary.match(/boundary=[a-z0-9][a-z0-9 ]{0,68}[a-z0-9]/gi) || [])[0];
          if(boundary) {
            boundary = boundary.replace(/^boundary="?|"$/gi, '');
            let boundary_begin = '\r\n--' + boundary + '\r\n';
            let boundary_end = '--' + boundary + '--';
            let end_index = mime_message.indexOf(boundary_end);
            if(end_index !== -1) {
              mime_message = mime_message.substr(0, end_index + boundary_end.length);
              if(mime_message) {
                let result = { full: mime_message, signed: null as string|null, signature: null as string|null };
                let first_part_start_index = mime_message.indexOf(boundary_begin);
                if(first_part_start_index !== -1) {
                  first_part_start_index += boundary_begin.length;
                  let first_part_end_index = mime_message.indexOf(boundary_begin, first_part_start_index);
                  let second_part_start_index = first_part_end_index + boundary_begin.length;
                  let second_part_end_index = mime_message.indexOf(boundary_end, second_part_start_index);
                  if(second_part_end_index !== -1) {
                    let first_part = mime_message.substr(first_part_start_index, first_part_end_index - first_part_start_index);
                    let second_part = mime_message.substr(second_part_start_index, second_part_end_index - second_part_start_index);
                    if(first_part.match(/^content-type: application\/pgp-signature/gi) !== null && tool.value('-----BEGIN PGP SIGNATURE-----').in(first_part) && tool.value('-----END PGP SIGNATURE-----').in(first_part)) {
                      result.signature = tool.crypto.armor.clip(first_part);
                      result.signed = second_part;
                    } else {
                      result.signature = tool.crypto.armor.clip(second_part);
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
    },
  },
  diagnose: {
    message_pubkeys: async (account_email: string, message: string|Uint8Array|OpenpgpMessage): Promise<DiagnoseMessagePubkeysResult> => {
      if(typeof message === 'string') {
        message = openpgp.message.readArmored(message);
      } else if(message instanceof Uint8Array) {
        message = openpgp.message.readArmored(tool.str.from_uint8(message));
      }
      message = <OpenpgpMessage>message;
      let message_key_ids = message.getEncryptionKeyIds ? message.getEncryptionKeyIds() : [];
      let private_keys = await Store.keys_get(account_email);
      let local_key_ids = [].concat.apply([], private_keys.map(ki => ki.public).map(tool._.crypto_key_ids));
      let diagnosis = { found_match: false, receivers: message_key_ids.length };
      for(let msg_k_id of message_key_ids) {
        for(let local_k_id of local_key_ids) {
          if(msg_k_id === local_k_id) {
            diagnosis.found_match = true;
            return diagnosis;
          }
        }
      }
      return diagnosis;
    },
  },
  crypto: {
    armor: {
      strip: (pgp_block_text: string) => {
        if(!pgp_block_text) {
          return pgp_block_text;
        }
        let debug = false;
        if(debug) {
          console.log('pgp_block_1');
          console.log(pgp_block_text);
        }
        let newlines = [/<div><br><\/div>/g, /<\/div><div>/g, /<[bB][rR]( [a-zA-Z]+="[^"]*")* ?\/? ?>/g, /<div ?\/?>/g];
        let spaces = [/&nbsp;/g];
        let removes = [/<wbr ?\/?>/g, /<\/?div>/g];
        for(let newline of newlines) {
          pgp_block_text = pgp_block_text.replace(newline, '\n');
        }
        if(debug) {
          console.log('pgp_block_2');
          console.log(pgp_block_text);
        }
        for(let remove of removes) {
          pgp_block_text = pgp_block_text.replace(remove, '');
        }
        if(debug) {
          console.log('pgp_block_3');
          console.log(pgp_block_text);
        }
        for(let space of spaces) {
          pgp_block_text = pgp_block_text.replace(space, ' ');
        }
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
        let double_newlines = pgp_block_text.match(/\n\n/g);
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
      },
      clip: (text: string) => {
        if(text && tool.value(tool._.var.crypto_armor_headers_DICT['null'].begin).in(text) && tool.value(tool._.var.crypto_armor_headers_DICT['null'].end as string).in(text)) {
          let match = text.match(/(-----BEGIN PGP (MESSAGE|SIGNED MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----[^]+-----END PGP (MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----)/gm);
          return(match !== null && match.length) ? match[0] : null;
        }
        return null;
      },
      headers: (block_type: ReplaceableMessageBlockType|'null', format='string'): CryptoArmorHeaderDefinition => {
        let h = tool._.var.crypto_armor_headers_DICT[block_type];
        return {
          begin: (typeof h.begin === 'string' && format === 're') ? h.begin.replace(/ /g, '\\\s') : h.begin,
          end: (typeof h.end === 'string' && format === 're') ? h.end.replace(/ /g, '\\\s') : h.end,
          replace: h.replace,
        };
      },
      detect_blocks: (original_text: string) => {
        let blocks: MessageBlock[] = [];
        original_text = tool.str.normalize_spaces(original_text);
        let start_at = 0;
        while(true) {
          let r = tool._.crypto_armor_detect_block_next(original_text, start_at);
          if(r.found) {
            blocks = blocks.concat(r.found);
          }
          if(r.continue_at === null) {
            return blocks;
          } else {
            if(r.continue_at <= start_at) {
              tool.catch.report(`tool.crypto.armor.detect_blocks likely infinite loop: r.continue_at(${r.continue_at}) <= start_at(${start_at})`);
              return blocks; // prevent infinite loop
            }
            start_at = r.continue_at;
          }
        }
      },
      replace_blocks: (factory: Factory, original_text: string, message_id:string|null=null, sender_email:string|null=null, is_outgoing: boolean|null=null) => {
        let blocks = tool.crypto.armor.detect_blocks(original_text);
        if(blocks.length === 1 && blocks[0].type === 'text') {
          return;
        }
        let r = '';
        for(let i in blocks) {
          if(blocks[i].type === 'text' || blocks[i].type === 'private_key') {
            r += (Number(i) ? '\n\n' : '') + tool.str.html_escape(blocks[i].content) + '\n\n';
          } else if (blocks[i].type === 'message') {
            r += factory.embedded_message(blocks[i].complete ? tool.crypto.armor.normalize(blocks[i].content, 'message') : '', message_id, is_outgoing, sender_email, false);
          } else if (blocks[i].type === 'signed_message') {
            r += factory.embedded_message(blocks[i].content, message_id, is_outgoing, sender_email, false);
          } else if (blocks[i].type === 'public_key') {
            // noinspection TypeScriptValidateJSTypes
            r += factory.embedded_pubkey(tool.crypto.armor.normalize(blocks[i].content, 'public_key'), is_outgoing);
          } else if (blocks[i].type === 'password_message') {
            r += factory.embedded_message('', message_id, is_outgoing, sender_email, true, null, blocks[i].content); // here blocks[i].content is message short id
          } else if (blocks[i].type === 'attest_packet') {
            // todo - find out why
            // noinspection TypeScriptValidateJSTypes
            r += factory.embedded_attest(blocks[i].content);
          } else if (blocks[i].type === 'cryptup_verification') {
            r += factory.embedded_verification(blocks[i].content);
          } else {
            tool.catch.report('dunno how to process block type: ' + blocks[i].type);
          }
        }
        return r;
      },
      normalize: (armored: string, type:string) => {
        if(tool.value(type).in(['message', 'public_key', 'private_key', 'key'])) {
          armored = armored.replace(/\r?\n/g, '\n').trim();
          let nl_2 = armored.match(/\n\n/g);
          let nl_3 = armored.match(/\n\n\n/g);
          let nl_4 = armored.match(/\n\n\n\n/g);
          let nl_6 = armored.match(/\n\n\n\n\n\n/g);
          if (nl_3 && nl_6 && nl_3.length > 1 && nl_6.length === 1) {
            return armored.replace(/\n\n\n/g, '\n'); // newlines tripled: fix
          } else if(nl_2 && nl_4 && nl_2.length > 1 && nl_4.length === 1) {
            return armored.replace(/\n\n/g, '\n'); // newlines doubled.GPA on windows does this, and sometimes message can get extracted this way from html
          }
          return armored;
        } else {
          return armored;
        }
      },
    },
    hash: {
      sha1: (string: string) => tool.str.to_hex(tool.str.from_uint8(openpgp.crypto.hash.sha1(string))),
      double_sha1_upper: (string: string) => tool.crypto.hash.sha1(tool.crypto.hash.sha1(string)).toUpperCase(),
      sha256: (string: string) => tool.str.to_hex(tool.str.from_uint8(openpgp.crypto.hash.sha256(string))),
      challenge_answer: (answer: string) => tool._.crypto_hash_sha256_loop(answer),
    },
    key: {
      create: (user_ids_as_pgp_contacts: Contact[], num_bits: 4096, pass_phrase: string, callback: (pk: string) => void) => {
        openpgp.generateKey({
          numBits: num_bits,
          userIds: user_ids_as_pgp_contacts,
          passphrase: pass_phrase,
        }).then(function(key: any) {
          callback(key.privateKeyArmored);
        }).catch(function(error: Error) {
          tool.catch.handle_exception(error);
        });
      },
      read: (armored_key: string) => openpgp.key.readArmored(armored_key).keys[0],
      decrypt: (prv: OpenpgpKey, passphrase: string): {success: boolean, error?: string} => {
        try {
          return {success: prv.decrypt(passphrase)};
        } catch(primary_e) {
          if(!tool.value(primary_e.message).in(['Unknown s2k type.', 'Invalid enum value.'])) {
            return {success: false, error: 'primary decrypt error: "' + primary_e.message + '"'}; // unknown exception for master key
          } else if(prv.subKeys !== null && prv.subKeys.length) {
            let subkes_succeeded = 0;
            let subkeys_unusable = 0;
            let unknown_exception: Error;
            for(let subkey of prv.subKeys) {
              try {
                subkes_succeeded += subkey.subKey.decrypt(passphrase);
              } catch(subkey_e) {
                subkeys_unusable++;
                if(!tool.value(subkey_e.message).in(['Key packet is required for this signature.', 'Unknown s2k type.', 'Invalid enum value.'])) {
                  return {success: false, error: 'subkey decrypt error: "' + subkey_e.message + '"'};
                }
              }
            }
            return {success: subkes_succeeded > 0 && (subkes_succeeded + subkeys_unusable) === prv.subKeys.length};
          } else {
            return {success: false, error: 'primary decrypt error and no subkeys to try: "' + primary_e.message + '"'};
          }
        }
      },
      expired_for_encryption: (key: OpenpgpKey) => {
        if(key.getEncryptionKeyPacket() !== null) {
          return false;
        }
        if(key.verifyPrimaryKey() === openpgp.enums.keyStatus.expired) {
          return true;
        }
        let found_expired_subkey = false;
        for(let sub_key of key.subKeys || []) {
          if(sub_key.verify(key.primaryKey) === openpgp.enums.keyStatus.expired && sub_key.isValidEncryptionKey(key.primaryKey)) {
            found_expired_subkey = true;
            return false;
          }
        }
        return found_expired_subkey; // todo - shouldn't we be checking that ALL subkeys are either invalid or expired to declare a key expired?
      },
      normalize: (armored: string) => {
        try {
          armored = tool.crypto.armor.normalize(armored, 'key');
          let key: OpenpgpKey|undefined = undefined;
          if(RegExp(tool.crypto.armor.headers('public_key', 're').begin).test(armored)) {
            key = openpgp.key.readArmored(armored).keys[0];
          } else if(RegExp(tool.crypto.armor.headers('message', 're').begin).test(armored)) {
            key = openpgp.key.Key(openpgp.message.readArmored(armored).packets);
          }
          if(key) {
            return key.armor();
          } else {
            return armored;
          }
        } catch(error) {
          tool.catch.handle_exception(error);
        }
      },
      fingerprint: (key: OpenpgpKey|string, formatting:"default"|"spaced"='default'): string|null => {
        if(key === null || typeof key === 'undefined') {
          return null;
        } else if(typeof key !== 'string' && typeof key.primaryKey !== 'undefined') {
          if(key.primaryKey.fingerprint === null) {
            return null;
          }
          try {
            let fp = key.primaryKey.fingerprint.toUpperCase();
            if(formatting === 'spaced') {
              return fp.replace(/(.{4})/g, '$1 ').trim();
            }
            return fp;
          } catch(error) {
            console.log(error);
            return null;
          }
        } else {
          try {
            return tool.crypto.key.fingerprint(openpgp.key.readArmored(key).keys[0], formatting);
          } catch(error) {
            if(error.message === 'openpgp is not defined') {
              tool.catch.handle_exception(error);
            }
            console.log(error);
            return null;
          }
        }
      },
      longid: (key_or_fingerprint_or_bytes: string|OpenpgpKey|null|undefined): string|null => {
        if(key_or_fingerprint_or_bytes === null || typeof key_or_fingerprint_or_bytes === 'undefined') {
          return null;
        } else if(typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 8) {
          return tool.str.to_hex(key_or_fingerprint_or_bytes).toUpperCase();
        } else if(typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 40) {
          return key_or_fingerprint_or_bytes.substr(-16);
        } else if(typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 49) {
          return key_or_fingerprint_or_bytes.replace(/ /g, '').substr(-16);
        } else {
          return tool.crypto.key.longid(tool.crypto.key.fingerprint(key_or_fingerprint_or_bytes));
        }
      },
      test: (armored: string, passphrase: string, callback: (ok: boolean, error?: string) => void) => {
        try {
          openpgp.encrypt({ data: 'this is a test', armor: true, publicKeys: [openpgp.key.readArmored(armored).keys[0].toPublic()] }).then(function (result: OpenpgpEncryptResult) {
            let prv = openpgp.key.readArmored(armored).keys[0];
            tool.crypto.key.decrypt(prv, passphrase);
            openpgp.decrypt({ message: openpgp.message.readArmored(result.data), format: 'utf8', privateKey: prv }).then(function () {
              callback(true);
            }).catch(function (error: Error) {
              callback(false, error.message);
            });
          }).catch(function (error: Error) {
            callback(false, error.message);
          });
        } catch(error) {
          callback(false, error.message);
        }
      },
      usable: (armored: string) => { // is pubkey usable for encrytion?
        if(!tool.crypto.key.fingerprint(armored)) {
          return false;
        }
        let pubkey = openpgp.key.readArmored(armored).keys[0];
        if(!pubkey) {
          return false;
        }
        tool._.crypto_key_patch_public_keys_to_ignore_expiration([pubkey]);
        return pubkey.getEncryptionKeyPacket() !== null;
      },
    },
    message: {
      is_openpgp: (data: string|Uint8Array): {armored: boolean, type: MessageBlockType}|null => {
        if(!data || !data.length) {
          return null;
        }
        let d = data.slice(0, 50); // only interested in first 50 bytes
        // noinspection SuspiciousInstanceOfGuard
        if(d instanceof Uint8Array) {
          d = tool.str.from_uint8(d);
        }
        let first_byte = d[0].charCodeAt(0); // attempt to understand this as a binary PGP packet: https://tools.ietf.org/html/rfc4880#section-4.2
        if((first_byte & 0b10000000) === 0b10000000) { // 1XXX XXXX - potential pgp packet tag
          let tag_number = 0; // zero is a forbidden tag number
          if((first_byte & 0b11000000) === 0b11000000) { // 11XX XXXX - potential new pgp packet tag
            tag_number = first_byte & 0b00111111;  // 11TTTTTT where T is tag number bit
          } else { // 10XX XXXX - potential old pgp packet tag
            tag_number = (first_byte & 0b00111100) / 4; // 10TTTTLL where T is tag number bit. Division by 4 in place of two bit shifts. I hate bit shifts.
          }
          if(tool.value(tag_number).in(Object.values(openpgp.enums.packet))) {
            // Indeed a valid OpenPGP packet tag number
            // This does not 100% mean it's OpenPGP message
            // But it's a good indication that it may
            let t = openpgp.enums;
            let m_types = [t.symEncryptedIntegrityProtected, t.modificationDetectionCode, t.symEncryptedAEADProtected, t.symmetricallyEncrypted, t.compressed];
            return {armored: false, type: tool.value(tag_number).in(m_types) ? 'message' : 'public_key'};
          }
        }
        let blocks = tool.crypto.armor.detect_blocks(d.trim());
        if(blocks.length === 1 && blocks[0].complete === false && tool.value(blocks[0].type).in(['message', 'private_key', 'public_key', 'signed_message'])) {
          return {armored: true, type: blocks[0].type};
        }
        return null;
      },  
      sign: async (signing_prv: any, data: string|Uint8Array, armor: boolean): Promise<string|Uint8Array> => {
        let options = { data: data, armor: armor, privateKeys: signing_prv, };
        let sign_result = await openpgp.sign(options);
        return sign_result.data;
      },
      verify: (message: any, keys_for_verification: OpenpgpKey[], optional_contact: Contact|null=null) => {
        let signature = { signer: null, contact: optional_contact,  match: null, error: null } as MessageVerifyResult;
        try {
          for(let verify_result of message.verify(keys_for_verification)) {
            signature.match = tool.value(signature.match).in([true, null]) && verify_result.valid; // this will probably falsely show as not matching in some rare cases. Needs testing.
            if(!signature.signer) {
              signature.signer = tool.crypto.key.longid(verify_result.keyid.bytes);
            }
          }
        } catch(verify_error) {
          signature.match = null;
          if(verify_error.message === 'Can only verify message with one literal data packet.') {
            signature.error = 'FlowCrypt is not equipped to verify this message (err 101)';
          } else {
            signature.error = 'FlowCrypt had trouble verifying this message (' + verify_error.message + ')';
            tool.catch.handle_exception(verify_error);
          }
        }
        return signature;
      },
      verify_detached: async (account_email: string, plaintext: string|Uint8Array, signature_text: string|Uint8Array): Promise<MessageVerifyResult> => {
        if(plaintext instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
          plaintext = tool.str.from_uint8(plaintext);
        }
        if(signature_text instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
          signature_text = tool.str.from_uint8(signature_text);
        }
        let message = openpgp.message.readSignedContent(plaintext, signature_text);
        let keys = await tool._.crypto_message_get_sorted_keys_for_message(account_email, message);
        return tool.crypto.message.verify(message, keys.for_verification, keys.verification_contacts[0]);
      },
      decrypt: (account_email: string, encrypted_data: string|Uint8Array, message_password: string|null, callback: (decrypted: DecryptSuccess|DecryptError) => void, output_format:"utf8"|"binary"|null=null): void => {
        let first_100_bytes = encrypted_data.slice(0, 100);
        // noinspection SuspiciousInstanceOfGuard - Uint8Array.slice of course returns Uint8Array
        if(first_100_bytes instanceof Uint8Array) {
          first_100_bytes = tool.str.from_uint8(first_100_bytes);
        }
        let armored_encrypted = tool.value(tool.crypto.armor.headers('message').begin).in(first_100_bytes);
        let armored_signed_only = tool.value(tool.crypto.armor.headers('signed_message').begin).in(first_100_bytes);
        let is_armored = armored_encrypted || armored_signed_only;
        if(is_armored && encrypted_data instanceof Uint8Array) {
          encrypted_data = tool.str.from_uint8(encrypted_data);
        }
        let other_errors: string[] = [];
        let message: OpenpgpMessage;
        try {
          if(armored_encrypted) {
            message = openpgp.message.readArmored(encrypted_data);
          } else if(armored_signed_only) {
            message = openpgp.cleartext.readArmored(encrypted_data);
          } else {
            message = openpgp.message.read(typeof encrypted_data === 'string' ? tool.str.to_uint8(encrypted_data) : encrypted_data);
          }
        } catch(format_error) {
          callback({success: false, counts: tool._.crypto_message_zeroed_decrypt_error_counts(), format_error: format_error.message, errors: other_errors, encrypted: null, signature: null});
          return;
        }
        tool._.crypto_message_get_sorted_keys_for_message(account_email, message).then(keys => {
          let counts = tool._.crypto_message_zeroed_decrypt_error_counts(keys);
          if(armored_signed_only) {
            if(!message.text) {
              let sm_headers = tool.crypto.armor.headers('signed_message', 're');
              let text = (encrypted_data as string).match(RegExp(sm_headers.begin + '\nHash:\s[A-Z0-9]+\n([^]+)\n' + sm_headers.middle + '[^]+' + sm_headers.end, 'm'));
              message.text = text && text.length === 2 ? text[1] : (encrypted_data as string);
            }
            callback({success: true, content: { data: message.text }, encrypted: false, signature: tool.crypto.message.verify(message, keys.for_verification, keys.verification_contacts[0])});
          } else {
            let missing_passphrases = keys.prv_for_decrypt_without_passphrases.map(function (ki) { return ki.longid; });
            if(!keys.prv_for_decrypt_with_passphrases.length && !message_password) {
              callback({success: false, signature: null, message: message, counts: counts, unsecure_mdc: !!counts.unsecure_mdc, encrypted_for: keys.encrypted_for, missing_passphrases: missing_passphrases, errors: other_errors, encrypted: true});
            } else {
              let keyinfos_for_looper = keys.prv_for_decrypt_with_passphrases.slice(); // copy keyinfo array
              let keep_trying_until_decrypted_or_all_failed = function () {
                tool.catch.try(function () {
                  if(!counts.decrypted && keyinfos_for_looper.length) {
                    try {
                      openpgp.decrypt(tool._.crypto_message_get_decrypt_options(message, keyinfos_for_looper.shift()!, is_armored, message_password, output_format)).then(function (decrypted: OpenpgpDecryptResult) {
                        tool.catch.try(function () {
                          if(!counts.decrypted++) { // don't call back twice if encrypted for two of my keys
                            // let signature_result = keys.signed_by.length ? tool.crypto.message.verify(message, keys.for_verification, keys.verification_contacts[0]) : false;
                            let signature_result = null;
                            if(tool._.crypto_message_chained_decryption_result_collector(callback, {success: true, content: decrypted, encrypted: true, signature: signature_result})) {
                              keep_trying_until_decrypted_or_all_failed();
                            }
                          }
                        })();
                      }).catch(function (decrypt_error: Error) {
                        tool.catch.try(function () {
                          tool._.crypto_message_increment_decrypt_error_counts(counts, other_errors, message_password, decrypt_error);
                          if(tool._.crypto_message_chained_decryption_result_collector(callback, {success: false, signature: null, message: message, counts: counts, unsecure_mdc: !!counts.unsecure_mdc, encrypted_for: keys.encrypted_for, missing_passphrases: missing_passphrases, errors: other_errors, encrypted: true})) {
                            keep_trying_until_decrypted_or_all_failed();
                          }
                        })();
                      });
                    } catch(decrypt_exception) {
                      other_errors.push(String(decrypt_exception));
                      counts.attempts_done++;
                      if(tool._.crypto_message_chained_decryption_result_collector(callback, {success: false, signature: null, message: message, counts: counts, unsecure_mdc: !!counts.unsecure_mdc, encrypted_for: keys.encrypted_for, missing_passphrases: missing_passphrases, errors: other_errors, encrypted: true})) {
                        keep_trying_until_decrypted_or_all_failed();
                      }
                    }
                  }
                })();
              };
              keep_trying_until_decrypted_or_all_failed(); // first attempt
            }
          }
        });
      },
      encrypt: (armored_pubkeys: string[], signing_prv: any, challenge: Challenge|null, data: string|Uint8Array, filename: string|null, armor: boolean): Promise<OpenpgpEncryptResult> => {
        let options: Options = { data: data, armor: armor };
        if(filename) {
          options['filename'] = filename;
        }
        let used_challange = false;
        if(armored_pubkeys) {
          options['publicKeys'] = [];
          for(let armored_pubkey of armored_pubkeys) {
            options['publicKeys'] = options['publicKeys'].concat(openpgp.key.readArmored(armored_pubkey).keys);
          }
          tool._.crypto_key_patch_public_keys_to_ignore_expiration(options['publicKeys']);
        }
        if(challenge && challenge.answer) {
          options['passwords'] = [tool.crypto.hash.challenge_answer(challenge.answer)];
          used_challange = true;
        }
        if(!armored_pubkeys && !used_challange) {
          alert('Internal error: don\'t know how to encryt message. Please refresh the page and try again, or contact me at human@flowcrypt.com if this happens repeatedly.');
          throw new Error('no-pubkeys-no-challenge');
        }
        if(signing_prv && typeof signing_prv.isPrivate !== 'undefined' && signing_prv.isPrivate()) {
          options['privateKeys'] = [signing_prv];
        }
        return openpgp.encrypt(options); // returns a promise
      },
    },
    password: {
      estimate_strength: (zxcvbn_result_guesses: number) => {
        let time_to_crack = zxcvbn_result_guesses / tool._.var.crypto_password_GUESSES_PER_SECOND;
        for(let i = 0; i < tool._.var.crypto_password_CRACK_TIME_WORDS.length; i++) {
          let readable_time = tool._.readable_crack_time(time_to_crack);
          // looks for a word match from readable_crack_time, defaults on "weak"
          if(tool.value(tool._.var.crypto_password_CRACK_TIME_WORDS[i].match).in(readable_time)) {
            return {
              word: tool._.var.crypto_password_CRACK_TIME_WORDS[i].word,
              bar: tool._.var.crypto_password_CRACK_TIME_WORDS[i].bar,
              time: readable_time,
              seconds: Math.round(time_to_crack),
              pass: tool._.var.crypto_password_CRACK_TIME_WORDS[i].pass,
              color: tool._.var.crypto_password_CRACK_TIME_WORDS[i].color,
            };
          }
        }
        tool.catch.report('estimate_strength: got to end without any result');
        throw Error('(thrown) estimate_strength: got to end without any result');
      },
      weak_words: () => [
        'crypt', 'up', 'cryptup', 'flow', 'flowcrypt', 'encryption', 'pgp', 'email', 'set', 'backup', 'passphrase', 'best', 'pass', 'phrases', 'are', 'long', 'and', 'have', 'several',
        'words', 'in', 'them', 'Best pass phrases are long', 'have several words', 'in them', 'bestpassphrasesarelong', 'haveseveralwords', 'inthem',
        'Loss of this pass phrase', 'cannot be recovered', 'Note it down', 'on a paper', 'lossofthispassphrase', 'cannotberecovered', 'noteitdown', 'onapaper',
        'setpassword', 'set password', 'set pass word', 'setpassphrase', 'set pass phrase', 'set passphrase'
      ],
    }
  },
  /* [BARE_ENGINE_OMIT_BEGIN] */
  ui: {
    spinner: (color: string, placeholder_class:"small_spinner"|"large_spinner"='small_spinner') => {
      let path = `/img/svgs/spinner-${color}-small.svg`;
      let url = typeof chrome !== 'undefined' && chrome.extension && chrome.extension.getURL ? chrome.extension.getURL(path) : path;
      return `<i class="${placeholder_class}" data-test="spinner"><img src="${url}" /></i>`;
    },
    passphrase_toggle: (pass_phrase_input_ids: string[], force_initial_show_or_hide:"show"|"hide"|null=null) => {
      let button_hide = '<img src="/img/svgs/eyeclosed-icon.svg" class="eye-closed"><br>hide';
      let button_show = '<img src="/img/svgs/eyeopen-icon.svg" class="eye-open"><br>show';
      Store.get_global(['hide_pass_phrases']).then(function (s) {
        let show: boolean;
        if(force_initial_show_or_hide === 'hide') {
          show = false;
        } else if(force_initial_show_or_hide === 'show') {
          show = true;
        } else {
          show = !s.hide_pass_phrases;
        }
        for(let id of pass_phrase_input_ids) {
          let passphrase_input = $('#' + id);
          passphrase_input.addClass('toggled_passphrase');
          if(show) {
            passphrase_input.after('<label href="#" id="toggle_' + id + '" class="toggle_show_hide_pass_phrase" for="' + id + '">' + button_hide + '</label>');
            passphrase_input.attr('type', 'text');
          } else {
            passphrase_input.after('<label href="#" id="toggle_' + id + '" class="toggle_show_hide_pass_phrase" for="' + id + '">' + button_show + '</label>');
            passphrase_input.attr('type', 'password');
          }
          $('#toggle_' + id).click(function () {
            if(passphrase_input.attr('type') === 'password') {
              $('#' + id).attr('type', 'text');
              $(this).html(button_hide);
              // noinspection JSIgnoredPromiseFromCall
              Store.set(null, { hide_pass_phrases: false });
            } else {
              $('#' + id).attr('type', 'password');
              $(this).html(button_show);
              // noinspection JSIgnoredPromiseFromCall
              Store.set(null, { hide_pass_phrases: true });
            }
          });
        }
      });
    },
    enter: (callback: () => void) => {
      return function(e: JQuery.Event<HTMLElement, null>) {
        if (e.which == tool.env.key_codes().enter) {
          callback();
        }
      };
    },
    build_jquery_selectors: (selectors: Dict<string>): SelectorCache => {
      let cache: NamedSelectors = {};
      return {
        cached: (name: string) => {
          if(!cache[name]) {
            if(typeof selectors[name] === 'undefined') {
              tool.catch.report('unknown selector name: ' + name);
            }
            cache[name] = $(selectors[name]);
          }
          return cache[name];
        },
        now: (name: string) => {
          if(typeof selectors[name] === 'undefined') {
            tool.catch.report('unknown selector name: ' + name);
          }
          return $(selectors[name]);
        },
        selector: (name: string) => {
          if(typeof selectors[name] === 'undefined') {
            tool.catch.report('unknown selector name: ' + name);
          }
          return selectors[name];
        }
      };
    },
    scroll: (selector: string|JQuery<HTMLElement>, repeat:number[]=[]) => {
      let el = $(selector).first()[0];
      if(el) {
        el.scrollIntoView();
        for(let delay of repeat) { // useful if mobile keyboard is about to show up
          setTimeout(function() {
            el.scrollIntoView();
          }, delay);
        }
      }
    },
    event: {
      stop: () => {
        return function(e: JQuery.Event) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        };
      },
      protect: () => {
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
      },
      double: (): PreventableEvent => ({ name: 'double', id: tool.str.random(10) }),
      parallel: (): PreventableEvent => ({ name: 'parallel', id: tool.str.random(10) }),
      spree: (type:"slow"|"veryslow"|""=''): PreventableEvent => ({ name: `${type}spree` as "spree"|"slowspree"|"veryslowspree", id: tool.str.random(10) }),
      prevent: (preventable_event: PreventableEvent, callback: (e: HTMLElement, id: string) => void) => { //todo: messy + needs refactoring
        return function () {
          if(preventable_event.name === 'spree') {
            clearTimeout(tool._.var.ui_event_fired[preventable_event.id]);
            tool._.var.ui_event_fired[preventable_event.id] = window.setTimeout(callback, tool._.var.ui_event_SPREE_MS);
          } else if(preventable_event.name === 'slowspree') {
            clearTimeout(tool._.var.ui_event_fired[preventable_event.id]);
            tool._.var.ui_event_fired[preventable_event.id] = window.setTimeout(callback, tool._.var.ui_event_SLOW_SPREE_MS);
          } else if(preventable_event.name === 'veryslowspree') {
            clearTimeout(tool._.var.ui_event_fired[preventable_event.id]);
            tool._.var.ui_event_fired[preventable_event.id] = window.setTimeout(callback, tool._.var.ui_event_VERY_SLOW_SPREE_MS);
          } else {
            if(preventable_event.id in tool._.var.ui_event_fired) {
              // if(meta.name === 'parallel') - id was found - means the event handling is still being processed. Do not call back
              if(preventable_event.name === 'double') {
                if(Date.now() - tool._.var.ui_event_fired[preventable_event.id] > tool._.var.ui_event_DOUBLE_MS) {
                  tool._.var.ui_event_fired[preventable_event.id] = Date.now();
                  callback(this, preventable_event.id);
                }
              }
            } else {
              tool._.var.ui_event_fired[preventable_event.id] = Date.now();
              callback(this, preventable_event.id);
            }
          }
        };
      },
      release: (id: string) => { // todo - I may have forgot to use this somewhere, used only parallel() - if that's how it works
        if(id in tool._.var.ui_event_fired) {
          let ms_to_release = tool._.var.ui_event_DOUBLE_MS + tool._.var.ui_event_fired[id] - Date.now();
          if(ms_to_release > 0) {
            setTimeout(function () {
              delete tool._.var.ui_event_fired[id];
            }, ms_to_release);
          } else {
            delete tool._.var.ui_event_fired[id];
          }
        }
      },
    },
  },
  browser: {
    message: {
      cb: '[***|callback_placeholder|***]',
      bg_exec: (path: string, args: any[], callback: (result: PossibleBgExecResults) => void) => {
        args = args.map((arg) => {
          if((typeof arg === 'string' && arg.length > tool._.var.browser_message_MAX_SIZE) || arg instanceof Uint8Array) {
            return tool.file.object_url_create(arg);
          } else {
            return arg;
          }
        });
        tool.browser.message.send(null, 'bg_exec', {path: path, args: args}, (result: PossibleBgExecResults) => {
          if(path === 'tool.crypto.message.decrypt') {
            if(result && (result as DecryptResult).success && (result as DecryptSuccess).content && (result as DecryptSuccess).content.data && typeof (result as DecryptSuccess).content.data === 'string' && ((result as DecryptSuccess).content.data as string).indexOf('blob:' + chrome.runtime.getURL('')) === 0) {
              tool.file.object_url_consume((result as DecryptSuccess).content.data as string).then(function (result_content_data) {
                (result as DecryptSuccess).content.data = result_content_data;
                callback(result);
              });
            } else {
              callback(result);
            }
          } else {
            callback(result);
          }
        });
      },
      send: (destination_string: string|null, name: string, data: Dict<any>|null=null, callback?: Callback) => {
        let msg = { name: name, data: data, to: destination_string || null, respondable: !!(callback), uid: tool.str.random(10), stack: tool.catch.stack_trace() };
        let is_background_page = tool.env.is_background_script();
        if(typeof  destination_string === 'undefined') { // don't know where to send the message
          tool.catch.log('tool.browser.message.send to:undefined');
          if(typeof callback !== 'undefined') {
            callback();
          }
        } else if (is_background_page && tool._.var.browser_message_background_script_registered_handlers && msg.to === null) {
          tool._.var.browser_message_background_script_registered_handlers[msg.name](msg.data, 'background', callback || tool.noop); // calling from background script to background script: skip messaging completely
        } else if(is_background_page) {
          chrome.tabs.sendMessage(tool._.browser_message_destination_parse(msg.to).tab!, msg, {}, function(r) {
            tool.catch.try(function() {
              if(typeof callback !== 'undefined') {
                callback(r);
              }
            })();
          });
        } else {
          chrome.runtime.sendMessage(msg, function(r) {
            tool.catch.try(function() {
              if(typeof callback !== 'undefined') {
                callback(r);
              }
            })();
          });
        }
      },
      tab_id: (callback: Callback) => tool.browser.message.send(null, '_tab_', null, callback),
      listen: (handlers: Dict<BrowserMessageHandler>, listen_for_tab_id='all') => {
        for(let name of Object.keys(handlers)) {
          // newly registered handlers with the same name will overwrite the old ones if tool.browser.message.listen is declared twice for the same frame
          // original handlers not mentioned in newly set handlers will continue to work
          tool._.var.browser_message_frame_registered_handlers[name] = handlers[name];
        }
        for(let name of Object.keys(tool._.var.browser_message_STANDARD_HANDLERS)) {
          if(typeof tool._.var.browser_message_frame_registered_handlers[name] !== 'function') {
            tool._.var.browser_message_frame_registered_handlers[name] = tool._.var.browser_message_STANDARD_HANDLERS[name]; // standard handlers are only added if not already set above
          }
        }
        let processed:string[] = [];
        chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
          return tool.catch.try(function () {
            if(msg.to === listen_for_tab_id || msg.to === 'broadcast') {
              if(!tool.value(msg.uid).in(processed)) {
                processed.push(msg.uid);
                if(typeof tool._.var.browser_message_frame_registered_handlers[msg.name] !== 'undefined') {
                  tool._.var.browser_message_frame_registered_handlers[msg.name](msg.data, sender, respond);
                } else if(msg.name !== '_tab_' && msg.to !== 'broadcast') {
                  if(tool._.browser_message_destination_parse(msg.to).frame !== null) { // only consider it an error if frameId was set because of firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1354337
                    tool.catch.report('tool.browser.message.listen error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
                  } else { // once firefox fixes the bug, it will behave the same as Chrome and the following will never happen.
                    console.log('tool.browser.message.listen ignoring missing handler "' + msg.name + '" due to Firefox Bug');
                  }
                }
              }
            }
            return msg.respondable === true;
          })();
        });
      },
      listen_background: (handlers: Dict<BrowserMessageHandler>) => {
        if(!tool._.var.browser_message_background_script_registered_handlers) {
          tool._.var.browser_message_background_script_registered_handlers = handlers;
        } else {
          for(let name of Object.keys(handlers)) {
            tool._.var.browser_message_background_script_registered_handlers[name] = handlers[name];
          }
        }
        chrome.runtime.onMessage.addListener(function (msg, sender, respond) {
          let safe_respond = function (response: any) {
            try { // avoiding unnecessary errors when target tab gets closed
              respond(response);
            } catch(e) {
              if(e.message !== 'Attempting to use a disconnected port object') {
                tool.catch.handle_exception(e);
                throw e;
              }
            }
          };
          if(msg.to && msg.to !== 'broadcast') {
            msg.sender = sender;
            chrome.tabs.sendMessage(tool._.browser_message_destination_parse(msg.to).tab!, msg, {}, safe_respond);
          } else if(tool.value(msg.name).in(Object.keys(tool._.var.browser_message_background_script_registered_handlers!))) { // is !null because added above
            tool._.var.browser_message_background_script_registered_handlers![msg.name](msg.data, sender, safe_respond); // is !null because added above
          } else if(msg.to !== 'broadcast') {
            tool.catch.report('tool.browser.message.listen_background error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
          }
          return msg.respondable === true;
        });
      },
    },
  },
  api: {
    auth: {
      window: (auth_url: string, window_closed_by_user: Callback) => {
        let auth_code_window = window.open(auth_url, '_blank', 'height=600,left=100,menubar=no,status=no,toolbar=no,top=100,width=500');
        let window_closed_timer = setInterval(function () {
          if(auth_code_window !== null && auth_code_window.closed) {
            clearInterval(window_closed_timer);
            window_closed_by_user();
          }
        }, 500);
        return function() {
          clearInterval(window_closed_timer);
          if(auth_code_window !== null) {
            auth_code_window.close();
          }
        };
      },
      parse_id_token: (id_token: string) => JSON.parse(atob(id_token.split(/\./g)[1])),
    },
    error: {
      network: 'API_ERROR_NETWORK',
    },
    google: {
      user_info: (account_email: string, callback: ApiCallback) => tool._.api_google_call(account_email, 'GET', 'https://www.googleapis.com/oauth2/v1/userinfo', {alt: 'json'}, callback),
      auth: (auth_request: AuthRequest, respond: Callback) => {
        tool.browser.message.tab_id(function(tab_id) {
          auth_request.tab_id = tab_id;
          Store.get_account(auth_request.account_email, ['google_token_access', 'google_token_expires', 'google_token_refresh', 'google_token_scopes']).then(function (s: Dict<any>) {
            if (typeof s.google_token_access === 'undefined' || typeof s.google_token_refresh === 'undefined' || tool._.api_google_has_new_scope(auth_request.scopes || null, s.google_token_scopes, auth_request.omit_read_scope || false)) {
              if(!tool.env.is_background_script()) {
                tool.api.google.auth_popup(auth_request, s.google_token_scopes, respond);
              } else {
                respond({success: false, error: 'Cannot produce auth window from background script'});
              }
            } else {
              tool._.google_auth_refresh_token(s.google_token_refresh, (success, result) => {
                if (!success && result === tool.api.error.network) {
                  respond({success: false, error: tool.api.error.network});
                } else if (typeof (result as GoogleAuthTokensResponse).access_token !== 'undefined') {
                  tool._.google_auth_save_tokens(auth_request.account_email, result as GoogleAuthTokensResponse, s.google_token_scopes, function () {
                    respond({ success: true, message_id: auth_request.message_id, account_email: auth_request.account_email }); //todo: email should be tested first with google_auth_check_email?
                  });
                } else if(!tool.env.is_background_script()) {
                  tool.api.google.auth_popup(auth_request, s.google_token_scopes, respond);
                } else {
                  respond({success: false, error: 'Cannot show auth window from background script'});
                }
              });
            }
          });
        });
      },
      auth_popup: (auth_request: AuthRequest, current_google_token_scopes:string[]=[], respond: Callback) => {
        auth_request.auth_responder_id = tool.str.random(20);
        tool._.var.api_google_auth_responders[auth_request.auth_responder_id] = respond;
        auth_request.scopes = auth_request.scopes || [];
        for(let scope of tool._.var.google_oauth2!.scopes) {
          if(!tool.value(scope).in(auth_request.scopes)) {
            if(scope !== tool.api.gmail.scope('read') || !auth_request.omit_read_scope) { // leave out read messages permission if user chose so
              auth_request.scopes.push(scope);
            }
          }
        }
        for(let scope of current_google_token_scopes) {
          if(!tool.value(scope).in(auth_request.scopes)) {
            auth_request.scopes.push(scope);
          }
        }
        let result_listener = {
          google_auth_window_result: function(result: Dict<any>, sender: chrome.runtime.MessageSender, respond: Callback) { 
            if(auth_request.auth_responder_id) {
              tool._.google_auth_window_result_handler(auth_request.auth_responder_id, result, respond); 
            } else {
              tool.catch.report(`result_listener.google_auth_window_result:auth_request.auth_responder_id:${auth_request.auth_responder_id}`);
            }
          },
        };
        if(auth_request.tab_id !== null && auth_request.tab_id !== undefined) {
          tool.browser.message.listen(result_listener, auth_request.tab_id);
        } else {
          tool.browser.message.listen_background(result_listener);
        }
        let auth_code_window = window.open(tool._.api_google_auth_code_url(auth_request), '_blank', 'height=600,left=100,menubar=no,status=no,toolbar=no,top=100,width=500');
        // auth window will show up. Inside the window, google_auth_code.js gets executed which will send
        // a 'gmail_auth_code_result' chrome message to 'google_auth.google_auth_window_result_handler' and close itself
        let window_closed_timer: number;
        if(tool.env.browser().name !== 'firefox') {
          window_closed_timer = window.setInterval(api_google_auth_window_closed_watcher, 250);
        }
        function api_google_auth_window_closed_watcher() {
          if(auth_code_window !== null && typeof auth_code_window !== 'undefined' && auth_code_window.closed) { // on firefox it seems to be sometimes returning a null, due to popup blocking
            clearInterval(window_closed_timer);
            if(!auth_request.auth_responder_id) {
              tool.catch.report(`api_google_auth_window_closed_watcher:auth_request.auth_responder_id:${auth_request.auth_responder_id}`);
            } else {
              let auth_responder = tool._.var.api_google_auth_responders[auth_request.auth_responder_id];
              if(auth_responder !== tool._.var.api_google_AUTH_RESPONDED && typeof auth_responder === 'function') {
                // if user did clock Allow/Deny on auth, race condition is prevented, because auth_responders[] are always marked as RESPONDED before closing window.
                // thus it's impossible for another process to try to respond before the next line
                // that also means, if window got closed and it's not marked as RESPONDED, it was the user closing the window manually, which is what we're watching for.
                auth_responder({success: false, result: 'closed', account_email: auth_request.account_email, message_id: auth_request.message_id});
                tool._.var.api_google_auth_responders[auth_request.auth_responder_id] = tool._.var.api_google_AUTH_RESPONDED;
              }  
            }
          }
        }
      },
    },
    common: {
      message: (account_email: string, from:string='', to:string|string[]=[], subject:string='', body: SendableMessageBody, attachments:Attachment[]=[], thread_referrence:string|null=null): SendableMessage => {
        // let [primary_pubkey] = await Store.keys_get(account_email, ['primary']); // todo - changing to async - add back later
        // headers: (typeof exports !== 'object' && primary_pubkey !== null) ? { // todo - make it work in electron as well
        //   OpenPGP: 'id=' + primary_pubkey.fingerprint,
        // } : {},
        return {
          headers: {} as FlatHeaders, 
          from: from,
          to: Array.isArray(to) ? to as string[] : (to as string).split(','),
          subject: subject,
          body: typeof body === 'object' ? body : {'text/plain': body},
          attachments: attachments,
          thread: thread_referrence,
        };
      },
      reply_correspondents: (account_email: string, addresses: string[], last_message_sender: string|null, last_message_recipients: string[]) => {
        let reply_to_estimate = last_message_recipients;
        if(last_message_sender) {
          reply_to_estimate.unshift(last_message_sender);
        }
        let reply_to:string[] = [];
        let my_email = account_email;
        for(let email of reply_to_estimate) {
          if(email) {
            if(tool.value(tool.str.parse_email(email).email).in(addresses)) { // my email
              my_email = email;
            } else if(!tool.value(tool.str.parse_email(email).email).in(reply_to)) { // skip duplicates
              reply_to.push(tool.str.parse_email(email).email); // reply to all except my emails
            }
          }
        }
        if(!reply_to.length) { // happens when user sends email to itself - all reply_to_estimage contained his own emails and got removed
          reply_to = tool.arr.unique(reply_to_estimate);
        }
        return {to: reply_to, from: my_email};
      },
    },
    gmail: {
      query: {
        or: (arr: string[], quoted:boolean=false) => {
          if(quoted) {
            return '("' + arr.join('") OR ("') + '")';
          } else {
            return '(' + arr.join(') OR (') + ')';
          }
        },
        backups: (account_email: string) => {
          return [
            'from:' + account_email,
            'to:' + account_email,
            '(subject:"' + tool.enums.recovery_email_subjects.join('" OR subject: "') + '")',
            '-is:spam',
          ].join(' ');
        },
      },
      scope: (scope: string|string[]): string|string[] => (typeof scope === 'string') ? tool._.var.api_gmail_SCOPE_DICT[scope] as string : scope.map(tool.api.gmail.scope) as string[],
      has_scope: (scopes: string[], scope: string) => scopes && tool.value(tool._.var.api_gmail_SCOPE_DICT[scope]).in(scopes),
      thread_get: (account_email: string, thread_id: string, format: GmailApiResponseFormat|null, get_thread_callback: ApiCallback) => {
        tool._.api_gmail_call(account_email, 'GET', 'threads/' + thread_id, {
          format: format
        }, get_thread_callback);
      },
      draft_create: (account_email: string, mime_message: string, thread_id: string, callback: ApiCallback) => {
        tool._.api_gmail_call(account_email, 'POST', 'drafts', {
          message: {
            raw: tool.str.base64url_encode(mime_message),
            threadId: thread_id || null,
          },
        }, callback);
      },
      draft_delete: (account_email: string, id: string, callback: ApiCallback) => {
        tool._.api_gmail_call(account_email, 'DELETE', 'drafts/' + id, null, callback);
      },
      draft_update: (account_email: string, id: string, mime_message: string, callback: ApiCallback) => {
        tool._.api_gmail_call(account_email, 'PUT', 'drafts/' + id, {
          message: {
            raw: tool.str.base64url_encode(mime_message),
          },
        }, callback);
      },
      draft_get: (account_email: string, id: string, format:GmailApiResponseFormat='full', callback: ApiCallback) => {
        tool._.api_gmail_call(account_email, 'GET', 'drafts/' + id, {
          format: format
        }, callback);
      },
      draft_send: (account_email: string, id: string, callback: ApiCallback) => {  // todo - not used yet, and should be
        tool._.api_gmail_call(account_email, 'POST', 'drafts/send', {
          id: id,
        }, callback);
      },
      message_send: (account_email: string, message: SendableMessage, callback: ApiCallback, progress_callback?: ApiCallProgressCallback) => {
        message.headers.From = message.from;
        message.headers.To = message.to.join(',');
        message.headers.Subject = message.subject;
        tool.mime.encode(message.body, message.headers, message.attachments, (mime_message) => {
          let request = tool._.encode_as_multipart_related({ 'application/json; charset=UTF-8': JSON.stringify({threadId: message.thread}), 'message/rfc822': mime_message });
          tool._.api_gmail_call(account_email, 'POST', 'messages/send', request.body, callback, undefined, {upload: progress_callback || tool.noop}, request.content_type);
        });
      },
      message_list: (account_email: string, q: string, include_deleted:boolean=false): Promise<ApirGmailMessageList> => {
        return new Promise((resolve, reject) => {
          tool._.api_gmail_call(account_email, 'GET', 'messages', {
            q: q,
            includeSpamTrash: include_deleted,
          }, (success, response) => (success && response) ? resolve(response as ApirGmailMessageList) : reject(response));  
        });
      },
      message_get: (account_email: string, message_id: string, format: GmailApiResponseFormat): Promise<ApirGmailMessage> => {
        return new Promise((resolve, reject) => {
          tool._.api_gmail_call(account_email, 'GET', 'messages/' + message_id, {
            format: format || 'full',
          }, (success, response) => (success && response) ? resolve(response as ApirGmailMessage) : reject(response));
        });
      },
      messages_get: async (account_email: string, message_ids: string[], format: GmailApiResponseFormat): Promise<Dict<ApirGmailMessage>> => {
        let results: Dict<ApirGmailMessage> = {};
        for(let message_id of message_ids) { // todo: serialized requests are slow. parallel processing would be better
          results[message_id] = await tool.api.gmail.message_get(account_email, message_id, format);
        }
        return results;
      },
      attachment_get: (account_email: string, message_id: string, attachment_id: string, progress_callback:ApiCallProgressCallback|null=null): Promise<ApirGmailAttachment> => new Promise((resolve, reject) => {
        let cb = (success: boolean, response: ApirGmailAttachment|null) => (success && response) ? resolve(response) : reject(response);
        tool._.api_gmail_call(account_email, 'GET', `messages/${message_id}/attachments/${attachment_id}`, {}, cb, undefined, {download: progress_callback} as ApiCallProgressCallbacks);
      }),
      attachment_get_chunk: (account_email: string, message_id: string, attachment_id: string): Promise<string> => new Promise(async (resolve, reject) => {
        let min_bytes = 1000;
        let processed = 0;
        let process_chunk_and_resolve = (chunk: string) => {
          if(!processed++) {
            // make json end guessing easier
            chunk = chunk.replace(/[\n\s\r]/g, '');
            // the response is a chunk of json that may not have ended. One of:
            // {"length":12345,"data":"kksdwei
            // {"length":12345,"data":"kksdweiooiowei
            // {"length":12345,"data":"kksdweiooiowei"
            // {"length":12345,"data":"kksdweiooiowei"}
            if(chunk[chunk.length-1] !== '"' && chunk[chunk.length-2] !== '"') {
              chunk += '"}'; // json end 
            } else if(chunk[chunk.length-1] !== '}') {
              chunk += '}'; // json end
            }
            let parsed_json_data_field;
            try {
              parsed_json_data_field = JSON.parse(chunk).data;
            } catch(e) {
              console.log(e);
              reject({code: null, message: "Chunk response could not be parsed"});
              return;
            }
            for(let i = 0; parsed_json_data_field && i < 50; i++) {
              try {
                resolve(tool.str.base64url_decode(parsed_json_data_field));
                return;
              } catch(e) {
                 // the chunk of data may have been cut at an inconvenient index
                 // shave off up to 50 trailing characters until it can be decoded
                parsed_json_data_field = parsed_json_data_field.slice(0, -1);
              }
            }
            reject({code: null, message: "Chunk response could not be decoded"});
          }
        };
        tool._.google_api_authorization_header(account_email).then(auth_token => {
          let r = new XMLHttpRequest();
          r.open('GET', `https://www.googleapis.com/gmail/v1/users/me/messages/${message_id}/attachments/${attachment_id}`, true);
          r.setRequestHeader('Authorization', auth_token);
          r.send(null);
          let status: number;
          let response_poll_interval = window.setInterval(() => {
            if(status >= 200 && status <= 299 && r.responseText.length >= min_bytes) {
              window.clearInterval(response_poll_interval);
              process_chunk_and_resolve(r.responseText);
              r.abort();
            }
          }, 10);
          r.onreadystatechange = function () {
            if(r.readyState === 2 || r.readyState === 3) { // headers, loading
              status = r.status;
              if(status >= 300) {
                reject({code: status, message: `Fail status ${status} received when downloading a chunk`});
                window.clearInterval(response_poll_interval);
                r.abort();
              }
            }
            if(r.readyState === 3 || r.readyState === 4) { // loading, done
              if(status >= 200 && status <= 299 && r.responseText.length >= min_bytes) { // done as a success - resolve in case response_poll didn't catch this yet
                process_chunk_and_resolve(r.responseText);
                window.clearInterval(response_poll_interval);
                if(r.readyState === 3) {
                  r.abort();
                }
              } else {  // done as a fail - reject
                reject({code: null, message: "Network connection error when downloading a chunk", internal: "network"});
                window.clearInterval(response_poll_interval);
              }
            }
          };
        }).catch(reject);
      }),
      find_header: (api_gmail_message_object: ApirGmailMessage|ApirGmailMessage$payload, header_name: string) => {
        let node: ApirGmailMessage$payload = api_gmail_message_object.hasOwnProperty('payload') ? (api_gmail_message_object as ApirGmailMessage).payload : api_gmail_message_object as ApirGmailMessage$payload;
        if(typeof node.headers !== 'undefined') {
          for(let i = 0; i < node.headers.length; i++) {
            if(node.headers[i].name.toLowerCase() === header_name.toLowerCase()) {
              return node.headers[i].value;
            }
          }
        }
        return null;
      },
      find_attachments: (message_or_payload_or_part: ApirGmailMessage|ApirGmailMessage$payload|ApirGmailMessage$payload$part, internal_results:Attachment[]=[], internal_message_id:string|null=null) => {
        if(message_or_payload_or_part.hasOwnProperty('payload')) {
          internal_message_id = (message_or_payload_or_part as ApirGmailMessage).id;
          tool.api.gmail.find_attachments((message_or_payload_or_part as ApirGmailMessage).payload, internal_results, internal_message_id);
        }
        if(message_or_payload_or_part.hasOwnProperty('parts')) {
          for(let part of (message_or_payload_or_part as ApirGmailMessage$payload).parts!) {
            tool.api.gmail.find_attachments(part, internal_results, internal_message_id);
          }
        }
        if(message_or_payload_or_part.hasOwnProperty('body') && (message_or_payload_or_part as ApirGmailMessage$payload$part).body!.hasOwnProperty('attachmentId')) {
          let attachment = {
            message_id: internal_message_id,
            id: (message_or_payload_or_part as ApirGmailMessage$payload$part).body!.attachmentId,
            size: (message_or_payload_or_part as ApirGmailMessage$payload$part).body!.size,
            name: (message_or_payload_or_part as ApirGmailMessage$payload$part).filename,
            type: (message_or_payload_or_part as ApirGmailMessage$payload$part).mimeType,
            inline: (tool.api.gmail.find_header(message_or_payload_or_part, 'content-disposition') || '').toLowerCase().indexOf('inline') === 0,
          } as Attachment;
          attachment.treat_as = tool.file.treat_as(attachment);
          internal_results.push(attachment);
        }
        return internal_results;
      },
      find_bodies: (gmail_email_object: Dict<any>, internal_results:Dict<any>={}): SendableMessageBody => {
        if(typeof gmail_email_object.payload !== 'undefined') {
          tool.api.gmail.find_bodies(gmail_email_object.payload, internal_results);
        }
        if(typeof gmail_email_object.parts !== 'undefined') {
          for(let part of gmail_email_object.parts) {
            tool.api.gmail.find_bodies(part, internal_results);
          }
        }
        if(typeof gmail_email_object.body !== 'undefined' && typeof gmail_email_object.body.data !== 'undefined' && gmail_email_object.body.size !== 0) {
          internal_results[gmail_email_object.mimeType] = gmail_email_object.body.data;
        }
        return internal_results as SendableMessageBody;
      },
      fetch_attachments: async (account_email: string, attachments:Attachment[]) => {
        let responses = await Promise.all(attachments.map(a => tool.api.gmail.attachment_get(account_email, a.message_id!, a.id!))); // if .message_id or .id not present, api will fail anyway  
        for(let i of responses.keys()) {
          attachments[i].data = responses[i].data;
        }
        return attachments;
      },
      search_contacts: (account_email: string, user_query: string, known_contacts: Contact[], chunked_callback: (r: ProviderContactsResults) => void) => { // This will keep triggering callback with new emails as they are being discovered
        let gmail_query = ['is:sent', tool._.var.api_gmail_USELESS_CONTACTS_FILTER];
        if(user_query) {
          let variations_of_to = user_query.split(/[ .]/g).filter(v => !tool.value(v).in(['com', 'org', 'net']));
          if(!tool.value(user_query).in(variations_of_to)) {
            variations_of_to.push(user_query);
          }
          gmail_query.push('(to:' + variations_of_to.join(' OR to:') + ')');
        }
        for(let contact of known_contacts) {
          gmail_query.push('-to:"' + contact.email + '"');
        }
        // noinspection JSIgnoredPromiseFromCall - we are only using the chunked callbacks
        tool._.api_gmail_loop_through_emails_to_compile_contacts(account_email, gmail_query.join(' '), chunked_callback);
      },
      /*
      * Extracts the encrypted message from gmail api. Sometimes it's sent as a text, sometimes html, sometimes attachments in various forms.
      * success_callback(str armored_pgp_message)
      * error_callback(str error_type, str html_formatted_data_to_display_to_user)
      *    ---> html_formatted_data_to_display_to_user might be unknown type of mime message, or pgp message with broken format, etc.
      *    ---> The motivation is that user might have other tool to process this. Also helps debugging issues in the field.
      */
      extract_armored_block: (account_email: string, message_id: string, format:GmailApiResponseFormat, success_callback: Callback, error_callback: any) => {
        tool.api.gmail.message_get(account_email, message_id, format).then(gmail_message_object => {
          if(format === 'full') {
            let bodies = tool.api.gmail.find_bodies(gmail_message_object);
            let attachments = tool.api.gmail.find_attachments(gmail_message_object);
            let armored_message_from_bodies = tool.crypto.armor.clip(tool.str.base64url_decode(bodies['text/plain'] || '')) || tool.crypto.armor.clip(tool.crypto.armor.strip(tool.str.base64url_decode(bodies['text/html'] || '')));
            if(armored_message_from_bodies) {
              success_callback(armored_message_from_bodies);
            } else if(attachments.length) {
              let found = false;
              for(let attachment_meta of attachments) {
                if(attachment_meta.treat_as === 'message') {
                  found = true;
                  tool.api.gmail.fetch_attachments(account_email, [attachment_meta]).then((attachments: Attachment[]) => {
                    let armored_message_text = tool.str.base64url_decode(attachments[0].data!);
                    let armored_message = tool.crypto.armor.clip(armored_message_text);
                    if(armored_message) {
                      success_callback(armored_message);
                    } else {
                      error_callback('format', armored_message_text);
                    }
                  }, () => error_callback('connection'));
                  break;
                }
              }
              if(!found) {
                error_callback('format', tool.str.pretty_print(gmail_message_object.payload));
              }
            } else {
              error_callback('format', tool.str.pretty_print(gmail_message_object.payload));
            }
          } else { // format === raw
            tool.mime.decode(tool.str.base64url_decode(gmail_message_object.raw!), function (success, mime_message) {
              if(success && mime_message.text !== undefined) {
                let armored_message = tool.crypto.armor.clip(mime_message.text); // todo - the message might be in attachments
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
        }, () => error_callback('connection'));
      },
      fetch_messages_based_on_query_and_extract_first_available_header: async (account_email: string, q: string, header_names: string[]) => {
        let {messages} = await tool.api.gmail.message_list(account_email, q, false);
        return await tool._.api_gmail_fetch_messages_sequentially_from_list_and_extract_first_available_header(account_email, messages || [], header_names);
      },
      fetch_key_backups: async (account_email: string) => {
        let response = await tool.api.gmail.message_list(account_email, tool.api.gmail.query.backups(account_email), true);
        if(!response.messages) {
          return [];
        }
        let message_ids = response.messages.map(m => m.id);
        let messages = await tool.api.gmail.messages_get(account_email, message_ids, 'full');
        let attachments:Attachment[] = [];
        for(let id of Object.keys(messages)) {
          attachments = attachments.concat(tool.api.gmail.find_attachments(messages[id]));
        }
        attachments = await tool.api.gmail.fetch_attachments(account_email, attachments);
        let keys:OpenpgpKey[] = [];
        for(let attachment of attachments) {
          try {
            let armored_key = tool.str.base64url_decode(attachment.data!);
            let key = openpgp.key.readArmored(armored_key).keys[0];
            if(key.isPrivate()) {
              keys.push(key);
            }
          } catch(err) {
          }
        }
        return keys;
      },
    },
    attester: {
      lookup_email: (email: string|string[]): FcPromise<PubkeySearchResult|{results: PubkeySearchResult[]}> => {
        return tool._.api_attester_call('lookup/email', {
          email: Array.isArray(email) ? email.map(a => tool.str.parse_email(a).email) : tool.str.parse_email(email).email,
        }).validate(r => Boolean(r));
      },
      initial_legacy_submit: (email: string, pubkey: string, attest:boolean=false): FcPromise<ApirAttInitialLegacySugmit> => {
        return tool._.api_attester_call('initial/legacy_submit', {
          email: tool.str.parse_email(email).email,
          pubkey: pubkey.trim(),
          attest: attest,
        }); 
      },
      initial_confirm: (signed_attest_packet: string): FcPromise<ApirAttInitialConfirm> => {
        return tool._.api_attester_call('initial/confirm', {
          signed_message: signed_attest_packet,
        });
      },
      replace_request: (email: string, signed_attest_packet: string, new_pubkey: string): FcPromise<ApirAttReplaceRequest> => {
        return tool._.api_attester_call('replace/request', {
          signed_message: signed_attest_packet,
          new_pubkey: new_pubkey,
          email: email,
        });
      },
      replace_confirm: (signed_attest_packet: string): FcPromise<ApirAttReplaceConfirm> => {
        return tool._.api_attester_call('replace/confirm', {
          signed_message: signed_attest_packet,
        });
      },
      test_welcome: (email: string, pubkey: string): FcPromise<ApirAttTestWelcome> => {
        return tool._.api_attester_call('test/welcome', {
          email: email,
          pubkey: pubkey,
        });
      },
      diagnose_keyserver_pubkeys: (account_email: string, callback: Callback) => {
        let diagnosis = { has_pubkey_missing: false, has_pubkey_mismatch: false, results: {} as Dict<{attested: boolean, pubkey: string|null, match: boolean}> };
        Store.get_account(account_email, ['addresses']).then(s => {
          Store.keys_get(account_email).then(stored_keys => {
            let stored_keys_longids = stored_keys.map(ki => ki.longid);
            tool.api.attester.lookup_email(tool.arr.unique([account_email].concat((s.addresses || []) as string[]))).then((pubkey_search_results: {results: PubkeySearchResult[]}) => {
              for(let pubkey_search_result of pubkey_search_results.results) {
                if (!pubkey_search_result.pubkey) {
                  diagnosis.has_pubkey_missing = true;
                  diagnosis.results[pubkey_search_result.email] = {attested: false, pubkey: null, match: false};
                } else {
                  let match = true;
                  if (!tool.value(tool.crypto.key.longid(pubkey_search_result.pubkey)).in(stored_keys_longids)) {
                    diagnosis.has_pubkey_mismatch = true;
                    match = false;
                  }
                  diagnosis.results[pubkey_search_result.email] = {pubkey: pubkey_search_result.pubkey, attested: pubkey_search_result.attested || false, match: match};
                }
              }
              callback(diagnosis);
            }, function(error) {
              callback();
            });
          });
        });
      },  
      packet: {
        create_sign: async (values: Dict<string>, decrypted_prv: OpenpgpKey) => {
          let lines:string[] = [];
          for(let key of Object.keys(values)) {
            lines.push(key + ':' + values[key]);
          }
          let content_text = lines.join('\n');
          let packet = tool.api.attester.packet.parse(tool._.api_attester_packet_armor(content_text));
          if(packet.success !== true) {
            throw {code: null, message: packet.error, internal: 'parse'};
          }
          return await tool.crypto.message.sign(decrypted_prv, content_text, true);
        },
        parse: (text: string) => {
          let accepted_values = {
            'ACT': 'action',
            'ATT': 'attester',
            'ADD': 'email_hash',
            'PUB': 'fingerprint',
            'OLD': 'fingerprint_old',
            'RAN': 'random',
          } as Dict<string>;
          let result = {
            success: false,
            content: {} as Dict<string>,
            error: null as string|null,
            text: null as string|null,
          };
          let packet_headers = tool.crypto.armor.headers('attest_packet', 're');
          let matches = text.match(RegExp(packet_headers.begin + '([^]+)' + packet_headers.end, 'm'));
          if(matches && matches[1]) {
            result.text = matches[1].replace(/^\s+|\s+$/g, '');
            let lines = result.text.split('\n');
            for(let line of lines) {
              let line_parts = line.replace('\n', '').replace(/^\s+|\s+$/g, '').split(':');
              if(line_parts.length !== 2) {
                result.error = 'Wrong content line format';
                result.content = {};
                return result;
              }
              if(!accepted_values[line_parts[0]]) {
                result.error = 'Unknown line key';
                result.content = {};
                return result;
              }
              if(result.content[accepted_values[line_parts[0]]]) {
                result.error = 'Duplicate line key';
                result.content = {};
                return result;
              }
              result.content[accepted_values[line_parts[0]]] = line_parts[1];
            }
            if(result.content['fingerprint'] && result.content['fingerprint'].length !== 40) { //todo - we should use regex here, everywhere
              result.error = 'Wrong PUB line value format';
              result.content = {};
              return result;
            }
            if(result.content['email_hash'] && result.content['email_hash'].length !== 40) {
              result.error = 'Wrong ADD line value format';
              result.content = {};
              return result;
            }
            if(result.content['str_random'] && result.content['str_random'].length !== 40) {
              result.error = 'Wrong RAN line value format';
              result.content = {};
              return result;
            }
            if(result.content['fingerprint_old'] && result.content['fingerprint_old'].length !== 40) {
              result.error = 'Wrong OLD line value format';
              result.content = {};
              return result;
            }
            if(result.content['action'] && !tool.value(result.content['action']).in(['INITIAL', 'REQUEST_REPLACEMENT', 'CONFIRM_REPLACEMENT'])) {
              result.error = 'Wrong ACT line value format';
              result.content = {};
              return result;
            }
            if(result.content['attester'] && !tool.value(result.content['attester']).in(['CRYPTUP'])) {
              result.error = 'Wrong ATT line value format';
              result.content = {};
              return result;
            }
            result.success = true;
            return result;
          } else {
            result.error = 'Could not locate packet headers';
            result.content = {};
            return result;
          }
        },
      },
    },
    cryptup: {
      auth_error: {code: 401, message: 'Could not log in', internal: 'auth'},
      url: (type: string, variable='') => {
        return ({
          'api': 'https://flowcrypt.com/api/',
          'me': 'https://flowcrypt.com/me/' + variable,
          'pubkey': 'https://flowcrypt.com/pub/' + variable,
          'decrypt': 'https://flowcrypt.com/' + variable,
          'web': 'https://flowcrypt.com/',
        } as Dict<string>)[type];
      },
      help_feedback: (account_email: string, message: string): FcPromise<ApirFcHelpFeedback> => {
        return tool._.api_cryptup_call('help/feedback', {
          email: account_email,
          message: message,
        });
      },
      help_uninstall: (email: string, client: string) => tool._.api_cryptup_call('help/uninstall', {
        email: email,
        client: client,
        metrics: null,
      }),
      account_login: async (account_email: string, token:string|null=null): Promise<{verified: boolean, subscription: SubscriptionInfo}> => {
        let auth_info = await Store.auth_info();
        let uuid = auth_info.uuid || tool.crypto.hash.sha1(tool.str.random(40));
        let email = auth_info.account_email || account_email;
        let response: ApirFcAccountLogin = await tool._.api_cryptup_call('account/login', {
          account: email,
          uuid: uuid,
          token: token,
        }).validate((r: ApirFcAccountLogin) => r.registered === true);
        await Store.set(null, {cryptup_account_email: email, cryptup_account_uuid: uuid, cryptup_account_verified: response.verified === true, cryptup_account_subscription: response.subscription});
        return {verified: response.verified === true, subscription: response.subscription};
      },
      account_check: (emails: string[]) => tool._.api_cryptup_call('account/check', {
        emails: emails,
      }) as Promise<ApirFcAccountCheck>,
      account_check_sync: async () => { // callbacks true on updated, false not updated, null for could not fetch
        let emails = await Store.account_emails_get();
        if(emails.length) {
          let response = await tool.api.cryptup.account_check(emails);
          let auth_info = await Store.auth_info();
          let subscription = await Store.subscription();
          let local_storage_update: GlobalStore = {};
          if(response.email) {
            if(response.email !== auth_info.account_email) {
              // this will of course fail auth on the server when used. The user will be prompted to verify this new device when that happens.
              local_storage_update['cryptup_account_email'] = response.email;
              local_storage_update['cryptup_account_uuid'] = tool.crypto.hash.sha1(tool.str.random(40));
              local_storage_update['cryptup_account_verified'] = false;
            }
          } else {
            if(auth_info.account_email) {
              local_storage_update['cryptup_account_email'] = null;
              local_storage_update['cryptup_account_uuid'] = null;
              local_storage_update['cryptup_account_verified'] = false;
            }
          }
          if(response.subscription) {
            let rs = response.subscription;
            if(rs.level !== subscription.level || rs.method !== subscription.method || rs.expire !== subscription.expire || subscription.active !== !rs.expired) {
              local_storage_update['cryptup_account_subscription'] = {active: !rs.expired, method: rs.method, level: rs.level, expire: rs.expire};
            }
          } else {
            if(subscription.level || subscription.expire || subscription.active || subscription.method) {
              local_storage_update['cryptup_account_subscription'] = null;
            }
          }
          if(Object.keys(local_storage_update).length) {
            tool.catch.log('updating account subscription from ' + subscription.level + ' to ' + (response.subscription ? response.subscription.level : null), response);
            await Store.set(null, local_storage_update);
            return true;
          } else {
            return false;
          }
        }
      },
      account_update: async (update_values?: Dict<Serializable>): Promise<ApirFcAccountUpdate> => {
        let auth_info = await Store.auth_info();
        if(!auth_info.verified) {
          throw tool.api.cryptup.auth_error;
        }
        let request = {account: auth_info.account_email, uuid: auth_info.uuid} as Dict<Serializable>;
        if(update_values) {
          for(let k of Object.keys(update_values)) {
            request[k] = update_values[k];
          }
        }
        return await tool._.api_cryptup_call('account/update', request).validate((r: ApirFcAccountUpdate) => typeof r.result === 'object');
      },
      account_subscribe: async (product: string, method: string, payment_source_token:string|null=null): Promise<ApirFcAccountSubscribe> => {
        let auth_info = await Store.auth_info();
        if(!auth_info.verified) {
          throw tool.api.cryptup.auth_error;
        }
        let response: ApirFcAccountSubscribe = await tool._.api_cryptup_call('account/subscribe', {
          account: auth_info.account_email,
          uuid: auth_info.uuid,
          method: method,
          source: payment_source_token,
          product: product,
        });
        await Store.set(null, { cryptup_account_subscription: response.subscription });
        return response;
      },
      message_presign_files: async (attachments: Attachment[], auth_method: FlowCryptApiAuthMethods): Promise<ApirFcMessagePresignFiles> => {
        let response: ApirFcMessagePresignFiles;
        let lengths = attachments.map(a => a.size);
        if(!auth_method) {
          response = await tool._.api_cryptup_call('message/presign_files', {
            lengths: lengths,
          });
        } else if(auth_method === 'uuid') {
          let auth_info = await Store.auth_info();
          if(!auth_info.verified) {
            throw tool.api.cryptup.auth_error;
          }
          response = await tool._.api_cryptup_call('message/presign_files', {
            account: auth_info.account_email,
            uuid: auth_info.uuid,
            lengths: lengths,
          });
        } else {
          response = await tool._.api_cryptup_call('message/presign_files', {
            message_token_account: auth_method.account,
            message_token: auth_method.token,
            lengths: lengths,
          });
        }
        if(response.approvals && response.approvals.length === attachments.length) {
          return response;
        }
        throw {'code': null, 'internal': 'network', message: 'Could not verify that all files were uploaded properly, please try again.'}
      },
      message_confirm_files: (identifiers: string[]): FcPromise<ApirFcMessageConfirmFiles> => {
        return tool._.api_cryptup_call('message/confirm_files', {
          identifiers: identifiers,
        });
      },
      message_upload: (encrypted_data_armored: string, auth_method: FlowCryptApiAuthMethods): FcPromise<ApirFcMessageUpload> => { // todo - DEPRECATE THIS. Send as JSON to message/store
        return tool.catch.Promise(function (resolve, reject) {
          if(encrypted_data_armored.length > 100000) {
            reject({code: null, message: 'Message text should not be more than 100 KB. You can send very long texts as attachments.'});
          } else {
            let content = tool.file.attachment('cryptup_encrypted_message.asc', 'text/plain', encrypted_data_armored);
            if(!auth_method) {
              tool._.api_cryptup_call('message/upload', {
                content: content,
              }, 'FORM').then(resolve, reject);
            } else {
              Store.auth_info().then(auth_info => {
                if(auth_info.verified) {
                  tool._.api_cryptup_call('message/upload', {
                    account: auth_info.account_email,
                    uuid: auth_info.uuid,
                    content: content,
                  }, 'FORM').then(resolve, reject);
                } else {
                  reject(tool.api.cryptup.auth_error);
                }
              });
            }
          }
        });
      },
      message_token: (): FcPromise<ApirFcMessageToken> => {
        return tool.catch.Promise(function (resolve, reject) {
          Store.auth_info().then(auth_info => {
            if(auth_info.verified) {
              tool._.api_cryptup_call('message/token', {
                account: auth_info.account_email,
                uuid: auth_info.uuid,
              }).then(resolve, reject);
            } else {
              reject(tool.api.cryptup.auth_error);
            }
          });
        });
      },
      message_expiration: (admin_codes: string[], add_days:null|number=null): FcPromise<ApirFcMessageExpiration> => {
        return tool.catch.Promise(function (resolve, reject) {
          Store.auth_info().then(auth_info => {
            if(auth_info.verified) {
              tool._.api_cryptup_call('message/expiration', {
                account: auth_info.account_email,
                uuid: auth_info.uuid,
                admin_codes: admin_codes,
                add_days: add_days,
              }).then(resolve, reject);
            } else {
              reject(tool.api.cryptup.auth_error);
            }
          });
        });
      },
      message_reply: (short: string, token: string, from: string, to: string, subject: string, message: string)=> tool._.api_cryptup_call('message/reply', {
        short: short,
        token: token,
        from: from,
        to: to,
        subject: subject,
        message: message,
      }),
      message_contact: (sender: string, message: string, message_token: FlowCryptApiAuthToken) => tool._.api_cryptup_call('message/contact', {
        message_token_account: message_token.account,
        message_token: message_token.token,
        sender: sender,
        message: message,
      }),
      link_message: (short: string): FcPromise<ApirFcMessageLink> => {
        return tool._.api_cryptup_call('link/message', {
          short: short,
        });
      },
      link_me: (alias: string) => tool._.api_cryptup_call('link/me', {
        alias: alias,
      }),
    },
    aws: {
      s3_upload: (items: {base_url:string, fields: Dict<Serializable|Attachment>, attachment: Attachment}[], progress_callback: ApiCallProgressCallback) => {
        let progress = tool.arr.zeroes(items.length);
        let promises:Promise<void>[] = [];
        if (!items.length) {
          return Promise.resolve(promises);
        }
        for(let i in items) {
          let values = items[i].fields;
          values.file = tool.file.attachment('encrpted_attachment', 'application/octet-stream', items[i].attachment.content!);
          promises.push(tool._.api_call(items[i].base_url, '', values, 'FORM', {upload: (single_file_progress: number) => {
            progress[i] = single_file_progress;
            tool.ui.event.prevent(tool.ui.event.spree(), function() {
              // this should of course be weighted average. How many years until someone notices?
              progress_callback(tool.arr.average(progress), null, null); // May 2018 - nobody noticed
            })();
          }}));
        }
        return Promise.all(promises);
      },
    }
  }, 
  /* [BARE_ENGINE_OMIT_END] */
  value: (v: FlatTypes) => ({in: (array_or_str: FlatTypes[]|string): boolean => tool.arr.contains(array_or_str, v)}),  // tool.value(v).in(array_or_string)
  e: (name: string, attrs: Dict<string>) => $(`<${name}/>`, attrs)[0].outerHTML,
  noop: (): any => null,
  enums: {
    recovery_email_subjects: ['Your FlowCrypt Backup', 'Your CryptUp Backup', 'All you need to know about CryptUP (contains a backup)', 'CryptUP Account Backup'],
  },
  _: { 
    var: { // meant to be used privately within this file like so: tool._.vars.???
      // internal variables
      ui_event_fired: {} as Dict<number>,
      browser_message_background_script_registered_handlers: null as Dict<BrowserMessageHandler>|null,
      browser_message_frame_registered_handlers: {} as Dict<BrowserMessageHandler>,
      api_google_auth_responders: {} as Dict<Callback|string>,
      // internal constants
      env_url_param_DICT: {'___cu_true___': true, '___cu_false___': false, '___cu_null___': null as null} as Dict<boolean|null>,
      ui_event_DOUBLE_MS: 1000,
      ui_event_SPREE_MS: 50,
      ui_event_SLOW_SPREE_MS: 200,
      ui_event_VERY_SLOW_SPREE_MS: 500,
      crypto_armor_header_MAX_LENGTH: 50,
      crypto_armor_headers_DICT: {
        null: { begin: '-----BEGIN', end: '-----END', replace: false },
        public_key: { begin: '-----BEGIN PGP PUBLIC KEY BLOCK-----', end: '-----END PGP PUBLIC KEY BLOCK-----', replace: true },
        private_key: { begin: '-----BEGIN PGP PRIVATE KEY BLOCK-----', end: '-----END PGP PRIVATE KEY BLOCK-----', replace: true },
        attest_packet: { begin: '-----BEGIN ATTEST PACKET-----', end: '-----END ATTEST PACKET-----', replace: true },
        cryptup_verification: { begin: '-----BEGIN CRYPTUP VERIFICATION-----', end: '-----END CRYPTUP VERIFICATION-----', replace: true },
        signed_message: { begin: '-----BEGIN PGP SIGNED MESSAGE-----', middle: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: true },
        signature: { begin: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: false },
        message: { begin: '-----BEGIN PGP MESSAGE-----', end: '-----END PGP MESSAGE-----', replace: true },
        password_message: { begin: 'This message is encrypted: Open Message', end: /https:(\/|&#x2F;){2}(cryptup\.org|flowcrypt\.com)(\/|&#x2F;)[a-zA-Z0-9]{10}(\n|$)/, replace: true},
      } as CryptoArmorHeaderDefinitions,
      api_gmail_USELESS_CONTACTS_FILTER: '-to:txt.voice.google.com -to:reply.craigslist.org -to:sale.craigslist.org -to:hous.craigslist.org',
      api_gmail_SCOPE_DICT: {read: 'https://www.googleapis.com/auth/gmail.readonly', compose: 'https://www.googleapis.com/auth/gmail.compose'} as Dict<string>,
      browser_message_MAX_SIZE: 1024 * 1024, // 1MB
      browser_message_STANDARD_HANDLERS: {
        set_css: (data: {css: Dict<string|number>, selector: string, traverse_up?: number}) => {
          let element = $(data.selector);
          let traverse_up_levels = data.traverse_up as number || 0;
          for(let i = 0; i < traverse_up_levels; i++) {
            element = element.parent();
          }
          element.css(data.css);
        },
      } as Dict<BrowserMessageHandler>,
      crypto_password_SENTENCE_PRESENT_TEST: /https:\/\/(cryptup\.org|flowcrypt\.com)\/[a-zA-Z0-9]{10}/,
      crypto_password_SENTECES: [
        /This\smessage\sis\sencrypted.+\n\n?/gm, // todo - should be in a common place as the code that generated it
        /.*https:\/\/(cryptup\.org|flowcrypt\.com)\/[a-zA-Z0-9]{10}.*\n\n?/gm,
      ],
      crypto_password_GUESSES_PER_SECOND: 10000 * 2 * 4000, //(10k pc)*(2 core p/pc)*(4k guess p/core) httpshttps://www.abuse.ch/?p=3294://threatpost.com/how-much-does-botnet-cost-022813/77573/ https://www.abuse.ch/?p=3294 
      crypto_password_CRACK_TIME_WORDS: [
        {match: 'millenni', word: 'perfect',    bar: 100, color: 'green',       pass: true},
        {match: 'centu',    word: 'great',      bar: 80,  color: 'green',       pass: true},
        {match: 'year',     word: 'good',       bar: 60,  color: 'orange',      pass: true},
        {match: 'month',    word: 'reasonable', bar: 40,  color: 'darkorange',  pass: true},
        {match: 'day',      word: 'poor',       bar: 20,  color: 'darkred',     pass: false},
        {match: '',         word: 'weak',       bar: 10,  color: 'red',         pass: false},
      ],
      google_oauth2: typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest() as FlowCryptManifest).oauth2 : null,
      api_google_AUTH_RESPONDED: 'RESPONDED',
    },
    // meant to be used privately within this file like so: tool._.???
    str_base64url_utf_encode: (str: string) => { // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
      return (typeof str === 'undefined') ? str : btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function(match, p1) {
        return String.fromCharCode(parseInt(p1, 16));
      })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    str_base64url_utf_decode: (str: string) => { // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
      return (typeof str === 'undefined') ? str : decodeURIComponent(Array.prototype.map.call(atob(str.replace(/-/g, '+').replace(/_/g, '/')), function(c: string) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''));
    },
    mime_node_type: (node: MimeParserNode) => {
      if(node.headers['content-type'] && node.headers['content-type'][0]) {
        return node.headers['content-type'][0].value;
      }
    },
    mime_node_filename: (node: MimeParserNode) => {
      // @ts-ignore - lazy
      if(node.headers['content-disposition'] && node.headers['content-disposition'][0] && node.headers['content-disposition'][0].params && node.headers['content-disposition'][0].params.filename) {
        // @ts-ignore - lazy
        return node.headers['content-disposition'][0].params.filename;
      }
      // @ts-ignore - lazy
      if(node.headers['content-type'] && node.headers['content-type'][0] && node.headers['content-type'][0].params && node.headers['content-type'][0].params.name) {
        // @ts-ignore - lazy
        return node.headers['content-type'][0].params.name;
      }
    },
    mime_content_node: (MimeBuilder: any, type: string, content: string): MimeParserNode => {
      let node = new MimeBuilder(type).setContent(content);
      if(type === 'text/plain') {
        node.addHeader('Content-Transfer-Encoding', 'quoted-printable'); // gmail likes this
      }
      return node;
    },
    mime_require: (group: 'parser'|'builder', callback: (m: any) => void) => {
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
    },
    crypto_armor_block_object: (type: MessageBlockType, content: string, missing_end=false):MessageBlock => ({type: type, content: content, complete: !missing_end}),
    crypto_armor_detect_block_next: (original_text: string, start_at: number) => {
      let result = {found: [] as MessageBlock[], continue_at: null as number|null};
      let begin = original_text.indexOf(tool.crypto.armor.headers('null').begin, start_at);
      if(begin !== -1) { // found
        let potential_begin_header = original_text.substr(begin, tool._.var.crypto_armor_header_MAX_LENGTH);
        for(let _type of Object.keys(tool._.var.crypto_armor_headers_DICT)) {
          let type = _type as ReplaceableMessageBlockType;
          let block_header_def = tool._.var.crypto_armor_headers_DICT[type];
          if(block_header_def.replace) {
            let index_of_confirmed_begin = potential_begin_header.indexOf(block_header_def.begin);
            if(index_of_confirmed_begin === 0 || (type === 'password_message' && index_of_confirmed_begin >= 0 && index_of_confirmed_begin < 15)) { // identified beginning of a specific block
              if(begin > start_at) {
                let potential_text_before_block_begun = original_text.substring(start_at, begin).trim();
                if(potential_text_before_block_begun) {
                  result.found.push(tool._.crypto_armor_block_object('text', potential_text_before_block_begun));
                }
              }
              let end_index: number = -1;
              let found_block_end_header_length = 0;
              if(typeof block_header_def.end === 'string') {
                end_index = original_text.indexOf(block_header_def.end, begin + block_header_def.begin.length);
                found_block_end_header_length = block_header_def.end.length;
              } else { // regexp
                let original_text_after_begin_index = original_text.substring(begin);
                let regexp_end = original_text_after_begin_index.match(block_header_def.end);
                if(regexp_end !== null) {
                  end_index = regexp_end.index ? begin + regexp_end.index : -1;
                  found_block_end_header_length = regexp_end[0].length;
                }
              }
              if(end_index !== -1) { // identified end of the same block
                if(type !== 'password_message') {
                  result.found.push(tool._.crypto_armor_block_object(type, original_text.substring(begin, end_index + found_block_end_header_length).trim()));
                } else {
                  let pm_full_text = original_text.substring(begin, end_index + found_block_end_header_length).trim();
                  let pm_short_id_match = pm_full_text.match(/[a-zA-Z0-9]{10}$/);
                  if(pm_short_id_match) {
                    result.found.push(tool._.crypto_armor_block_object(type, pm_short_id_match[0]));
                  } else {
                    result.found.push(tool._.crypto_armor_block_object('text', pm_full_text));
                  }
                }
                result.continue_at = end_index + found_block_end_header_length;
              } else { // corresponding end not found
                result.found.push(tool._.crypto_armor_block_object(type, original_text.substr(begin), true));
              }
              break;
            }
          }
        }
      }
      if(original_text && !result.found.length) { // didn't find any blocks, but input is non-empty
        let potential_text = original_text.substr(start_at).trim();
        if(potential_text) {
          result.found.push(tool._.crypto_armor_block_object('text', potential_text));
        }
      }
      return result;
    },
    crypto_hash_sha256_loop: (string: string, times=100000) => {
      for(let i = 0; i < times; i++) {
        string = tool.crypto.hash.sha256(string);
      }
      return string;
    },
    crypto_key_ids: (armored_pubkey: string) => openpgp.key.readArmored(armored_pubkey).keys[0].getKeyIds(),
    crypto_message_get_sorted_keys_for_message: async (account_email: string, message: OpenpgpMessage): Promise<InternalSortedKeysForDecrypt> => {
      let keys: InternalSortedKeysForDecrypt = {
        verification_contacts: [],
        for_verification: [],
        encrypted_for: [],
        signed_by: [],
        prv_matching: [],
        prv_for_decrypt: [],
        prv_for_decrypt_with_passphrases: [],
        prv_for_decrypt_without_passphrases: [],
      };
      keys.encrypted_for = (message.getEncryptionKeyIds ? message.getEncryptionKeyIds() : []).map(id => tool.crypto.key.longid((id as any).bytes)).filter(Boolean) as string[];
      keys.signed_by = (message.getSigningKeyIds ? message.getSigningKeyIds() : []).filter(Boolean).map(id => tool.crypto.key.longid((id as any).bytes)).filter(Boolean) as string[];
      let private_keys_all = await Store.keys_get(account_email);
      keys.prv_matching = private_keys_all.filter(ki => tool.value(ki.longid).in(keys.encrypted_for));
      if(keys.prv_matching.length) {
        keys.prv_for_decrypt = keys.prv_matching;
      } else {
        keys.prv_for_decrypt = private_keys_all;
      }
      let passphrases = await Promise.all(keys.prv_for_decrypt.map(ki => Store.passphrase_get(account_email, ki.longid)));
      for(let i in keys.prv_for_decrypt) {
        if(passphrases[i] !== null) {
          let key = openpgp.key.readArmored(keys.prv_for_decrypt[i].private).keys[0];
          if(tool.crypto.key.decrypt(key, passphrases[i]!).success) {
            keys.prv_for_decrypt[i].decrypted = key;
            keys.prv_for_decrypt_with_passphrases.push(keys.prv_for_decrypt[i]);
          } else {
            keys.prv_for_decrypt_without_passphrases.push(keys.prv_for_decrypt[i]);
          }
        } else {
          keys.prv_for_decrypt_without_passphrases.push(keys.prv_for_decrypt[i]);
        }
      }
      if(keys.signed_by.length && typeof Store.db_contact_get === 'function') {
        let verification_contacts = await Store.db_contact_get(null, keys.signed_by);
        keys.verification_contacts = verification_contacts.filter(contact => contact !== null) as Contact[];
        keys.for_verification = [].concat.apply([], keys.verification_contacts.map(contact => openpgp.key.readArmored(contact.pubkey).keys));
      }
      return keys;
    },
    crypto_message_zeroed_decrypt_error_counts: (keys:InternalSortedKeysForDecrypt|null=null) => {
      return {
        decrypted: 0,
        potentially_matching_keys: keys ? keys.prv_matching.length : 0,
        chosen_keys: keys ? keys.prv_for_decrypt.length : 0,
        attempts_planned: keys ? keys.prv_for_decrypt_with_passphrases.length : 0,
        attempts_done: 0,
        key_mismatch: 0,
        wrong_password: 0,
        unsecure_mdc: 0,
        format_errors: 0,
      };
    },
    crypto_message_increment_decrypt_error_counts: (counts: DecryptedErrorCounts, other_errors: string[], message_password: string|null, decrypt_error: Error) => {
      if(String(decrypt_error) === 'Error: Error decrypting message: Cannot read property \'isDecrypted\' of null' && !message_password) {
        counts.key_mismatch++; // wrong private key
      } else if(String(decrypt_error) === 'Error: Error decrypting message: Invalid session key for decryption.' && !message_password) {
        counts.key_mismatch++; // attempted opening password only message with key
      } else if(message_password && tool.value(String(decrypt_error)).in(['Error: Error decrypting message: Invalid enum value.', 'Error: Error decrypting message: CFB decrypt: invalid key'])) {
        counts.wrong_password++; // wrong password
      } else if(String(decrypt_error) === 'Error: Error decrypting message: Decryption failed due to missing MDC in combination with modern cipher.') {
        counts.unsecure_mdc++;
      } else if (String(decrypt_error) === 'Error: Error decrypting message: Decryption error') {
        counts.format_errors++; // typically
      } else {
        other_errors.push(String(decrypt_error));
      }
      counts.attempts_done++;
    },
    /**
     *
     * @param callback: callback function / listener
     * @param result: result to be called back
     * @returns {boolean}: continue to next attempt
     */
    crypto_message_chained_decryption_result_collector: (callback: Callback, result: DecryptSuccess|DecryptError) => {
      if(result.success === true) {
        callback(result); // callback the moment there is successful decrypt
        return false; // do not try again
      } else if (result.success === false) {
        if(result.counts.attempts_done === result.counts.attempts_planned && !result.counts.decrypted) {
          if(result.counts.format_errors > 0) {
            result.format_error = 'This message seems to be badly formatted.';
          }
          callback(result); // or callback if no success and this was the last attempt
          return false; // do not try again
        }
        return true; // next attempt
      }
    },
    crypto_message_get_decrypt_options: (message: OpenpgpMessage, ki: KeyInfo, is_armored: boolean, message_password: string|null, force_output_format:EncryptDecryptOutputFormat|null=null) => {
      let options: Options = {
        message: message, 
        format: is_armored ? (force_output_format || 'utf8') : (force_output_format || 'binary'),
      };
      if(!message_password) {
        options.privateKey = ki.decrypted;
      } else {
        options.password = tool.crypto.hash.challenge_answer(message_password);
      }
      return options;
    },
    crypto_key_patch_public_keys_to_ignore_expiration: (keys: OpenpgpKey[]) => { // may deprecate this
      let openpgpjs_original_isValidEncryptionKeyPacket = function(keyPacket: any, signature: any) {
        return keyPacket.algorithm !== openpgp.enums.read(openpgp.enums.publicKey, openpgp.enums.publicKey.dsa) && keyPacket.algorithm !== openpgp.enums.read(openpgp.enums.publicKey, openpgp.enums.publicKey.rsa_sign) && (!signature.keyFlags || (signature.keyFlags[0] & openpgp.enums.keyFlags.encrypt_communication) !== 0 || (signature.keyFlags[0] & openpgp.enums.keyFlags.encrypt_storage) !== 0);
      };
      for(let key of keys) {
        for(let subKey of key.subKeys || []) {
          subKey.isValidEncryptionKey = function (primaryKey: any) {
            let verifyResult = this.verify(primaryKey);
            if (verifyResult !== openpgp.enums.keyStatus.valid && verifyResult !== openpgp.enums.keyStatus.expired) {
              return false;
            }
            for (let i = 0; i < this.bindingSignatures.length; i++) {
              if (openpgpjs_original_isValidEncryptionKeyPacket(this.subKey, this.bindingSignatures[i])) {
                return true;
              }
            }
            return false;
          };
        }
      }
    },
    readable_crack_time: (total_seconds: number) => { // http://stackoverflow.com/questions/8211744/convert-time-interval-given-in-seconds-into-more-human-readable-form
      function numberEnding(number: number) {
        return(number > 1) ? 's' : '';
      }
      total_seconds = Math.round(total_seconds);
      let millennia = Math.round(total_seconds / (86400 * 30 * 12 * 100 * 1000));
      if(millennia) {
        return millennia === 1 ? 'a millennium' : 'millennia';
      }
      let centuries = Math.round(total_seconds / (86400 * 30 * 12 * 100));
      if(centuries) {
        return centuries === 1 ? 'a century' : 'centuries';
      }
      let years = Math.round(total_seconds / (86400 * 30 * 12));
      if(years) {
        return years + ' year' + numberEnding(years);
      }
      let months = Math.round(total_seconds / (86400 * 30));
      if(months) {
        return months + ' month' + numberEnding(months);
      }
      let days = Math.round(total_seconds / 86400);
      if(days) {
        return days + ' day' + numberEnding(days);
      }
      let hours = Math.round(total_seconds / 3600);
      if(hours) {
        return hours + ' hour' + numberEnding(hours);
      }
      let minutes = Math.round(total_seconds / 60);
      if(minutes) {
        return minutes + ' minute' + numberEnding(minutes);
      }
      let seconds = total_seconds % 60;
      if(seconds) {
        return seconds + ' second' + numberEnding(seconds);
      }
      return 'less than a second';
    },
    /* [BARE_ENGINE_OMIT_BEGIN] */
    browser_message_destination_parse: (destination_string: string|null) => {
      let parsed = { tab: null as null|number, frame: null as null|number };
      if(destination_string) {
        parsed.tab = Number(destination_string.split(':')[0]);
        // @ts-ignore - adding nonsense into isNaN
        parsed.frame = !isNaN(destination_string.split(':')[1]) ? Number(destination_string.split(':')[1]) : null;
      }
      return parsed;
    },
    get_ajax_progress_xhr: (progress_callbacks: ApiCallProgressCallbacks|null) => {
      let progress_reporting_xhr = new (window as FcWindow).XMLHttpRequest();
      if(progress_callbacks && typeof progress_callbacks.upload === 'function') {
        progress_reporting_xhr.upload.addEventListener('progress', function(evt: ProgressEvent) {
          progress_callbacks.upload!(evt.lengthComputable ? Math.round((evt.loaded / evt.total) * 100) : null, null, null); // checked ===function above
        }, false);
      }
      if(progress_callbacks && typeof progress_callbacks.download === 'function') {
        progress_reporting_xhr.onprogress = function (evt: ProgressEvent) {
          progress_callbacks.download!(evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : null, evt.loaded, evt.total); // checked ===function above
        };
      }
      return progress_reporting_xhr;
    },
    api_call: (base_url: string, path: string, values: Dict<any>, format: ApiCallFormat, progress:ApiCallProgressCallbacks|null, headers:FlatHeaders|undefined=undefined, response_format:ApiResponseFormat='json', method:ApiCallMethod='POST'): FcPromise<any> => {
      progress = progress || {} as ApiCallProgressCallbacks;
      let formatted_values:FormData|string;
      let content_type: string|false;
      if(format === 'JSON' && values !== null) {
        formatted_values = JSON.stringify(values);
        content_type = 'application/json; charset=UTF-8';
      } else if(format === 'FORM') {
        formatted_values = new FormData();
        for(let name of Object.keys(values)) {
          let value = values[name];
          if(typeof value === 'object' && value.name && value.content && value.type) {
            (formatted_values as FormData).append(name, new Blob([value.content], { type: value.type }), value.name); // todo - type should be just app/pgp? for privacy
          } else {
            (formatted_values as FormData).append(name, value);
          }
        }
        content_type = false;
      } else {
        throw Error('unknown format:' + String(format));
      }
      return tool.catch.Promise(function(resolve, reject) {
        $.ajax({
          xhr: function() {
            return tool._.get_ajax_progress_xhr(progress);
          },
          url: base_url + path,
          method: method,
          data: formatted_values,
          dataType: response_format,
          crossDomain: true,
          headers: headers,
          processData: false,
          contentType: content_type,
          async: true,
          timeout: typeof progress!.upload === 'function' || typeof progress!.download === 'function' ? undefined : 20000, // substituted with {} above 
          success: function (response) {
            tool.catch.try(function () {
              if(response && typeof response === 'object' && typeof response.error === 'object') {
                reject(response.error);
              } else {
                resolve(response);
              }
            })();
          },
          error: function (XMLHttpRequest, status, error) {
            tool.catch.try(function () {
              if(XMLHttpRequest.status === 0) {
                reject({code: null, message: 'Internet connection not available', internal: 'network'});
              } else {
                reject({code: XMLHttpRequest.status, message: String(error)});
              }
            })();
          },
        });
      });
    },
    api_google_has_new_scope: (new_scopes: string[]|null, original_scopes: string[], omit_read_scope: boolean) => {
      new_scopes = new_scopes || [];
      original_scopes = original_scopes || [];
      if(!original_scopes.length) {
        return true; // no original scopes
      }
      if(!new_scopes.length) { // no new scopes specified
        return(original_scopes.length === 2 && !omit_read_scope); // however, previously there were only two of three scopes, and third was not omitted this time
      }
      for(let i = 0; i < new_scopes.length; i++) {
        if(!tool.value(new_scopes[i]).in(original_scopes)) {
          return true; // found a new scope
        }
      }
      return false; // no new scope found
    },
    api_google_auth_state_pack: (status_object: AuthRequest) => tool._.var.google_oauth2!.state_header + JSON.stringify(status_object),
    api_google_auth_code_url: (auth_request: AuthRequest) => {
      return tool.env.url_create(tool._.var.google_oauth2!.url_code, {
        client_id: tool._.var.google_oauth2!.client_id,
        response_type: 'code',
        access_type: 'offline',
        state: tool._.api_google_auth_state_pack(auth_request),
        redirect_uri: tool._.var.google_oauth2!.url_redirect,
        scope: (auth_request.scopes || []).join(' '),
        login_hint: auth_request.account_email,
      });
    },
    google_auth_save_tokens: (account_email: string, tokens_object: GoogleAuthTokensResponse, scopes: string[], callback: Callback) => {
      let to_save: AccountStore = {
        google_token_access: tokens_object.access_token,
        google_token_expires: new Date().getTime() + (tokens_object.expires_in as number) * 1000,
        google_token_scopes: scopes,
      };
      if(typeof tokens_object.refresh_token !== 'undefined') {
        to_save['google_token_refresh'] = tokens_object.refresh_token;
      }
      Store.set(account_email, to_save).then(callback);
    },
    google_auth_get_tokens: (code: string, callback: (r: GoogleAuthTokensResponse|AjaxError) => void, retries_left: number) => {
      $.ajax({
        url: tool.env.url_create(tool._.var.google_oauth2!.url_tokens, { grant_type: 'authorization_code', code: code, client_id: tool._.var.google_oauth2!.client_id, redirect_uri: tool._.var.google_oauth2!.url_redirect }),
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
              tool._.google_auth_get_tokens(code, callback, retries_left - 1);
            }, 2000);
          }
        },
      });
    },
    google_auth_refresh_token: (refresh_token: string, callback: (ok: boolean, r: GoogleAuthTokensResponse|string|AjaxError) => void) => {
      $.ajax({
        url: tool.env.url_create(tool._.var.google_oauth2!.url_tokens, { grant_type: 'refresh_token', refresh_token: refresh_token, client_id: tool._.var.google_oauth2!.client_id }),
        method: 'POST',
        crossDomain: true,
        async: true,
        success: function (response) {
          callback(true, response as GoogleAuthTokensResponse);
        },
        error: function (XMLHttpRequest, status, error) {
          if(XMLHttpRequest.status === 0 && status === 'error') { // connection error
            callback(false, tool.api.error.network);
          } else {
            callback(false, { request: XMLHttpRequest, status: status, error: error });
          }
        },
      });
    },
    google_auth_check_email: (expected_email: string, access_token: string, callback: Callback) => {
      $.ajax({
        url: 'https://www.googleapis.com/gmail/v1/users/me/profile',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + access_token },
        crossDomain: true,
        contentType: 'application/json; charset=UTF-8',
        async: true,
        success: function (response) {
          callback(response.emailAddress || expected_email);  // todo - emailAddress may be undefined. Handle better
        },
        error: function (response) {
          console.log('google_auth_check_email error');
          console.log(expected_email);
          console.log(response);
          callback(expected_email); //todo - handle better. On a network error, this could result in saving this wrongly. Should re-try two times with some delay, then call back.
        },
      });
    },
    google_auth_window_result_handler: (expected_responder_id: string, result: any, close_auth_window: Callback) => {
      if(result.state.auth_responder_id === expected_responder_id) {
        let auth_responder = tool._.var.api_google_auth_responders[result.state.auth_responder_id];
        if(auth_responder !== tool._.var.api_google_AUTH_RESPONDED && typeof auth_responder === 'function') {
          tool._.var.api_google_auth_responders[result.state.auth_responder_id] = tool._.var.api_google_AUTH_RESPONDED;
          close_auth_window();
          switch(result.result) {
            case 'Success':
            tool._.google_auth_get_tokens(result.params.code, function (tokens_object) {
                if(typeof (tokens_object as GoogleAuthTokensResponse).access_token !== 'undefined') {
                  tool._.google_auth_check_email(result.state.account_email, (tokens_object as GoogleAuthTokensResponse).access_token, function (account_email) {
                    tool._.google_auth_save_tokens(account_email, tokens_object as GoogleAuthTokensResponse, result.state.scopes, function () {
                      (auth_responder as Callback)({account_email: account_email, success: true, result: 'success', message_id: result.state.message_id});
                    });
                  });
                } else { // got code but failed to use the code to fetch tokens
                  (auth_responder as Callback)({success: false, result: 'success', account_email: result.state.account_email, message_id: result.state.message_id});
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
    },
    api_google_call: (account_email: string, method: ApiCallMethod, url: string, parameters: Dict<Serializable>|string, callback: ApiCallback, fail_on_auth=false) => {
      Store.get_account(account_email, ['google_token_access', 'google_token_expires']).then(function (auth) {
        let data = method === 'GET' || method === 'DELETE' ? parameters : JSON.stringify(parameters);
        if(typeof auth.google_token_access !== 'undefined' && (!auth.google_token_expires || auth.google_token_expires > new Date().getTime())) { // have a valid gmail_api oauth token
          $.ajax({
            url: url,
            method: method,
            data: data,
            headers: { 'Authorization': 'Bearer ' + auth.google_token_access },
            crossDomain: true,
            contentType: 'application/json; charset=UTF-8',
            async: true,
            success: function (response) {
              tool.catch.try(function () {
                callback(true, response);
              })();
            },
            error: function (response) {
              try {
                let error_obj = JSON.parse(response.responseText);
                if(typeof error_obj.error !== 'undefined' && error_obj.error.message === 'Invalid Credentials') {
                  tool._.google_api_handle_auth_error(account_email, method, url, parameters, callback, fail_on_auth, response, tool._.api_google_call);
                } else {
                  // @ts-ignore - edditing native response object
                  response['_error'] = error_obj.error;
                  tool.catch.try(function () {
                    callback(false, response);
                  })();
                }
              } catch(err) {
                tool.catch.try(function () {
                  // @ts-ignore - edditing native response object
                  response['_error'] = {};
                  let re_title = /<title>([^<]+)<\/title>/mgi;
                  let title_match = re_title.exec(response.responseText);
                  if(title_match) {
                    // @ts-ignore - edditing native response object
                    response['_error'].message = title_match[1];
                  }
                  callback(false, response);
                })();
              }
            },
          });
        } else { // no valid gmail_api oauth token
          tool._.google_api_handle_auth_error(account_email, method, url, parameters, callback, fail_on_auth, null, tool._.api_google_call);
        }
      });
    },
    api_gmail_call: (account_email: string, method: ApiCallMethod, resource: string, parameters: Dict<Serializable>|string|null, callback: ApiCallback, fail_on_auth=false, progress:ApiCallProgressCallbacks|null=null, content_type:string|null=null) => {
      if(!account_email) {
        throw new Error('missing account_email in api_gmail_call');
      }
      progress = progress || {};
      Store.get_account(account_email, ['google_token_access', 'google_token_expires']).then((auth) => {
        if(typeof auth.google_token_access !== 'undefined' && (!auth.google_token_expires || auth.google_token_expires > new Date().getTime())) { // have a valid gmail_api oauth token
          let data, url;
          if(typeof progress!.upload === 'function') { // substituted with {} above
            url = 'https://www.googleapis.com/upload/gmail/v1/users/me/' + resource + '?uploadType=multipart';
            data = parameters;
          } else {
            url = 'https://www.googleapis.com/gmail/v1/users/me/' + resource;
            if(method === 'GET' || method === 'DELETE') {
              data = parameters;
            } else {
              data = JSON.stringify(parameters);
            }
          }
          $.ajax({
            xhr: function () {
              return tool._.get_ajax_progress_xhr(progress);
            },
            url,
            method,
            data: data || undefined,
            headers: { 'Authorization': 'Bearer ' + auth.google_token_access },
            crossDomain: true,
            contentType: content_type || 'application/json; charset=UTF-8',
            async: true,
            success: function (response) {
              tool.catch.try(function () {
                if(callback) {
                  callback(true, response);
                }
              })();
            },
            error: function (response) {
              try {
                let error_obj = JSON.parse(response.responseText);
                if(typeof error_obj.error !== 'undefined' && error_obj.error.message === 'Invalid Credentials') {
                  tool._.google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, response, tool._.api_gmail_call, progress, content_type);
                } else {
                  // @ts-ignore - edditing native response object
                  response['_error'] = error_obj.error;
                  if(callback) {
                    tool.catch.try(function () {
                      callback(false, response);
                    })();
                  }
                }
              } catch(err) {
                tool.catch.try(function () {
                  // @ts-ignore - edditing native response object
                  response['_error'] = {};
                  let re_title = /<title>([^<]+)<\/title>/mgi;
                  let title_match = re_title.exec(response.responseText);
                  if(title_match) {
                    // @ts-ignore - edditing native response object
                    response['_error'].message = title_match[1];
                  }
                  if(callback) {
                    callback(false, response);
                  }
                })();
              }
            },
          });
        } else { // no valid gmail_api oauth token
          tool._.google_api_handle_auth_error(account_email, method, resource, parameters, callback, fail_on_auth, null, tool._.api_gmail_call, progress, content_type);
        }
      });
    },
    google_api_authorization_header: (account_email: string): Promise<string> => new Promise(async (resolve, reject) => {
      if(!account_email) {
        throw new Error('missing account_email in api_gmail_call');
      }
      let auth = await Store.get_account(account_email, ['google_token_access', 'google_token_expires']);
      if(typeof auth.google_token_access !== 'undefined' && (!auth.google_token_expires || auth.google_token_expires > new Date().getTime())) { // have a valid gmail_api oauth token
        resolve('Bearer ' + auth.google_token_access);
      } else { // no valid gmail_api oauth token
        tool.api.google.auth({account_email}, async (response) => {
          if(response && response.success === false && response.error === tool.api.error.network) {
            reject(tool.api.error.network);
          } else {
            let auth = await Store.get_account(account_email, ['google_token_access', 'google_token_expires']);
            if(typeof auth.google_token_access !== 'undefined' && (!auth.google_token_expires || auth.google_token_expires > new Date().getTime())) { // have a valid gmail_api oauth token
              resolve('Bearer ' + auth.google_token_access);
            } else {
              reject({code: 401, message: 'Could not refresh google auth token', internal: 'auth'});
            }
          }
        });
      }

    }),
    google_api_handle_auth_error: (account_email: string, method: ApiCallMethod, resource: string, parameters: Dict<Serializable>|string|null, callback: ApiCallback, fail_on_auth: boolean, error_response: any, base_api_function: any, progress:ApiCallProgressCallbacks|null=null, content_type:string|null=null) => {
      if(fail_on_auth !== true) {
        tool.api.google.auth({account_email: account_email}, function (response) {
          if(response && response.success === false && response.error === tool.api.error.network) {
            callback(false, tool.api.error.network);
          } else { //todo: error handling for other bad situations
            base_api_function(account_email, method, resource, parameters, callback, true, progress, content_type);
          }
        });
      } else {
        callback(false, error_response);
      }
    },
    encode_as_multipart_related: (parts: Dict<string>) => { // todo - this could probably be achieved with emailjs-mime-builder
      let boundary = 'this_sucks_' + tool.str.random(10);
      let body = '';
      for(let type of Object.keys(parts)) {
        body += '--' + boundary + '\n';
        body += 'Content-Type: ' + type + '\n';
        if(tool.value('json').in(type as string)) {
          body += '\n' + parts[type] + '\n\n';
        } else {
          body += 'Content-Transfer-Encoding: base64\n';
          body += '\n' + btoa(parts[type]) + '\n\n';
        }
      }
      body += '--' + boundary + '--';
      return { content_type: 'multipart/related; boundary=' + boundary, body: body };
    },
    api_gmail_loop_through_emails_to_compile_contacts: async (account_email: string, query: string, chunked_callback: (r: ProviderContactsResults) => void) => {
      let all_results: ProviderContactsResult[] = [];
      while(true) {
        let headers = await tool.api.gmail.fetch_messages_based_on_query_and_extract_first_available_header(account_email, query, ['to', 'date']);
        if(headers.to) {
          let new_results = headers.to.split(/, ?/).map(tool.str.parse_email).map(r => ({date: headers.date, name: r.name, email: r.email, full: r.full}));
          query += new_results.map(email => ' -to:"' + email.email + '"').join('');
          all_results = all_results.concat(new_results);
          chunked_callback({new: new_results, all: all_results});
        } else {
          chunked_callback({ new: [], all: all_results });
          return;
        }
      }
    },
    api_gmail_fetch_messages_sequentially_from_list_and_extract_first_available_header: async (account_email: string, messages: ApirGmailMessageList$message[], header_names: string[]): Promise<FlatHeaders> => {
      for(let message of messages) {
        let header_values: FlatHeaders = {};
        let message_get_response = await tool.api.gmail.message_get(account_email, message.id, 'metadata');
        for(let header_name of header_names) {
          let value = tool.api.gmail.find_header(message_get_response, header_name);
          if (value !== null) {
            header_values[header_name] = value;
          } else {
            break;
          }
        }
        if(Object.values(header_values).length === header_names.length) {
          return header_values; // all requested header values found in one msg
        }
      }
      return {}
    },
    api_attester_packet_armor: (content_text: string) => `${tool.crypto.armor.headers('attest_packet').begin}\n${content_text}\n${tool.crypto.armor.headers('attest_packet').end}`,
    api_attester_call: (path: string, values: Dict<any>) => tool._.api_call('https://attester.flowcrypt.com/', path, values, 'JSON', null, {'api-version': '3'} as FlatHeaders),
    // api_attester_call: (path: string, values: Dict<any>) => tool._.api_call('http://127.0.0.1:5002/, path, values, 'JSON', null, {'api-version': '3'} as HeadersDict),
    api_cryptup_call: (path: string, values: Dict<any>, format='JSON' as ApiCallFormat) => tool._.api_call(tool.api.cryptup.url('api'), path, values, format, null, {'api-version': '3'} as FlatHeaders),
    // api_cryptup_call: (path: string, values: Dict<any>, format='JSON' as ApiCallFormat) => tool._.api_call('http://127.0.0.1:5001/', path, values, format, null, {'api-version': '3'} as HeadersDict),
    /* [BARE_ENGINE_OMIT_END] */
  },
  catch: { // web and extension code
    handle_error: (error_message: string|undefined, url: string, line: number, col: number, error: string|Error|Dict<Serializable>, is_manually_called: boolean, version: string, env: string) => {
      if(typeof error === 'string') {
        error_message = error;
        error = { name: 'thrown_string', message: error_message, stack: error_message };
      }
      if(error_message && url && typeof line !== 'undefined' && !col && !error && !is_manually_called && !version && !env) { // safari has limited support
        error = { name: 'safari_error', message: error_message, stack: error_message };
      }
      if(typeof error_message === 'undefined' && line === 0 && col === 0 && is_manually_called && typeof error === 'object' && !(error instanceof Error)) {
        let stringified;
        try { // this sometimes happen with unhandled Promise.then(_, reject)
          stringified = JSON.stringify(error);
        } catch(cannot) {
          stringified = 'typeof: ' + (typeof error) + '\n' + String(error);
        }
        error = { name: 'thrown_object', message: error.message || '(unknown)', stack: stringified};
        error_message = 'thrown_object'
      }
      let user_log_message = ' Please report errors above to human@flowcrypt.com. I fix errors VERY promptly.';
      let ignored_errors = [
        'Invocation of form get(, function) doesn\'t match definition get(optional string or array or object keys, function callback)', // happens in gmail window when reloaded extension + now reloading gmail
        'Invocation of form set(, function) doesn\'t match definition set(object items, optional function callback)', // happens in gmail window when reloaded extension + now reloading gmail
        'Invocation of form runtime.connect(null, ) doesn\'t match definition runtime.connect(optional string extensionId, optional object connectInfo)',
      ];
      if(!error) {
        return;
      }
      if(ignored_errors.indexOf((error as Error).message) !== -1) { // todo - remove cast & debug
        return true;
      }
      if((error as Error).stack) { // todo - remove cast & debug
        console.log('%c[' + error_message + ']\n' + (error as Error).stack, 'color: #F00; font-weight: bold;');  // todo - remove cast & debug
      } else {
        console.log('%c' + error_message, 'color: #F00; font-weight: bold;');
      }
      if(is_manually_called !== true && tool.catch._.original_on_error && tool.catch._.original_on_error !== (tool.catch.handle_error as ErrorEventHandler)) {
        tool.catch._.original_on_error.apply(this, arguments); // Call any previously assigned handler
      }
      if(((error as Error).stack || '').indexOf('PRIVATE') !== -1) { // todo - remove cast & debug
        return;
      }
      if(error instanceof UnreportableError) {
        return;
      }
      try {
        $.ajax({
          url: 'https://flowcrypt.com/api/help/error',
          method: 'POST',
          data: JSON.stringify({
            name: ((error as Error).name || '').substring(0, 50), // todo - remove cast & debug
            message: (error_message || '').substring(0, 200),
            url: (url || '').substring(0, 100),
            line: line || 0,
            col: col || 0,
            trace: (error as Error).stack || '', // todo - remove cast & debug
            version: version || tool.catch.version() || 'unknown',
            environment: env || tool.catch.environment(),
          }),
          dataType: 'json',
          crossDomain: true,
          contentType: 'application/json; charset=UTF-8',
          async: true,
          success: function (response) {
            if(response.saved === true) {
              console.log('%cFlowCrypt ERROR:' + user_log_message, 'font-weight: bold;');
            } else {
              console.log('%cFlowCrypt EXCEPTION:' + user_log_message, 'font-weight: bold;');
            }
          },
          error: function (XMLHttpRequest, status, error) {
            console.log('%cFlowCrypt FAILED:' + user_log_message, 'font-weight: bold;');
          },
        });
      } catch(ajax_err) {
        console.log(ajax_err.message);
        console.log('%cFlowCrypt ISSUE:' + user_log_message, 'font-weight: bold;');
      }
      try {
        if(typeof Store.get_account === 'function' && typeof Store.set === 'function') {
          Store.get_global(['errors']).then(function (s: any) {
            if(typeof s.errors === 'undefined') {
              s.errors = [] as Error[];
            }
            s.errors.unshift((error as Error).stack || error_message); // todo - remove cast & debug
            // noinspection JSIgnoredPromiseFromCall
            Store.set(null, s);
          });
        }
      } catch (storage_err) {
        console.log('failed to locally log error "' + String(error_message) + '" because: ' + storage_err.message);
      }
      return true;
    },
    handle_exception: (exception: Error) => {
      let line, col;
      try {
        let caller_line = exception.stack!.split('\n')[1]; // will be catched below
        let matched = caller_line.match(/\.js:([0-9]+):([0-9]+)\)?/);
        line = Number(matched![1]); // will be catched below
        col = Number(matched![2]); // will be catched below
      } catch(line_err) {
        line = 0;
        col = 0;
      }
      tool.catch._.runtime = tool.catch._.runtime || {};
      tool.catch.handle_error(exception.message, window.location.href, line, col, exception, true, tool.catch._.runtime['version'], tool.catch._.runtime['environment']);
    },
    report: (name: string, details:Error|Serializable|StandardError|PromiseRejectionEvent=undefined) => {
      try {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(name);
      } catch(e) {
        if(typeof details !== 'string') {
          try {
            details = JSON.stringify(details);
          } catch(stringify_error) {
            details = '(could not stringify details "' + String(details) + '" in tool.catch.report because: ' + stringify_error.message + ')';
          }
        }
        e.stack = e.stack + '\n\n\ndetails: ' + details;
        tool.catch.handle_exception(e);
      }
    },
    log: (name: string, details:Serializable|Error|Dict<Serializable>=undefined) => {
      name = 'tool.catch.log: ' + name;
      console.log(name);
      try {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(name);
      } catch(e) {
        if(typeof details !== 'string') {
          try {
            details = JSON.stringify(details);
          } catch(stringify_error) {
            details = '(could not stringify details "' + String(details) + '" in tool.catch.log because: ' + stringify_error.message + ')';
          }
        }
        e.stack = e.stack + '\n\n\ndetails: ' + details;
        try {
          Store.get_global(['errors']).then(function (s: any) {
            if(typeof s.errors === 'undefined') {
              s.errors = [];
            }
            s.errors.unshift(e.stack || name);
            // noinspection JSIgnoredPromiseFromCall
            Store.set(null, s);
          });
        } catch (storage_err) {
          console.log('failed to locally log info "' + String(name) + '" because: ' + storage_err.message);
        }
      }
    },
    version: (format='original') => {
      if(format === 'int') {
        return tool.catch._.runtime['version'] ? Number(tool.catch._.runtime['version'].replace(/\./g, '')) : null;
      } else {
        return tool.catch._.runtime['version'] || null;
      }
    },
    try: (code: Function) => {
      return function () {
        try {
          return code();
        } catch(code_err) {
          tool.catch.handle_exception(code_err);
        }
      };
    },
    environment: (url=window.location.href): string => {
      let browser_name = tool.env.browser().name;
      let env = 'unknown';
      if(url.indexOf('bnjglocicd') !== -1) {
        env = 'ex:prod';
      } else if(url.indexOf('gjdhkacdgd') !== -1) {
        env = 'ex:dev';
      } else if(url.indexOf('gjdhkacdgd') !== -1) { // in case it differs in the future
        env = 'ex:test';
      } else if (url.indexOf('l.flowcrypt.com') !== -1 || url.indexOf('127.0.0.1') !== -1) {
        env = 'web:local';
      } else if (url.indexOf('cryptup.org') !== -1 || url.indexOf('flowcrypt.com') !== -1) {
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
    },
    test: () => {
      // @ts-ignore - intentional exception
      this_will_fail();
    },
    Promise: (f: (resolve: (result?: any) => void, reject: (error?: any) => void) => void): FcPromise<any> => {
      return new Promise(function(resolve, reject) {
        try {
          f(resolve, reject);
        } catch(e) {
          tool.catch.handle_exception(e);
          reject({code: null, message: 'Error happened, please write me at human@flowcrypt.com to fix this\n\nError: ' + e.message, internal: 'exception'});
        }
      }) as FcPromise<any>;
    },
    promise_error_alert: (note: string) => {
      return function (error: Error) {
        console.log(error);
        alert(note);
      };
    },
    stack_trace: () => {
      try {
        tool.catch.test();
      } catch(e) {
        return e.stack.split('\n').splice(3).join('\n'); // return stack after removing first 3 lines
      }
    },
    handle_promise_error: (e: PromiseRejectionEvent|StandardError|Error) => {
      if(e && typeof e === 'object' && e.hasOwnProperty('reason') && typeof (e as PromiseRejectionEvent).reason === 'object' && (e as PromiseRejectionEvent).reason && (e as PromiseRejectionEvent).reason.message) {
        tool.catch.handle_exception((e as PromiseRejectionEvent).reason); // actual exception that happened in Promise, unhandled
      } else if(!tool.value(JSON.stringify(e)).in(['{"isTrusted":false}', '{"isTrusted":true}'])) {  // unrelated to FlowCrypt, has to do with JS-initiated clicks/events
        tool.catch.report('unhandled_promise_reject_object', e); // some x that was called with reject(x) and later not handled
      }
    },
    _: {
      runtime: {} as Dict<string>,
      original_on_error: window.onerror,
      initialize: () => {
        figure_out_flowcrypt_runtime();

        (window as FcWindow).onerror = (tool.catch.handle_error as ErrorEventHandler);
        (window as FcWindow).onunhandledrejection = tool.catch.handle_promise_error;
      
        function figure_out_flowcrypt_runtime() {
          if((window as FcWindow).is_bare_engine !== true) {
            try {
              tool.catch._.runtime['version'] = chrome.runtime.getManifest().version;
            } catch(err) {
            }
            tool.catch._.runtime['environment'] = tool.catch.environment();
            if(!tool.env.is_background_script() && tool.env.is_extension()) {
              tool.browser.message.send(null, 'runtime', null, function (extension_runtime) {
                if(typeof extension_runtime !== 'undefined') {
                  tool.catch._.runtime = extension_runtime;
                } else {
                  setTimeout(figure_out_flowcrypt_runtime, 200);
                }
              });
            }
          }
        }
      },
    }
  },
};

tool.catch._.initialize();

(function ( /* EXTENSIONS AND CONFIG */ ) {

  if(typeof (window as FcWindow).openpgp !== 'undefined' && typeof (window as FcWindow).openpgp.config !== 'undefined' && typeof (window as FcWindow).openpgp.config.versionstring !== 'undefined' && typeof (window as FcWindow).openpgp.config.commentstring !== 'undefined') {
    (window as FcWindow).openpgp.config.versionstring = 'FlowCrypt ' + (tool.catch.version() || '') + ' Gmail Encryption flowcrypt.com';
    (window as FcWindow).openpgp.config.commentstring = 'Seamlessly send, receive and search encrypted email';
  }

  (RegExp as any).escape = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  String.prototype.repeat = String.prototype.repeat || function(count) {
    if (this == null) {
      throw new TypeError('can\'t convert ' + this + ' to object');
    }
    let str = '' + this;
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
    let rpt = '';
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

  (Promise as any).prototype.validate = (Promise as any).prototype.validate || function(validity_checker: (r: any) => boolean) {
    let original_promise = this;
    return tool.catch.Promise(function(resolve, reject) {
      original_promise.then(function(response: any) {
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

  (Promise as any).prototype.resolved = (Promise as any).prototype.resolved || function(next: (ok: boolean, v: any) => void) {
    return this.then(function(x: any) {
      next(true, x);
    }, function(x: any) {
      next(false, x);
    });
  };

  Promise.sequence = Promise.sequence || function (promise_factories: (() => void)[]) {
    return tool.catch.Promise(function (resolve, reject) {
      let all_results: any[] = [];
      return promise_factories.reduce((chained_promises: Promise<any>, create_promise) => {
        return chained_promises.then(function(promise_result) {
          all_results.push(promise_result);
          return create_promise();
        });
      }, Promise.resolve('remove+me')).then(function(last_promise_result) {
        all_results.push(last_promise_result);
        resolve(all_results.splice(1)); // remove first bogus promise result
      });
    });
  }

})();
