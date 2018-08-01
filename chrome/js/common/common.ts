
/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />
/// <reference path="common.d.ts" />
/// <reference path="openpgp.d.ts" />

'use strict';

declare let $_HOST_html_to_text: (html: string) => string;
declare let MimeParser: AnyThirdPartyLibrary;
declare let MimeBuilder: AnyThirdPartyLibrary;
declare var require: AnyThirdPartyLibrary;
declare var exports: AnyPlatformDependentCode;
declare let openpgp: typeof OpenPGP;

class UnreportableError extends Error {}

enum DecryptErrorTypes {
  key_mismatch = 'key_mismatch',
  use_password = 'use_password',
  wrong_password = 'wrong_password',
  no_mdc = 'no_mdc',
  need_passphrase = 'need_passphrase',
  format = 'format',
  other = 'other',
}

let tool = {
  str: {
    parse_email: (email_string: string) => {
      if (tool.value('<').in(email_string) && tool.value('>').in(email_string)) {
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
    html_as_text: (html_text: string): Promise<string> => new Promise((resolve, reject) => {
      // extracts innerText from a html text in a safe way without executing any contained js
      // firefox does not preserve line breaks of iframe.contentDocument.body.innerText due to a bug - have to guess the newlines with regexes
      // this is still safe because Firefox does strip all other tags
      let br: string;
      let block_start: string;
      let block_end: string;
      if (tool.env.browser().name === 'firefox') {
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
      e.style.display = 'none';
      e.onload = () => {
        if (e.contentDocument === null) {
          tool.catch.report('e.contentDocument null');
          return;
        }
        let text = e.contentDocument.body.innerText;
        if (tool.env.browser().name === 'firefox') {
          text = text.replace(RegExp('(' + block_start + ')+', 'g'), block_start).replace(RegExp('(' + block_end + ')+', 'g'), block_end);
          text = text.split(block_end + block_start).join(br).split(br + block_end).join(br);
          text = text.split(br).join('\n').split(block_start).filter(v => !!v).join('\n').split(block_end).filter(v => !!v).join('\n');
          text = text.replace(/\n{2,}/g, '\n\n');
        }
        resolve(text.trim());
        document.body.removeChild(e);
      };
      document.body.appendChild(e);
    }),
    normalize_spaces: (str: string) => str.replace(RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32)).replace(/\n /g, '\n'),
    normalize_dashes: (str: string) => str.replace(/^—–|—–$/gm, '-----'),
    normalize: (str: string) => tool.str.normalize_spaces(tool.str.normalize_dashes(str)),
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
      for (let i = 0; i < length; i++) {
        id += possible.charAt(Math.floor(Math.random() * possible.length));
      }
      return id;
    },
    html_attribute_encode: (values: object): string => tool._.str_base64url_utf_encode(JSON.stringify(values)),
    html_attribute_decode: (encoded: string): object => JSON.parse(tool._.str_base64url_utf_decode(encoded)),
    // http://stackoverflow.com/questions/1219860/html-encoding-lost-when-attribute-read-from-input-field
    html_escape: (str: string) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;'),
    html_unescape: (str: string) => str.replace(/&#x2F;/g, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
    as_safe_html: async (text_or_html: string): Promise<string> => {
      let nl = '_cryptup_newline_placeholder_' + tool.str.random(3) + '_';
      let plain = await tool.str.html_as_text(text_or_html.replace(/<br ?\/?> ?\r?\n/gm, nl).replace(/\r?\n/gm, nl).replace(/</g, '&lt;').replace(RegExp(nl, 'g'), '<br>'));
      return plain.trim().replace(/</g, '&lt;').replace(/\n/g, '<br>').replace(/ {2,}/g, (spaces) => '&nbsp;'.repeat(spaces.length));
    },
    base64url_encode: (str: string) => (typeof str === 'undefined') ? str : btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''), // used for 3rd party API calls - do not change w/o testing Gmail api attachments
    base64url_decode: (str: string) => (typeof str === 'undefined') ? str : atob(str.replace(/-/g, '+').replace(/_/g, '/')), // used for 3rd party API calls - do not change w/o testing Gmail api attachments
    from_uint8: (u8a: Uint8Array|string): string => {
      if(typeof u8a === 'string') {
        return u8a;
      }
      let CHUNK_SZ = 0x8000;
      let c = [];
      for (let i = 0; i < u8a.length; i += CHUNK_SZ) {
        c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
      }
      return c.join('');
    },
    to_uint8: (raw: string|Uint8Array): Uint8Array => {
      if(raw instanceof Uint8Array) {
        return raw;
      }
      let rawLength = raw.length;
      let uint8 = new Uint8Array(new ArrayBuffer(rawLength));
      for (let i = 0; i < rawLength; i++) {
        uint8[i] = raw.charCodeAt(i);
      }
      return uint8;
    },
    from_equal_sign_notation_as_utf: (str: string): string => {
      return str.replace(/(=[A-F0-9]{2})+/g, equal_sign_utf_part => {
        return tool.str.uint8_as_utf(equal_sign_utf_part.replace(/^=/, '').split('=').map((two_hex_digits) => parseInt(two_hex_digits, 16)));
      });
    },
    uint8_as_utf: (a: Uint8Array|number[]) => { // tom
      let length = a.length;
      let bytes_left_in_char = 0;
      let utf8_string = '';
      let binary_char = '';
      for (let i = 0; i < length; i++) {
        if (a[i] < 128) {
          if (bytes_left_in_char) { // utf-8 continuation byte missing, assuming the last character was an 8-bit ASCII character
            utf8_string += String.fromCharCode(a[i-1]);
          }
          bytes_left_in_char = 0;
          binary_char = '';
          utf8_string += String.fromCharCode(a[i]);
        } else {
          if (!bytes_left_in_char) { // beginning of new multi-byte character
            if (a[i] >= 128 && a[i] < 192) { // 10xx xxxx
              utf8_string += String.fromCharCode(a[i]); // extended 8-bit ASCII compatibility, european ASCII characters
            } else if (a[i] >= 192 && a[i] < 224) { // 110x xxxx
              bytes_left_in_char = 1;
              binary_char = a[i].toString(2).substr(3);
            } else if (a[i] >= 224 && a[i] < 240) { // 1110 xxxx
              bytes_left_in_char = 2;
              binary_char = a[i].toString(2).substr(4);
            } else if (a[i] >= 240 && a[i] < 248) { // 1111 0xxx
              bytes_left_in_char = 3;
              binary_char = a[i].toString(2).substr(5);
            } else if (a[i] >= 248 && a[i] < 252) { // 1111 10xx
              bytes_left_in_char = 4;
              binary_char = a[i].toString(2).substr(6);
            } else if (a[i] >= 252 && a[i] < 254) { // 1111 110x
              bytes_left_in_char = 5;
              binary_char = a[i].toString(2).substr(7);
            } else {
              console.log('tool.str.uint8_as_utf: invalid utf-8 character beginning byte: ' + a[i]);
            }
          } else { // continuation of a multi-byte character
            binary_char += a[i].toString(2).substr(2);
            bytes_left_in_char--;
          }
          if (binary_char && !bytes_left_in_char) {
            utf8_string += String.fromCharCode(parseInt(binary_char, 2));
            binary_char = '';
          }
        }
      }
      return utf8_string;
    },
    to_hex: (s: string): string => { // http://phpjs.org/functions/bin2hex/, Kevin van Zonneveld (http://kevin.vanzonneveld.net), Onno Marsman, Linuxworld, ntoniazzi
      let o = '';
      s += '';
      for (let i = 0; i < s.length; i++) {
        let n = s.charCodeAt(i).toString(16);
        o += n.length < 2 ? '0' + n : n;
      }
      return o;
    },
    from_hex: (hex: string): string => {
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        let v = parseInt(hex.substr(i, 2), 16);
        if (v) {
          str += String.fromCharCode(v);
        }
      }
      return str;
    },
    extract_cryptup_attachments: (decrypted_content: string, cryptup_attachments: Attachment[]) => {
      if (tool.value('cryptup_file').in(decrypted_content)) {
        decrypted_content = decrypted_content.replace(/<a[^>]+class="cryptup_file"[^>]+>[^<]+<\/a>/g, found_link => {
          let element = $(found_link);
          let cryptup_data = element.attr('cryptup-data');
          if (cryptup_data) {
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
      if (cryptup_token_element.length) {
        let cryptup_data = cryptup_token_element.attr('cryptup-data');
        if (cryptup_data) {
          return tool.str.html_attribute_decode(cryptup_data);
        }
      }
    },
    strip_cryptup_reply_token: (decrypted_content: string) => decrypted_content.replace(/<div[^>]+class="cryptup_reply"[^>]+><\/div>/, ''),
    strip_public_keys: (decrypted_content: string, found_public_keys: string[]) => {
      let {blocks, normalized} = tool.crypto.armor.detect_blocks(decrypted_content);
      for (let block of blocks) {
        if (block.type === 'public_key') {
          found_public_keys.push(block.content);
          normalized = normalized.replace(block.content, '');
        }
      }
      return normalized;
    },
    int_to_hex: (int_as_string: string|number): string => { // http://stackoverflow.com/questions/18626844/convert-a-large-integer-to-a-hex-string-in-javascript (Collin Anderson)
      let dec = int_as_string.toString().split(''), sum = [], hex = [], i, s;
      while(dec.length) {
        s = Number(dec.shift());
        for(i = 0; s || i < sum.length; i++) {
          s += (sum[i] || 0) * 10;
          sum[i] = s % 16;
          s = (s - sum[i]) / 16;
        }
      }
      while(sum.length) {
        hex.push(sum.pop()!.toString(16));
      }
      return hex.join('');
    },
    capitalize: (string: string): string => string.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
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
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        if (original === true) {
          return chrome.runtime.id;
        } else {
          return chrome.runtime.id.replace(/[^a-z0-9]/gi, '');
        }
      }
      return null;
    },
    is_background_script: () => Boolean(window.location && tool.value('_generated_background_page.html').in(window.location.href)),
    is_extension: () => tool.env.runtime_id() !== null,
    url_param_require: {
      string: (values: UrlParams, name: string): string => tool.ui.abort_and_render_error_on_url_param_mismatch(values, name, 'string') as string,
    },
    url_params: (expected_keys: string[], string:string|null=null) => {
      let url = (string || window.location.search.replace('?', ''));
      let value_pairs = url.split('?').pop()!.split('&'); // str.split('?') string[].length will always be >= 1
      let url_data: UrlParams = {};
      for (let value_pair of value_pairs) {
        let pair = value_pair.split('=');
        if (tool.value(pair[0]).in(expected_keys)) {
          url_data[pair[0]] = typeof tool._.var.env_url_param_DICT[pair[1]] !== 'undefined' ? tool._.var.env_url_param_DICT[pair[1]] : decodeURIComponent(pair[1]);
        }
      }
      return url_data;
    },
    url_create: (link: string, params: UrlParams) => {
      for (let key of Object.keys(params)) {
        let value = params[key];
        if (typeof value !== 'undefined') {
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
    webmails: async (): Promise<WebMailName[]> => ['gmail', 'inbox'], // async because storage may be involved in the future
  },
  arr: {
    unique: <T extends FlatTypes>(array: T[]): T[] => {
      let unique: T[] = [];
      for (let v of array) {
        if (!tool.value(v).in(unique)) {
          unique.push(v);
        }
      }
      return unique;
    },
    from_dom_node_list: (obj: NodeList|JQuery<HTMLElement>): Node[] => { // http://stackoverflow.com/questions/2735067/how-to-convert-a-dom-node-list-to-an-array-in-javascript
      let array = [];
      for (let i = obj.length >>> 0; i--;) { // iterate backwards ensuring that length is an UInt32
        array[i] = obj[i];
      }
      return array;
    },
    without_key: <T>(array: T[], i: number) => array.splice(0, i).concat(array.splice(i + 1, array.length)),
    without_value: <T>(array: T[], without_value: T) => {
      let result: T[] = [];
      for (let value of array) {
        if (value !== without_value) {
          result.push(value);
        }
      }
      return result;
    },
    contains: <T>(arr: T[]|string, value: T): boolean => Boolean(arr && typeof arr.indexOf === 'function' && (arr as any[]).indexOf(value) !== -1),
    sum: (arr: number[]) => arr.reduce((a, b) => a + b, 0),
    average: (arr: number[]) => tool.arr.sum(arr) / arr.length,
    zeroes: (length: number): number[] => new Array(length).map(() => 0),
  },
  obj: {
    key_by_value: <T>(obj: Dict<T>, v: T) => {
      for (let k of Object.keys(obj)) {
        if (obj[k] === v) {
          return k;
        }
      }
    },
  },
  int: {
    random: (min_value: number, max_value: number) => min_value + Math.round(Math.random() * (max_value - min_value)),
  },
  time: {
    wait: (until_this_function_evaluates_true: () => boolean|undefined) => new Promise((success, error) => {
      let interval = setInterval(() => {
        let result = until_this_function_evaluates_true();
        if (result === true) {
          clearInterval(interval);
          if (success) {
            success();
          }
        } else if (result === false) {
          clearInterval(interval);
          if (error) {
            error();
          }
        }
      }, 50);
    }),
    sleep: (ms: number, set_timeout: (code: () => void, t: number) => void = setTimeout) => new Promise(resolve => set_timeout(resolve, ms)),
    get_future_timestamp_in_months: (months_to_add: number) => new Date().getTime() + 1000 * 3600 * 24 * 30 * months_to_add,
    hours: (h: number) =>  h * 1000 * 60 * 60, // hours in miliseconds
    expiration_format: (date: string) => tool.str.html_escape(date.substr(0, 10)),
    to_utc_timestamp: (datetime_string: string, as_string:boolean=false) => as_string ? String(Date.parse(datetime_string)) : Date.parse(datetime_string),
  },
  file: {
    object_url_create: (content: Uint8Array|string) => window.URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' })),
    object_url_consume: async (url: string) => {
      let uint8 = await tool.file.download_as_uint8(url, null);
      window.URL.revokeObjectURL(url);
      return uint8;
    },
    download_as_uint8: (url: string, progress:ApiCallProgressCallback|null=null): Promise<Uint8Array> => new Promise((resolve, reject) => {
      let request = new XMLHttpRequest();
      request.open('GET', url, true);
      request.responseType = 'arraybuffer';
      if (typeof progress === 'function') {
        request.onprogress = (evt) => progress(evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : null, evt.loaded, evt.total);
      }
      request.onerror = reject;
      request.onload = e => resolve(new Uint8Array(request.response));
      request.send();
    }),
    save_to_downloads: (name: string, type: string, content: Uint8Array|string|Blob, render_in:JQuery<HTMLElement>|null=null) => {
      let blob = new Blob([content], { type });
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, name);
      } else {
        let a = window.document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = name;
        if (render_in) {
          a.textContent = 'DECRYPTED FILE';
          a.style.cssText = 'font-size: 16px; font-weight: bold;';
          render_in.html('<div style="font-size: 16px;padding: 17px 0;">File is ready.<br>Right-click the link and select <b>Save Link As</b></div>');
          render_in.append(a);
          render_in.css('height', 'auto');
          render_in.find('a').click(e => {
            alert('Please use right-click and select Save Link As');
            e.preventDefault();
            e.stopPropagation();
            return false;
          });
        } else {
          if (typeof a.click === 'function') {
            a.click();
          } else { // safari
            let e = document.createEvent('MouseEvents');
            // @ts-ignore - safari only. expected 15 arguments, but works well with 4
            e.initMouseEvent('click', true, true, window);
            a.dispatchEvent(e);
          }
          if (tool.env.browser().name === 'firefox') {
            try {
              document.body.removeChild(a);
            } catch (err) {
              if (err.message !== 'Node was not found') {
                throw err;
              }
            }
          }
          setTimeout(() => window.URL.revokeObjectURL(a.href), 0);
        }
      }
    },
    attachment: (name='', type='application/octet-stream', content: string|Uint8Array|null, size:number|null=null, url:string|null=null): Attachment => { // todo - refactor as (content, name, type, LENGTH, url), making all but content voluntary
      // todo: accept any type of content, then add getters for content(str, uint8, blob) and fetch(), also size('formatted')
      return {name, type, content, size: size || (content || '').length, url};
    },
    pgp_name_patterns: () => ['*.pgp', '*.gpg', '*.asc', 'noname', 'message', 'PGPMIME version identification', ''],
    keyinfo_as_pubkey_attachment: (ki: KeyInfo) => tool.file.attachment(`0x${ki.longid}.asc`, 'application/pgp-keys', ki.public),
    treat_as: (attachment: Attachment) => {
      if (tool.value(attachment.name).in(['PGPexch.htm.pgp', 'PGPMIME version identification'])) {
        return 'hidden';  // PGPexch.htm.pgp is html alternative of textual body content produced by PGP Desktop and GPG4o
      } else if (attachment.name === 'signature.asc' || attachment.type === 'application/pgp-signature') {
        return  'signature';
      } else if (!attachment.name && !tool.value('image/').in(attachment.type)) { // attachment.name may be '' or undefined - catch either
        return attachment.size < 100 ? 'hidden' : 'message';
      } else if (tool.value(attachment.name).in(['message', 'message.asc', 'encrypted.asc', 'encrypted.eml.pgp'])) {
        return 'message';
      } else if (attachment.name.match(/(\.pgp$)|(\.gpg$)|(\.[a-zA-Z0-9]{3,4}\.asc$)/g)) { // ends with one of .gpg, .pgp, .???.asc, .????.asc
        return 'encrypted';
      } else if (attachment.name.match(/^(0|0x)?[A-F0-9]{8}([A-F0-9]{8})?.*\.asc$/g)) { // name starts with a key id
        return 'public_key';
      } else if (tool.value('public').in(attachment.name.toLowerCase()) && attachment.name.match(/[A-F0-9]{8}.*\.asc$/g)) { // name contains the word "public", any key id and ends with .asc
        return 'public_key';
      } else if (attachment.name.match(/\.asc$/) && attachment.size < 100000 && !attachment.inline) {
        return 'message';
      } else {
        return 'standard';
      }
    },
  },
  mime: {
    process: async (mime_message: string) => {
      let decoded = await tool.mime.decode(mime_message);
      if (typeof decoded.text === 'undefined' && typeof decoded.html !== 'undefined' && typeof $_HOST_html_to_text === 'function') { // android
        decoded.text = $_HOST_html_to_text(decoded.html); // temporary solution
      }
      let blocks: MessageBlock[] = [];
      if (decoded.text) {  // may be undefined or empty
        blocks = blocks.concat(tool.crypto.armor.detect_blocks(decoded.text).blocks);
      }
      for (let file of decoded.attachments) {
        let treat_as = tool.file.treat_as(file);
        if (treat_as === 'message') {
          let armored = tool.crypto.armor.clip(file.content as string); // todo - what if file.content is uint8?
          if (armored) {
            blocks.push(tool._.crypto_armor_block_object('message', armored));
          }
        } else if (treat_as === 'signature') {
          decoded.signature = decoded.signature || file.content as string; // todo - what if file.content is uint8?
        } else if (treat_as === 'public_key') {
          blocks = blocks.concat(tool.crypto.armor.detect_blocks(file.content as string).blocks); // todo - what if file.content is uint8?
        }
      }
      if (decoded.signature) {
        for (let block of blocks) {
          if (block.type === 'text') {
            block.type = 'signed_message';
            block.signature = decoded.signature;
            return false;
          }
        }
      }
      return {headers: decoded.headers, blocks};
    },
    headers_to_from: (parsed_mime_message: MimeContent): FromToHeaders => {
      let header_to: string[] = [];
      let header_from;
      // @ts-ignore - I should check this - does it really have .address?
      if (parsed_mime_message.headers.from && parsed_mime_message.headers.from.length && parsed_mime_message.headers.from[0] && parsed_mime_message.headers.from[0].address) {
        // @ts-ignore - I should check this - does it really have .address?
        header_from = parsed_mime_message.headers.from[0].address;
      }
      if (parsed_mime_message.headers.to && parsed_mime_message.headers.to.length) {
        for (let to of parsed_mime_message.headers.to) {
          // @ts-ignore - I should check this - does it really have .address?
          if (to.address) {
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
      if (m instanceof Uint8Array) {
        m = tool.str.from_uint8(m);
      }
      m = m.toLowerCase();
      let contentType = m.match(/content-type: +[0-9a-z\-\/]+/);
      if (contentType === null) {
        return false;
      }
      if (m.match(/content-transfer-encoding: +[0-9a-z\-\/]+/) || m.match(/content-disposition: +[0-9a-z\-\/]+/) || m.match(/; boundary=/) || m.match(/; charset=/)) {
        return true;
      }
      return Boolean(contentType.index === 0 && m.match(/boundary=/));
    },
    format_content_to_display: (text: string, full_mime_message: string) => {
      // todo - this function is very confusing, and should be split into two:
      // ---> format_mime_plaintext_to_display(text, charset)
      // ---> get_charset(full_mime_message)
      if (/<((br)|(div)|p) ?\/?>/.test(text)) {
        return text;
      }
      text = (text || '').replace(/\r?\n/g, '<br>\n');

      if (text && full_mime_message && full_mime_message.match(/^Charset: iso-8859-2/m) !== null) {
        return (window as FcWindow).iso88592.decode(text);  // todo - use iso88592.labels for detection
      }

      let chunk = text.substring(0, 1000).split('');
      let c_cross_d = chunk.filter(c => c === 'Ð').length;
      let c_confirm = chunk.filter(c => 'Ñ²¸»'.indexOf(c) !== -1).length;
      if (chunk && c_cross_d > 1 && c_cross_d / chunk.length > 0.02 && c_confirm / chunk.length > 0.01) {
        // guessed based on the test above that the text needs to be explicitly decoded as utf8 to become utf string
        return tool.str.uint8_as_utf(tool.str.to_uint8(text));
      }

      return text;
    },
    decode: (mime_message: string): Promise<MimeContent> => {
      return new Promise(async resolve => {
        let mime_content = {attachments: [], headers: {} as FlatHeaders, text: undefined, html: undefined, signature: undefined} as MimeContent;
        let emailjs_mime_parser: AnyThirdPartyLibrary = await tool._.mime_require('parser');
        try {
          let parser = new emailjs_mime_parser();
          let parsed: {[key: string]: MimeParserNode} = {};
          parser.onheader = (node: MimeParserNode) => {
            if (!String(node.path.join('.'))) { // root node headers
              for (let name of Object.keys(node.headers)) {
                mime_content.headers[name] = node.headers[name][0].value;
              }
            }
          };
          parser.onbody = (node: MimeParserNode) => {
            let path = String(node.path.join('.'));
            if (typeof parsed[path] === 'undefined') {
              parsed[path] = node;
            }
          };
          parser.onend = () => {
            for (let node of Object.values(parsed)) {
              if (tool._.mime_node_type(node) === 'application/pgp-signature') {
                mime_content.signature = node.rawContent;
              } else if (tool._.mime_node_type(node) === 'text/html' && !tool._.mime_node_filename(node)) {
                mime_content.html = node.rawContent;
              } else if (tool._.mime_node_type(node) === 'text/plain' && !tool._.mime_node_filename(node)) {
                mime_content.text = node.rawContent;
              } else {
                let node_content = tool.str.from_uint8(node.content);
                mime_content.attachments.push(tool.file.attachment(tool._.mime_node_filename(node), tool._.mime_node_type(node), node_content));
              }
            }
            resolve(mime_content);
          };
          parser.write(mime_message); // todo - better chunk it for very big messages containing attachments? research
          parser.end();
        } catch (e) {
          tool.catch.handle_exception(e);
          resolve(mime_content); // maybe could reject? this will return partial info
        }
      });
    },
    encode: async (body:string|SendableMessageBody, headers: RichHeaders, attachments:Attachment[]=[]): Promise<string> => {
      let MimeBuilder: AnyThirdPartyLibrary = await tool._.mime_require('builder');
      let root_node = new MimeBuilder('multipart/mixed');
      for (let key of Object.keys(headers)) {
        root_node.addHeader(key, headers[key]);
      }
      if (typeof body === 'string') {
        body = {'text/plain': body};
      }
      let content_node: MimeParserNode;
      if (Object.keys(body).length === 1) {
        content_node = tool._.mime_content_node(MimeBuilder, Object.keys(body)[0], body[Object.keys(body)[0] as "text/plain"|"text/html"] || '');
      } else {
        content_node = new MimeBuilder('multipart/alternative');
        for (let type of Object.keys(body)) {
          content_node.appendChild(tool._.mime_content_node(MimeBuilder, type, body[type]!)); // already present, that's why part of for loop
        }
      }
      root_node.appendChild(content_node);
      for (let attachment of attachments) {
        let type = `${attachment.type}; name="${attachment.name}"`;
        let header = {'Content-Disposition': 'attachment', 'X-Attachment-Id': `f_${tool.str.random(10)}`, 'Content-Transfer-Encoding': 'base64'};
        root_node.appendChild(new MimeBuilder(type, { filename: attachment.name }).setHeader(header).setContent(attachment.content));
      }
      return root_node.build();
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
      if (signed_header_index !== -1) {
        mime_message = mime_message.substr(signed_header_index);
        let first_boundary_index = mime_message.substr(0, 1000).toLowerCase().indexOf('boundary=');
        if (first_boundary_index) {
          let boundary = mime_message.substr(first_boundary_index, 100);
          boundary = (boundary.match(/boundary="[^"]{1,70}"/gi) || boundary.match(/boundary=[a-z0-9][a-z0-9 ]{0,68}[a-z0-9]/gi) || [])[0];
          if (boundary) {
            boundary = boundary.replace(/^boundary="?|"$/gi, '');
            let boundary_begin = '\r\n--' + boundary + '\r\n';
            let boundary_end = '--' + boundary + '--';
            let end_index = mime_message.indexOf(boundary_end);
            if (end_index !== -1) {
              mime_message = mime_message.substr(0, end_index + boundary_end.length);
              if (mime_message) {
                let result = { full: mime_message, signed: null as string|null, signature: null as string|null };
                let first_part_start_index = mime_message.indexOf(boundary_begin);
                if (first_part_start_index !== -1) {
                  first_part_start_index += boundary_begin.length;
                  let first_part_end_index = mime_message.indexOf(boundary_begin, first_part_start_index);
                  let second_part_start_index = first_part_end_index + boundary_begin.length;
                  let second_part_end_index = mime_message.indexOf(boundary_end, second_part_start_index);
                  if (second_part_end_index !== -1) {
                    let first_part = mime_message.substr(first_part_start_index, first_part_end_index - first_part_start_index);
                    let second_part = mime_message.substr(second_part_start_index, second_part_end_index - second_part_start_index);
                    if (first_part.match(/^content-type: application\/pgp-signature/gi) !== null && tool.value('-----BEGIN PGP SIGNATURE-----').in(first_part) && tool.value('-----END PGP SIGNATURE-----').in(first_part)) {
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
    message_pubkeys: async (account_email: string, m: string|Uint8Array|OpenPGP.message.Message): Promise<DiagnoseMessagePubkeysResult> => {
      let message: OpenPGP.message.Message;
      if (typeof m === 'string') {
        message = openpgp.message.readArmored(m);
      } else if (m instanceof Uint8Array) {
        message = openpgp.message.readArmored(tool.str.from_uint8(m));
      } else {
        message = m;
      }
      let message_key_ids = message.getEncryptionKeyIds ? message.getEncryptionKeyIds() : [];
      let private_keys = await Store.keys_get(account_email);
      let local_key_ids = [].concat.apply([], private_keys.map(ki => ki.public).map(tool._.crypto_key_ids));
      let diagnosis = { found_match: false, receivers: message_key_ids.length };
      for (let msg_k_id of message_key_ids) {
        for (let local_k_id of local_key_ids) {
          if (msg_k_id === local_k_id) {
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
        if (!pgp_block_text) {
          return pgp_block_text;
        }
        let debug = false;
        if (debug) {
          console.info('pgp_block_1');
          console.info(pgp_block_text);
        }
        let newlines = [/<div><br><\/div>/g, /<\/div><div>/g, /<[bB][rR]( [a-zA-Z]+="[^"]*")* ?\/? ?>/g, /<div ?\/?>/g];
        let spaces = [/&nbsp;/g];
        let removes = [/<wbr ?\/?>/g, /<\/?div>/g];
        for (let newline of newlines) {
          pgp_block_text = pgp_block_text.replace(newline, '\n');
        }
        if (debug) {
          console.info('pgp_block_2');
          console.info(pgp_block_text);
        }
        for (let remove of removes) {
          pgp_block_text = pgp_block_text.replace(remove, '');
        }
        if (debug) {
          console.info('pgp_block_3');
          console.info(pgp_block_text);
        }
        for (let space of spaces) {
          pgp_block_text = pgp_block_text.replace(space, ' ');
        }
        if (debug) {
          console.info('pgp_block_4');
          console.info(pgp_block_text);
        }
        pgp_block_text = pgp_block_text.replace(/\r\n/g, '\n');
        if (debug) {
          console.info('pgp_block_5');
          console.info(pgp_block_text);
        }
        pgp_block_text = $('<div>' + pgp_block_text + '</div>').text();
        if (debug) {
          console.info('pgp_block_6');
          console.info(pgp_block_text);
        }
        let double_newlines = pgp_block_text.match(/\n\n/g);
        if (double_newlines !== null && double_newlines.length > 2) { // a lot of newlines are doubled
          pgp_block_text = pgp_block_text.replace(/\n\n/g, '\n');
          if (debug) {
            console.info('pgp_block_removed_doubles');
          }
        }
        if (debug) {
          console.info('pgp_block_7');
          console.info(pgp_block_text);
        }
        pgp_block_text = pgp_block_text.replace(/^ +/gm, '');
        if (debug) {
          console.info('pgp_block_final');
          console.info(pgp_block_text);
        }
        return pgp_block_text;
      },
      clip: (text: string) => {
        if (text && tool.value(tool._.var.crypto_armor_headers_DICT.null.begin).in(text) && tool.value(tool._.var.crypto_armor_headers_DICT.null.end as string).in(text)) {
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
        let normalized = tool.str.normalize(original_text);
        let start_at = 0;
        while(true) {
          let r = tool._.crypto_armor_detect_block_next(normalized, start_at);
          if (r.found) {
            blocks = blocks.concat(r.found);
          }
          if (r.continue_at === null) {
            return {blocks, normalized};
          } else {
            if (r.continue_at <= start_at) {
              tool.catch.report(`tool.crypto.armor.detect_blocks likely infinite loop: r.continue_at(${r.continue_at}) <= start_at(${start_at})`);
              return {blocks, normalized}; // prevent infinite loop
            }
            start_at = r.continue_at;
          }
        }
      },
      replace_blocks: (factory: Factory, original_text: string, message_id:string|null=null, sender_email:string|null=null, is_outgoing: boolean|null=null) => {
        let blocks = tool.crypto.armor.detect_blocks(original_text).blocks;
        if (blocks.length === 1 && blocks[0].type === 'text') {
          return;
        }
        let r = '';
        for (let i in blocks) {
          if (blocks[i].type === 'text' || blocks[i].type === 'private_key') {
            r += (Number(i) ? '\n\n' : '') + tool.str.html_escape(blocks[i].content) + '\n\n';
          } else if (blocks[i].type === 'message') {
            r += factory.embedded_message(blocks[i].complete ? tool.crypto.armor.normalize(blocks[i].content, 'message') : '', message_id, is_outgoing, sender_email, false);
          } else if (blocks[i].type === 'signed_message') {
            r += factory.embedded_message(blocks[i].content, message_id, is_outgoing, sender_email, false);
          } else if (blocks[i].type === 'public_key') {
            r += factory.embedded_pubkey(tool.crypto.armor.normalize(blocks[i].content, 'public_key'), is_outgoing);
          } else if (blocks[i].type === 'password_message') {
            r += factory.embedded_message('', message_id, is_outgoing, sender_email, true, null, blocks[i].content); // here blocks[i].content is message short id
          } else if (blocks[i].type === 'attest_packet') {
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
        armored = tool.str.normalize(armored);
        if (tool.value(type).in(['message', 'public_key', 'private_key', 'key'])) {
          armored = armored.replace(/\r?\n/g, '\n').trim();
          let nl_2 = armored.match(/\n\n/g);
          let nl_3 = armored.match(/\n\n\n/g);
          let nl_4 = armored.match(/\n\n\n\n/g);
          let nl_6 = armored.match(/\n\n\n\n\n\n/g);
          if (nl_3 && nl_6 && nl_3.length > 1 && nl_6.length === 1) {
            return armored.replace(/\n\n\n/g, '\n'); // newlines tripled: fix
          } else if (nl_2 && nl_4 && nl_2.length > 1 && nl_4.length === 1) {
            return armored.replace(/\n\n/g, '\n'); // newlines doubled.GPA on windows does this, and sometimes message can get extracted this way from html
          }
          return armored;
        } else {
          return armored;
        }
      },
    },
    hash: {
      sha1: (string: string) => tool.str.to_hex(tool.str.from_uint8(openpgp.crypto.hash.digest(openpgp.enums.hash.sha1, string))),
      double_sha1_upper: (string: string) => tool.crypto.hash.sha1(tool.crypto.hash.sha1(string)).toUpperCase(),
      sha256: (string: string) => tool.str.to_hex(tool.str.from_uint8(openpgp.crypto.hash.digest(openpgp.enums.hash.sha1, string))),
      challenge_answer: (answer: string) => tool._.crypto_hash_sha256_loop(answer),
    },
    key: {
      create: async (userIds: {name: string, email: string}[], numBits: 4096, passphrase: string): Promise<{private: string, public: string}> => {
        let k = await openpgp.generateKey({numBits, userIds, passphrase});
        return {public: k.publicKeyArmored, private: k.privateKeyArmored};
      },
      read: (armored_key: string) => openpgp.key.readArmored(armored_key).keys[0],
      decrypt: async (key: OpenPGP.key.Key, passphrases: string[]): Promise<boolean> => {
        try {
          return await key.decrypt(passphrases);
        } catch (e) {
          if (e.message.toLowerCase().indexOf('passphrase') !== -1) {
            return false;
          }
          throw e;
        }
      },
      normalize: (armored: string) => {
        try {
          armored = tool.crypto.armor.normalize(armored, 'key');
          let key: OpenPGP.key.Key|undefined;
          if (RegExp(tool.crypto.armor.headers('public_key', 're').begin).test(armored)) {
            key = openpgp.key.readArmored(armored).keys[0];
          } else if (RegExp(tool.crypto.armor.headers('message', 're').begin).test(armored)) {
            key = new OpenPGP.key.Key(openpgp.message.readArmored(armored).packets);
          }
          if (key) {
            return key.armor();
          } else {
            return armored;
          }
        } catch (error) {
          tool.catch.handle_exception(error);
        }
      },
      fingerprint: (key: OpenPGP.key.Key|string, formatting:"default"|"spaced"='default'): string|null => {
        if (key === null || typeof key === 'undefined') {
          return null;
        } else if (key instanceof openpgp.key.Key) {
          if (key.primaryKey.getFingerprintBytes() === null) {
            return null;
          }
          try {
            let fp = key.primaryKey.getFingerprint().toUpperCase();
            if (formatting === 'spaced') {
              return fp.replace(/(.{4})/g, '$1 ').trim();
            }
            return fp;
          } catch (error) {
            console.log(error);
            return null;
          }
        } else {
          try {
            return tool.crypto.key.fingerprint(openpgp.key.readArmored(key).keys[0], formatting);
          } catch (error) {
            if (error.message === 'openpgp is not defined') {
              tool.catch.handle_exception(error);
            }
            console.log(error);
            return null;
          }
        }
      },
      longid: (key_or_fingerprint_or_bytes: string|OpenPGP.key.Key|null|undefined): string|null => {
        if (key_or_fingerprint_or_bytes === null || typeof key_or_fingerprint_or_bytes === 'undefined') {
          return null;
        } else if (typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 8) {
          return tool.str.to_hex(key_or_fingerprint_or_bytes).toUpperCase();
        } else if (typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 40) {
          return key_or_fingerprint_or_bytes.substr(-16);
        } else if (typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 49) {
          return key_or_fingerprint_or_bytes.replace(/ /g, '').substr(-16);
        } else {
          return tool.crypto.key.longid(tool.crypto.key.fingerprint(key_or_fingerprint_or_bytes));
        }
      },
      usable: async (armored: string) => { // is pubkey usable for encrytion?
        if (!tool.crypto.key.fingerprint(armored)) {
          return false;
        }
        let pubkey = openpgp.key.readArmored(armored).keys[0];
        if (!pubkey) {
          return false;
        }
        if(await pubkey.getEncryptionKey() !== null) {
          return true; // good key - cannot be expired
        }
        return await tool.crypto.key.usable_but_expired(pubkey);
      },
      usable_but_expired: async (key: OpenPGP.key.Key): Promise<boolean> => {
        if(await key.getEncryptionKey() !== null) {
          return false; // good key - cannot be expired
        }
        let one_second_before_expiration = await tool.crypto.key.date_before_expiration(key);
        if(one_second_before_expiration === null) {
          return false; // key does not expire
        }
        // try to see if the key was usable just before expiration
        return await key.getEncryptionKey(null, one_second_before_expiration) !== null;
      },
      date_before_expiration: async (key: OpenPGP.key.Key): Promise<Date|null> => {
        let expires = await key.getExpirationTime();
        if(expires instanceof Date && expires.getTime() < Date.now()) { // expired
          return new Date(expires.getTime() - 1000);
        }
        return null;
      },

    },
    message: {
      is_openpgp: (data: string|Uint8Array): {armored: boolean, type: MessageBlockType}|null => {
        if (!data || !data.length) {
          return null;
        }
        let d = data.slice(0, 50); // only interested in first 50 bytes
        // noinspection SuspiciousInstanceOfGuard
        if (d instanceof Uint8Array) {
          d = tool.str.from_uint8(d);
        }
        let first_byte = d[0].charCodeAt(0); // attempt to understand this as a binary PGP packet: https://tools.ietf.org/html/rfc4880#section-4.2
        if ((first_byte & 0b10000000) === 0b10000000) { // 1XXX XXXX - potential pgp packet tag
          let tag_number = 0; // zero is a forbidden tag number
          if ((first_byte & 0b11000000) === 0b11000000) { // 11XX XXXX - potential new pgp packet tag
            tag_number = first_byte & 0b00111111;  // 11TTTTTT where T is tag number bit
          } else { // 10XX XXXX - potential old pgp packet tag
            tag_number = (first_byte & 0b00111100) / 4; // 10TTTTLL where T is tag number bit. Division by 4 in place of two bit shifts. I hate bit shifts.
          }
          if (tool.value(tag_number).in(Object.values(openpgp.enums.packet))) {
            // Indeed a valid OpenPGP packet tag number
            // This does not 100% mean it's OpenPGP message
            // But it's a good indication that it may
            let t = openpgp.enums.packet;
            let m_types = [t.symEncryptedIntegrityProtected, t.modificationDetectionCode, t.symEncryptedAEADProtected, t.symmetricallyEncrypted, t.compressed];
            return {armored: false, type: tool.value(tag_number).in(m_types) ? 'message' : 'public_key'};
          }
        }
        let {blocks} = tool.crypto.armor.detect_blocks(d.trim());
        if (blocks.length === 1 && blocks[0].complete === false && tool.value(blocks[0].type).in(['message', 'private_key', 'public_key', 'signed_message'])) {
          return {armored: true, type: blocks[0].type};
        }
        return null;
      },
      sign: async (signing_prv: OpenPGP.key.Key, data: string): Promise<string> => {
        let sign_result = await openpgp.sign({data, armor: true, privateKeys: [signing_prv]});
        return (sign_result as OpenPGP.SignArmorResult).data;
      },
      verify: async (message: OpenPGP.message.Message|OpenPGP.cleartext.CleartextMessage, keys_for_verification: OpenPGP.key.Key[], optional_contact: Contact|null=null) => {
        let signature: MessageVerifyResult = { signer: null, contact: optional_contact, match: null, error: null };
        try {
          for (let verify_result of await message.verify(keys_for_verification)) {
            signature.match = tool.value(signature.match).in([true, null]) && verify_result.valid; // this will probably falsely show as not matching in some rare cases. Needs testing.
            if (!signature.signer) {
              signature.signer = tool.crypto.key.longid(verify_result.keyid.bytes);
            }
          }
        } catch (verify_error) {
          signature.match = null;
          if (verify_error.message === 'Can only verify message with one literal data packet.') {
            signature.error = 'FlowCrypt is not equipped to verify this message (err 101)';
          } else {
            signature.error = `FlowCrypt had trouble verifying this message (${verify_error.message})`;
            tool.catch.handle_exception(verify_error);
          }
        }
        return signature;
      },
      verify_detached: async (account_email: string, plaintext: string|Uint8Array, signature_text: string|Uint8Array): Promise<MessageVerifyResult> => {
        if (plaintext instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
          plaintext = tool.str.from_uint8(plaintext);
        }
        if (signature_text instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
          signature_text = tool.str.from_uint8(signature_text);
        }
        let message = openpgp.message.fromText(plaintext);
        message.appendSignature(signature_text);
        let keys = await tool._.crypto_message_get_sorted_keys_for_message(account_email, message);
        return await tool.crypto.message.verify(message, keys.for_verification, keys.verification_contacts[0]);
      },
      decrypt: async (account_email: string, encrypted_data: string|Uint8Array, msg_pwd: string|null=null, get_uint8=false): Promise<DecryptSuccess|DecryptError> => {
        let prepared;
        let longids = {message: [] as string[], matching: [] as string[], chosen: [] as string[], need_passphrase: [] as string[]};
        try {
          prepared = tool._.crypto_message_prepare_for_decrypt(encrypted_data);
        } catch (format_error) {
          return {success: false, error: {type: DecryptErrorTypes.format, error: format_error.message}, longids, is_encrypted: null, signature: null};
        }
        let keys = await tool._.crypto_message_get_sorted_keys_for_message(account_email, prepared.message);
        longids.message = keys.encrypted_for;
        longids.matching = keys.prv_for_decrypt.map(ki => ki.longid);
        longids.chosen = keys.prv_for_decrypt_with_passphrases.map(ki => ki.longid);
        longids.need_passphrase = keys.prv_for_decrypt_without_passphrases.map(ki => ki.longid);
        let is_encrypted = !prepared.is_cleartext;
        if (!is_encrypted) {
          return {success: true, content: {text: prepared.message.getText(), filename: null}, is_encrypted, signature: await tool.crypto.message.verify(prepared.message, keys.for_verification, keys.verification_contacts[0])};
        }
        if (!keys.prv_for_decrypt_with_passphrases.length && !msg_pwd) {
          return {success: false, error: {type: DecryptErrorTypes.need_passphrase}, signature: null, message: prepared.message, longids, is_encrypted};
        }
        try {
          let packets = (prepared.message as OpenPGP.message.Message).packets;
          let is_sym_encrypted = packets.filter(p => p.tag === openpgp.enums.packet.symEncryptedSessionKey).length > 0;
          let is_pub_encrypted = packets.filter(p => p.tag === openpgp.enums.packet.publicKeyEncryptedSessionKey).length > 0;
          if(is_sym_encrypted && !is_pub_encrypted && !msg_pwd) {
            return {success: false, error: {type: DecryptErrorTypes.use_password}, longids, is_encrypted, signature: null};
          }
          let msg_passwords = msg_pwd ? [msg_pwd] : null;
          let decrypted = await (prepared.message as OpenPGP.message.Message).decrypt(keys.prv_for_decrypt_with_passphrases.map(ki => ki.decrypted!), msg_passwords);
          // let signature_result = keys.signed_by.length ? tool.crypto.message.verify(message, keys.for_verification, keys.verification_contacts[0]) : false;
          let signature_result = null;
          if(get_uint8) {
            return {success: true, content: {uint8: decrypted.getLiteralData(), filename: decrypted.getFilename()}, is_encrypted, signature: signature_result};
          } else {
            return {success: true, content: {text: decrypted.getText(), filename: decrypted.getFilename()}, is_encrypted, signature: signature_result};
          }
        } catch (e) {
          return {success: false, error: tool._.crypto_message_decrypt_categorize_error(e, msg_pwd), signature: null, message: prepared.message, longids, is_encrypted};
        }
      },
      encrypt: async (armored_pubkeys: string[], signing_prv: OpenPGP.key.Key|null, challenge: Challenge|null, data: string|Uint8Array, filename: string|null, armor: boolean, date: Date|null=null): Promise<OpenPGP.EncryptResult> => {
        let options: OpenPGP.EncryptOptions = { data, armor, date: date || undefined, filename: filename || undefined };
        let used_challange = false;
        if (armored_pubkeys) {
          options.publicKeys = [];
          for (let armored_pubkey of armored_pubkeys) {
            options.publicKeys = options.publicKeys.concat(openpgp.key.readArmored(armored_pubkey).keys);
          }
        }
        if (challenge && challenge.answer) {
          options.passwords = [tool.crypto.hash.challenge_answer(challenge.answer)];
          used_challange = true;
        }
        if (!armored_pubkeys && !used_challange) {
          alert('Internal error: don\'t know how to encryt message. Please refresh the page and try again, or contact me at human@flowcrypt.com if this happens repeatedly.');
          throw new Error('no-pubkeys-no-challenge');
        }
        if (signing_prv && typeof signing_prv.isPrivate !== 'undefined' && signing_prv.isPrivate()) {
          options.privateKeys = [signing_prv];
        }
        return await openpgp.encrypt(options);
      },
    },
    password: {
      estimate_strength: (zxcvbn_result_guesses: number) => {
        let time_to_crack = zxcvbn_result_guesses / tool._.var.crypto_password_GUESSES_PER_SECOND;
        for (let i = 0; i < tool._.var.crypto_password_CRACK_TIME_WORDS.length; i++) {
          let readable_time = tool._.readable_crack_time(time_to_crack);
          // looks for a word match from readable_crack_time, defaults on "weak"
          if (tool.value(tool._.var.crypto_password_CRACK_TIME_WORDS[i].match).in(readable_time)) {
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
    retry_link: () => `<a href="${window.location.href}">retry</a>`,
    delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
    spinner: (color: string, placeholder_class:"small_spinner"|"large_spinner"='small_spinner') => {
      let path = `/img/svgs/spinner-${color}-small.svg`;
      let url = typeof chrome !== 'undefined' && chrome.extension && chrome.extension.getURL ? chrome.extension.getURL(path) : path;
      return `<i class="${placeholder_class}" data-test="spinner"><img src="${url}" /></i>`;
    },
    abort_and_render_error_on_url_param_mismatch: (values: UrlParams, name: string, expected_type: string): UrlParam => {
      let actual_type = typeof values[name];
      if (actual_type !== expected_type) {
        let msg = `Cannot render page (expected ${name} to be of type ${expected_type} but got ${actual_type})<br><br>Was the URL editted manually? Please write human@flowcrypt.com for help.`;
        $('body').html(msg).addClass('bad').css({padding: '20px', 'font-size': '16px'});
        throw new UnreportableError(msg);
      }
      return values[name];
    },
    passphrase_toggle: async (pass_phrase_input_ids: string[], force_initial_show_or_hide:"show"|"hide"|null=null) => {
      let button_hide = '<img src="/img/svgs/eyeclosed-icon.svg" class="eye-closed"><br>hide';
      let button_show = '<img src="/img/svgs/eyeopen-icon.svg" class="eye-open"><br>show';
      let {hide_pass_phrases} = await Store.get_global(['hide_pass_phrases']);
      let show: boolean;
      if (force_initial_show_or_hide === 'hide') {
        show = false;
      } else if (force_initial_show_or_hide === 'show') {
        show = true;
      } else {
        show = !hide_pass_phrases;
      }
      for (let id of pass_phrase_input_ids) {
        let passphrase_input = $('#' + id);
        passphrase_input.addClass('toggled_passphrase');
        if (show) {
          passphrase_input.after('<label href="#" id="toggle_' + id + '" class="toggle_show_hide_pass_phrase" for="' + id + '">' + button_hide + '</label>');
          passphrase_input.attr('type', 'text');
        } else {
          passphrase_input.after('<label href="#" id="toggle_' + id + '" class="toggle_show_hide_pass_phrase" for="' + id + '">' + button_show + '</label>');
          passphrase_input.attr('type', 'password');
        }
        $('#toggle_' + id).click(function() {
          if (passphrase_input.attr('type') === 'password') {
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
    },
    enter: (callback: () => void) => (e: JQuery.Event<HTMLElement, null>) => { // returns a function
      if (e.which === tool.env.key_codes().enter) {
        callback();
      }
    },
    build_jquery_selectors: (selectors: Dict<string>): SelectorCache => {
      let cache: NamedSelectors = {};
      return {
        cached: (name: string) => {
          if (!cache[name]) {
            if (typeof selectors[name] === 'undefined') {
              tool.catch.report('unknown selector name: ' + name);
            }
            cache[name] = $(selectors[name]);
          }
          return cache[name];
        },
        now: (name: string) => {
          if (typeof selectors[name] === 'undefined') {
            tool.catch.report('unknown selector name: ' + name);
          }
          return $(selectors[name]);
        },
        selector: (name: string) => {
          if (typeof selectors[name] === 'undefined') {
            tool.catch.report('unknown selector name: ' + name);
          }
          return selectors[name];
        }
      };
    },
    scroll: (selector: string|JQuery<HTMLElement>, repeat:number[]=[]) => {
      let el = $(selector).first()[0];
      if (el) {
        el.scrollIntoView();
        for (let delay of repeat) { // useful if mobile keyboard is about to show up
          setTimeout(() => el.scrollIntoView(), delay);
        }
      }
    },
    event: {
      clicked: (selector: string): Promise<HTMLElement> => new Promise(resolve => $(selector).one('click', function() { resolve(this); })),
      stop: () => (e: JQuery.Event) => { // returns a function
        e.preventDefault();
        e.stopPropagation();
        return false;
      },
      protect: () => {
        // prevent events that could potentially leak information about sensitive info from bubbling above the frame
        $('body').on('keyup keypress keydown click drag drop dragover dragleave dragend submit', e => {
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
      prevent: (preventable_event: PreventableEvent, callback: (e: HTMLElement, id: string) => void) => { // todo: messy + needs refactoring
        return function() {
          if (preventable_event.name === 'spree') {
            clearTimeout(tool._.var.ui_event_fired[preventable_event.id]);
            tool._.var.ui_event_fired[preventable_event.id] = window.setTimeout(callback, tool._.var.ui_event_SPREE_MS);
          } else if (preventable_event.name === 'slowspree') {
            clearTimeout(tool._.var.ui_event_fired[preventable_event.id]);
            tool._.var.ui_event_fired[preventable_event.id] = window.setTimeout(callback, tool._.var.ui_event_SLOW_SPREE_MS);
          } else if (preventable_event.name === 'veryslowspree') {
            clearTimeout(tool._.var.ui_event_fired[preventable_event.id]);
            tool._.var.ui_event_fired[preventable_event.id] = window.setTimeout(callback, tool._.var.ui_event_VERY_SLOW_SPREE_MS);
          } else {
            if (preventable_event.id in tool._.var.ui_event_fired) {
              // if (meta.name === 'parallel') - id was found - means the event handling is still being processed. Do not call back
              if (preventable_event.name === 'double') {
                if (Date.now() - tool._.var.ui_event_fired[preventable_event.id] > tool._.var.ui_event_DOUBLE_MS) {
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
      release: (id: string) => { // todo - I may have forgot to use this somewhere, used only with parallel() - if that's how it works
        if (id in tool._.var.ui_event_fired) {
          let ms_to_release = tool._.var.ui_event_DOUBLE_MS + tool._.var.ui_event_fired[id] - Date.now();
          if (ms_to_release > 0) {
            setTimeout(() => { delete tool._.var.ui_event_fired[id]; }, ms_to_release);
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
      bg: {
        diagnose_message_pubkeys: (account_email: string, message: string) => tool.browser.message.bg.exec('tool.diagnose.message_pubkeys', [account_email, message]) as Promise<DiagnoseMessagePubkeysResult>,
        crypto_message_decrypt: async (account_email: string, encrypted_data: string|Uint8Array, user_entered_message_password:string|null=null) => {
          let result = await tool.browser.message.bg.exec('tool.crypto.message.decrypt', [account_email, encrypted_data, user_entered_message_password]) as DecryptResult;
          if (result.success && result.content && result.content.text && result.content.text.indexOf(`blob:${chrome.runtime.getURL('')}`) === 0) {
            result.content.text = tool.str.from_uint8(await tool.file.object_url_consume(result.content.text));
          }
          return result;
        },
        crypto_message_verify_detached: (acct_e: string, m: string|Uint8Array, sig: string|Uint8Array) => tool.browser.message.bg.exec('tool.crypto.message.verify_detached', [acct_e, m, sig]) as Promise<MessageVerifyResult>,
        exec: (path: string, args: any[]) => tool.browser.message.send_await(null, 'bg_exec', {path, args: args.map(arg => {
          if ((typeof arg === 'string' && arg.length > tool._.var.browser_message_MAX_SIZE) || arg instanceof Uint8Array) {
            return tool.file.object_url_create(arg);
          } else {
            return arg;
          }
        })}) as any as Promise<PossibleBgExecResults>,
      },
      send: (destination_string: string|null, name: string, data: Dict<any>|null=null) => tool.browser.message.send_await(destination_string, name, data).catch(tool.catch.handle_promise_error),
      send_await: (destination_string: string|null, name: string, data: Dict<any>|null=null): Promise<BrowserMessageResponse> => new Promise(resolve => {
        let msg = { name, data, to: destination_string || null, uid: tool.str.random(10), stack: tool.catch.stack_trace() };
        let try_resolve_no_undefined = (r?: BrowserMessageResponse) => tool.catch.try(() => resolve(typeof r === 'undefined' ? {} : r))();
        let is_background_page = tool.env.is_background_script();
        if (typeof  destination_string === 'undefined') { // don't know where to send the message
          tool.catch.log('tool.browser.message.send to:undefined');
          try_resolve_no_undefined();
        } else if (is_background_page && tool._.var.browser_message_background_script_registered_handlers && msg.to === null) {
          tool._.var.browser_message_background_script_registered_handlers[msg.name](msg.data, 'background', try_resolve_no_undefined); // calling from background script to background script: skip messaging completely
        } else if (is_background_page) {
          chrome.tabs.sendMessage(tool._.browser_message_destination_parse(msg.to).tab!, msg, {}, try_resolve_no_undefined);
        } else {
          chrome.runtime.sendMessage(msg, try_resolve_no_undefined);
        }
      }),
      tab_id: async (): Promise<string|null|undefined> => {
        let r = await tool.browser.message.send_await(null, '_tab_', null);
        if(typeof r === 'string' || typeof r === 'undefined' || r === null) {
          return r; // for compatibility reasons when upgrading from 5.7.2 - can be removed later
        } else {
          return r.tab_id; // new format
        }
      },
      required_tab_id: async (): Promise<string> => {
        let tab_id = await tool.browser.message.tab_id();
        if (tab_id) {
          return tab_id;
        } else {
          throw new Error(`Tab id is required, but received '${String(tab_id)}'`);
        }
      },
      listen: (handlers: Dict<BrowserMessageHandler>, listen_for_tab_id='all') => {
        for (let name of Object.keys(handlers)) {
          // newly registered handlers with the same name will overwrite the old ones if tool.browser.message.listen is declared twice for the same frame
          // original handlers not mentioned in newly set handlers will continue to work
          tool._.var.browser_message_frame_registered_handlers[name] = handlers[name];
        }
        for (let name of Object.keys(tool._.var.browser_message_STANDARD_HANDLERS)) {
          if (typeof tool._.var.browser_message_frame_registered_handlers[name] !== 'function') {
            tool._.var.browser_message_frame_registered_handlers[name] = tool._.var.browser_message_STANDARD_HANDLERS[name]; // standard handlers are only added if not already set above
          }
        }
        let processed:string[] = [];
        chrome.runtime.onMessage.addListener((msg, sender, respond) => {
          return tool.catch.try(() => {
            if (msg.to === listen_for_tab_id || msg.to === 'broadcast') {
              if (!tool.value(msg.uid).in(processed)) {
                processed.push(msg.uid);
                if (typeof tool._.var.browser_message_frame_registered_handlers[msg.name] !== 'undefined') {
                  tool._.var.browser_message_frame_registered_handlers[msg.name](msg.data, sender, respond);
                } else if (msg.name !== '_tab_' && msg.to !== 'broadcast') {
                  if (tool._.browser_message_destination_parse(msg.to).frame !== null) { // only consider it an error if frameId was set because of firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1354337
                    tool.catch.report('tool.browser.message.listen error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
                  } else { // once firefox fixes the bug, it will behave the same as Chrome and the following will never happen.
                    console.log('tool.browser.message.listen ignoring missing handler "' + msg.name + '" due to Firefox Bug');
                  }
                }
              }
            }
            return !!respond; // indicate that this listener intends to respond
          })();
        });
      },
      listen_background: (handlers: Dict<BrowserMessageHandler>) => {
        if (!tool._.var.browser_message_background_script_registered_handlers) {
          tool._.var.browser_message_background_script_registered_handlers = handlers;
        } else {
          for (let name of Object.keys(handlers)) {
            tool._.var.browser_message_background_script_registered_handlers[name] = handlers[name];
          }
        }
        chrome.runtime.onMessage.addListener((msg, sender, respond) => {
          let safe_respond = (response: any) => {
            try { // avoiding unnecessary errors when target tab gets closed
              respond(response);
            } catch (e) {
              if (e.message !== 'Attempting to use a disconnected port object') {
                tool.catch.handle_exception(e);
                throw e;
              }
            }
          };
          if (msg.to && msg.to !== 'broadcast') {
            msg.sender = sender;
            chrome.tabs.sendMessage(tool._.browser_message_destination_parse(msg.to).tab!, msg, {}, safe_respond);
          } else if (tool.value(msg.name).in(Object.keys(tool._.var.browser_message_background_script_registered_handlers!))) { // is !null because added above
            tool._.var.browser_message_background_script_registered_handlers![msg.name](msg.data, sender, safe_respond); // is !null because added above
          } else if (msg.to !== 'broadcast') {
            tool.catch.report('tool.browser.message.listen_background error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
          }
          return !!respond; // indicate that we intend to respond later
        });
      },
    },
  },
  api: {
    auth: {
      window: (auth_url: string, window_closed_by_user: Callback) => {
        let auth_code_window = window.open(auth_url, '_blank', 'height=600,left=100,menubar=no,status=no,toolbar=no,top=100,width=500');
        let window_closed_timer = setInterval(() => {
          if (auth_code_window !== null && auth_code_window.closed) {
            clearInterval(window_closed_timer);
            window_closed_by_user();
          }
        }, 500);
        return () => {
          clearInterval(window_closed_timer);
          if (auth_code_window !== null) {
            auth_code_window.close();
          }
        };
      },
      parse_id_token: (id_token: string) => JSON.parse(atob(id_token.split(/\./g)[1])),
    },
    error: {
      is_network_error: (e: Thrown) => {
        if (typeof e === 'object') {
          if (e.internal === 'network') { // StandardError
            return true;
          }
          if (e.status === 0 && e.statusText === 'error') { // $.ajax network error
            return true;
          }
        }
        return false;
      },
      is_auth_error: (e: Thrown) => {
        if (e === 'auth') { // todo - deprecate this
          return true;
        }
        if (typeof e === 'object') {
          if (e.internal === 'auth') { // StandardError
            return true;
          }
          if (e.status === 401) { // $.ajax auth error
            return true;
          }
        }
        return false;
      },
      is_auth_popup_needed: (e: Thrown) => {
        if (typeof e === 'object') {
          if (e.status === 400 && typeof e.responseJSON === 'object') {
            if (e.responseJSON.error === 'invalid_grant' && tool.value(e.responseJSON.error_description).in(['Bad Request', "Token has been expired or revoked."])) {
              return true;
            }
          }
        }
        return false;
      },
    },
    google: {
      user_info: (account_email: string): Promise<ApirGoogleUserInfo> => tool._.api_google_call(account_email, 'GET', 'https://www.googleapis.com/oauth2/v1/userinfo', {alt: 'json'}),
      auth_popup: (account_email: string|null, tab_id: string, omit_read_scope=false, scopes:string[]=[]): Promise<AuthResult> => {
        return new Promise((resolve, reject) => {
          if (tool.env.is_background_script()) {
            throw {code: null, message: 'Cannot produce auth window from background script'};
          }
          let response_handled = false;
          tool._.api_google_auth_popup_prepare_auth_request_scopes(account_email, scopes, omit_read_scope).then(scopes => {
            let auth_request: AuthRequest = {tab_id, account_email, auth_responder_id: tool.str.random(20), scopes};
            tool.browser.message.listen({
              google_auth_window_result: (result: GoogleAuthWindowResult, sender: chrome.runtime.MessageSender, close_auth_window: VoidCallback) => {
                if (result.state.auth_responder_id === auth_request.auth_responder_id && !response_handled) {
                  response_handled = true;
                  tool._.google_auth_window_result_handler(result).then(resolve, reject);
                  close_auth_window();
                }
              },
            }, auth_request.tab_id);
            let auth_code_window = window.open(tool._.api_google_auth_code_url(auth_request), '_blank', 'height=600,left=100,menubar=no,status=no,toolbar=no,top=100,width=500');
            // auth window will show up. Inside the window, google_auth_code.js gets executed which will send
            // a 'gmail_auth_code_result' chrome message to 'google_auth.google_auth_window_result_handler' and close itself
            if (tool.env.browser().name !== 'firefox') {
              let window_closed_timer = window.setInterval(() => {
                if (auth_code_window === null || typeof auth_code_window === 'undefined') {
                  clearInterval(window_closed_timer);  // on firefox it seems to be sometimes returning a null, due to popup blocking
                } else if (auth_code_window.closed) {
                  clearInterval(window_closed_timer);
                  if (!response_handled) {
                    resolve({success: false, result: 'Closed', account_email: auth_request.account_email, message_id: auth_request.message_id});
                    response_handled = true;
                  }
                }
              }, 250);
            }
          }, reject);
        });
      },
    },
    common: {
      message: (account_email: string, from:string='', to:string|string[]=[], subject:string='', body: SendableMessageBody, attachments:Attachment[]=[], thread_referrence:string|null=null): SendableMessage => {
        // TODO
        // let [primary_pubkey] = await Store.keys_get(account_email, ['primary']); // todo - changing to async - add back later
        // headers: (typeof exports !== 'object' && primary_pubkey !== null) ? { // todo - make it work in electron as well
        //   OpenPGP: 'id=' + primary_pubkey.fingerprint,
        // } : {},
        return {
          headers: {} as FlatHeaders,
          from,
          to: Array.isArray(to) ? to as string[] : (to as string).split(','),
          subject,
          body: typeof body === 'object' ? body : {'text/plain': body},
          attachments,
          thread: thread_referrence,
        };
      },
      reply_correspondents: (account_email: string, addresses: string[], last_message_sender: string|null, last_message_recipients: string[]) => {
        let reply_to_estimate = last_message_recipients;
        if (last_message_sender) {
          reply_to_estimate.unshift(last_message_sender);
        }
        let reply_to:string[] = [];
        let my_email = account_email;
        for (let email of reply_to_estimate) {
          if (email) {
            if (tool.value(tool.str.parse_email(email).email).in(addresses)) { // my email
              my_email = email;
            } else if (!tool.value(tool.str.parse_email(email).email).in(reply_to)) { // skip duplicates
              reply_to.push(tool.str.parse_email(email).email); // reply to all except my emails
            }
          }
        }
        if (!reply_to.length) { // happens when user sends email to itself - all reply_to_estimage contained his own emails and got removed
          reply_to = tool.arr.unique(reply_to_estimate);
        }
        return {to: reply_to, from: my_email};
      },
    },
    gmail: {
      query: {
        or: (arr: string[], quoted:boolean=false) => {
          if (quoted) {
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
      scope: (scope: string[]): string[] => scope.map(s => tool._.var.api_gmail_SCOPE_DICT[s] as string),
      has_scope: (scopes: string[], scope: string) => scopes && tool.value(tool._.var.api_gmail_SCOPE_DICT[scope]).in(scopes),
      thread_get: (account_email: string, thread_id: string, format: GmailApiResponseFormat|null): Promise<ApirGmailThreadGet> => tool._.api_gmail_call(account_email, 'GET', `threads/${thread_id}`, {
          format,
      }),
      draft_create: (account_email: string, mime_message: string, thread_id: string): Promise<ApirGmailDraftCreate> => tool._.api_gmail_call(account_email, 'POST', 'drafts', {
          message: {
            raw: tool.str.base64url_encode(mime_message),
            threadId: thread_id || null,
          },
      }),
      draft_delete: (account_email: string, id: string): Promise<ApirGmailDraftDelete> => tool._.api_gmail_call(account_email, 'DELETE', 'drafts/' + id, null),
      draft_update: (account_email: string, id: string, mime_message: string): Promise<ApirGmailDraftUpdate> => tool._.api_gmail_call(account_email, 'PUT', `drafts/${id}`, {
          message: {
            raw: tool.str.base64url_encode(mime_message),
          },
      }),
      draft_get: (account_email: string, id: string, format:GmailApiResponseFormat='full'): Promise<ApirGmailDraftGet> => tool._.api_gmail_call(account_email, 'GET', `drafts/${id}`, {
          format,
      }),
      draft_send: (account_email: string, id: string): Promise<ApirGmailDraftSend> => tool._.api_gmail_call(account_email, 'POST', 'drafts/send', { // todo - not used yet, and should be
          id,
      }),
      message_send: async (account_email: string, message: SendableMessage, progress_callback?: ApiCallProgressCallback): Promise<ApirGmailMessageSend> => {
        message.headers.From = message.from;
        message.headers.To = message.to.join(',');
        message.headers.Subject = message.subject;
        let mime_message = await tool.mime.encode(message.body, message.headers, message.attachments);
        let request = tool._.encode_as_multipart_related({ 'application/json; charset=UTF-8': JSON.stringify({threadId: message.thread}), 'message/rfc822': mime_message });
        return tool._.api_gmail_call(account_email, 'POST', 'messages/send', request.body, {upload: progress_callback || tool.noop}, request.content_type);
      },
      message_list: (account_email: string, q: string, include_deleted:boolean=false): Promise<ApirGmailMessageList> => tool._.api_gmail_call(account_email, 'GET', 'messages', {
            q,
            includeSpamTrash: include_deleted,
      }),
      message_get: (account_email: string, message_id: string, format: GmailApiResponseFormat): Promise<ApirGmailMessage> => tool._.api_gmail_call(account_email, 'GET', `messages/${message_id}`, {
            format: format || 'full',
      }),
      messages_get: async (account_email: string, message_ids: string[], format: GmailApiResponseFormat): Promise<Dict<ApirGmailMessage>> => {
        let results: Dict<ApirGmailMessage> = {};
        for (let message_id of message_ids) { // todo: serialized requests are slow. parallel processing would be better
          results[message_id] = await tool.api.gmail.message_get(account_email, message_id, format);
        }
        return results;
      },
      attachment_get: (account_email: string, message_id: string, attachment_id: string, progress_callback:ApiCallProgressCallback|null=null): Promise<ApirGmailAttachment> => {
        return tool._.api_gmail_call(account_email, 'GET', `messages/${message_id}/attachments/${attachment_id}`, {}, {download: progress_callback});
      },
      attachment_get_chunk: (account_email: string, message_id: string, attachment_id: string): Promise<string> => new Promise(async (resolve, reject) => {
        let min_bytes = 1000;
        let processed = 0;
        let process_chunk_and_resolve = (chunk: string) => {
          if (!processed++) {
            // make json end guessing easier
            chunk = chunk.replace(/[\n\s\r]/g, '');
            // the response is a chunk of json that may not have ended. One of:
            // {"length":12345,"data":"kksdwei
            // {"length":12345,"data":"kksdweiooiowei
            // {"length":12345,"data":"kksdweiooiowei"
            // {"length":12345,"data":"kksdweiooiowei"}
            if (chunk[chunk.length-1] !== '"' && chunk[chunk.length-2] !== '"') {
              chunk += '"}'; // json end
            } else if (chunk[chunk.length-1] !== '}') {
              chunk += '}'; // json end
            }
            let parsed_json_data_field;
            try {
              parsed_json_data_field = JSON.parse(chunk).data;
            } catch (e) {
              console.log(e);
              reject({code: null, message: "Chunk response could not be parsed"});
              return;
            }
            for (let i = 0; parsed_json_data_field && i < 50; i++) {
              try {
                resolve(tool.str.base64url_decode(parsed_json_data_field));
                return;
              } catch (e) {
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
            if (status >= 200 && status <= 299 && r.responseText.length >= min_bytes) {
              window.clearInterval(response_poll_interval);
              process_chunk_and_resolve(r.responseText);
              r.abort();
            }
          }, 10);
          r.onreadystatechange = () => {
            if (r.readyState === 2 || r.readyState === 3) { // headers, loading
              status = r.status;
              if (status >= 300) {
                reject({code: status, message: `Fail status ${status} received when downloading a chunk`});
                window.clearInterval(response_poll_interval);
                r.abort();
              }
            }
            if (r.readyState === 3 || r.readyState === 4) { // loading, done
              if (status >= 200 && status <= 299 && r.responseText.length >= min_bytes) { // done as a success - resolve in case response_poll didn't catch this yet
                process_chunk_and_resolve(r.responseText);
                window.clearInterval(response_poll_interval);
                if (r.readyState === 3) {
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
        if (typeof node.headers !== 'undefined') {
          for (let i = 0; i < node.headers.length; i++) {
            if (node.headers[i].name.toLowerCase() === header_name.toLowerCase()) {
              return node.headers[i].value;
            }
          }
        }
        return null;
      },
      find_attachments: (message_or_payload_or_part: ApirGmailMessage|ApirGmailMessage$payload|ApirGmailMessage$payload$part, internal_results:Attachment[]=[], internal_message_id:string|null=null) => {
        if (message_or_payload_or_part.hasOwnProperty('payload')) {
          internal_message_id = (message_or_payload_or_part as ApirGmailMessage).id;
          tool.api.gmail.find_attachments((message_or_payload_or_part as ApirGmailMessage).payload, internal_results, internal_message_id);
        }
        if (message_or_payload_or_part.hasOwnProperty('parts')) {
          for (let part of (message_or_payload_or_part as ApirGmailMessage$payload).parts!) {
            tool.api.gmail.find_attachments(part, internal_results, internal_message_id);
          }
        }
        if (message_or_payload_or_part.hasOwnProperty('body') && (message_or_payload_or_part as ApirGmailMessage$payload$part).body!.hasOwnProperty('attachmentId')) {
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
        if (typeof gmail_email_object.payload !== 'undefined') {
          tool.api.gmail.find_bodies(gmail_email_object.payload, internal_results);
        }
        if (typeof gmail_email_object.parts !== 'undefined') {
          for (let part of gmail_email_object.parts) {
            tool.api.gmail.find_bodies(part, internal_results);
          }
        }
        if (typeof gmail_email_object.body !== 'undefined' && typeof gmail_email_object.body.data !== 'undefined' && gmail_email_object.body.size !== 0) {
          internal_results[gmail_email_object.mimeType] = gmail_email_object.body.data;
        }
        return internal_results as SendableMessageBody;
      },
      fetch_attachments: async (account_email: string, attachments:Attachment[]) => {
        let responses = await Promise.all(attachments.map(a => tool.api.gmail.attachment_get(account_email, a.message_id!, a.id!))); // if .message_id or .id not present, api will fail anyway
        for (let i of responses.keys()) {
          attachments[i].data = responses[i].data;
        }
        return attachments;
      },
      search_contacts: (account_email: string, user_query: string, known_contacts: Contact[], chunked_callback: (r: ProviderContactsResults) => void) => { // This will keep triggering callback with new emails as they are being discovered
        let gmail_query = ['is:sent', tool._.var.api_gmail_USELESS_CONTACTS_FILTER];
        if (user_query) {
          let variations_of_to = user_query.split(/[ .]/g).filter(v => !tool.value(v).in(['com', 'org', 'net']));
          if (!tool.value(user_query).in(variations_of_to)) {
            variations_of_to.push(user_query);
          }
          gmail_query.push('(to:' + variations_of_to.join(' OR to:') + ')');
        }
        for (let contact of known_contacts) {
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
      extract_armored_block: async (account_email: string, message_id: string, format:GmailApiResponseFormat): Promise<string> => {
        let gmail_message_object = await tool.api.gmail.message_get(account_email, message_id, format);
        if (format === 'full') {
          let bodies = tool.api.gmail.find_bodies(gmail_message_object);
          let attachments = tool.api.gmail.find_attachments(gmail_message_object);
          let armored_message_from_bodies = tool.crypto.armor.clip(tool.str.base64url_decode(bodies['text/plain'] || '')) || tool.crypto.armor.clip(tool.crypto.armor.strip(tool.str.base64url_decode(bodies['text/html'] || '')));
          if (armored_message_from_bodies) {
            return armored_message_from_bodies;
          } else if (attachments.length) {
            for (let attachment_meta of attachments) {
              if (attachment_meta.treat_as === 'message') {
                let attachments = await tool.api.gmail.fetch_attachments(account_email, [attachment_meta]);
                let armored_message_text = tool.str.base64url_decode(attachments[0].data!);
                let armored_message = tool.crypto.armor.clip(armored_message_text);
                if (armored_message) {
                  return armored_message;
                } else {
                  throw {code: null, internal: 'format', message: 'Problem extracting armored message', data: armored_message_text};
                }
              }
            }
            throw {code: null, internal: 'format', message: 'Armored message not found', data: tool.str.pretty_print(gmail_message_object.payload)};
          } else {
            throw {code: null, internal: 'format', message: 'No attachments', data: tool.str.pretty_print(gmail_message_object.payload)};
          }
        } else { // format === raw
          let mime_message = await tool.mime.decode(tool.str.base64url_decode(gmail_message_object.raw!));
          if (mime_message.text !== undefined) {
            let armored_message = tool.crypto.armor.clip(mime_message.text); // todo - the message might be in attachments
            if (armored_message) {
              return armored_message;
            } else {
              throw {code: null, internal: 'format', message: 'Could not find armored message in parsed raw mime', data: mime_message};
            }
          } else {
            throw {code: null, internal: 'format', message: 'No text in parsed raw mime', data: mime_message};
          }
        }
      },
      fetch_messages_based_on_query_and_extract_first_available_header: async (account_email: string, q: string, header_names: string[]) => {
        let {messages} = await tool.api.gmail.message_list(account_email, q, false);
        return await tool._.api_gmail_fetch_messages_sequentially_from_list_and_extract_first_available_header(account_email, messages || [], header_names);
      },
      fetch_key_backups: async (account_email: string) => {
        let response = await tool.api.gmail.message_list(account_email, tool.api.gmail.query.backups(account_email), true);
        if (!response.messages) {
          return [];
        }
        let message_ids = response.messages.map(m => m.id);
        let messages = await tool.api.gmail.messages_get(account_email, message_ids, 'full');
        let attachments:Attachment[] = [];
        for (let id of Object.keys(messages)) {
          attachments = attachments.concat(tool.api.gmail.find_attachments(messages[id]));
        }
        attachments = await tool.api.gmail.fetch_attachments(account_email, attachments);
        let keys:OpenPGP.key.Key[] = [];
        for (let attachment of attachments) {
          try {
            let armored_key = tool.str.base64url_decode(attachment.data!);
            let key = openpgp.key.readArmored(armored_key).keys[0];
            if (key.isPrivate()) {
              keys.push(key);
            }
          } catch (err) {} // tslint:disable-line:no-empty
        }
        return keys;
      },
    },
    attester: {
      lookup_email: (emails: string[]): Promise<{results: PubkeySearchResult[]}> => tool._.api_attester_call('lookup/email', {
        email: emails.map(e => tool.str.parse_email(e).email),
      }),
      initial_legacy_submit: (email: string, pubkey: string, attest:boolean=false): Promise<ApirAttInitialLegacySugmit> => tool._.api_attester_call('initial/legacy_submit', {
        email: tool.str.parse_email(email).email,
        pubkey: pubkey.trim(),
        attest,
      }),
      initial_confirm: (signed_attest_packet: string): Promise<ApirAttInitialConfirm> => tool._.api_attester_call('initial/confirm', {
        signed_message: signed_attest_packet,
      }),
      replace_request: (email: string, signed_attest_packet: string, new_pubkey: string): Promise<ApirAttReplaceRequest> => tool._.api_attester_call('replace/request', {
        signed_message: signed_attest_packet,
        new_pubkey,
        email,
      }),
      replace_confirm: (signed_attest_packet: string): Promise<ApirAttReplaceConfirm> => tool._.api_attester_call('replace/confirm', {
        signed_message: signed_attest_packet,
      }),
      test_welcome: (email: string, pubkey: string): Promise<ApirAttTestWelcome> => tool._.api_attester_call('test/welcome', {
        email,
        pubkey,
      }),
      diagnose_keyserver_pubkeys: async (account_email: string) => {
        let diagnosis = { has_pubkey_missing: false, has_pubkey_mismatch: false, results: {} as Dict<{attested: boolean, pubkey: string|null, match: boolean}> };
        let {addresses} = await Store.get_account(account_email, ['addresses']);
        let stored_keys = await Store.keys_get(account_email);
        let stored_keys_longids = stored_keys.map(ki => ki.longid);
        let {results} = await tool.api.attester.lookup_email(tool.arr.unique([account_email].concat(addresses || [])));
        for (let pubkey_search_result of results) {
          if (!pubkey_search_result.pubkey) {
            diagnosis.has_pubkey_missing = true;
            diagnosis.results[pubkey_search_result.email] = {attested: false, pubkey: null, match: false};
          } else {
            let match = true;
            if (!tool.value(tool.crypto.key.longid(pubkey_search_result.pubkey)).in(stored_keys_longids)) {
              diagnosis.has_pubkey_mismatch = true;
              match = false;
            }
            diagnosis.results[pubkey_search_result.email] = {pubkey: pubkey_search_result.pubkey, attested: pubkey_search_result.attested || false, match};
          }
        }
        return diagnosis;
      },
      packet: {
        create_sign: async (values: Dict<string>, decrypted_prv: OpenPGP.key.Key) => {
          let lines:string[] = [];
          for (let key of Object.keys(values)) {
            lines.push(key + ':' + values[key]);
          }
          let content_text = lines.join('\n');
          let packet = tool.api.attester.packet.parse(tool._.api_attester_packet_armor(content_text));
          if (packet.success !== true) {
            throw {code: null, message: packet.error, internal: 'parse'};
          }
          return await tool.crypto.message.sign(decrypted_prv, content_text);
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
          if (matches && matches[1]) {
            result.text = matches[1].replace(/^\s+|\s+$/g, '');
            let lines = result.text.split('\n');
            for (let line of lines) {
              let line_parts = line.replace('\n', '').replace(/^\s+|\s+$/g, '').split(':');
              if (line_parts.length !== 2) {
                result.error = 'Wrong content line format';
                result.content = {};
                return result;
              }
              if (!accepted_values[line_parts[0]]) {
                result.error = 'Unknown line key';
                result.content = {};
                return result;
              }
              if (result.content[accepted_values[line_parts[0]]]) {
                result.error = 'Duplicate line key';
                result.content = {};
                return result;
              }
              result.content[accepted_values[line_parts[0]]] = line_parts[1];
            }
            if (result.content.fingerprint && result.content.fingerprint.length !== 40) { // todo - we should use regex here, everywhere
              result.error = 'Wrong PUB line value format';
              result.content = {};
              return result;
            }
            if (result.content.email_hash && result.content.email_hash.length !== 40) {
              result.error = 'Wrong ADD line value format';
              result.content = {};
              return result;
            }
            if (result.content.str_random && result.content.str_random.length !== 40) {
              result.error = 'Wrong RAN line value format';
              result.content = {};
              return result;
            }
            if (result.content.fingerprint_old && result.content.fingerprint_old.length !== 40) {
              result.error = 'Wrong OLD line value format';
              result.content = {};
              return result;
            }
            if (result.content.action && !tool.value(result.content.action).in(['INITIAL', 'REQUEST_REPLACEMENT', 'CONFIRM_REPLACEMENT'])) {
              result.error = 'Wrong ACT line value format';
              result.content = {};
              return result;
            }
            if (result.content.action && !tool.value(result.content.action).in(['CRYPTUP'])) {
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
      auth_error: () => ({code: 401, message: 'Could not log in', internal: 'auth', stack: tool.catch.stack_trace()}),
      url: (type: string, variable='') => {
        return ({
          'api': 'https://flowcrypt.com/api/',
          'me': 'https://flowcrypt.com/me/' + variable,
          'pubkey': 'https://flowcrypt.com/pub/' + variable,
          'decrypt': 'https://flowcrypt.com/' + variable,
          'web': 'https://flowcrypt.com/',
        } as Dict<string>)[type];
      },
      help_feedback: (account_email: string, message: string): Promise<ApirFcHelpFeedback> => tool._.api_cryptup_call('help/feedback', {
        email: account_email,
        message,
      }),
      help_uninstall: (email: string, client: string) => tool._.api_cryptup_call('help/uninstall', {
        email,
        client,
        metrics: null,
      }),
      account_login: async (account_email: string, token:string|null=null): Promise<{verified: boolean, subscription: SubscriptionInfo}> => {
        let auth_info = await Store.auth_info();
        let uuid = auth_info.uuid || tool.crypto.hash.sha1(tool.str.random(40));
        let account = auth_info.account_email || account_email;
        let response: ApirFcAccountLogin = await tool._.api_cryptup_call('account/login', {
          account,
          uuid,
          token,
        });
        if(response.registered !== true) {
          throw new Error('account_login did not result in successful registration');
        }
        await Store.set(null, {cryptup_account_email: account, cryptup_account_uuid: uuid, cryptup_account_verified: response.verified === true, cryptup_account_subscription: response.subscription});
        return {verified: response.verified === true, subscription: response.subscription};
      },
      account_check: (emails: string[]) => tool._.api_cryptup_call('account/check', {
        emails,
      }) as Promise<ApirFcAccountCheck>,
      account_check_sync: async () => { // callbacks true on updated, false not updated, null for could not fetch
        let emails = await Store.account_emails_get();
        if (emails.length) {
          let response = await tool.api.cryptup.account_check(emails);
          let auth_info = await Store.auth_info();
          let subscription = await Store.subscription();
          let local_storage_update: GlobalStore = {};
          if (response.email) {
            if (response.email !== auth_info.account_email) {
              // this will of course fail auth on the server when used. The user will be prompted to verify this new device when that happens.
              local_storage_update.cryptup_account_email = response.email;
              local_storage_update.cryptup_account_uuid = tool.crypto.hash.sha1(tool.str.random(40));
              local_storage_update.cryptup_account_verified = false;
            }
          } else {
            if (auth_info.account_email) {
              local_storage_update.cryptup_account_email = null;
              local_storage_update.cryptup_account_uuid = null;
              local_storage_update.cryptup_account_verified = false;
            }
          }
          if (response.subscription) {
            let rs = response.subscription;
            if (rs.level !== subscription.level || rs.method !== subscription.method || rs.expire !== subscription.expire || subscription.active !== !rs.expired) {
              local_storage_update.cryptup_account_subscription = {active: !rs.expired, method: rs.method, level: rs.level, expire: rs.expire};
            }
          } else {
            if (subscription.level || subscription.expire || subscription.active || subscription.method) {
              local_storage_update.cryptup_account_subscription = null;
            }
          }
          if (Object.keys(local_storage_update).length) {
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
        if (!auth_info.verified) {
          throw tool.api.cryptup.auth_error();
        }
        let request = {account: auth_info.account_email, uuid: auth_info.uuid} as Dict<Serializable>;
        if (update_values) {
          for (let k of Object.keys(update_values)) {
            request[k] = update_values[k];
          }
        }
        return await tool._.api_cryptup_call('account/update', request);
      },
      account_subscribe: async (product: string, method: string, payment_source_token:string|null=null): Promise<ApirFcAccountSubscribe> => {
        let auth_info = await Store.auth_info();
        if (!auth_info.verified) {
          throw tool.api.cryptup.auth_error();
        }
        let response: ApirFcAccountSubscribe = await tool._.api_cryptup_call('account/subscribe', {
          account: auth_info.account_email,
          uuid: auth_info.uuid,
          method,
          source: payment_source_token,
          product,
        });
        await Store.set(null, { cryptup_account_subscription: response.subscription });
        return response;
      },
      message_presign_files: async (attachments: Attachment[], auth_method: FlowCryptApiAuthMethods): Promise<ApirFcMessagePresignFiles> => {
        let response: ApirFcMessagePresignFiles;
        let lengths = attachments.map(a => a.size);
        if (!auth_method) {
          response = await tool._.api_cryptup_call('message/presign_files', {
            lengths,
          });
        } else if (auth_method === 'uuid') {
          let auth_info = await Store.auth_info();
          if (!auth_info.verified) {
            throw tool.api.cryptup.auth_error();
          }
          response = await tool._.api_cryptup_call('message/presign_files', {
            account: auth_info.account_email,
            uuid: auth_info.uuid,
            lengths,
          });
        } else {
          response = await tool._.api_cryptup_call('message/presign_files', {
            message_token_account: auth_method.account,
            message_token: auth_method.token,
            lengths,
          });
        }
        if (response.approvals && response.approvals.length === attachments.length) {
          return response;
        }
        throw new Error('Could not verify that all files were uploaded properly, please try again.');
      },
      message_confirm_files: (identifiers: string[]): Promise<ApirFcMessageConfirmFiles> => tool._.api_cryptup_call('message/confirm_files', {
        identifiers,
      }),
      message_upload: async (encrypted_data_armored: string, auth_method: FlowCryptApiAuthMethods): Promise<ApirFcMessageUpload> => { // todo - DEPRECATE THIS. Send as JSON to message/store
        if (encrypted_data_armored.length > 100000) {
          throw {code: null, message: 'Message text should not be more than 100 KB. You can send very long texts as attachments.'};
        }
        let content = tool.file.attachment('cryptup_encrypted_message.asc', 'text/plain', encrypted_data_armored);
        if (!auth_method) {
          return await tool._.api_cryptup_call('message/upload', {content}, 'FORM');
        } else {
          let auth_info = await Store.auth_info();
          if (!auth_info.verified) {
            throw tool.api.cryptup.auth_error();
          }
          return await tool._.api_cryptup_call('message/upload', {account: auth_info.account_email, uuid: auth_info.uuid, content}, 'FORM');
        }
      },
      message_token: async (): Promise<ApirFcMessageToken> => {
        let auth_info = await Store.auth_info();
        if (!auth_info.verified) {
          throw tool.api.cryptup.auth_error();
        }
        return await tool._.api_cryptup_call('message/token', {account: auth_info.account_email, uuid: auth_info.uuid});
      },
      message_expiration: async (admin_codes: string[], add_days:null|number=null): Promise<ApirFcMessageExpiration> => {
        let auth_info = await Store.auth_info();
        if (!auth_info.verified) {
          throw tool.api.cryptup.auth_error();
        }
        return await tool._.api_cryptup_call('message/expiration', {account: auth_info.account_email, uuid: auth_info.uuid, admin_codes, add_days});
      },
      message_reply: (short: string, token: string, from: string, to: string, subject: string, message: string) => tool._.api_cryptup_call('message/reply', {
        short,
        token,
        from,
        to,
        subject,
        message,
      }),
      message_contact: (sender: string, message: string, message_token: FlowCryptApiAuthToken) => tool._.api_cryptup_call('message/contact', {
        message_token_account: message_token.account,
        message_token: message_token.token,
        sender,
        message,
      }),
      link_message: (short: string): Promise<ApirFcMessageLink> => tool._.api_cryptup_call('link/message', {
        short,
      }),
      link_me: (alias: string) => tool._.api_cryptup_call('link/me', { // todo - add return type
        alias,
      }),
    },
    aws: {
      s3_upload: (items: {base_url:string, fields: Dict<Serializable|Attachment>, attachment: Attachment}[], progress_callback: ApiCallProgressCallback) => {
        let progress = tool.arr.zeroes(items.length);
        let promises:Promise<void>[] = [];
        if (!items.length) {
          return Promise.resolve(promises);
        }
        for (let i of items.keys()) {
          let values = items[i].fields;
          values.file = tool.file.attachment('encrpted_attachment', 'application/octet-stream', items[i].attachment.content!);
          promises.push(tool._.api_call(items[i].base_url, '', values, 'FORM', {upload: (single_file_progress: number) => {
            progress[i] = single_file_progress;
            tool.ui.event.prevent(tool.ui.event.spree(), () => {
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
  noop: (): void => undefined,
  enums: {
    recovery_email_subjects: ['Your FlowCrypt Backup', 'Your CryptUp Backup', 'All you need to know about CryptUP (contains a backup)', 'CryptUP Account Backup'],
  },
  _: {
    var: { // meant to be used privately within this file like so: tool._.vars.???
      // internal variables
      ui_event_fired: {} as Dict<number>,
      browser_message_background_script_registered_handlers: null as Dict<BrowserMessageHandler>|null,
      browser_message_frame_registered_handlers: {} as Dict<BrowserMessageHandler>,
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
          for (let i = 0; i < traverse_up_levels; i++) {
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
      crypto_password_GUESSES_PER_SECOND: 10000 * 2 * 4000, // (10k pc)*(2 core p/pc)*(4k guess p/core) httpshttps://www.abuse.ch/?p=3294://threatpost.com/how-much-does-botnet-cost-022813/77573/ https://www.abuse.ch/?p=3294
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
      return (typeof str === 'undefined') ? str : btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    str_base64url_utf_decode: (str: string) => { // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
      return (typeof str === 'undefined') ? str : decodeURIComponent(Array.prototype.map.call(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
    },
    mime_node_type: (node: MimeParserNode) => {
      if (node.headers['content-type'] && node.headers['content-type'][0]) {
        return node.headers['content-type'][0].value;
      }
    },
    mime_node_filename: (node: MimeParserNode) => {
      // @ts-ignore - lazy
      if (node.headers['content-disposition'] && node.headers['content-disposition'][0] && node.headers['content-disposition'][0].params && node.headers['content-disposition'][0].params.filename) {
        // @ts-ignore - lazy
        return node.headers['content-disposition'][0].params.filename;
      }
      // @ts-ignore - lazy
      if (node.headers['content-type'] && node.headers['content-type'][0] && node.headers['content-type'][0].params && node.headers['content-type'][0].params.name) {
        // @ts-ignore - lazy
        return node.headers['content-type'][0].params.name;
      }
    },
    mime_content_node: (MimeBuilder: AnyThirdPartyLibrary, type: string, content: string): MimeParserNode => {
      let node = new MimeBuilder(type).setContent(content);
      if (type === 'text/plain') {
        node.addHeader('Content-Transfer-Encoding', 'quoted-printable'); // gmail likes this
      }
      return node;
    },
    mime_require: (group: 'parser'|'builder') => new Promise(resolve => {
      if (group === 'parser') {
        if (typeof MimeParser !== 'undefined') { // browser
          resolve(MimeParser);
        } else if (typeof exports === 'object') { // electron
          resolve(require('emailjs-mime-parser'));
        } else { // RequireJS
          tool.env.set_up_require();
          require(['emailjs-mime-parser'], resolve);
        }
      } else {
        if (typeof MimeBuilder !== 'undefined') { // browser
          resolve(MimeBuilder);
        } else if (typeof exports === 'object') { // electron
          resolve(require('emailjs-mime-builder'));
        } else { // RequireJS
          tool.env.set_up_require();
          require(['emailjs-mime-builder'], resolve);
        }
      }
    }),
    crypto_armor_block_object: (type: MessageBlockType, content: string, missing_end=false):MessageBlock => ({type, content, complete: !missing_end}),
    crypto_armor_detect_block_next: (original_text: string, start_at: number) => {
      let result = {found: [] as MessageBlock[], continue_at: null as number|null};
      let begin = original_text.indexOf(tool.crypto.armor.headers('null').begin, start_at);
      if (begin !== -1) { // found
        let potential_begin_header = original_text.substr(begin, tool._.var.crypto_armor_header_MAX_LENGTH);
        for (let _type of Object.keys(tool._.var.crypto_armor_headers_DICT)) {
          let type = _type as ReplaceableMessageBlockType;
          let block_header_def = tool._.var.crypto_armor_headers_DICT[type];
          if (block_header_def.replace) {
            let index_of_confirmed_begin = potential_begin_header.indexOf(block_header_def.begin);
            if (index_of_confirmed_begin === 0 || (type === 'password_message' && index_of_confirmed_begin >= 0 && index_of_confirmed_begin < 15)) { // identified beginning of a specific block
              if (begin > start_at) {
                let potential_text_before_block_begun = original_text.substring(start_at, begin).trim();
                if (potential_text_before_block_begun) {
                  result.found.push(tool._.crypto_armor_block_object('text', potential_text_before_block_begun));
                }
              }
              let end_index: number = -1;
              let found_block_end_header_length = 0;
              if (typeof block_header_def.end === 'string') {
                end_index = original_text.indexOf(block_header_def.end, begin + block_header_def.begin.length);
                found_block_end_header_length = block_header_def.end.length;
              } else { // regexp
                let original_text_after_begin_index = original_text.substring(begin);
                let regexp_end = original_text_after_begin_index.match(block_header_def.end);
                if (regexp_end !== null) {
                  end_index = regexp_end.index ? begin + regexp_end.index : -1;
                  found_block_end_header_length = regexp_end[0].length;
                }
              }
              if (end_index !== -1) { // identified end of the same block
                if (type !== 'password_message') {
                  result.found.push(tool._.crypto_armor_block_object(type, original_text.substring(begin, end_index + found_block_end_header_length).trim()));
                } else {
                  let pm_full_text = original_text.substring(begin, end_index + found_block_end_header_length).trim();
                  let pm_short_id_match = pm_full_text.match(/[a-zA-Z0-9]{10}$/);
                  if (pm_short_id_match) {
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
      if (original_text && !result.found.length) { // didn't find any blocks, but input is non-empty
        let potential_text = original_text.substr(start_at).trim();
        if (potential_text) {
          result.found.push(tool._.crypto_armor_block_object('text', potential_text));
        }
      }
      return result;
    },
    crypto_hash_sha256_loop: (string: string, times=100000) => {
      for (let i = 0; i < times; i++) {
        string = tool.crypto.hash.sha256(string);
      }
      return string;
    },
    crypto_key_ids: (armored_pubkey: string) => openpgp.key.readArmored(armored_pubkey).keys[0].getKeyIds(),
    crypto_message_prepare_for_decrypt: (data: string|Uint8Array): {is_armored: boolean, is_cleartext: false, message: OpenPGP.message.Message}|{is_armored: boolean, is_cleartext: true, message: OpenPGP.cleartext.CleartextMessage} => {
      let first_100_bytes = tool.str.from_uint8(data.slice(0, 100));
      let is_armored_encrypted = tool.value(tool.crypto.armor.headers('message').begin).in(first_100_bytes);
      let is_armored_signed_only = tool.value(tool.crypto.armor.headers('signed_message').begin).in(first_100_bytes);
      let is_armored = is_armored_encrypted || is_armored_signed_only;
      if (is_armored_encrypted) {
        return {is_armored, is_cleartext: false, message: openpgp.message.readArmored(tool.str.from_uint8(data))};
      } else if (is_armored_signed_only) {
        return {is_armored, is_cleartext: true, message: openpgp.cleartext.readArmored(tool.str.from_uint8(data))};
      } else {
        return {is_armored, is_cleartext: false, message: openpgp.message.read(tool.str.to_uint8(data))};
      }
    },
    crypto_message_get_sorted_keys_for_message: async (account_email: string, message: OpenPGP.message.Message|OpenPGP.cleartext.CleartextMessage): Promise<InternalSortedKeysForDecrypt> => {
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
      keys.encrypted_for = (message instanceof openpgp.message.Message ? (message as OpenPGP.message.Message).getEncryptionKeyIds() : []).map(id => tool.crypto.key.longid(id.bytes)).filter(Boolean) as string[];
      keys.signed_by = (message.getSigningKeyIds ? message.getSigningKeyIds() : []).filter(Boolean).map(id => tool.crypto.key.longid((id as any).bytes)).filter(Boolean) as string[];
      let private_keys_all = await Store.keys_get(account_email);
      keys.prv_matching = private_keys_all.filter(ki => tool.value(ki.longid).in(keys.encrypted_for));
      if (keys.prv_matching.length) {
        keys.prv_for_decrypt = keys.prv_matching;
      } else {
        keys.prv_for_decrypt = private_keys_all;
      }
      let passphrases = (await Promise.all(keys.prv_for_decrypt.map(ki => Store.passphrase_get(account_email, ki.longid))));
      let passphrases_filtered = passphrases.filter(pp => pp !== null) as string[];
      for (let i of keys.prv_for_decrypt.keys()) {
        let key = openpgp.key.readArmored(keys.prv_for_decrypt[i].private).keys[0];
        if (passphrases_filtered.length && await tool.crypto.key.decrypt(key, passphrases_filtered) === true) {
          keys.prv_for_decrypt[i].decrypted = key;
          keys.prv_for_decrypt_with_passphrases.push(keys.prv_for_decrypt[i]);
        } else {
          keys.prv_for_decrypt_without_passphrases.push(keys.prv_for_decrypt[i]);
        }
      }
      if (keys.signed_by.length && typeof Store.db_contact_get === 'function') {
        let verification_contacts = await Store.db_contact_get(null, keys.signed_by);
        keys.verification_contacts = verification_contacts.filter(contact => contact !== null && contact.pubkey) as Contact[];
        keys.for_verification = [].concat.apply([], keys.verification_contacts.map(contact => openpgp.key.readArmored(contact.pubkey!).keys)); // pubkey! checked above
      }
      return keys;
    },
    crypto_message_decrypt_categorize_error: (decrypt_error: Error, message_password: string|null): DecryptError$error => {
      let e = String(decrypt_error).replace('Error: ', '').replace('Error decrypting message: ', '');
      if (tool.value(e).in(['Cannot read property \'isDecrypted\' of null', 'privateKeyPacket is null', 'TypeprivateKeyPacket is null', 'Session key decryption failed.', 'Invalid session key for decryption.']) && !message_password) {
        return {type: DecryptErrorTypes.key_mismatch, error: e};
      } else if (message_password && tool.value(e).in(['Invalid enum value.', 'CFB decrypt: invalid key'])) {
        return {type: DecryptErrorTypes.wrong_password, error: e};
      } else if (e === 'Decryption failed due to missing MDC in combination with modern cipher.') {
        return {type: DecryptErrorTypes.no_mdc, error: e};
      } else if (e === 'Decryption error') {
        return {type: DecryptErrorTypes.format, error: e};
      } else {
        return {type: DecryptErrorTypes.other, error: e};
      }
    },
    readable_crack_time: (total_seconds: number) => { // http://stackoverflow.com/questions/8211744/convert-time-interval-given-in-seconds-into-more-human-readable-form
      let number_word_ending = (n: number) => (n > 1) ? 's' : '';
      total_seconds = Math.round(total_seconds);
      let millennia = Math.round(total_seconds / (86400 * 30 * 12 * 100 * 1000));
      if (millennia) {
        return millennia === 1 ? 'a millennium' : 'millennia';
      }
      let centuries = Math.round(total_seconds / (86400 * 30 * 12 * 100));
      if (centuries) {
        return centuries === 1 ? 'a century' : 'centuries';
      }
      let years = Math.round(total_seconds / (86400 * 30 * 12));
      if (years) {
        return years + ' year' + number_word_ending(years);
      }
      let months = Math.round(total_seconds / (86400 * 30));
      if (months) {
        return months + ' month' + number_word_ending(months);
      }
      let days = Math.round(total_seconds / 86400);
      if (days) {
        return days + ' day' + number_word_ending(days);
      }
      let hours = Math.round(total_seconds / 3600);
      if (hours) {
        return hours + ' hour' + number_word_ending(hours);
      }
      let minutes = Math.round(total_seconds / 60);
      if (minutes) {
        return minutes + ' minute' + number_word_ending(minutes);
      }
      let seconds = total_seconds % 60;
      if (seconds) {
        return seconds + ' second' + number_word_ending(seconds);
      }
      return 'less than a second';
    },
    /* [BARE_ENGINE_OMIT_BEGIN] */
    browser_message_destination_parse: (destination_string: string|null) => {
      let parsed = { tab: null as null|number, frame: null as null|number };
      if (destination_string) {
        parsed.tab = Number(destination_string.split(':')[0]);
        // @ts-ignore - adding nonsense into isNaN
        parsed.frame = !isNaN(destination_string.split(':')[1]) ? Number(destination_string.split(':')[1]) : null;
      }
      return parsed;
    },
    get_ajax_progress_xhr: (progress_callbacks: ApiCallProgressCallbacks|null) => {
      let progress_reporting_xhr = new (window as FcWindow).XMLHttpRequest();
      if (progress_callbacks && typeof progress_callbacks.upload === 'function') {
        progress_reporting_xhr.upload.addEventListener('progress', (evt: ProgressEvent) => {
          progress_callbacks.upload!(evt.lengthComputable ? Math.round((evt.loaded / evt.total) * 100) : null, null, null); // checked ===function above
        }, false);
      }
      if (progress_callbacks && typeof progress_callbacks.download === 'function') {
        progress_reporting_xhr.onprogress = (evt: ProgressEvent) => {
          progress_callbacks.download!(evt.lengthComputable ? Math.floor((evt.loaded / evt.total) * 100) : null, evt.loaded, evt.total); // checked ===function above
        };
      }
      return progress_reporting_xhr;
    },
    api_call: async (base_url: string, path: string, values: Dict<any>, format: ApiCallFormat, progress:ApiCallProgressCallbacks|null, headers:FlatHeaders|undefined=undefined, response_format:ApiResponseFormat='json', method:ApiCallMethod='POST') => {
      progress = progress || {} as ApiCallProgressCallbacks;
      let formatted_values:FormData|string;
      let content_type: string|false;
      if (format === 'JSON' && values !== null) {
        formatted_values = JSON.stringify(values);
        content_type = 'application/json; charset=UTF-8';
      } else if (format === 'FORM') {
        formatted_values = new FormData();
        for (let name of Object.keys(values)) {
          let value = values[name];
          if (typeof value === 'object' && value.name && value.content && value.type) {
            (formatted_values as FormData).append(name, new Blob([value.content], { type: value.type }), value.name); // todo - type should be just app/pgp? for privacy
          } else {
            (formatted_values as FormData).append(name, value);
          }
        }
        content_type = false;
      } else {
        throw Error('unknown format:' + String(format));
      }
      let response = await $.ajax({
        xhr: () => tool._.get_ajax_progress_xhr(progress),
        url: base_url + path,
        method,
        data: formatted_values,
        dataType: response_format,
        crossDomain: true,
        headers,
        processData: false,
        contentType: content_type,
        async: true,
        timeout: typeof progress!.upload === 'function' || typeof progress!.download === 'function' ? undefined : 20000, // substituted with {} above
      });
      if (response && typeof response === 'object' && typeof response.error === 'object') {
        throw response as StandardError;
      }
      return response;
    },
    api_google_auth_state_pack: (status_object: AuthRequest) => tool._.var.google_oauth2!.state_header + JSON.stringify(status_object),
    api_google_auth_code_url: (auth_request: AuthRequest) => tool.env.url_create(tool._.var.google_oauth2!.url_code, {
      client_id: tool._.var.google_oauth2!.client_id,
      response_type: 'code',
      access_type: 'offline',
      state: tool._.api_google_auth_state_pack(auth_request),
      redirect_uri: tool._.var.google_oauth2!.url_redirect,
      scope: (auth_request.scopes || []).join(' '),
      login_hint: auth_request.account_email,
    }),
    google_auth_save_tokens: async (account_email: string, tokens_object: GoogleAuthTokensResponse, scopes: string[]) => {
      let to_save: AccountStore = {
        google_token_access: tokens_object.access_token,
        google_token_expires: new Date().getTime() + (tokens_object.expires_in as number) * 1000,
        google_token_scopes: scopes,
      };
      if (typeof tokens_object.refresh_token !== 'undefined') {
        to_save.google_token_refresh = tokens_object.refresh_token;
      }
      await Store.set(account_email, to_save);
    },
    google_auth_get_tokens: (code: string): Promise<GoogleAuthTokensResponse> => $.ajax({
      url: tool.env.url_create(tool._.var.google_oauth2!.url_tokens, { grant_type: 'authorization_code', code, client_id: tool._.var.google_oauth2!.client_id, redirect_uri: tool._.var.google_oauth2!.url_redirect }),
      method: 'POST',
      crossDomain: true,
      async: true,
    }),
    google_auth_refresh_token: (refresh_token: string): Promise<GoogleAuthTokensResponse> => $.ajax({
      url: tool.env.url_create(tool._.var.google_oauth2!.url_tokens, { grant_type: 'refresh_token', refresh_token, client_id: tool._.var.google_oauth2!.client_id }),
      method: 'POST',
      crossDomain: true,
      async: true,
    }),
    google_auth_check_access_token: (access_token: string): Promise<GoogleAuthTokenInfo> => $.ajax({
      url: tool.env.url_create('https://www.googleapis.com/oauth2/v1/tokeninfo', { access_token }),
      crossDomain: true,
      async: true,
    }),
    google_auth_check_email: async (expected_email: string|null, access_token: string) => {
      try {
        let r = await $.ajax({
          url: 'https://www.googleapis.com/gmail/v1/users/me/profile',
          method: 'GET',
          headers: { 'Authorization': 'Bearer ' + access_token },
          crossDomain: true,
          contentType: 'application/json; charset=UTF-8',
          async: true,
        });
        return r.emailAddress || expected_email;  // todo - emailAddress may be undefined. Handle better
      } catch (e) {
        console.log(['google_auth_check_email error', expected_email, e]);
        return expected_email; // todo - handle better. On a network error, this could result in saving this wrongly. Should re-try two times with some delay, then call back.
      }
    },
    google_auth_window_result_handler: async (result: GoogleAuthWindowResult): Promise<AuthResult> => {
      if (result.result === 'Success') {
        let tokens_object = await tool._.google_auth_get_tokens(result.params.code);
        let _ = await tool._.google_auth_check_access_token(tokens_object.access_token); // https://groups.google.com/forum/#!topic/oauth2-dev/QOFZ4G7Ktzg
        let account_email = await tool._.google_auth_check_email(result.state.account_email, tokens_object.access_token);
        await tool._.google_auth_save_tokens(account_email, tokens_object, result.state.scopes!); // we fill AuthRequest inside .auth_popup()
        return { account_email, success: true, result: 'Success', message_id: result.state.message_id };
      } else if (result.result === 'Denied') {
        return { success: false, result: 'Denied', error: result.params.error, account_email: result.state.account_email, message_id: result.state.message_id };
      } else if (result.result === 'Error') {
        return { success: false, result: 'Error', error: result.params.error, account_email: result.state.account_email, message_id: result.state.message_id };
      } else {
        throw new Error(`Unknown GoogleAuthWindowResult.result === '${result.result}'`);
      }
    },
    api_google_call_retry_auth_error_one_time: async (account_email: string, request: JQuery.AjaxSettings) => {
      try {
        return await $.ajax(request);
      } catch (e) {
        if (tool.api.error.is_auth_error(e)) { // force refresh token
          request.headers!.Authorization = await tool._.google_api_authorization_header(account_email, true);
          return await $.ajax(request);
        }
      }
    },
    api_google_call: async (account_email: string, method: ApiCallMethod, url: string, parameters: Dict<Serializable>|string) => {
      let data = method === 'GET' || method === 'DELETE' ? parameters : JSON.stringify(parameters);
      let headers = { Authorization: await tool._.google_api_authorization_header(account_email) };
      let request = {url, method, data, headers, crossDomain: true, contentType: 'application/json; charset=UTF-8', async: true};
      return await tool._.api_google_call_retry_auth_error_one_time(account_email, request);
    },
    // todo - asyncified
    api_gmail_call: async (account_email: string, method: ApiCallMethod, resource: string, parameters: Dict<Serializable>|string|null, progress:ApiCallProgressCallbacks|null=null, contentType:string|null=null) => {
      progress = progress || {};
      let data;
      let url;
      if (typeof progress!.upload === 'function') { // substituted with {} above
        url = 'https://www.googleapis.com/upload/gmail/v1/users/me/' + resource + '?uploadType=multipart';
        data = parameters || undefined;
      } else {
        url = 'https://www.googleapis.com/gmail/v1/users/me/' + resource;
        if (method === 'GET' || method === 'DELETE') {
          data = parameters || undefined;
        } else {
          data = JSON.stringify(parameters) || undefined;
        }
      }
      contentType = contentType || 'application/json; charset=UTF-8';
      let headers = { 'Authorization': await tool._.google_api_authorization_header(account_email) };
      let xhr = () => tool._.get_ajax_progress_xhr(progress);
      let request = {xhr, url, method, data, headers, crossDomain: true, contentType, async: true};
      return await tool._.api_google_call_retry_auth_error_one_time(account_email, request);
    },
    google_api_is_auth_token_valid: (s: AccountStore) => s.google_token_access && (!s.google_token_expires || s.google_token_expires > new Date().getTime() + (120 * 1000)), // oauth token will be valid for another 2 min
    google_api_authorization_header: async (account_email: string, force_refresh=false): Promise<string> => {
      if (!account_email) {
        throw new Error('missing account_email in api_gmail_call');
      }
      let storage = await Store.get_account(account_email, ['google_token_access', 'google_token_expires', 'google_token_scopes', 'google_token_refresh']);
      if (!storage.google_token_access || !storage.google_token_refresh) {
        throw new Error('Account not connected to FlowCrypt Browser Extension');
      } else if (tool._.google_api_is_auth_token_valid(storage) && !force_refresh) {
        return `Bearer ${storage.google_token_access}`;
      } else { // refresh token
        let refresh_token_response = await tool._.google_auth_refresh_token(storage.google_token_refresh);
        let _ = await tool._.google_auth_check_access_token(refresh_token_response.access_token); // https://groups.google.com/forum/#!topic/oauth2-dev/QOFZ4G7Ktzg
        await tool._.google_auth_save_tokens(account_email, refresh_token_response, storage.google_token_scopes || []);
        let auth = await Store.get_account(account_email, ['google_token_access', 'google_token_expires']);
        if (tool._.google_api_is_auth_token_valid(auth)) { // have a valid gmail_api oauth token
          return `Bearer ${auth.google_token_access}`;
        } else {
          throw {code: 401, message: 'Could not refresh google auth token - did not become valid', internal: 'auth'};
        }
      }
    },
    api_google_auth_popup_prepare_auth_request_scopes: async (account_email: string|null, requested_scopes: string[], omit_read_scope: boolean): Promise<string[]> => {
      let current_tokens_scopes: string[] = [];
      if (account_email) {
        let storage = await Store.get_account(account_email, ['google_token_scopes']);
        current_tokens_scopes = storage.google_token_scopes || [];
      }
      let auth_request_scopes = requested_scopes || [];
      for (let scope of tool._.var.google_oauth2!.scopes) {
        if (!tool.value(scope).in(requested_scopes)) {
          if (scope !== tool.api.gmail.scope(['read'])[0] || !omit_read_scope) { // leave out read messages permission if user chose so
            auth_request_scopes.push(scope);
          }
        }
      }
      for (let scope of current_tokens_scopes) {
        if (!tool.value(scope).in(requested_scopes)) {
          auth_request_scopes.push(scope);
        }
      }
      return auth_request_scopes;
    },
    encode_as_multipart_related: (parts: Dict<string>) => { // todo - this could probably be achieved with emailjs-mime-builder
      let boundary = 'this_sucks_' + tool.str.random(10);
      let body = '';
      for (let type of Object.keys(parts)) {
        body += '--' + boundary + '\n';
        body += 'Content-Type: ' + type + '\n';
        if (tool.value('json').in(type as string)) {
          body += '\n' + parts[type] + '\n\n';
        } else {
          body += 'Content-Transfer-Encoding: base64\n';
          body += '\n' + btoa(parts[type]) + '\n\n';
        }
      }
      body += '--' + boundary + '--';
      return { content_type: 'multipart/related; boundary=' + boundary, body };
    },
    api_gmail_loop_through_emails_to_compile_contacts: async (account_email: string, query: string, chunked_callback: (r: ProviderContactsResults) => void) => {
      let all_results: ProviderContactsResult[] = [];
      while(true) {
        let headers = await tool.api.gmail.fetch_messages_based_on_query_and_extract_first_available_header(account_email, query, ['to', 'date']);
        if (headers.to) {
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
      for (let message of messages) {
        let header_values: FlatHeaders = {};
        let message_get_response = await tool.api.gmail.message_get(account_email, message.id, 'metadata');
        for (let header_name of header_names) {
          let value = tool.api.gmail.find_header(message_get_response, header_name);
          if (value !== null) {
            header_values[header_name] = value;
          } else {
            break;
          }
        }
        if (Object.values(header_values).length === header_names.length) {
          return header_values; // all requested header values found in one msg
        }
      }
      return {};
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
      if (typeof error === 'string') {
        error_message = error;
        error = { name: 'thrown_string', message: error_message, stack: error_message };
      }
      if (error_message && url && typeof line !== 'undefined' && !col && !error && !is_manually_called && !version && !env) { // safari has limited support
        error = { name: 'safari_error', message: error_message, stack: error_message };
      }
      if (typeof error_message === 'undefined' && line === 0 && col === 0 && is_manually_called && typeof error === 'object' && !(error instanceof Error)) {
        let stringified;
        try { // this sometimes happen with unhandled Promise.then(_, reject)
          stringified = JSON.stringify(error);
        } catch (cannot) {
          stringified = 'typeof: ' + (typeof error) + '\n' + String(error);
        }
        error = { name: 'thrown_object', message: error.message || '(unknown)', stack: stringified};
        error_message = 'thrown_object';
      }
      let user_log_message = ' Please report errors above to human@flowcrypt.com. I fix errors VERY promptly.';
      let ignored_errors = [
        'Invocation of form get(, function) doesn\'t match definition get(optional string or array or object keys, function callback)', // happens in gmail window when reloaded extension + now reloading gmail
        'Invocation of form set(, function) doesn\'t match definition set(object items, optional function callback)', // happens in gmail window when reloaded extension + now reloading gmail
        'Invocation of form runtime.connect(null, ) doesn\'t match definition runtime.connect(optional string extensionId, optional object connectInfo)',
      ];
      if (!error) {
        return;
      }
      if (ignored_errors.indexOf((error as Error).message) !== -1) { // todo - remove cast & debug
        return true;
      }
      if ((error as Error).stack) { // todo - remove cast & debug
        console.log('%c[' + error_message + ']\n' + (error as Error).stack, 'color: #F00; font-weight: bold;');  // todo - remove cast & debug
      } else {
        console.log('%c' + error_message, 'color: #F00; font-weight: bold;');
      }
      if (is_manually_called !== true && tool.catch._.original_on_error && tool.catch._.original_on_error !== (tool.catch.handle_error as ErrorEventHandler)) {
        tool.catch._.original_on_error.apply(this, arguments); // Call any previously assigned handler
      }
      if (((error as Error).stack || '').indexOf('PRIVATE') !== -1) { // todo - remove cast & debug
        return;
      }
      if (error instanceof UnreportableError) {
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
          success: (response) => {
            if (response.saved === true) {
              console.log('%cFlowCrypt ERROR:' + user_log_message, 'font-weight: bold;');
            } else {
              console.log('%cFlowCrypt EXCEPTION:' + user_log_message, 'font-weight: bold;');
            }
          },
          error: (XMLHttpRequest, status, error) => {
            console.log('%cFlowCrypt FAILED:' + user_log_message, 'font-weight: bold;');
          },
        });
      } catch (ajax_err) {
        console.log(ajax_err.message);
        console.log('%cFlowCrypt ISSUE:' + user_log_message, 'font-weight: bold;');
      }
      try {
        if (typeof Store.get_account === 'function' && typeof Store.set === 'function') {
          Store.get_global(['errors']).then(s => {
            if (typeof s.errors === 'undefined') {
              s.errors = [];
            }
            if(error instanceof Error) {
              s.errors.unshift(error.stack || error_message || String(error));
            } else {
              s.errors.unshift(error_message || String(error));
            }
            Store.set(null, s).catch(console.error);
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
      } catch (line_err) {
        line = 0;
        col = 0;
      }
      tool.catch._.runtime = tool.catch._.runtime || {};
      tool.catch.handle_error(exception.message, window.location.href, line, col, exception, true, tool.catch._.runtime.version, tool.catch._.runtime.environment);
    },
    report: (name: string, details:Error|Serializable|StandardError|PromiseRejectionEvent=undefined) => {
      try {
        // noinspection ExceptionCaughtLocallyJS
        throw new Error(name);
      } catch (e) {
        if (typeof details !== 'string') {
          try {
            details = JSON.stringify(details);
          } catch (stringify_error) {
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
      } catch (e_local) {
        let e = e_local as Error;
        if (typeof details !== 'string') {
          try {
            details = JSON.stringify(details);
          } catch (stringify_error) {
            details = '(could not stringify details "' + String(details) + '" in tool.catch.log because: ' + stringify_error.message + ')';
          }
        }
        e.stack = e.stack + '\n\n\ndetails: ' + details;
        try {
          Store.get_global(['errors']).then(s => {
            if (typeof s.errors === 'undefined') {
              s.errors = [];
            }
            s.errors.unshift(e.stack || name);
            Store.set(null, s).catch(console.error);
          });
        } catch (storage_err) {
          console.log('failed to locally log info "' + String(name) + '" because: ' + storage_err.message);
        }
      }
    },
    version: (format='original') => {
      if (format === 'int') {
        return tool.catch._.runtime.version ? Number(tool.catch._.runtime.version.replace(/\./g, '')) : null;
      } else {
        return tool.catch._.runtime.version || null;
      }
    },
    try: (code: Function) => () => { // tslint:disable-line:ban-types // returns a function
      try {
        let r = code();
        if (r && typeof r === 'object' && typeof r.then === 'function' && typeof r.catch === 'function') { // a promise - async catching
          r.catch(tool.catch.handle_promise_error);
        }
      } catch (code_err) {
        tool.catch.handle_exception(code_err);
      }
    },
    environment: (url=window.location.href): string => {
      let browser_name = tool.env.browser().name;
      let env = 'unknown';
      if (url.indexOf('bnjglocicd') !== -1) {
        env = 'ex:prod';
      } else if (url.indexOf('gjdhkacdgd') !== -1) {
        env = 'ex:dev';
      } else if (url.indexOf('gjdhkacdgd') !== -1) { // in case it differs in the future
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
    promise_error_alert: (note: string) => (error: Error) => { // returns a function
      console.log(error);
      alert(note);
    },
    stack_trace: (): string => {
      try {
        tool.catch.test();
      } catch (e) {
        return e.stack.split('\n').splice(3).join('\n'); // return stack after removing first 3 lines
      }
      return ''; // make ts happy - this will never happen
    },
    handle_promise_error: (e: PromiseRejectionEvent|StandardError|Error) => {
      if(!(e instanceof UnreportableError)) {
        if (e && typeof e === 'object' && e.hasOwnProperty('reason') && typeof (e as PromiseRejectionEvent).reason === 'object' && (e as PromiseRejectionEvent).reason && (e as PromiseRejectionEvent).reason.message) {
          tool.catch.handle_exception((e as PromiseRejectionEvent).reason); // actual exception that happened in Promise, unhandled
        } else if (!tool.value(JSON.stringify(e)).in(['{"isTrusted":false}', '{"isTrusted":true}'])) {  // unrelated to FlowCrypt, has to do with JS-initiated clicks/events
          if (typeof e === 'object' && typeof (e as StandardError).stack === 'string' && (e as StandardError).stack) { // thrown object that has a stack attached
            let stack = (e as StandardError).stack;
            delete (e as StandardError).stack;
            tool.catch.report('unhandled_promise_reject_object with stack', `${JSON.stringify(e)}\n\n${stack}`);
          } else {
            tool.catch.report('unhandled_promise_reject_object', e); // some x that was called with reject(x) and later not handled
          }
        }
      }
    },
    _: {
      runtime: {} as Dict<string>,
      original_on_error: window.onerror,
      initialize: () => {
        let figure_out_flowcrypt_runtime = () => {
          if ((window as FcWindow).is_bare_engine !== true) {
            try {
              tool.catch._.runtime.version = chrome.runtime.getManifest().version;
            } catch (err) {} // tslint:disable-line:no-empty
            tool.catch._.runtime.environment = tool.catch.environment();
            if (!tool.env.is_background_script() && tool.env.is_extension()) {
              tool.browser.message.send_await(null, 'runtime', null).then(extension_runtime => {
                if (typeof extension_runtime !== 'undefined') {
                  tool.catch._.runtime = extension_runtime;
                } else {
                  setTimeout(figure_out_flowcrypt_runtime, 200);
                }
              });
            }
          }
        };
        figure_out_flowcrypt_runtime();
        (window as FcWindow).onerror = (tool.catch.handle_error as ErrorEventHandler);
        (window as FcWindow).onunhandledrejection = tool.catch.handle_promise_error;
      },
    }
  },
};

tool.catch._.initialize();

(( /* EXTENSIONS AND CONFIG */ ) => {

  if (typeof openpgp === 'object' && typeof openpgp.config === 'object') {
    openpgp.config.versionstring = 'FlowCrypt ' + (tool.catch.version() || '') + ' Gmail Encryption flowcrypt.com';
    openpgp.config.commentstring = 'Seamlessly send, receive and search encrypted email';
  }

  (RegExp as any).escape = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  String.prototype.repeat = String.prototype.repeat || function(count) {
    if (this == null) {
      throw new TypeError('can\'t convert ' + this + ' to object');
    }
    let str = '' + this;
    count = +count;
    if (count !== count) {
      count = 0;
    }
    if (count < 0) {
      throw new RangeError('repeat count must be non-negative');
    }
    if (count === Infinity) {
      throw new RangeError('repeat count must be less than infinity');
    }
    count = Math.floor(count);
    if (str.length === 0 || count === 0) {
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
      if ((count & 1) === 1) {
        rpt += str;
      }
      count >>>= 1;
      if (count === 0) {
        break;
      }
      str += str;
    }
    // Could we try:
    // return Array(count + 1).join(this);
    return rpt;
  };

})();
