
/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />
/// <reference path="common.d.ts" />
/// <reference path="openpgp.d.ts" />

'use strict';

declare let $_HOST_html_to_text: (html: string) => string;
declare let openpgp: typeof OpenPGP;
declare let mnemonic: (hex: string) => string;
declare let zxcvbn: Function; // tslint:disable-line:ban-types
// declare module 'dompurify'; // useful if on @types repo
// declare let dompurify: typeof DOMPurify;

class UnreportableError extends Error {}
class TabIdRequiredError extends Error {}

enum DecryptErrorTypes {
  key_mismatch = 'key_mismatch',
  use_password = 'use_password',
  wrong_password = 'wrong_password',
  no_mdc = 'no_mdc',
  need_passphrase = 'need_passphrase',
  format = 'format',
  other = 'other',
}

class Attachment {

  private text: string|null = null;
  private bytes: Uint8Array|null = null;
  private treat_as_value: Attachment$treat_as|null = null;

  public length: number;
  public type: string;
  public name: string;
  public url: string|null;
  public id: string|null;
  public message_id: string|null;
  public inline: boolean;
  public cid: string|null;

  constructor({data, type, name, length, url, inline, id, message_id, treat_as, cid}: AttachmentMeta) {
    if(typeof data === 'undefined' && typeof url === 'undefined' && typeof id === 'undefined') {
      throw new Error('Attachment: one of data|url|id has to be set');
    }
    if(id && !message_id) {
      throw new Error('Attachment: if id is set, message_id must be set too');
    }
    if(data !== null && typeof data !== 'undefined') {
      this.set_data(data);
    }
    this.name = name || '';
    this.type = type || 'application/octet-stream';
    this.length = data ? data.length : (length || NaN);
    this.url = url || null;
    this.inline = inline !== true;
    this.id = id || null;
    this.message_id = message_id || null;
    this.treat_as_value = treat_as || null;
    this.cid = cid || null;
  }

  public set_data = (data: string|Uint8Array) => {
    if(this.has_data()) {
      throw new Error('Attachment: data already set');
    }
    if(data instanceof Uint8Array) {
      this.bytes = data;
    } else if(typeof data === 'string') {
      this.text = data;
    }
    this.length = data.length;
  }

  public has_data = () => {
    if(this.bytes === null && this.text === null) {
      return false;
    }
    return true;
  }

  public data = (): string|Uint8Array => {
    if(this.bytes !== null) {
      return this.bytes;
    }
    if (this.text !== null) {
      return this.text;
    }
    throw new Error('Attachment has no data set');
  }

  public as_text = (): string => {
    if(this.text === null && this.bytes !== null) {
      this.text = Str.from_uint8(this.bytes);
    }
    if(this.text !== null) {
      return this.text;
    }
    throw new Error('Attachment has no data set');
  }

  public as_bytes = (): Uint8Array => {
    if(this.bytes === null && this.text !== null) {
      this.bytes = Str.to_uint8(this.text);
    }
    if (this.bytes !== null) {
      return this.bytes;
    }
    throw new Error('Attachment has no data set');
  }

  public treat_as = (): Attachment$treat_as => {
    // todo - should return a probability in the range of certain-likely-maybe
    // could also return possible types as an array - which makes basic usage more difficult - to think through
    // better option - add an "unknown" type: when encountered, code consuming this should inspect a chunk of contents
    if(this.treat_as_value) { // pre-set
      return this.treat_as_value;
    } else if (Value.is(this.name).in(['PGPexch.htm.pgp', 'PGPMIME version identification', 'Version.txt'])) {
      return 'hidden';  // PGPexch.htm.pgp is html alternative of textual body content produced by PGP Desktop and GPG4o
    } else if (this.name === 'signature.asc' || this.type === 'application/pgp-signature') {
      return  'signature';
    } else if (!this.name && !Value.is('image/').in(this.type)) { // this.name may be '' or undefined - catch either
      return this.length < 100 ? 'hidden' : 'message';
    } else if (Value.is(this.name).in(['message', 'msg.asc', 'message.asc', 'encrypted.asc', 'encrypted.eml.pgp', 'Message.pgp'])) {
      return 'message';
    } else if (this.name.match(/(\.pgp$)|(\.gpg$)|(\.[a-zA-Z0-9]{3,4}\.asc$)/g)) { // ends with one of .gpg, .pgp, .???.asc, .????.asc
      return 'encrypted';
    } else if (this.name.match(/^(0|0x)?[A-F0-9]{8}([A-F0-9]{8})?.*\.asc$/g)) { // name starts with a key id
      return 'public_key';
    } else if (Value.is('public').in(this.name.toLowerCase()) && this.name.match(/[A-F0-9]{8}.*\.asc$/g)) { // name contains the word "public", any key id and ends with .asc
      return 'public_key';
    } else if (this.name.match(/\.asc$/) && this.length < 100000 && !this.inline) {
      return 'message';
    } else {
      return 'standard';
    }
  }

  public static methods = {
    object_url_create: (content: Uint8Array|string) => window.URL.createObjectURL(new Blob([content], { type: 'application/octet-stream' })),
    object_url_consume: async (url: string) => {
      let uint8 = await Attachment.methods.download_as_uint8(url, null);
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
    save_to_downloads: (attachment: Attachment, render_in:JQuery<HTMLElement>|null=null) => {
      let blob = new Blob([attachment.data()], {type: attachment.type});
      if (window.navigator && window.navigator.msSaveOrOpenBlob) {
        window.navigator.msSaveBlob(blob, attachment.name);
      } else {
        let a = window.document.createElement('a');
        a.href = window.URL.createObjectURL(blob);
        a.download = Xss.html_escape(attachment.name);
        if (render_in) {
          a.textContent = 'DECRYPTED FILE';
          a.style.cssText = 'font-size: 16px; font-weight: bold;';
          Ui.sanitize_render(render_in, '<div style="font-size: 16px;padding: 17px 0;">File is ready.<br>Right-click the link and select <b>Save Link As</b></div>');
          render_in.append(a); // xss-escaped attachment name above
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
          if (Env.browser().name === 'firefox') {
            try {
              document.body.removeChild(a);
            } catch (err) {
              if (err.message !== 'Node was not found') {
                throw err;
              }
            }
          }
          Catch.set_timeout(() => window.URL.revokeObjectURL(a.href), 0);
        }
      }
    },
    pgp_name_patterns: () => ['*.pgp', '*.gpg', '*.asc', 'noname', 'message', 'PGPMIME version identification', ''],
    keyinfo_as_pubkey_attachment: (ki: KeyInfo) => new Attachment({data: ki.public, type: 'application/pgp-keys', name: `0x${ki.longid}.asc`}),
  };

}

class Extension { // todo - move extension-specific common.js code here

  public static prepare_bug_report = (name: string, details?: Dict<FlatTypes>, error?: Error|any): string => {
    let bug_report: Dict<string> = {
      name,
      stack: Catch.stack_trace(),
    };
    try {
      bug_report.error = JSON.stringify(error, null, 2);
    } catch(e) {
      bug_report.error_as_string = String(error);
      bug_report.error_serialization_error = String(e);
    }
    try {
      bug_report.details = JSON.stringify(details, null, 2);
    } catch(e) {
      bug_report.details_as_string = String(details);
      bug_report.details_serialization_error = String(e);
    }
    let result = '';
    for(let k of Object.keys(bug_report)) {
      result += `\n[${k}]\n${bug_report[k]}\n`;
    }
    return result;
  }

}

class Env {

  private static URL_PARAM_DICT: Dict<boolean|null> = {'___cu_true___': true, '___cu_false___': false, '___cu_null___': null};

  public static browser = () => {  // http://stackoverflow.com/questions/4825498/how-can-i-find-out-which-browser-a-user-is-using
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

  public static runtime_id = (original=false) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
      if (original === true) {
        return chrome.runtime.id;
      } else {
        return chrome.runtime.id.replace(/[^a-z0-9]/gi, '');
      }
    }
    return null;
  }

  public static is_background_script = () => Boolean(window.location && Value.is('_generated_background_page.html').in(window.location.href));

  public static is_extension = () => Env.runtime_id() !== null;

  public static url_param_require = {
    string: (values: UrlParams, name: string): string => Ui.abort_and_render_error_on_url_param_type_mismatch(values, name, 'string') as string,
    oneof: (values: UrlParams, name: string, allowed: UrlParam[]): string => Ui.abort_and_render_error_on_url_param_value_mismatch(values, name, allowed) as string,
  };

  public static url_params = (expected_keys: string[], string:string|null=null) => {
    let url = (string || window.location.search.replace('?', ''));
    let value_pairs = url.split('?').pop()!.split('&'); // str.split('?') string[].length will always be >= 1
    let url_data: UrlParams = {};
    for (let value_pair of value_pairs) {
      let pair = value_pair.split('=');
      if (Value.is(pair[0]).in(expected_keys)) {
        url_data[pair[0]] = typeof Env.URL_PARAM_DICT[pair[1]] !== 'undefined' ? Env.URL_PARAM_DICT[pair[1]] : decodeURIComponent(pair[1]);
      }
    }
    return url_data;
  }

  public static url_create = (link: string, params: UrlParams) => {
    for (let key of Object.keys(params)) {
      let value = params[key];
      if (typeof value !== 'undefined') {
        let transformed = Value.obj.key_by_value(Env.URL_PARAM_DICT, value);
        link += (!Value.is('?').in(link) ? '?' : '&') + encodeURIComponent(key) + '=' + encodeURIComponent(String(typeof transformed !== 'undefined' ? transformed : value));
      }
    }
    return link;
  }

  public static key_codes = () => {
    return { a: 97, r: 114, A: 65, R: 82, f: 102, F: 70, backspace: 8, tab: 9, enter: 13, comma: 188, };
  }

  public static webmails = async (): Promise<WebMailName[]> => {
    return ['gmail', 'inbox']; // async because storage may be involved in the future
  }

}

class Api {

  private static GMAIL_USELESS_CONTACTS_FILTER = '-to:txt.voice.google.com -to:reply.craigslist.org -to:sale.craigslist.org -to:hous.craigslist.org';
  private static GMAIL_SCOPE_DICT: Dict<string> = {read: 'https://www.googleapis.com/auth/gmail.readonly', compose: 'https://www.googleapis.com/auth/gmail.compose'};
  private static GOOGLE_OAUTH2 = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest() as FlowCryptManifest).oauth2 : null;
  public static GMAIL_RECOVERY_EMAIL_SUBJECTS = ['Your FlowCrypt Backup', 'Your CryptUp Backup', 'All you need to know about CryptUP (contains a backup)', 'CryptUP Account Backup'];

  public static auth = {
    window: (auth_url: string, window_closed_by_user: Callback) => {
      let auth_code_window = window.open(auth_url, '_blank', 'height=600,left=100,menubar=no,status=no,toolbar=no,top=100,width=500');
      let window_closed_timer = Catch.set_interval(() => {
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
  };

  public static error = {
    is_network_error: (e: Thrown) => {
      if(e instanceof TypeError && (e.message === 'Failed to fetch' || e.message === 'NetworkError when attempting to fetch resource.')) {
        return true; // openpgp.js uses fetch()... which produces these errors
      }
      if (e && typeof e === 'object') {
        if (Api.error.is_standard_error(e, 'network')) { // StandardError
          return true;
        }
        if (e.status === 0 && e.statusText === 'error') { // $.ajax network error
          return true;
        }
      }
      return false;
    },
    is_auth_error: (e: Thrown) => {
      if (e && typeof e === 'object') {
        if(Api.error.is_standard_error(e, 'auth')) {
          return true; // API auth error response
        }
        if (e.status === 401) { // $.ajax auth error
          return true;
        }
      }
      return false;
    },
    is_standard_error: (e: Thrown, internal_type: string) => {
      if(e && typeof e === 'object') {
        if(e.internal === internal_type) {
          return true;
        }
        if(e.error && typeof e.error === 'object' && e.error.internal === internal_type) {
          return true;
        }
      }
      return false;
    },
    is_auth_popup_needed: (e: Thrown) => {
      if (e && typeof e === 'object' && e.status === 400 && typeof e.responseJSON === 'object') {
        if (e.responseJSON.error === 'invalid_grant' && Value.is(e.responseJSON.error_description).in(['Bad Request', "Token has been expired or revoked."])) {
          return true;
        }
      }
      return false;
    },
    is_not_found: (e: Thrown): boolean => e && typeof e === 'object' && e.readyState === 4 && e.status === 404, // $.ajax rejection
    is_bad_request: (e: Thrown): boolean => e && typeof e === 'object' && e.readyState === 4 && e.status === 400, // $.ajax rejection
    is_server_error: (e: Thrown): boolean => e && typeof e === 'object' && e.readyState === 4 && e.status >= 500, // $.ajax rejection
  };

  public static google = {
    plus: {
      people_me: (account_email: string): Promise<ApirGooglePlusPeopleMe> => Api.internal.api_google_call(account_email, 'GET', 'https://www.googleapis.com/plus/v1/people/me', {alt: 'json'}),
    },
    auth_popup: (account_email: string|null, tab_id: string, omit_read_scope=false, scopes:string[]=[]): Promise<AuthResult> => new Promise((resolve, reject) => {
      if (Env.is_background_script()) {
        throw {code: null, message: 'Cannot produce auth window from background script'};
      }
      let response_handled = false;
      Api.internal.api_google_auth_popup_prepare_auth_request_scopes(account_email, scopes, omit_read_scope).then(scopes => {
        let auth_request: AuthRequest = {tab_id, account_email, auth_responder_id: Str.random(20), scopes};
        BrowserMsg.listen({
          google_auth_window_result: (result: GoogleAuthWindowResult, sender: chrome.runtime.MessageSender, close_auth_window: VoidCallback) => {
            if (result.state.auth_responder_id === auth_request.auth_responder_id && !response_handled) {
              response_handled = true;
              Api.internal.google_auth_window_result_handler(result).then(resolve, reject);
              close_auth_window();
            }
          },
        }, auth_request.tab_id);
        let auth_code_window = window.open(Api.internal.api_google_auth_code_url(auth_request), '_blank', 'height=700,left=100,menubar=no,status=no,toolbar=no,top=50,width=600');
        // auth window will show up. Inside the window, google_auth_code.js gets executed which will send
        // a 'gmail_auth_code_result' chrome message to 'google_auth.google_auth_window_result_handler' and close itself
        if (Env.browser().name !== 'firefox') {
          let window_closed_timer = Catch.set_interval(() => {
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
    }),
  };

  public static common = {
    message: async (account_email: string, from:string='', to:string|string[]=[], subject:string='', body: SendableMessageBody, attachments:Attachment[]=[], thread_referrence:string|null=null): Promise<SendableMessage> => {
      let [primary_ki] = await Store.keys_get(account_email, ['primary']);
      return {
        headers: primary_ki ? {OpenPGP: `id=${primary_ki.fingerprint}`} : {},
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
          if (Value.is(Str.parse_email(email).email).in(addresses)) { // my email
            my_email = email;
          } else if (!Value.is(Str.parse_email(email).email).in(reply_to)) { // skip duplicates
            reply_to.push(Str.parse_email(email).email); // reply to all except my emails
          }
        }
      }
      if (!reply_to.length) { // happens when user sends email to itself - all reply_to_estimage contained his own emails and got removed
        reply_to = Value.arr.unique(reply_to_estimate);
      }
      return {to: reply_to, from: my_email};
    },
  };

  public static gmail = {
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
          '(subject:"' + Api.GMAIL_RECOVERY_EMAIL_SUBJECTS.join('" OR subject: "') + '")',
          '-is:spam',
        ].join(' ');
      },
    },
    scope: (scope: string[]): string[] => scope.map(s => Api.GMAIL_SCOPE_DICT[s] as string),
    has_scope: (scopes: string[], scope: string) => scopes && Value.is(Api.GMAIL_SCOPE_DICT[scope]).in(scopes),
    users_me_profile: async (account_email: string|null, access_token?: string): Promise<ApirGmailUsersMeProfile> => {
      let url = 'https://www.googleapis.com/gmail/v1/users/me/profile';
      if(account_email && !access_token) {
        return await Api.internal.api_google_call(account_email, 'GET', url, {});
      } else if (!account_email && access_token) {
        return await $.ajax({url, method: 'GET', headers: {'Authorization': `Bearer ${access_token}`}, crossDomain: true, contentType: 'application/json; charset=UTF-8', async: true});
      } else {
        throw new Error('Api.gmail.users_me_profile: need either account_email or access_token');
      }
    },
    thread_get: (account_email: string, thread_id: string, format: GmailApiResponseFormat|null): Promise<ApirGmailThreadGet> => Api.internal.api_gmail_call(account_email, 'GET', `threads/${thread_id}`, {
      format,
    }),
    draft_create: (account_email: string, mime_message: string, thread_id: string): Promise<ApirGmailDraftCreate> => Api.internal.api_gmail_call(account_email, 'POST', 'drafts', {
      message: {
        raw: Str.base64url_encode(mime_message),
        threadId: thread_id || null,
      },
    }),
    draft_delete: (account_email: string, id: string): Promise<ApirGmailDraftDelete> => Api.internal.api_gmail_call(account_email, 'DELETE', 'drafts/' + id, null),
    draft_update: (account_email: string, id: string, mime_message: string): Promise<ApirGmailDraftUpdate> => Api.internal.api_gmail_call(account_email, 'PUT', `drafts/${id}`, {
      message: {
        raw: Str.base64url_encode(mime_message),
      },
    }),
    draft_get: (account_email: string, id: string, format:GmailApiResponseFormat='full'): Promise<ApirGmailDraftGet> => Api.internal.api_gmail_call(account_email, 'GET', `drafts/${id}`, {
      format,
    }),
    draft_send: (account_email: string, id: string): Promise<ApirGmailDraftSend> => Api.internal.api_gmail_call(account_email, 'POST', 'drafts/send', {
      id,
    }),
    message_send: async (account_email: string, message: SendableMessage, progress_callback?: ApiCallProgressCallback): Promise<ApirGmailMessageSend> => {
      message.headers.From = message.from;
      message.headers.To = message.to.join(',');
      message.headers.Subject = message.subject;
      let mime_message = await Mime.encode(message.body, message.headers, message.attachments);
      let request = Api.internal.encode_as_multipart_related({ 'application/json; charset=UTF-8': JSON.stringify({threadId: message.thread}), 'message/rfc822': mime_message });
      return Api.internal.api_gmail_call(account_email, 'POST', 'messages/send', request.body, {upload: progress_callback || Value.noop}, request.content_type);
    },
    message_list: (account_email: string, q: string, include_deleted:boolean=false): Promise<ApirGmailMessageList> => Api.internal.api_gmail_call(account_email, 'GET', 'messages', {
      q,
      includeSpamTrash: include_deleted,
    }),
    message_get: (account_email: string, message_id: string, format: GmailApiResponseFormat): Promise<ApirGmailMessage> => Api.internal.api_gmail_call(account_email, 'GET', `messages/${message_id}`, {
      format: format || 'full',
    }),
    messages_get: (account_email: string, message_ids: string[], format: GmailApiResponseFormat): Promise<ApirGmailMessage[]> => {
      return Promise.all(message_ids.map(id => Api.gmail.message_get(account_email, id, format)));
    },
    labels_get: (account_email: string): Promise<ApirGmailLabels> => Api.internal.api_gmail_call(account_email, 'GET', `labels`, {}),
    attachment_get: async (account_email: string, message_id: string, attachment_id: string, progress_callback:ApiCallProgressCallback|null=null): Promise<ApirGmailAttachment> => {
      let r: ApirGmailAttachment = await Api.internal.api_gmail_call(account_email, 'GET', `messages/${message_id}/attachments/${attachment_id}`, {}, {download: progress_callback});
      r.data = Str.base64url_decode(r.data);
      return r;
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
              resolve(Str.base64url_decode(parsed_json_data_field));
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
      Api.internal.google_api_authorization_header(account_email).then(auth_token => {
        let r = new XMLHttpRequest();
        r.open('GET', `https://www.googleapis.com/gmail/v1/users/me/messages/${message_id}/attachments/${attachment_id}`, true);
        r.setRequestHeader('Authorization', auth_token);
        r.send();
        let status: number;
        let response_poll_interval = Catch.set_interval(() => {
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
        for (let header of node.headers) {
          if (header.name.toLowerCase() === header_name.toLowerCase()) {
            return header.value;
          }
        }
      }
      return null;
    },
    find_attachments: (message_or_payload_or_part: ApirGmailMessage|ApirGmailMessage$payload|ApirGmailMessage$payload$part, internal_results:Attachment[]=[], internal_message_id:string|null=null) => {
      if (message_or_payload_or_part.hasOwnProperty('payload')) {
        internal_message_id = (message_or_payload_or_part as ApirGmailMessage).id;
        Api.gmail.find_attachments((message_or_payload_or_part as ApirGmailMessage).payload, internal_results, internal_message_id);
      }
      if (message_or_payload_or_part.hasOwnProperty('parts')) {
        for (let part of (message_or_payload_or_part as ApirGmailMessage$payload).parts!) {
          Api.gmail.find_attachments(part, internal_results, internal_message_id);
        }
      }
      if (message_or_payload_or_part.hasOwnProperty('body') && (message_or_payload_or_part as ApirGmailMessage$payload$part).body!.hasOwnProperty('attachmentId')) {
        internal_results.push(new Attachment({
          message_id: internal_message_id,
          id: (message_or_payload_or_part as ApirGmailMessage$payload$part).body!.attachmentId,
          length: (message_or_payload_or_part as ApirGmailMessage$payload$part).body!.size,
          name: (message_or_payload_or_part as ApirGmailMessage$payload$part).filename,
          type: (message_or_payload_or_part as ApirGmailMessage$payload$part).mimeType,
          inline: (Api.gmail.find_header(message_or_payload_or_part, 'content-disposition') || '').toLowerCase().indexOf('inline') === 0,
        }));
      }
      return internal_results;
    },
    find_bodies: (gmail_email_object: Dict<any>, internal_results:Dict<any>={}): SendableMessageBody => {
      if (typeof gmail_email_object.payload !== 'undefined') {
        Api.gmail.find_bodies(gmail_email_object.payload, internal_results);
      }
      if (typeof gmail_email_object.parts !== 'undefined') {
        for (let part of gmail_email_object.parts) {
          Api.gmail.find_bodies(part, internal_results);
        }
      }
      if (typeof gmail_email_object.body !== 'undefined' && typeof gmail_email_object.body.data !== 'undefined' && gmail_email_object.body.size !== 0) {
        internal_results[gmail_email_object.mimeType] = gmail_email_object.body.data;
      }
      return internal_results as SendableMessageBody;
    },
    fetch_attachments: async (account_email: string, attachments: Attachment[]) => {
      let responses = await Promise.all(attachments.map(a => Api.gmail.attachment_get(account_email, a.message_id!, a.id!)));
      for (let i of responses.keys()) {
        attachments[i].set_data(responses[i].data);
      }
    },
    search_contacts: async (account_email: string, user_query: string, known_contacts: Contact[], chunked_callback: (r: ProviderContactsResults) => void) => { // This will keep triggering callback with new emails as they are being discovered
      let gmail_query = ['is:sent', Api.GMAIL_USELESS_CONTACTS_FILTER];
      if (user_query) {
        let variations_of_to = user_query.split(/[ .]/g).filter(v => !Value.is(v).in(['com', 'org', 'net']));
        if (!Value.is(user_query).in(variations_of_to)) {
          variations_of_to.push(user_query);
        }
        gmail_query.push(`(to:${variations_of_to.join(' OR to:')})`);
      }
      let filtered_contacts = known_contacts.filter(c => Str.is_email_valid(c.email));
      for (let contact of filtered_contacts) {
        gmail_query.push(`-to:${contact.email}`);
      }
      await Api.internal.api_gmail_loop_through_emails_to_compile_contacts(account_email, gmail_query.join(' '), chunked_callback);
    },
    /*
    * Extracts the encrypted message from gmail api. Sometimes it's sent as a text, sometimes html, sometimes attachments in various forms.
    * success_callback(str armored_pgp_message)
    * error_callback(str error_type, str html_formatted_data_to_display_to_user)
    *    ---> html_formatted_data_to_display_to_user might be unknown type of mime message, or pgp message with broken format, etc.
    *    ---> The motivation is that user might have other tool to process this. Also helps debugging issues in the field.
    */
    extract_armored_block: async (account_email: string, message_id: string, format:GmailApiResponseFormat): Promise<string> => {
      let gmail_message_object = await Api.gmail.message_get(account_email, message_id, format);
      if (format === 'full') {
        let bodies = Api.gmail.find_bodies(gmail_message_object);
        let attachments = Api.gmail.find_attachments(gmail_message_object);
        let armored_message_from_bodies = Pgp.armor.clip(Str.base64url_decode(bodies['text/plain'] || '')) || Pgp.armor.clip(Pgp.armor.strip(Str.base64url_decode(bodies['text/html'] || '')));
        if (armored_message_from_bodies) {
          return armored_message_from_bodies;
        } else if (attachments.length) {
          for (let attachment of attachments) {
            if (attachment.treat_as() === 'message') {
              await Api.gmail.fetch_attachments(account_email, [attachment]);
              let armored_message = Pgp.armor.clip(attachment.as_text());
              if (armored_message) {
                return armored_message;
              } else {
                throw {code: null, internal: 'format', message: 'Problem extracting armored message', data: attachment.as_text()};
              }
            }
          }
          throw {code: null, internal: 'format', message: 'Armored message not found', data: JSON.stringify(gmail_message_object.payload, undefined, 2)};
        } else {
          throw {code: null, internal: 'format', message: 'No attachments', data: JSON.stringify(gmail_message_object.payload, undefined, 2)};
        }
      } else { // format === raw
        let mime_message = await Mime.decode(Str.base64url_decode(gmail_message_object.raw!));
        if (mime_message.text !== undefined) {
          let armored_message = Pgp.armor.clip(mime_message.text); // todo - the message might be in attachments
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
      let {messages} = await Api.gmail.message_list(account_email, q, false);
      return await Api.internal.api_gmail_fetch_messages_sequentially_from_list_and_extract_first_available_header(account_email, messages || [], header_names);
    },
    fetch_key_backups: async (account_email: string) => {
      let response = await Api.gmail.message_list(account_email, Api.gmail.query.backups(account_email), true);
      if (!response.messages) {
        return [];
      }
      let message_ids = response.messages.map(m => m.id);
      let messages = await Api.gmail.messages_get(account_email, message_ids, 'full');
      let attachments:Attachment[] = [];
      for (let message of messages) {
        attachments = attachments.concat(Api.gmail.find_attachments(message));
      }
      await Api.gmail.fetch_attachments(account_email, attachments);
      let keys: OpenPGP.key.Key[] = [];
      for (let attachment of attachments) {
        try {
          let key = openpgp.key.readArmored(attachment.as_text()).keys[0];
          if (key.isPrivate()) {
            keys.push(key);
          }
        } catch (err) {} // tslint:disable-line:no-empty
      }
      return keys;
    },
  };

  public static attester = {
    lookup_email: (emails: string[]): Promise<{results: PubkeySearchResult[]}> => Api.internal.api_attester_call('lookup/email', {
      email: emails.map(e => Str.parse_email(e).email),
    }),
    initial_legacy_submit: (email: string, pubkey: string, attest:boolean=false): Promise<ApirAttInitialLegacySugmit> => Api.internal.api_attester_call('initial/legacy_submit', {
      email: Str.parse_email(email).email,
      pubkey: pubkey.trim(),
      attest,
    }),
    initial_confirm: (signed_attest_packet: string): Promise<ApirAttInitialConfirm> => Api.internal.api_attester_call('initial/confirm', {
      signed_message: signed_attest_packet,
    }),
    replace_request: (email: string, signed_attest_packet: string, new_pubkey: string): Promise<ApirAttReplaceRequest> => Api.internal.api_attester_call('replace/request', {
      signed_message: signed_attest_packet,
      new_pubkey,
      email,
    }),
    replace_confirm: (signed_attest_packet: string): Promise<ApirAttReplaceConfirm> => Api.internal.api_attester_call('replace/confirm', {
      signed_message: signed_attest_packet,
    }),
    test_welcome: (email: string, pubkey: string): Promise<ApirAttTestWelcome> => Api.internal.api_attester_call('test/welcome', {
      email,
      pubkey,
    }),
    diagnose_keyserver_pubkeys: async (account_email: string) => {
      let diagnosis = { has_pubkey_missing: false, has_pubkey_mismatch: false, results: {} as Dict<{attested: boolean, pubkey: string|null, match: boolean}> };
      let {addresses} = await Store.get_account(account_email, ['addresses']);
      let stored_keys = await Store.keys_get(account_email);
      let stored_keys_longids = stored_keys.map(ki => ki.longid);
      let {results} = await Api.attester.lookup_email(Value.arr.unique([account_email].concat(addresses || [])));
      for (let pubkey_search_result of results) {
        if (!pubkey_search_result.pubkey) {
          diagnosis.has_pubkey_missing = true;
          diagnosis.results[pubkey_search_result.email] = {attested: false, pubkey: null, match: false};
        } else {
          let match = true;
          if (!Value.is(Pgp.key.longid(pubkey_search_result.pubkey)).in(stored_keys_longids)) {
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
        let packet = Api.attester.packet.parse(Api.internal.api_attester_packet_armor(content_text));
        if (packet.success !== true) {
          throw {code: null, message: packet.error, internal: 'parse'};
        }
        return await Pgp.message.sign(decrypted_prv, content_text);
      },
      is_valid_hash: (v: string) => /^[A-F0-9]{40}$/.test(v),
      parse: (text: string): ParsedAttest => {
        let accepted_values = {
          'ACT': 'action',
          'ATT': 'attester',
          'ADD': 'email_hash',
          'PUB': 'fingerprint',
          'OLD': 'fingerprint_old',
          'RAN': 'random',
        } as Dict<string>;
        let result: ParsedAttest = {
          success: false,
          content: {},
          error: null as string|null,
          text: null as string|null,
        };
        let packet_headers = Pgp.armor.headers('attest_packet', 're');
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
          if (result.content.fingerprint && !Api.attester.packet.is_valid_hash(result.content.fingerprint)) {
            result.error = 'Wrong PUB line value format';
            result.content = {};
            return result;
          }
          if (result.content.email_hash && !Api.attester.packet.is_valid_hash(result.content.email_hash)) {
            result.error = 'Wrong ADD line value format';
            result.content = {};
            return result;
          }
          if (result.content.str_random && !Api.attester.packet.is_valid_hash(result.content.str_random)) {
            result.error = 'Wrong RAN line value format';
            result.content = {};
            return result;
          }
          if (result.content.fingerprint_old && !Api.attester.packet.is_valid_hash(result.content.fingerprint_old)) {
            result.error = 'Wrong OLD line value format';
            result.content = {};
            return result;
          }
          if (result.content.action && !Value.is(result.content.action).in(['INITIAL', 'REQUEST_REPLACEMENT', 'CONFIRM_REPLACEMENT'])) {
            result.error = 'Wrong ACT line value format';
            result.content = {};
            return result;
          }
          if (result.content.attester && !Value.is(result.content.attester).in(['CRYPTUP'])) {
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
  };

  public static fc = {
    url: (type: string, variable='') => {
      return ({
        'api': 'https://flowcrypt.com/api/',
        'me': 'https://flowcrypt.com/me/' + variable,
        'pubkey': 'https://flowcrypt.com/pub/' + variable,
        'decrypt': 'https://flowcrypt.com/' + variable,
        'web': 'https://flowcrypt.com/',
      } as Dict<string>)[type];
    },
    help_feedback: (account_email: string, message: string): Promise<ApirFcHelpFeedback> => Api.internal.api_fc_call('help/feedback', {
      email: account_email,
      message,
    }),
    help_uninstall: (email: string, client: string) => Api.internal.api_fc_call('help/uninstall', {
      email,
      client,
      metrics: null,
    }),
    account_login: async (account_email: string, token:string|null=null): Promise<{verified: boolean, subscription: SubscriptionInfo}> => {
      let auth_info = await Store.auth_info();
      let uuid = auth_info.uuid || Pgp.hash.sha1(Str.random(40));
      let account = auth_info.account_email || account_email;
      let response: ApirFcAccountLogin = await Api.internal.api_fc_call('account/login', {
        account,
        uuid,
        token,
      });
      if(response.registered !== true) {
        throw new Error('account_login did not result in successful registration');
      }
      await Store.set(null, {cryptup_account_email: account, cryptup_account_uuid: uuid, cryptup_account_subscription: response.subscription});
      return {verified: response.verified === true, subscription: response.subscription};
    },
    account_check: (emails: string[]) => Api.internal.api_fc_call('account/check', {
      emails,
    }) as Promise<ApirFcAccountCheck>,
    account_check_sync: async () => { // callbacks true on updated, false not updated, null for could not fetch
      let emails = await Store.account_emails_get();
      if (emails.length) {
        let response = await Api.fc.account_check(emails);
        let auth_info = await Store.auth_info();
        let subscription = await Store.subscription();
        let local_storage_update: GlobalStore = {};
        if (response.email) {
          if (response.email !== auth_info.account_email) {
            // will fail auth when used on server, user will be prompted to verify this new device when that happens
            local_storage_update.cryptup_account_email = response.email;
            local_storage_update.cryptup_account_uuid = Pgp.hash.sha1(Str.random(40));
          }
        } else {
          if (auth_info.account_email) {
            local_storage_update.cryptup_account_email = null;
            local_storage_update.cryptup_account_uuid = null;
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
          Catch.log('updating account subscription from ' + subscription.level + ' to ' + (response.subscription ? response.subscription.level : null), response);
          await Store.set(null, local_storage_update);
          return true;
        } else {
          return false;
        }
      }
    },
    account_update: async (update_values?: Dict<Serializable>): Promise<ApirFcAccountUpdate> => {
      let auth_info = await Store.auth_info();
      let request = {account: auth_info.account_email, uuid: auth_info.uuid} as Dict<Serializable>;
      if (update_values) {
        for (let k of Object.keys(update_values)) {
          request[k] = update_values[k];
        }
      }
      return await Api.internal.api_fc_call('account/update', request);
    },
    account_subscribe: async (product: string, method: string, payment_source_token:string|null=null): Promise<ApirFcAccountSubscribe> => {
      let auth_info = await Store.auth_info();
      let response: ApirFcAccountSubscribe = await Api.internal.api_fc_call('account/subscribe', {
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
      let lengths = attachments.map(a => a.length);
      if (!auth_method) {
        response = await Api.internal.api_fc_call('message/presign_files', {
          lengths,
        });
      } else if (auth_method === 'uuid') {
        let auth_info = await Store.auth_info();
        response = await Api.internal.api_fc_call('message/presign_files', {
          account: auth_info.account_email,
          uuid: auth_info.uuid,
          lengths,
        });
      } else {
        response = await Api.internal.api_fc_call('message/presign_files', {
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
    message_confirm_files: (identifiers: string[]): Promise<ApirFcMessageConfirmFiles> => Api.internal.api_fc_call('message/confirm_files', {
      identifiers,
    }),
    message_upload: async (encrypted_data_armored: string, auth_method: FlowCryptApiAuthMethods): Promise<ApirFcMessageUpload> => { // todo - DEPRECATE THIS. Send as JSON to message/store
      if (encrypted_data_armored.length > 100000) {
        throw {code: null, message: 'Message text should not be more than 100 KB. You can send very long texts as attachments.'};
      }
      let content = new Attachment({name: 'cryptup_encrypted_message.asc', type: 'text/plain', data: encrypted_data_armored});
      if (!auth_method) {
        return await Api.internal.api_fc_call('message/upload', {content}, 'FORM');
      } else {
        let auth_info = await Store.auth_info();
        return await Api.internal.api_fc_call('message/upload', {account: auth_info.account_email, uuid: auth_info.uuid, content}, 'FORM');
      }
    },
    message_token: async (): Promise<ApirFcMessageToken> => {
      let auth_info = await Store.auth_info();
      return await Api.internal.api_fc_call('message/token', {account: auth_info.account_email, uuid: auth_info.uuid});
    },
    message_expiration: async (admin_codes: string[], add_days:null|number=null): Promise<ApirFcMessageExpiration> => {
      let auth_info = await Store.auth_info();
      return await Api.internal.api_fc_call('message/expiration', {account: auth_info.account_email, uuid: auth_info.uuid, admin_codes, add_days});
    },
    message_reply: (short: string, token: string, from: string, to: string, subject: string, message: string) => Api.internal.api_fc_call('message/reply', {
      short,
      token,
      from,
      to,
      subject,
      message,
    }),
    message_contact: (sender: string, message: string, message_token: FlowCryptApiAuthToken) => Api.internal.api_fc_call('message/contact', {
      message_token_account: message_token.account,
      message_token: message_token.token,
      sender,
      message,
    }),
    link_message: (short: string): Promise<ApirFcLinkMessage> => Api.internal.api_fc_call('link/message', {
      short,
    }),
    link_me: (alias: string): Promise<ApirFcLinkMe> => Api.internal.api_fc_call('link/me', {
      alias,
    }),
  };

  public static aws = {
    s3_upload: (items: {base_url:string, fields: Dict<Serializable|Attachment>, attachment: Attachment}[], progress_callback: ApiCallProgressCallback) => {
      let progress = Value.arr.zeroes(items.length);
      let promises:Promise<void>[] = [];
      if (!items.length) {
        return Promise.resolve(promises);
      }
      for (let i of items.keys()) {
        let values = items[i].fields;
        values.file = new Attachment({name: 'encrpted_attachment', type: 'application/octet-stream', data: items[i].attachment.data()});
        promises.push(Api.internal.api_call(items[i].base_url, '', values, 'FORM', {upload: (single_file_progress: number) => {
          progress[i] = single_file_progress;
          Ui.event.prevent('spree', () => {
            // this should of course be weighted average. How many years until someone notices?
            progress_callback(Value.arr.average(progress), null, null); // May 2018 - nobody noticed
          })();
        }}));
      }
      return Promise.all(promises);
    },
  };

  private static internal = {
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
    api_call: async (base_url: string, path: string, fields: Dict<any>, format: ApiCallFormat, progress:ApiCallProgressCallbacks|null, headers:FlatHeaders|undefined=undefined, response_format:ApiResponseFormat='json', method:ApiCallMethod='POST') => {
      progress = progress || {} as ApiCallProgressCallbacks;
      let formatted_data: FormData|string;
      let content_type: string|false;
      if (format === 'JSON' && fields !== null) {
        formatted_data = JSON.stringify(fields);
        content_type = 'application/json; charset=UTF-8';
      } else if (format === 'FORM') {
        formatted_data = new FormData();
        for (let form_field_name of Object.keys(fields)) {
          let a: Attachment|string = fields[form_field_name];
          if (a instanceof Attachment) {
            formatted_data.append(form_field_name, new Blob([a.data()], {type: a.type}), a.name); // xss-none
          } else {
            formatted_data.append(form_field_name, a); // xss-none
          }
        }
        content_type = false;
      } else {
        throw Error('unknown format:' + String(format));
      }
      let request: JQueryAjaxSettings = {
        xhr: () => Api.internal.get_ajax_progress_xhr(progress),
        url: base_url + path,
        method,
        data: formatted_data,
        dataType: response_format,
        crossDomain: true,
        headers,
        processData: false,
        contentType: content_type,
        async: true,
        timeout: typeof progress!.upload === 'function' || typeof progress!.download === 'function' ? undefined : 20000, // substituted with {} above
      };
      try {
        let response = await $.ajax(request);
        if (response && typeof response === 'object' && typeof response.error === 'object') {
          throw response as StandardError;
        }
        return response;
      } catch(e) {
        if(e && typeof e === 'object' && e.readyState === 4) {
          e.url = request.url; // for debugging
        }
        throw e;
      }
    },
    api_google_auth_state_pack: (status_object: AuthRequest) => Api.GOOGLE_OAUTH2!.state_header + JSON.stringify(status_object),
    api_google_auth_code_url: (auth_request: AuthRequest) => Env.url_create(Api.GOOGLE_OAUTH2!.url_code, {
      client_id: Api.GOOGLE_OAUTH2!.client_id,
      response_type: 'code',
      access_type: 'offline',
      state: Api.internal.api_google_auth_state_pack(auth_request),
      redirect_uri: Api.GOOGLE_OAUTH2!.url_redirect,
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
    google_auth_get_tokens: (code: string) => $.ajax({
      url: Env.url_create(Api.GOOGLE_OAUTH2!.url_tokens, { grant_type: 'authorization_code', code, client_id: Api.GOOGLE_OAUTH2!.client_id, redirect_uri: Api.GOOGLE_OAUTH2!.url_redirect }),
      method: 'POST',
      crossDomain: true,
      async: true,
    }) as any as Promise<GoogleAuthTokensResponse>,
    google_auth_refresh_token: (refresh_token: string) => $.ajax({
      url: Env.url_create(Api.GOOGLE_OAUTH2!.url_tokens, { grant_type: 'refresh_token', refresh_token, client_id: Api.GOOGLE_OAUTH2!.client_id }),
      method: 'POST',
      crossDomain: true,
      async: true,
    }) as any as Promise<GoogleAuthTokensResponse>,
    google_auth_check_access_token: (access_token: string) => $.ajax({
      url: Env.url_create('https://www.googleapis.com/oauth2/v1/tokeninfo', { access_token }),
      crossDomain: true,
      async: true,
    }) as any as Promise<GoogleAuthTokenInfo>,
    google_auth_window_result_handler: async (result: GoogleAuthWindowResult): Promise<AuthResult> => {
      if (result.result === 'Success') {
        let tokens_object = await Api.internal.google_auth_get_tokens(result.params.code);
        let _ = await Api.internal.google_auth_check_access_token(tokens_object.access_token); // https://groups.google.com/forum/#!topic/oauth2-dev/QOFZ4G7Ktzg
        let {emailAddress: account_email} = await Api.gmail.users_me_profile(null, tokens_object.access_token);
        if(result.state.account_email !== account_email) {
          Catch.report('google_auth_window_result_handler: result.state.account_email !== me.emailAddress');
        }
        await Api.internal.google_auth_save_tokens(account_email, tokens_object, result.state.scopes!); // we fill AuthRequest inside .auth_popup()
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
        if (Api.error.is_auth_error(e)) { // force refresh token
          request.headers!.Authorization = await Api.internal.google_api_authorization_header(account_email, true);
          return await $.ajax(request);
        }
        if(e && typeof e === 'object' && e.readyState === 4) {
          e.url = request.url; // for debugging
        }
        throw e;
      }
    },
    api_google_call: async (account_email: string, method: ApiCallMethod, url: string, parameters: Dict<Serializable>|string) => {
      let data = method === 'GET' || method === 'DELETE' ? parameters : JSON.stringify(parameters);
      let headers = { Authorization: await Api.internal.google_api_authorization_header(account_email) };
      let request = {url, method, data, headers, crossDomain: true, contentType: 'application/json; charset=UTF-8', async: true};
      return await Api.internal.api_google_call_retry_auth_error_one_time(account_email, request);
    },
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
      let headers = { 'Authorization': await Api.internal.google_api_authorization_header(account_email) };
      let xhr = () => Api.internal.get_ajax_progress_xhr(progress);
      let request = {xhr, url, method, data, headers, crossDomain: true, contentType, async: true};
      return await Api.internal.api_google_call_retry_auth_error_one_time(account_email, request);
    },
    google_api_is_auth_token_valid: (s: AccountStore) => s.google_token_access && (!s.google_token_expires || s.google_token_expires > new Date().getTime() + (120 * 1000)), // oauth token will be valid for another 2 min
    google_api_authorization_header: async (account_email: string, force_refresh=false): Promise<string> => {
      if (!account_email) {
        throw new Error('missing account_email in api_gmail_call');
      }
      let storage = await Store.get_account(account_email, ['google_token_access', 'google_token_expires', 'google_token_scopes', 'google_token_refresh']);
      if (!storage.google_token_access || !storage.google_token_refresh) {
        throw new Error('Account not connected to FlowCrypt Browser Extension');
      } else if (Api.internal.google_api_is_auth_token_valid(storage) && !force_refresh) {
        return `Bearer ${storage.google_token_access}`;
      } else { // refresh token
        let refresh_token_response = await Api.internal.google_auth_refresh_token(storage.google_token_refresh);
        let _ = await Api.internal.google_auth_check_access_token(refresh_token_response.access_token); // https://groups.google.com/forum/#!topic/oauth2-dev/QOFZ4G7Ktzg
        await Api.internal.google_auth_save_tokens(account_email, refresh_token_response, storage.google_token_scopes || []);
        let auth = await Store.get_account(account_email, ['google_token_access', 'google_token_expires']);
        if (Api.internal.google_api_is_auth_token_valid(auth)) { // have a valid gmail_api oauth token
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
      for (let scope of Api.GOOGLE_OAUTH2!.scopes) {
        if (!Value.is(scope).in(requested_scopes)) {
          if (scope !== Api.gmail.scope(['read'])[0] || !omit_read_scope) { // leave out read messages permission if user chose so
            auth_request_scopes.push(scope);
          }
        }
      }
      for (let scope of current_tokens_scopes) {
        if (!Value.is(scope).in(requested_scopes)) {
          auth_request_scopes.push(scope);
        }
      }
      return auth_request_scopes;
    },
    encode_as_multipart_related: (parts: Dict<string>) => { // todo - this could probably be achieved with emailjs-mime-builder
      let boundary = 'this_sucks_' + Str.random(10);
      let body = '';
      for (let type of Object.keys(parts)) {
        body += '--' + boundary + '\n';
        body += 'Content-Type: ' + type + '\n';
        if (Value.is('json').in(type as string)) {
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
      let all_results: Contact[] = [];
      while(true) {
        let headers = await Api.gmail.fetch_messages_based_on_query_and_extract_first_available_header(account_email, query, ['to', 'date']);
        if (headers.to) {
          let raw_parsed_results = (window as BrowserWidnow)['emailjs-addressparser'].parse(headers.to);
          let new_valid_results = raw_parsed_results.filter(r => Str.is_email_valid(r.address)).map(r => Store.db_contact_object(r.address, r.name, null, null, null, false, null));
          query += raw_parsed_results.map(raw => ` -to:"${raw.address}"`).join('');
          all_results = all_results.concat(new_valid_results);
          chunked_callback({new: new_valid_results, all: all_results});
          if(query.length > 6000) { // gmail search string can handle about this much
            chunked_callback({new: [], all: all_results});
            return;
          }
        } else {
          chunked_callback({new: [], all: all_results});
          return;
        }
      }
    },
    api_gmail_fetch_messages_sequentially_from_list_and_extract_first_available_header: async (account_email: string, messages: ApirGmailMessageList$message[], header_names: string[]): Promise<FlatHeaders> => {
      for (let message of messages) {
        let header_values: FlatHeaders = {};
        let message_get_response = await Api.gmail.message_get(account_email, message.id, 'metadata');
        for (let header_name of header_names) {
          let value = Api.gmail.find_header(message_get_response, header_name);
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
    api_attester_packet_armor: (content_text: string) => `${Pgp.armor.headers('attest_packet').begin}\n${content_text}\n${Pgp.armor.headers('attest_packet').end}`,
    api_attester_call: (path: string, values: Dict<any>) => Api.internal.api_call('https://attester.flowcrypt.com/', path, values, 'JSON', null, {'api-version': '3'} as FlatHeaders),
    api_fc_call: (path: string, values: Dict<any>, format='JSON' as ApiCallFormat) => Api.internal.api_call(Api.fc.url('api'), path, values, format, null, {'api-version': '3'} as FlatHeaders),
  };

}

class Ui {

  public static EVENT_DOUBLE_MS = 1000;
  public static EVENT_SPREE_MS = 50;
  public static EVENT_SLOW_SPREE_MS = 200;
  public static EVENT_VERY_SLOW_SPREE_MS = 500;

  public static retry_link = (caption:string='retry') => `<a href="${Xss.html_escape(window.location.href)}">${Xss.html_escape(caption)}</a>`;

  public static delay = (ms: number) => new Promise(resolve => Catch.set_timeout(resolve, ms));

  public static spinner = (color: string, placeholder_class:"small_spinner"|"large_spinner"='small_spinner') => {
    let path = `/img/svgs/spinner-${color}-small.svg`;
    let url = typeof chrome !== 'undefined' && chrome.extension && chrome.extension.getURL ? chrome.extension.getURL(path) : path;
    return `<i class="${placeholder_class}" data-test="spinner"><img src="${url}" /></i>`;
  }

  public static sanitize_render = (selector: string|HTMLElement|JQuery<HTMLElement>, dirty_html: string) => $(selector as any).html(Xss.html_sanitize(dirty_html)); // xss-sanitized

  public static sanitize_append = (selector: string|HTMLElement|JQuery<HTMLElement>, dirty_html: string) => $(selector as any).append(Xss.html_sanitize(dirty_html)); // xss-sanitized

  public static sanitize_prepend = (selector: string|HTMLElement|JQuery<HTMLElement>, dirty_html: string) => $(selector as any).prepend(Xss.html_sanitize(dirty_html)); // xss-sanitized

  public static sanitize_replace = (selector: string|HTMLElement|JQuery<HTMLElement>, dirty_html: string) => $(selector as any).replaceWith(Xss.html_sanitize(dirty_html)); // xss-sanitized

  public static render_overlay_prompt_await_user_choice = (buttons: Dict<{title?: string, color?: string}>, prompt: string): Promise<string> => {
    return new Promise(resolve => {
      let btns = Object.keys(buttons).map(id => `<div class="button ${Xss.html_escape(buttons[id].color || 'green')} overlay_action_${Xss.html_escape(id)}">${Xss.html_escape(buttons[id].title || id.replace(/_/g, ' '))}</div>`).join('&nbsp;'.repeat(5));
      Ui.sanitize_append('body', `
        <div class="featherlight white prompt_overlay" style="display: block;">
          <div class="featherlight-content" data-test="dialog">
            <div class="line">${prompt.replace(/\n/g, '<br>')}</div>
            <div class="line">${btns}</div>
            <div class="line">&nbsp;</div>
            <div class="line">Email human@flowcrypt.com if you need assistance.</div>
          </div>
        </div>
      `);
      let overlay = $('.prompt_overlay');
      for(let id of Object.keys(buttons)) {
        overlay.find(`.overlay_action_${id}`).one('click', () => {
          overlay.remove();
          resolve(id);
        });
      }
    });
  }

  public static abort_and_render_error_on_unprotected_key = async (account_email?: string, tab_id?: string) => {
    if(account_email) {
      let [primary_ki] = await Store.keys_get(account_email, ['primary']);
      let {setup_done, setup_simple} = await Store.get_account(account_email, ['setup_simple', 'setup_done']);
      if(setup_done && setup_simple && primary_ki && openpgp.key.readArmored(primary_ki.private).keys[0].isDecrypted()) {
        if(window.location.pathname === '/chrome/settings/index.htm') {
          Settings.render_sub_page(account_email, tab_id!, '/chrome/settings/modules/change_passphrase.htm');
        } else {
          let msg = `Protect your key with a pass phrase to finish setup.`;
          let r = await Ui.render_overlay_prompt_await_user_choice({finish_setup: {}, later: {color: 'gray'}}, msg);
          if(r === 'finish_setup') {
            BrowserMsg.send(null, 'settings', {account_email});
          }
        }
      }
    }
  }

  public static abort_and_render_error_on_url_param_type_mismatch = (values: UrlParams, name: string, expected_type: string): UrlParam => {
    let actual_type = typeof values[name];
    if (actual_type !== expected_type) {
      let msg = `Cannot render page (expected ${Xss.html_escape(name)} to be of type ${Xss.html_escape(expected_type)} but got ${Xss.html_escape(actual_type)})<br><br>Was the URL editted manually? Please write human@flowcrypt.com for help.`;
      Ui.sanitize_render('body', msg).addClass('bad').css({padding: '20px', 'font-size': '16px'});
      throw new UnreportableError(msg);
    }
    return values[name];
  }

  public static abort_and_render_error_on_url_param_value_mismatch = <T>(values: Dict<T>, name: string, expected_values: T[]): T => {
    if (expected_values.indexOf(values[name]) === -1) {
      let msg = `Cannot render page (expected ${Xss.html_escape(name)} to be one of ${Xss.html_escape(expected_values.map(String).join(','))} but got ${Xss.html_escape(String(values[name]))}<br><br>Was the URL editted manually? Please write human@flowcrypt.com for help.`;
      Ui.sanitize_render('body', msg).addClass('bad').css({padding: '20px', 'font-size': '16px'});
      throw new UnreportableError(msg);
    }
    return values[name];
  }

  public static passphrase_toggle = async (pass_phrase_input_ids: string[], force_initial_show_or_hide:"show"|"hide"|null=null) => {
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
      $('#toggle_' + id).click(Ui.event.handle(target => {
        if (passphrase_input.attr('type') === 'password') {
          $('#' + id).attr('type', 'text');
          Ui.sanitize_render(target, button_hide);
          Store.set(null, { hide_pass_phrases: false }).catch(Catch.rejection);
        } else {
          $('#' + id).attr('type', 'password');
          Ui.sanitize_render(target, button_show);
          Store.set(null, { hide_pass_phrases: true }).catch(Catch.rejection);
        }
      }));
    }
  }

  public static enter = (callback: () => void) => (e: JQuery.Event<HTMLElement, null>) => { // returns a function
    if (e.which === Env.key_codes().enter) {
      callback();
    }
  }

  public static build_jquery_selectors = (selectors: Dict<string>): SelectorCache => {
    let cache: NamedSelectors = {};
    return {
      cached: (name: string) => {
        if (!cache[name]) {
          if (typeof selectors[name] === 'undefined') {
            Catch.report('unknown selector name: ' + name);
          }
          cache[name] = $(selectors[name]);
        }
        return cache[name];
      },
      now: (name: string) => {
        if (typeof selectors[name] === 'undefined') {
          Catch.report('unknown selector name: ' + name);
        }
        return $(selectors[name]);
      },
      selector: (name: string) => {
        if (typeof selectors[name] === 'undefined') {
          Catch.report('unknown selector name: ' + name);
        }
        return selectors[name];
      }
    };
  }

  public static scroll = (selector: string|JQuery<HTMLElement>, repeat:number[]=[]) => {
    let el = $(selector as string).first()[0]; // as string due to JQuery TS quirk
    if (el) {
      el.scrollIntoView();
      for (let delay of repeat) { // useful if mobile keyboard is about to show up
        Catch.set_timeout(() => el.scrollIntoView(), delay);
      }
    }
  }

  public static event = {
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
    handle: (cb: (e: HTMLElement, event: JQuery.Event<HTMLElement, null>) => void|Promise<void>, err_handler?: BrowserEventErrorHandler) => {
      return function(event: JQuery.Event<HTMLElement, null>) {
        let r;
        try {
          r = cb(this, event);
          if(typeof r === 'object' && typeof r.catch === 'function') {
            r.catch(e => Ui.event.__dispatch_err(e, err_handler));
          }
        } catch(e) {
          Ui.event.__dispatch_err(e, err_handler);
        }
      };
    },
    __dispatch_err: (e: any, err_handler?: BrowserEventErrorHandler) => {
      if(Api.error.is_network_error(e) && err_handler && err_handler.network) {
        err_handler.network();
      } else if (Api.error.is_auth_error(e) && err_handler && err_handler.auth) {
        err_handler.auth();
      } else if (Api.error.is_auth_popup_needed(e) && err_handler && err_handler.auth_popup) {
        err_handler.auth_popup();
      } else if (err_handler && err_handler.other) {
        err_handler.other(e);
      } else {
        Catch.handle_exception(e);
      }
    },
    prevent: (preventable_event: PreventableEventName, cb: (e: HTMLElement, reset_timer: () => void) => void|Promise<void>, err_handler?: BrowserEventErrorHandler) => {
      let event_timer: number|undefined;
      let event_fired_on: number|undefined;
      let cb_reset_timer = () => {
        event_timer = undefined;
        event_fired_on = undefined;
      };
      let cb_with_errors_handled = (e: HTMLElement) => {
        let r;
        try {
          r = cb(e, cb_reset_timer);
          if(typeof r === 'object' && typeof r.catch === 'function') {
            r.catch(e => Ui.event.__dispatch_err(e, err_handler));
          }
        } catch(e) {
          Ui.event.__dispatch_err(e, err_handler);
        }
      };
      return function() {
        if (preventable_event === 'spree') {
          clearTimeout(event_timer);
          event_timer = Catch.set_timeout(() => cb_with_errors_handled(this), Ui.EVENT_SPREE_MS);
        } else if (preventable_event === 'slowspree') {
          clearTimeout(event_timer);
          event_timer = Catch.set_timeout(() => cb_with_errors_handled(this), Ui.EVENT_SLOW_SPREE_MS);
        } else if (preventable_event === 'veryslowspree') {
          clearTimeout(event_timer);
          event_timer = Catch.set_timeout(() => cb_with_errors_handled(this), Ui.EVENT_VERY_SLOW_SPREE_MS);
        } else {
          if (event_fired_on) {
            if (preventable_event === 'parallel') {
              // event handling is still being processed. Do not call back
            } else if (preventable_event === 'double') {
              if (Date.now() - event_fired_on > Ui.EVENT_DOUBLE_MS) {
                event_fired_on = Date.now();
                cb_with_errors_handled(this);
              }
            }
          } else {
            event_fired_on = Date.now();
            cb_with_errors_handled(this);
          }
        }
      };
    }
  };

  /**
   * XSS WARNING
   *
   * Return values are inserted directly into DOM. Results must be html escaped.
   *
   * When edited, REQUEST A SECOND SET OF EYES TO REVIEW CHANGES
   */
  public static renderable_message_block = (factory: XssSafeFactory, block: MessageBlock, message_id:string|null=null, sender_email:string|null=null, is_outgoing: boolean|null=null) => {
    if (block.type === 'text' || block.type === 'private_key') {
      return Xss.html_escape(block.content).replace(/\n/g, '<br>') + '<br><br>';
    } else if (block.type === 'message') {
      return factory.embedded_message(block.complete ? Pgp.armor.normalize(block.content, 'message') : '', message_id, is_outgoing, sender_email, false);
    } else if (block.type === 'signed_message') {
      return factory.embedded_message(block.content, message_id, is_outgoing, sender_email, false);
    } else if (block.type === 'public_key') {
      return factory.embedded_pubkey(Pgp.armor.normalize(block.content, 'public_key'), is_outgoing);
    } else if (block.type === 'password_message') {
      return factory.embedded_message('', message_id, is_outgoing, sender_email, true, null, block.content); // here block.content is message short id
    } else if (block.type === 'attest_packet') {
      return factory.embedded_attest(block.content);
    } else if (block.type === 'cryptup_verification') {
      return factory.embedded_verification(block.content);
    } else {
      Catch.report('dunno how to process block type: ' + block.type);
      return '';
    }
  }

  public static time = {
    wait: (until_this_function_evaluates_true: () => boolean|undefined) => new Promise((success, error) => {
      let interval = Catch.set_interval(() => {
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
    sleep: (ms: number, set_timeout: (code: () => void, t: number) => void = Catch.set_timeout) => new Promise(resolve => set_timeout(resolve, ms)),
  };

  public static e = (name: string, attrs: Dict<string>) => $(`<${name}/>`, attrs)[0].outerHTML; // xss-tested: jquery escapes attributes

}

class BrowserMsg {

  public static MAX_SIZE = 1024 * 1024; // 1MB
  private static HANDLERS_REGISTERED_BACKGROUND: Dict<BrowserMessageHandler>|null = null;
  private static HANDLERS_REGISTERED_FRAME: Dict<BrowserMessageHandler> = {};
  private static HANDLERS_STANDARD = {
    set_css: (data: {css: Dict<string|number>, selector: string, traverse_up?: number}) => {
      let element = $(data.selector);
      let traverse_up_levels = data.traverse_up as number || 0;
      for (let i = 0; i < traverse_up_levels; i++) {
        element = element.parent();
      }
      element.css(data.css);
    },
  } as Dict<BrowserMessageHandler>;

  public static send = (destination_string: string|null, name: string, data: Dict<any>|null=null) => {
    BrowserMsg.send_await(destination_string, name, data).catch(Catch.rejection);
  }

  public static send_await = (destination_string: string|null, name: string, data: Dict<any>|null=null): Promise<BrowserMessageResponse> => new Promise(resolve => {
    let msg = { name, data, to: destination_string || null, uid: Str.random(10), stack: Catch.stack_trace() };
    let try_resolve_no_undefined = (r?: BrowserMessageResponse) => Catch.try(() => resolve(typeof r === 'undefined' ? {} : r))();
    let is_background_page = Env.is_background_script();
    if (typeof  destination_string === 'undefined') { // don't know where to send the message
      Catch.log('BrowserMsg.send to:undefined');
      try_resolve_no_undefined();
    } else if (is_background_page && BrowserMsg.HANDLERS_REGISTERED_BACKGROUND && msg.to === null) {
      BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[msg.name](msg.data, 'background', try_resolve_no_undefined); // calling from background script to background script: skip messaging completely
    } else if (is_background_page) {
      chrome.tabs.sendMessage(BrowserMsg.browser_message_destination_parse(msg.to).tab!, msg, {}, try_resolve_no_undefined);
    } else {
      chrome.runtime.sendMessage(msg, try_resolve_no_undefined);
    }
  })

  public static tab_id = async (): Promise<string|null|undefined> => {
    let r = await BrowserMsg.send_await(null, '_tab_', null);
    if(typeof r === 'string' || typeof r === 'undefined' || r === null) {
      return r; // for compatibility reasons when upgrading from 5.7.2 - can be removed later
    } else {
      return r.tab_id; // new format
    }
  }

  public static required_tab_id = async (): Promise<string> => {
    let tab_id;
    for(let i = 0; i < 10; i++) { // up to 10 attempts. Sometimes returns undefined right after browser start
      tab_id = await BrowserMsg.tab_id();
      if(tab_id) {
        return tab_id;
      }
      await Ui.time.sleep(200); // sleep 200ms between attempts
    }
    throw new TabIdRequiredError(`Tab id is required, but received '${String(tab_id)}' after 10 attempts`);
  }

  public static listen = (handlers: Dict<BrowserMessageHandler>, listen_for_tab_id='all') => {
    for (let name of Object.keys(handlers)) {
      // newly registered handlers with the same name will overwrite the old ones if BrowserMsg.listen is declared twice for the same frame
      // original handlers not mentioned in newly set handlers will continue to work
      BrowserMsg.HANDLERS_REGISTERED_FRAME[name] = handlers[name];
    }
    for (let name of Object.keys(BrowserMsg.HANDLERS_STANDARD)) {
      if (typeof BrowserMsg.HANDLERS_REGISTERED_FRAME[name] !== 'function') {
        BrowserMsg.HANDLERS_REGISTERED_FRAME[name] = BrowserMsg.HANDLERS_STANDARD[name]; // standard handlers are only added if not already set above
      }
    }
    let processed:string[] = [];
    chrome.runtime.onMessage.addListener((msg, sender, respond) => {
      try {
        if (msg.to === listen_for_tab_id || msg.to === 'broadcast') {
          if (!Value.is(msg.uid).in(processed)) {
            processed.push(msg.uid);
            if (typeof BrowserMsg.HANDLERS_REGISTERED_FRAME[msg.name] !== 'undefined') {
              let r = BrowserMsg.HANDLERS_REGISTERED_FRAME[msg.name](msg.data, sender, respond);
              if(r && typeof r === 'object' && (r as Promise<void>).then && (r as Promise<void>).catch) {
                // todo - a way to callback the error to be re-thrown to caller stack
                (r as Promise<void>).catch(Catch.rejection);
              }
            } else if (msg.name !== '_tab_' && msg.to !== 'broadcast') {
              if (BrowserMsg.browser_message_destination_parse(msg.to).frame !== null) { // only consider it an error if frameId was set because of firefox bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1354337
                Catch.report('BrowserMsg.listen error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
              } else { // once firefox fixes the bug, it will behave the same as Chrome and the following will never happen.
                console.log('BrowserMsg.listen ignoring missing handler "' + msg.name + '" due to Firefox Bug');
              }
            }
          }
        }
        return !!respond; // indicate that this listener intends to respond
      } catch(e) {
        // todo - a way to callback the error to be re-thrown to caller stack
        Catch.handle_exception(e);
      }
    });
  }

  public static listen_background = (handlers: Dict<BrowserMessageHandler>) => {
    if (!BrowserMsg.HANDLERS_REGISTERED_BACKGROUND) {
      BrowserMsg.HANDLERS_REGISTERED_BACKGROUND = handlers;
    } else {
      for (let name of Object.keys(handlers)) {
        BrowserMsg.HANDLERS_REGISTERED_BACKGROUND[name] = handlers[name];
      }
    }
    chrome.runtime.onMessage.addListener((msg, sender, respond) => {
      try {
        let safe_respond = (response: any) => {
          try { // avoiding unnecessary errors when target tab gets closed
            respond(response);
          } catch (e) {
            // todo - the sender should still know - could have PageClosedError
            if (e.message !== 'Attempting to use a disconnected port object') {
              Catch.handle_exception(e);
              throw e;
            }
          }
        };
        if (msg.to && msg.to !== 'broadcast') {
          msg.sender = sender;
          chrome.tabs.sendMessage(BrowserMsg.browser_message_destination_parse(msg.to).tab!, msg, {}, safe_respond);
        } else if (Value.is(msg.name).in(Object.keys(BrowserMsg.HANDLERS_REGISTERED_BACKGROUND!))) { // is !null because added above
          let r = BrowserMsg.HANDLERS_REGISTERED_BACKGROUND![msg.name](msg.data, sender, safe_respond); // is !null because checked above
          if(r && typeof r === 'object' && (r as Promise<void>).then && (r as Promise<void>).catch) {
            // todo - a way to callback the error to be re-thrown to caller stack
            (r as Promise<void>).catch(Catch.rejection);
          }
        } else if (msg.to !== 'broadcast') {
          Catch.report('BrowserMsg.listen_background error: handler "' + msg.name + '" not set', 'Message sender stack:\n' + msg.stack);
        }
        return !!respond; // indicate that we intend to respond later
      } catch (e) {
        // todo - a way to callback the error to be re-thrown to caller stack
        Catch.handle_exception(e);
      }
    });
  }

  private static browser_message_destination_parse = (destination_string: string|null) => {
    let parsed = { tab: null as null|number, frame: null as null|number };
    if (destination_string) {
      parsed.tab = Number(destination_string.split(':')[0]);
      // @ts-ignore - adding nonsense into isNaN
      parsed.frame = !isNaN(destination_string.split(':')[1]) ? Number(destination_string.split(':')[1]) : null;
    }
    return parsed;
  }

}

class Xss {

  private static ALLOWED_HTML_TAGS = ['p', 'div', 'br', 'u', 'i', 'em', 'b', 'ol', 'ul', 'pre', 'li', 'table', 'tr', 'td', 'th', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'address', 'blockquote', 'dl', 'fieldset', 'a', 'font'];
  private static ADD_ATTR = ['email', 'page', 'addurltext', 'longid', 'index'];
  private static HREF_REGEX_CACHE = null as null|RegExp;

  public static html_sanitize = (dirty_html: string): string => { // originaly text_or_html
    return DOMPurify.sanitize(dirty_html, {
      SAFE_FOR_JQUERY: true,
      ADD_ATTR: Xss.ADD_ATTR,
      ALLOWED_URI_REGEXP: Xss.sanitize_href_regexp(),
    });
  }

  public static html_sanitize_keep_basic_tags = (dirty_html: string): string => {
    // used whenever untrusted remote content (eg html email) is rendered, but we still want to preserve html
    DOMPurify.removeAllHooks();
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if ('src' in node) {
        // replace images with a link that points to that image
        let img: Element = node;
        let src = img.getAttribute('src')!;
        let title = img.getAttribute('title');
        img.removeAttribute('src');
        let a = document.createElement('a');
        a.href = src;
        a.className = 'image_src_link';
        a.target = '_blank';
        a.innerText = title || 'show image';
        let heightWidth = `height: ${img.clientHeight ? `${Number(img.clientHeight)}px` : 'auto'}; width: ${img.clientWidth ? `${Number(img.clientWidth)}px` : 'auto'};`;
        a.setAttribute('style', `text-decoration: none; background: #FAFAFA; padding: 4px; border: 1px dotted #CACACA; display: inline-block; ${heightWidth}`);
        img.outerHTML = a.outerHTML; // xss-safe-value - "a" was build using dom node api
      }
      if ('target' in node) { // open links in new window
        (node as Element).setAttribute('target', '_blank');
      }
    });
    let clean_html = DOMPurify.sanitize(dirty_html, {
      SAFE_FOR_JQUERY: true,
      ADD_ATTR: Xss.ADD_ATTR,
      ALLOWED_TAGS: Xss.ALLOWED_HTML_TAGS,
      ALLOWED_URI_REGEXP: Xss.sanitize_href_regexp(),
    });
    DOMPurify.removeAllHooks();
    return clean_html;
  }

  public static html_sanitize_and_strip_all_tags = (dirty_html: string, output_newline: string): string => {
    let html = Xss.html_sanitize_keep_basic_tags(dirty_html);
    let random = Str.random(5);
    let br = `CU_BR_${random}`;
    let block_start = `CU_BS_${random}`;
    let block_end = `CU_BE_${random}`;
    html = html.replace(/<br[^>]*>/gi, br);
    html = html.replace(/\n/g, '');
    html = html.replace(/<\/(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, block_end);
    html = html.replace(/<(p|h1|h2|h3|h4|h5|h6|ol|ul|pre|address|blockquote|dl|div|fieldset|form|hr|table)[^>]*>/gi, block_start);
    html = html.replace(RegExp(`(${block_start})+`, 'g'), block_start).replace(RegExp(`(${block_end})+`, 'g'), block_end);
    html = html.split(block_end + block_start).join(br).split(br + block_end).join(br);
    let text = html.split(br).join('\n').split(block_start).filter(v => !!v).join('\n').split(block_end).filter(v => !!v).join('\n');
    text = text.replace(/\n{2,}/g, '\n\n');
    // not all tags were removed above. Remove all remaining tags
    text = DOMPurify.sanitize(text, {SAFE_FOR_JQUERY: true, ALLOWED_TAGS: []});
    text = text.trim();
    if(output_newline !== '\n') {
      text = text.replace(/\n/g, output_newline);
    }
    return text;
  }

  public static html_escape = (str: string) => str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\//g, '&#x2F;');

  public static html_unescape = (str: string) => {
    // the &nbsp; at the end is replaced with an actual NBSP character, not a space character. IDE won't show you the difference. Do not change.
    return str.replace(/&#x2F;/g, '/').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
  }

  private static sanitize_href_regexp = () => { // allow href links that have same origin as our extension + cid
    if(Xss.HREF_REGEX_CACHE === null) {
      if (window && window.location && window.location.origin && window.location.origin.match(/^(?:chrome-extension|moz-extension):\/\/[a-z0-9\-]+$/g)) {
        Xss.HREF_REGEX_CACHE = new RegExp(`^(?:(http|https|cid):|${Str.regex_escape(window.location.origin)}|[^a-z]|[a-z+.\\-]+(?:[^a-z+.\\-:]|$))`, 'i');
      } else {
        Xss.HREF_REGEX_CACHE = /^(?:(http|https):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i;
      }
    }
    return Xss.HREF_REGEX_CACHE;
  }

}

class Str {

  public static parse_email = (email_string: string) => {
    if (Value.is('<').in(email_string) && Value.is('>').in(email_string)) {
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
  }

  public static pretty_print = (obj: any) => (typeof obj === 'object') ? JSON.stringify(obj, null, 2).replace(/ /g, '&nbsp;').replace(/\n/g, '<br>') : String(obj);

  public static normalize_spaces = (str: string) => str.replace(RegExp(String.fromCharCode(160), 'g'), String.fromCharCode(32)).replace(/\n /g, '\n');

  public static normalize_dashes = (str: string) => str.replace(/^—–|—–$/gm, '-----');

  public static normalize = (str: string) => Str.normalize_spaces(Str.normalize_dashes(str));

  public static number_format = (number: number) => { // http://stackoverflow.com/questions/3753483/javascript-thousand-separator-string-format
    let nStr: string = number + '';
    let x = nStr.split('.');
    let x1 = x[0];
    let x2 = x.length > 1 ? '.' + x[1] : '';
    let rgx = /(\d+)(\d{3})/;
    while(rgx.test(x1)) {
      x1 = x1.replace(rgx, '$1' + ',' + '$2');
    }
    return x1 + x2;
  }

  public static is_email_valid = (email: string) => /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/i.test(email);

  public static month_name = (month_index: number) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month_index];

  public static random = (length:number=5) => {
    let id = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    for (let i = 0; i < length; i++) {
      id += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return id;
  }

  public static regex_escape = (to_be_used_in_regex: string) => to_be_used_in_regex.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  public static html_attribute_encode = (values: Dict<any>): string => Str.base64url_utf_encode(JSON.stringify(values));

  public static html_attribute_decode = (encoded: string): FlowCryptAttachmentLinkData|any => JSON.parse(Str.base64url_utf_decode(encoded));

  public static base64url_encode = (str: string) => (typeof str === 'undefined') ? str : btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // used for 3rd party API calls - do not change w/o testing Gmail api attachments

  public static base64url_decode = (str: string) => (typeof str === 'undefined') ? str : atob(str.replace(/-/g, '+').replace(/_/g, '/')); // used for 3rd party API calls - do not change w/o testing Gmail api attachments

  public static from_uint8 = (u8a: Uint8Array|string): string => {
    if(typeof u8a === 'string') {
      return u8a;
    }
    let CHUNK_SZ = 0x8000;
    let c = [];
    for (let i = 0; i < u8a.length; i += CHUNK_SZ) {
      c.push(String.fromCharCode.apply(null, u8a.subarray(i, i + CHUNK_SZ)));
    }
    return c.join('');
  }

  public static to_uint8 = (raw: string|Uint8Array): Uint8Array => {
    if(raw instanceof Uint8Array) {
      return raw;
    }
    let rawLength = raw.length;
    let uint8 = new Uint8Array(new ArrayBuffer(rawLength));
    for (let i = 0; i < rawLength; i++) {
      uint8[i] = raw.charCodeAt(i);
    }
    return uint8;
  }

  public static from_equal_sign_notation_as_utf = (str: string): string => {
    return str.replace(/(=[A-F0-9]{2})+/g, equal_sign_utf_part => {
      return Str.uint8_as_utf(equal_sign_utf_part.replace(/^=/, '').split('=').map((two_hex_digits) => parseInt(two_hex_digits, 16)));
    });
  }

  public static uint8_as_utf = (a: Uint8Array|number[]) => { // tom
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
            console.log('Str.uint8_as_utf: invalid utf-8 character beginning byte: ' + a[i]);
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
  }

  public static to_hex = (s: string): string => { // http://phpjs.org/functions/bin2hex/, Kevin van Zonneveld (http://kevin.vanzonneveld.net), Onno Marsman, Linuxworld, ntoniazzi
    let o = '';
    s += '';
    for (let i = 0; i < s.length; i++) {
      let n = s.charCodeAt(i).toString(16);
      o += n.length < 2 ? '0' + n : n;
    }
    return o;
  }

  public static from_hex = (hex: string): string => {
    let str = '';
    for (let i = 0; i < hex.length; i += 2) {
      let v = parseInt(hex.substr(i, 2), 16);
      if (v) {
        str += String.fromCharCode(v);
      }
    }
    return str;
  }

  public static extract_fc_attachments = (decrypted_content: string, fc_attachments: Attachment[]) => {
    if (Value.is('cryptup_file').in(decrypted_content)) {
      decrypted_content = decrypted_content.replace(/<a[^>]+class="cryptup_file"[^>]+>[^<]+<\/a>\n?/gm, found_link => {
        let element = $(found_link);
        let fc_data = element.attr('cryptup-data');
        if (fc_data) {
          let a: FlowCryptAttachmentLinkData = Str.html_attribute_decode(fc_data);
          if(a && typeof a === 'object' && typeof a.name !== 'undefined' && typeof a.size !== 'undefined' && typeof a.type !== 'undefined') {
            fc_attachments.push(new Attachment({type: a.type, name: a.name, length: a.size, url: element.attr('href')}));
          }
        }
        return '';
      });
    }
    return decrypted_content;
  }

  public static extract_fc_reply_token = (decrypted_content: string) => { // todo - used exclusively on the web - move to a web package
    let fc_token_element = $(Ui.e('div', {html: decrypted_content})).find('.cryptup_reply');
    if (fc_token_element.length) {
      let fc_data = fc_token_element.attr('cryptup-data');
      if (fc_data) {
        return Str.html_attribute_decode(fc_data);
      }
    }
  }

  public static strip_fc_reply_token = (decrypted_content: string) => decrypted_content.replace(/<div[^>]+class="cryptup_reply"[^>]+><\/div>/, '');

  public static strip_public_keys = (decrypted_content: string, found_public_keys: string[]) => {
    let {blocks, normalized} = Pgp.armor.detect_blocks(decrypted_content);
    for (let block of blocks) {
      if (block.type === 'public_key') {
        found_public_keys.push(block.content);
        normalized = normalized.replace(block.content, '');
      }
    }
    return normalized;
  }

  public static int_to_hex = (int_as_string: string|number): string => { // http://stackoverflow.com/questions/18626844/convert-a-large-integer-to-a-hex-string-in-javascript (Collin Anderson)
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
  }

  public static capitalize = (string: string): string => string.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');

  public static to_utc_timestamp = (datetime_string: string, as_string:boolean=false) => as_string ? String(Date.parse(datetime_string)) : Date.parse(datetime_string);

  public static datetime_to_date = (date: string) => Xss.html_escape(date.substr(0, 10));

  private static base64url_utf_encode = (str: string) => { // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    return (typeof str === 'undefined') ? str : btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => String.fromCharCode(parseInt(p1, 16)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private static base64url_utf_decode = (str: string) => { // https://stackoverflow.com/questions/30106476/using-javascripts-atob-to-decode-base64-doesnt-properly-decode-utf-8-strings
    return (typeof str === 'undefined') ? str : decodeURIComponent(Array.prototype.map.call(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
  }

}

class Mime {

  public static process = async (mime_message: string) => {
    let decoded = await Mime.decode(mime_message);
    if (typeof decoded.text === 'undefined' && typeof decoded.html !== 'undefined' && typeof $_HOST_html_to_text === 'function') { // android
      decoded.text = $_HOST_html_to_text(decoded.html); // temporary solution
    }
    let blocks: MessageBlock[] = [];
    if (decoded.text) {  // may be undefined or empty
      blocks = blocks.concat(Pgp.armor.detect_blocks(decoded.text).blocks);
    }
    for (let file of decoded.attachments) {
      let treat_as = file.treat_as();
      if (treat_as === 'message') {
        let armored = Pgp.armor.clip(file.as_text());
        if (armored) {
          blocks.push(Pgp.internal.crypto_armor_block_object('message', armored));
        }
      } else if (treat_as === 'signature') {
        decoded.signature = decoded.signature || file.as_text();
      } else if (treat_as === 'public_key') {
        blocks = blocks.concat(Pgp.armor.detect_blocks(file.as_text()).blocks);
      }
    }
    if (decoded.signature) {
      for (let block of blocks) {
        if (block.type === 'text') {
          block.type = 'signed_message';
          block.signature = decoded.signature;
        }
      }
    }
    return {headers: decoded.headers, blocks};
  }

  public static headers_to_from = (parsed_mime_message: MimeContent): FromToHeaders => {
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
  }

  public static reply_headers = (parsed_mime_message: MimeContent) => {
    let message_id = parsed_mime_message.headers['message-id'] || '';
    let references = parsed_mime_message.headers['in-reply-to'] || '';
    return { 'in-reply-to': message_id, 'references': references + ' ' + message_id };
  }

  public static resembles_message = (message: string|Uint8Array) => {
    let m = message.slice(0, 1000);
    // noinspection SuspiciousInstanceOfGuard
    if (m instanceof Uint8Array) {
      m = Str.from_uint8(m);
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
  }

  public static decode = (mime_message: string): Promise<MimeContent> => {
    return new Promise(async resolve => {
      let mime_content = {attachments: [], headers: {} as FlatHeaders, text: undefined, html: undefined, signature: undefined} as MimeContent;
      try {
        let MimeParser = (window as BrowserWidnow)['emailjs-mime-parser'];
        let parser = new MimeParser();
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
            if (Mime.get_node_type(node) === 'application/pgp-signature') {
              mime_content.signature = node.rawContent;
            } else if (Mime.get_node_type(node) === 'text/html' && !Mime.get_node_filename(node)) {
              // html content may be broken up into smaller pieces by attachments in between
              // AppleMail does this with inline attachments
              mime_content.html = (mime_content.html || '') + Mime.get_node_content_as_text(node);
            } else if (Mime.get_node_type(node) === 'text/plain' && !Mime.get_node_filename(node)) {
              mime_content.text = Mime.get_node_content_as_text(node);
            } else {
              mime_content.attachments.push(new Attachment({
                name: Mime.get_node_filename(node),
                type: Mime.get_node_type(node),
                data: node.content,
                cid: Mime.get_node_content_id(node),
              }));
            }
          }
          resolve(mime_content);
        };
        parser.write(mime_message);
        parser.end();
      } catch (e) {
        Catch.handle_exception(e);
        resolve(mime_content);
      }
    });
  }

  public static encode = async (body:string|SendableMessageBody, headers: RichHeaders, attachments:Attachment[]=[]): Promise<string> => {
    let MimeBuilder = (window as BrowserWidnow)['emailjs-mime-builder'];
    let root_node = new MimeBuilder('multipart/mixed');
    for (let key of Object.keys(headers)) {
      root_node.addHeader(key, headers[key]);
    }
    if (typeof body === 'string') {
      body = {'text/plain': body};
    }
    let content_node: MimeParserNode;
    if (Object.keys(body).length === 1) {
      content_node = Mime.new_content_node(MimeBuilder, Object.keys(body)[0], body[Object.keys(body)[0] as "text/plain"|"text/html"] || '');
    } else {
      content_node = new MimeBuilder('multipart/alternative');
      for (let type of Object.keys(body)) {
        content_node.appendChild(Mime.new_content_node(MimeBuilder, type, body[type]!)); // already present, that's why part of for loop
      }
    }
    root_node.appendChild(content_node);
    for (let attachment of attachments) {
      let type = `${attachment.type}; name="${attachment.name}"`;
      let header = {'Content-Disposition': 'attachment', 'X-Attachment-Id': `f_${Str.random(10)}`, 'Content-Transfer-Encoding': 'base64'};
      root_node.appendChild(new MimeBuilder(type, { filename: attachment.name }).setHeader(header).setContent(attachment.data()));
    }
    return root_node.build();
  }

  public static signed = (mime_message: string) => {
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
                  if (first_part.match(/^content-type: application\/pgp-signature/gi) !== null && Value.is('-----BEGIN PGP SIGNATURE-----').in(first_part) && Value.is('-----END PGP SIGNATURE-----').in(first_part)) {
                    result.signature = Pgp.armor.clip(first_part);
                    result.signed = second_part;
                  } else {
                    result.signature = Pgp.armor.clip(second_part);
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

  private static get_node_type = (node: MimeParserNode) => {
    if (node.headers['content-type'] && node.headers['content-type'][0]) {
      return node.headers['content-type'][0].value;
    }
  }

  private static get_node_content_id = (node: MimeParserNode) => {
    if (node.headers['content-id'] && node.headers['content-id'][0]) {
      return node.headers['content-id'][0].value;
    }
  }

  private static get_node_filename = (node: MimeParserNode) => {
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
  }

  private static get_node_content_as_text = (node: MimeParserNode): string => {
    if(node.charset === 'utf-8' && node.contentTransferEncoding.value === 'base64') {
      return Str.uint8_as_utf(node.content);
    }
    if(node.charset === 'utf-8' && node.contentTransferEncoding.value === 'quoted-printable') {
      return Str.from_equal_sign_notation_as_utf(node.rawContent);
    }
    if(node.charset === 'iso-8859-2') {
      return (window as FcWindow).iso88592.decode(node.rawContent);  // todo - use iso88592.labels for detection
    }
    return node.rawContent;
  }

  private static new_content_node = (MimeBuilder: AnyThirdPartyLibrary, type: string, content: string): MimeParserNode => {
    let node = new MimeBuilder(type).setContent(content);
    if (type === 'text/plain') {
      node.addHeader('Content-Transfer-Encoding', 'quoted-printable'); // gmail likes this
    }
    return node;
  }

}

class Pgp {

  private static ARMOR_HEADER_MAX_LENGTH = 50;
  private static ARMOR_HEADER_DICT: CryptoArmorHeaderDefinitions = {
    null: { begin: '-----BEGIN', end: '-----END', replace: false },
    public_key: { begin: '-----BEGIN PGP PUBLIC KEY BLOCK-----', end: '-----END PGP PUBLIC KEY BLOCK-----', replace: true },
    private_key: { begin: '-----BEGIN PGP PRIVATE KEY BLOCK-----', end: '-----END PGP PRIVATE KEY BLOCK-----', replace: true },
    attest_packet: { begin: '-----BEGIN ATTEST PACKET-----', end: '-----END ATTEST PACKET-----', replace: true },
    cryptup_verification: { begin: '-----BEGIN CRYPTUP VERIFICATION-----', end: '-----END CRYPTUP VERIFICATION-----', replace: true },
    signed_message: { begin: '-----BEGIN PGP SIGNED MESSAGE-----', middle: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: true },
    signature: { begin: '-----BEGIN PGP SIGNATURE-----', end: '-----END PGP SIGNATURE-----', replace: false },
    message: { begin: '-----BEGIN PGP MESSAGE-----', end: '-----END PGP MESSAGE-----', replace: true },
    password_message: { begin: 'This message is encrypted: Open Message', end: /https:(\/|&#x2F;){2}(cryptup\.org|flowcrypt\.com)(\/|&#x2F;)[a-zA-Z0-9]{10}(\n|$)/, replace: true},
  };
  private static PASSWORD_GUESSES_PER_SECOND = 10000 * 2 * 4000; // (10k pc)*(2 core p/pc)*(4k guess p/core) httpshttps://www.abuse.ch/?p=3294://threatpost.com/how-much-does-botnet-cost-022813/77573/ https://www.abuse.ch/?p=3294
  private static PASSWORD_CRACK_TIME_WORDS = [
    {match: 'millenni', word: 'perfect',    bar: 100, color: 'green',       pass: true},
    {match: 'centu',    word: 'great',      bar: 80,  color: 'green',       pass: true},
    {match: 'year',     word: 'good',       bar: 60,  color: 'orange',      pass: true},
    {match: 'month',    word: 'reasonable', bar: 40,  color: 'darkorange',  pass: true},
    {match: 'day',      word: 'poor',       bar: 20,  color: 'darkred',     pass: false},
    {match: '',         word: 'weak',       bar: 10,  color: 'red',         pass: false},
  ];

  public static armor = {
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
      if (text && Value.is(Pgp.ARMOR_HEADER_DICT.null.begin).in(text) && Value.is(Pgp.ARMOR_HEADER_DICT.null.end as string).in(text)) {
        let match = text.match(/(-----BEGIN PGP (MESSAGE|SIGNED MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----[^]+-----END PGP (MESSAGE|SIGNATURE|PUBLIC KEY BLOCK)-----)/gm);
        return(match !== null && match.length) ? match[0] : null;
      }
      return null;
    },
    headers: (block_type: ReplaceableMessageBlockType|'null', format='string'): CryptoArmorHeaderDefinition => {
      let h = Pgp.ARMOR_HEADER_DICT[block_type];
      return {
        begin: (typeof h.begin === 'string' && format === 're') ? h.begin.replace(/ /g, '\\\s') : h.begin,
        end: (typeof h.end === 'string' && format === 're') ? h.end.replace(/ /g, '\\\s') : h.end,
        replace: h.replace,
      };
    },
    detect_blocks: (original_text: string) => {
      let blocks: MessageBlock[] = [];
      let normalized = Str.normalize(original_text);
      let start_at = 0;
      while(true) {
        let r = Pgp.internal.crypto_armor_detect_block_next(normalized, start_at);
        if (r.found) {
          blocks = blocks.concat(r.found);
        }
        if (r.continue_at === null) {
          return {blocks, normalized};
        } else {
          if (r.continue_at <= start_at) {
            Catch.report(`Pgp.armor.detect_blocks likely infinite loop: r.continue_at(${r.continue_at}) <= start_at(${start_at})`);
            return {blocks, normalized}; // prevent infinite loop
          }
          start_at = r.continue_at;
        }
      }
    },
    /**
     * XSS WARNING
     *
     * Return values are inserted directly into DOM. Results must be html escaped.
     *
     * When edited, REQUEST A SECOND SET OF EYES TO REVIEW CHANGES
     */
    replace_blocks: (factory: XssSafeFactory, original_text: string, message_id:string|null=null, sender_email:string|null=null, is_outgoing: boolean|null=null) => {
      let {blocks} = Pgp.armor.detect_blocks(original_text);
      if (blocks.length === 1 && blocks[0].type === 'text') {
        return;
      }
      let r = '';
      for (let block of blocks) {
        r += (r ? '\n\n' : '') + Ui.renderable_message_block(factory, block, message_id, sender_email, is_outgoing);
      }
      return r;
    },
    normalize: (armored: string, type:string) => {
      armored = Str.normalize(armored);
      if (Value.is(type).in(['message', 'public_key', 'private_key', 'key'])) {
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
  };

  public static hash = {
    sha1: (string: string) => Str.to_hex(Str.from_uint8(openpgp.crypto.hash.digest(openpgp.enums.hash.sha1, string))),
    double_sha1_upper: (string: string) => Pgp.hash.sha1(Pgp.hash.sha1(string)).toUpperCase(),
    sha256: (string: string) => Str.to_hex(Str.from_uint8(openpgp.crypto.hash.digest(openpgp.enums.hash.sha256, string))),
    challenge_answer: (answer: string) => Pgp.internal.crypto_hash_sha256_loop(answer),
  };

  public static key = {
    create: async (userIds: {name: string, email: string}[], numBits: 4096, passphrase: string): Promise<{private: string, public: string}> => {
      let k = await openpgp.generateKey({numBits, userIds, passphrase});
      return {public: k.publicKeyArmored, private: k.privateKeyArmored};
    },
    read: (armored_key: string) => openpgp.key.readArmored(armored_key).keys[0],
    decrypt: async (key: OpenPGP.key.Key, passphrases: string[]): Promise<boolean> => {
      try {
        return await key.decrypt(passphrases);
      } catch (e) {
        if (Value.is('passphrase').in(e.message.toLowerCase())) {
          return false;
        }
        throw e;
      }
    },
    normalize: (armored: string) => {
      try {
        armored = Pgp.armor.normalize(armored, 'key');
        let key: OpenPGP.key.Key|undefined;
        if (RegExp(Pgp.armor.headers('public_key', 're').begin).test(armored)) {
          key = openpgp.key.readArmored(armored).keys[0];
        } else if (RegExp(Pgp.armor.headers('message', 're').begin).test(armored)) {
          key = new openpgp.key.Key(openpgp.message.readArmored(armored).packets);
        }
        if (key) {
          return key.armor();
        } else {
          return armored;
        }
      } catch (error) {
        Catch.handle_exception(error);
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
          return Pgp.key.fingerprint(openpgp.key.readArmored(key).keys[0], formatting);
        } catch (error) {
          if (error.message === 'openpgp is not defined') {
            Catch.handle_exception(error);
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
        return Str.to_hex(key_or_fingerprint_or_bytes).toUpperCase();
      } else if (typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 40) {
        return key_or_fingerprint_or_bytes.substr(-16);
      } else if (typeof key_or_fingerprint_or_bytes === 'string' && key_or_fingerprint_or_bytes.length === 49) {
        return key_or_fingerprint_or_bytes.replace(/ /g, '').substr(-16);
      } else {
        return Pgp.key.longid(Pgp.key.fingerprint(key_or_fingerprint_or_bytes));
      }
    },
    usable: async (armored: string) => { // is pubkey usable for encrytion?
      if (!Pgp.key.fingerprint(armored)) {
        return false;
      }
      let pubkey = openpgp.key.readArmored(armored).keys[0];
      if (!pubkey) {
        return false;
      }
      if(await pubkey.getEncryptionKey() !== null) {
        return true; // good key - cannot be expired
      }
      return await Pgp.key.usable_but_expired(pubkey);
    },
    usable_but_expired: async (key: OpenPGP.key.Key): Promise<boolean> => {
      if(await key.getEncryptionKey() !== null) {
        return false; // good key - cannot be expired
      }
      let one_second_before_expiration = await Pgp.key.date_before_expiration(key);
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
  };

  public static message = {
    type: (data: string|Uint8Array): {armored: boolean, type: MessageBlockType}|null => {
      if (!data || !data.length) {
        return null;
      }
      let d = data.slice(0, 50); // only interested in first 50 bytes
      // noinspection SuspiciousInstanceOfGuard
      if (d instanceof Uint8Array) {
        d = Str.from_uint8(d);
      }
      let first_byte = d[0].charCodeAt(0); // attempt to understand this as a binary PGP packet: https://tools.ietf.org/html/rfc4880#section-4.2
      if ((first_byte & 0b10000000) === 0b10000000) { // 1XXX XXXX - potential pgp packet tag
        let tag_number = 0; // zero is a forbidden tag number
        if ((first_byte & 0b11000000) === 0b11000000) { // 11XX XXXX - potential new pgp packet tag
          tag_number = first_byte & 0b00111111;  // 11TTTTTT where T is tag number bit
        } else { // 10XX XXXX - potential old pgp packet tag
          tag_number = (first_byte & 0b00111100) / 4; // 10TTTTLL where T is tag number bit. Division by 4 in place of two bit shifts. I hate bit shifts.
        }
        if (Value.is(tag_number).in(Object.values(openpgp.enums.packet))) {
          // Indeed a valid OpenPGP packet tag number
          // This does not 100% mean it's OpenPGP message
          // But it's a good indication that it may
          let t = openpgp.enums.packet;
          let m_types = [t.symEncryptedIntegrityProtected, t.modificationDetectionCode, t.symEncryptedAEADProtected, t.symmetricallyEncrypted, t.compressed];
          return {armored: false, type: Value.is(tag_number).in(m_types) ? 'message' : 'public_key'};
        }
      }
      let {blocks} = Pgp.armor.detect_blocks(d.trim());
      if (blocks.length === 1 && blocks[0].complete === false && Value.is(blocks[0].type).in(['message', 'private_key', 'public_key', 'signed_message'])) {
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
          signature.match = Value.is(signature.match).in([true, null]) && verify_result.valid; // this will probably falsely show as not matching in some rare cases. Needs testing.
          if (!signature.signer) {
            signature.signer = Pgp.key.longid(verify_result.keyid.bytes);
          }
        }
      } catch (verify_error) {
        signature.match = null;
        if (verify_error.message === 'Can only verify message with one literal data packet.') {
          signature.error = 'FlowCrypt is not equipped to verify this message (err 101)';
        } else {
          signature.error = `FlowCrypt had trouble verifying this message (${verify_error.message})`;
          Catch.handle_exception(verify_error);
        }
      }
      return signature;
    },
    verify_detached: async (account_email: string, plaintext: string|Uint8Array, signature_text: string|Uint8Array): Promise<MessageVerifyResult> => {
      if (plaintext instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
        plaintext = Str.from_uint8(plaintext);
      }
      if (signature_text instanceof Uint8Array) { // until https://github.com/openpgpjs/openpgpjs/issues/657 fixed
        signature_text = Str.from_uint8(signature_text);
      }
      let message = openpgp.message.fromText(plaintext);
      message.appendSignature(signature_text);
      let keys = await Pgp.internal.crypto_message_get_sorted_keys_for_message(account_email, message);
      return await Pgp.message.verify(message, keys.for_verification, keys.verification_contacts[0]);
    },
    decrypt: async (account_email: string, encrypted_data: string|Uint8Array, msg_pwd: string|null=null, get_uint8=false): Promise<DecryptSuccess|DecryptError> => {
      let prepared;
      let longids = {message: [] as string[], matching: [] as string[], chosen: [] as string[], need_passphrase: [] as string[]};
      try {
        prepared = Pgp.internal.crypto_message_prepare_for_decrypt(encrypted_data);
      } catch (format_error) {
        return {success: false, error: {type: DecryptErrorTypes.format, error: format_error.message}, longids, is_encrypted: null, signature: null};
      }
      let keys = await Pgp.internal.crypto_message_get_sorted_keys_for_message(account_email, prepared.message);
      longids.message = keys.encrypted_for;
      longids.matching = keys.prv_for_decrypt.map(ki => ki.longid);
      longids.chosen = keys.prv_for_decrypt_decrypted.map(ki => ki.longid);
      longids.need_passphrase = keys.prv_for_decrypt_without_passphrases.map(ki => ki.longid);
      let is_encrypted = !prepared.is_cleartext;
      if (!is_encrypted) {
        return {success: true, content: {text: prepared.message.getText(), filename: null}, is_encrypted, signature: await Pgp.message.verify(prepared.message, keys.for_verification, keys.verification_contacts[0])};
      }
      if (!keys.prv_for_decrypt_decrypted.length && !msg_pwd) {
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
        let decrypted = await (prepared.message as OpenPGP.message.Message).decrypt(keys.prv_for_decrypt_decrypted.map(ki => ki.decrypted!), msg_passwords);
        // let signature_result = keys.signed_by.length ? Pgp.message.verify(message, keys.for_verification, keys.verification_contacts[0]) : false;
        let signature_result = null;
        if(get_uint8) {
          return {success: true, content: {uint8: decrypted.getLiteralData(), filename: decrypted.getFilename()}, is_encrypted, signature: signature_result};
        } else {
          return {success: true, content: {text: decrypted.getText(), filename: decrypted.getFilename()}, is_encrypted, signature: signature_result};
        }
      } catch (e) {
        return {success: false, error: Pgp.internal.crypto_message_decrypt_categorize_error(e, msg_pwd), signature: null, message: prepared.message, longids, is_encrypted};
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
        options.passwords = [Pgp.hash.challenge_answer(challenge.answer)];
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
    diagnose_pubkeys: async (account_email: string, m: string|Uint8Array|OpenPGP.message.Message): Promise<DiagnoseMessagePubkeysResult> => {
      let message: OpenPGP.message.Message;
      if (typeof m === 'string') {
        message = openpgp.message.readArmored(m);
      } else if (m instanceof Uint8Array) {
        message = openpgp.message.readArmored(Str.from_uint8(m));
      } else {
        message = m;
      }
      let message_key_ids = message.getEncryptionKeyIds ? message.getEncryptionKeyIds() : [];
      let private_keys = await Store.keys_get(account_email);
      let local_key_ids = [].concat.apply([], private_keys.map(ki => ki.public).map(Pgp.internal.crypto_key_ids));
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
  };

  public static password = {
    estimate_strength: (zxcvbn_result_guesses: number) => {
      let time_to_crack = zxcvbn_result_guesses / Pgp.PASSWORD_GUESSES_PER_SECOND;
      for (let word of Pgp.PASSWORD_CRACK_TIME_WORDS) {
        let readable_time = Pgp.internal.readable_crack_time(time_to_crack);
        // looks for a word match from readable_crack_time, defaults on "weak"
        if (Value.is(word.match).in(readable_time)) {
          return {word, seconds: Math.round(time_to_crack), time: readable_time};
        }
      }
      Catch.report('estimate_strength: got to end without any result');
      throw Error('(thrown) estimate_strength: got to end without any result');
    },
    weak_words: () => [
      'crypt', 'up', 'cryptup', 'flow', 'flowcrypt', 'encryption', 'pgp', 'email', 'set', 'backup', 'passphrase', 'best', 'pass', 'phrases', 'are', 'long', 'and', 'have', 'several',
      'words', 'in', 'them', 'Best pass phrases are long', 'have several words', 'in them', 'bestpassphrasesarelong', 'haveseveralwords', 'inthem',
      'Loss of this pass phrase', 'cannot be recovered', 'Note it down', 'on a paper', 'lossofthispassphrase', 'cannotberecovered', 'noteitdown', 'onapaper',
      'setpassword', 'set password', 'set pass word', 'setpassphrase', 'set pass phrase', 'set passphrase'
    ],
    random: () => { // eg TDW6-DU5M-TANI-LJXY
      let secure_random_array = new Uint8Array(128);
      window.crypto.getRandomValues(secure_random_array);
      return btoa(Str.from_uint8(secure_random_array)).toUpperCase().replace(/[^A-Z0-9]|0|O|1/g, '').replace(/(.{4})/g, '$1-').substr(0, 19);
    },
  };

  public static internal = {
    crypto_armor_block_object: (type: MessageBlockType, content: string, missing_end=false):MessageBlock => ({type, content, complete: !missing_end}),
    crypto_armor_detect_block_next: (original_text: string, start_at: number) => {
      let result = {found: [] as MessageBlock[], continue_at: null as number|null};
      let begin = original_text.indexOf(Pgp.armor.headers('null').begin, start_at);
      if (begin !== -1) { // found
        let potential_begin_header = original_text.substr(begin, Pgp.ARMOR_HEADER_MAX_LENGTH);
        for (let _type of Object.keys(Pgp.ARMOR_HEADER_DICT)) {
          let type = _type as ReplaceableMessageBlockType;
          let block_header_def = Pgp.ARMOR_HEADER_DICT[type];
          if (block_header_def.replace) {
            let index_of_confirmed_begin = potential_begin_header.indexOf(block_header_def.begin);
            if (index_of_confirmed_begin === 0 || (type === 'password_message' && index_of_confirmed_begin >= 0 && index_of_confirmed_begin < 15)) { // identified beginning of a specific block
              if (begin > start_at) {
                let potential_text_before_block_begun = original_text.substring(start_at, begin).trim();
                if (potential_text_before_block_begun) {
                  result.found.push(Pgp.internal.crypto_armor_block_object('text', potential_text_before_block_begun));
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
                  result.found.push(Pgp.internal.crypto_armor_block_object(type, original_text.substring(begin, end_index + found_block_end_header_length).trim()));
                } else {
                  let pm_full_text = original_text.substring(begin, end_index + found_block_end_header_length).trim();
                  let pm_short_id_match = pm_full_text.match(/[a-zA-Z0-9]{10}$/);
                  if (pm_short_id_match) {
                    result.found.push(Pgp.internal.crypto_armor_block_object(type, pm_short_id_match[0]));
                  } else {
                    result.found.push(Pgp.internal.crypto_armor_block_object('text', pm_full_text));
                  }
                }
                result.continue_at = end_index + found_block_end_header_length;
              } else { // corresponding end not found
                result.found.push(Pgp.internal.crypto_armor_block_object(type, original_text.substr(begin), true));
              }
              break;
            }
          }
        }
      }
      if (original_text && !result.found.length) { // didn't find any blocks, but input is non-empty
        let potential_text = original_text.substr(start_at).trim();
        if (potential_text) {
          result.found.push(Pgp.internal.crypto_armor_block_object('text', potential_text));
        }
      }
      return result;
    },
    crypto_hash_sha256_loop: (string: string, times=100000) => {
      for (let i = 0; i < times; i++) {
        string = Pgp.hash.sha256(string);
      }
      return string;
    },
    crypto_key_ids: (armored_pubkey: string) => openpgp.key.readArmored(armored_pubkey).keys[0].getKeyIds(),
    crypto_message_prepare_for_decrypt: (data: string|Uint8Array): {is_armored: boolean, is_cleartext: false, message: OpenPGP.message.Message}|{is_armored: boolean, is_cleartext: true, message: OpenPGP.cleartext.CleartextMessage} => {
      let first_100_bytes = Str.from_uint8(data.slice(0, 100));
      let is_armored_encrypted = Value.is(Pgp.armor.headers('message').begin).in(first_100_bytes);
      let is_armored_signed_only = Value.is(Pgp.armor.headers('signed_message').begin).in(first_100_bytes);
      let is_armored = is_armored_encrypted || is_armored_signed_only;
      if (is_armored_encrypted) {
        return {is_armored, is_cleartext: false, message: openpgp.message.readArmored(Str.from_uint8(data))};
      } else if (is_armored_signed_only) {
        return {is_armored, is_cleartext: true, message: openpgp.cleartext.readArmored(Str.from_uint8(data))};
      } else {
        return {is_armored, is_cleartext: false, message: openpgp.message.read(Str.to_uint8(data))};
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
        prv_for_decrypt_decrypted: [],
        prv_for_decrypt_without_passphrases: [],
      };
      keys.encrypted_for = (message instanceof openpgp.message.Message ? (message as OpenPGP.message.Message).getEncryptionKeyIds() : []).map(id => Pgp.key.longid(id.bytes)).filter(Boolean) as string[];
      keys.signed_by = (message.getSigningKeyIds ? message.getSigningKeyIds() : []).filter(Boolean).map(id => Pgp.key.longid((id as any).bytes)).filter(Boolean) as string[];
      let private_keys_all = await Store.keys_get(account_email);
      keys.prv_matching = private_keys_all.filter(ki => Value.is(ki.longid).in(keys.encrypted_for));
      if (keys.prv_matching.length) {
        keys.prv_for_decrypt = keys.prv_matching;
      } else {
        keys.prv_for_decrypt = private_keys_all;
      }
      let passphrases = (await Promise.all(keys.prv_for_decrypt.map(ki => Store.passphrase_get(account_email, ki.longid))));
      let passphrases_filtered = passphrases.filter(pp => pp !== null) as string[];
      for (let prv_for_decrypt of keys.prv_for_decrypt) {
        let key = openpgp.key.readArmored(prv_for_decrypt.private).keys[0];
        if (key.isDecrypted() || (passphrases_filtered.length && await Pgp.key.decrypt(key, passphrases_filtered) === true)) {
          prv_for_decrypt.decrypted = key;
          keys.prv_for_decrypt_decrypted.push(prv_for_decrypt);
        } else {
          keys.prv_for_decrypt_without_passphrases.push(prv_for_decrypt);
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
      if (Value.is(e).in(['Cannot read property \'isDecrypted\' of null', 'privateKeyPacket is null', 'TypeprivateKeyPacket is null', 'Session key decryption failed.', 'Invalid session key for decryption.']) && !message_password) {
        return {type: DecryptErrorTypes.key_mismatch, error: e};
      } else if (message_password && Value.is(e).in(['Invalid enum value.', 'CFB decrypt: invalid key', 'Session key decryption failed.'])) {
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
  };

}

class Catch {

  private static RUNTIME: Dict<string> = {};
  private static ORIGINAL_ON_ERROR = window.onerror;

  public static handle_error = (error_message: string|undefined, url: string, line: number, col: number, error: string|Error|Dict<Serializable>, is_manually_called: boolean, version: string, env: string) => {
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
    if (error instanceof Error && ignored_errors.indexOf(error.message) !== -1) {
      return true;
    }
    if (error instanceof Error && error.stack) {
      console.log('%c[' + error_message + ']\n' + error.stack, 'color: #F00; font-weight: bold;');
    } else {
      console.error(error);
      console.log('%c' + error_message, 'color: #F00; font-weight: bold;');
    }
    if (is_manually_called !== true && Catch.ORIGINAL_ON_ERROR && Catch.ORIGINAL_ON_ERROR !== (Catch.handle_error as ErrorEventHandler)) {
      Catch.ORIGINAL_ON_ERROR.apply(null, arguments); // Call any previously assigned handler
    }
    if (error instanceof Error && (error.stack || '').indexOf('PRIVATE') !== -1) {
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
          version: version || Catch.version() || 'unknown',
          environment: env || Catch.environment(),
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
        }).catch(console.error);
      }
    } catch (storage_err) {
      console.log('failed to locally log error "' + String(error_message) + '" because: ' + storage_err.message);
    }
    return true;
  }

  public static handle_exception = (exception: any) => {
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
    Catch.RUNTIME = Catch.RUNTIME || {};
    Catch.handle_error(exception.message, window.location.href, line, col, exception, true, Catch.RUNTIME.version, Catch.RUNTIME.environment);
  }

  public static report = (name: string, details:Error|Serializable|StandardError|PromiseRejectionEvent=undefined) => {
    try {
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(name);
    } catch (e) {
      if (typeof details !== 'string') {
        try {
          details = JSON.stringify(details);
        } catch (stringify_error) {
          details = '(could not stringify details "' + String(details) + '" in Catch.report because: ' + stringify_error.message + ')';
        }
      }
      e.stack = e.stack + '\n\n\ndetails: ' + details;
      Catch.handle_exception(e);
    }
  }

  public static log = (name: string, details:Serializable|Error|Dict<Serializable>=undefined) => {
    name = 'Catch.log: ' + name;
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
          details = '(could not stringify details "' + String(details) + '" in Catch.log because: ' + stringify_error.message + ')';
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
        }).catch(console.error);
      } catch (storage_err) {
        console.log('failed to locally log info "' + String(name) + '" because: ' + storage_err.message);
      }
    }
  }

  public static version = (format='original') => {
    if (format === 'int') {
      return Catch.RUNTIME.version ? Number(Catch.RUNTIME.version.replace(/\./g, '')) : null;
    } else {
      return Catch.RUNTIME.version || null;
    }
  }

  public static try = (code: Function) => () => { // tslint:disable-line:ban-types // returns a function
    try {
      let r = code();
      if (r && typeof r === 'object' && typeof r.then === 'function' && typeof r.catch === 'function') { // a promise - async catching
        r.catch(Catch.rejection);
      }
    } catch (code_err) {
      Catch.handle_exception(code_err);
    }
  }

  public static environment = (url=window.location.href): string => {
    let browser_name = Env.browser().name;
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
  }

  public static test = () => {
    // @ts-ignore - intentional exception
    this_will_fail();
  }

  public static promise_error_alert = (note: string) => (error: Error) => { // returns a function
    console.log(error);
    alert(note);
  }

  public static stack_trace = (): string => {
    try {
      Catch.test();
    } catch (e) {
      return e.stack.split('\n').splice(3).join('\n'); // return stack after removing first 3 lines
    }
    return ''; // make ts happy - this will never happen
  }

  public static rejection = (e: PromiseRejectionEvent|StandardError|Error) => {
    if(!(e instanceof UnreportableError)) {
      if (e && typeof e === 'object' && e.hasOwnProperty('reason') && typeof (e as PromiseRejectionEvent).reason === 'object' && (e as PromiseRejectionEvent).reason && (e as PromiseRejectionEvent).reason.message) {
        Catch.handle_exception((e as PromiseRejectionEvent).reason); // actual exception that happened in Promise, unhandled
      } else if (!Value.is(JSON.stringify(e)).in(['{"isTrusted":false}', '{"isTrusted":true}'])) {  // unrelated to FlowCrypt, has to do with JS-initiated clicks/events
        if (typeof e === 'object' && typeof (e as StandardError).stack === 'string' && (e as StandardError).stack) { // thrown object that has a stack attached
          let stack = (e as StandardError).stack;
          delete (e as StandardError).stack;
          Catch.report('unhandled_promise_reject_object with stack', `${JSON.stringify(e)}\n\n${stack}`);
        } else {
          Catch.report('unhandled_promise_reject_object', e); // some x that was called with reject(x) and later not handled
        }
      }
    }
  }

  public static set_interval = (cb: () => void, ms: number): number => {
    return window.setInterval(Catch.try(cb), ms); // error-handled: else setInterval will silently swallow errors
  }

  public static set_timeout = (cb: () => void, ms: number): number => {
    return window.setTimeout(Catch.try(cb), ms); // error-handled: else setTimeout will silently swallow errors
  }

  public static initialize = () => {
    let figure_out_flowcrypt_runtime = () => {
      if ((window as FcWindow).is_bare_engine !== true) {
        try {
          Catch.RUNTIME.version = chrome.runtime.getManifest().version;
        } catch (err) {} // tslint:disable-line:no-empty
        Catch.RUNTIME.environment = Catch.environment();
        if (!Env.is_background_script() && Env.is_extension()) {
          BrowserMsg.send_await(null, 'runtime', null).then(extension_runtime => {
            if (typeof extension_runtime !== 'undefined') {
              Catch.RUNTIME = extension_runtime;
            } else {
              Catch.set_timeout(figure_out_flowcrypt_runtime, 200);
            }
          }).catch(Catch.rejection);
        }
      }
    };
    figure_out_flowcrypt_runtime();
    (window as FcWindow).onerror = (Catch.handle_error as ErrorEventHandler);
    (window as FcWindow).onunhandledrejection = Catch.rejection;
  }

}

class Value {

  public static arr = {
    unique: <T extends FlatTypes>(array: T[]): T[] => {
      let unique: T[] = [];
      for (let v of array) {
        if (!Value.is(v).in(unique)) {
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
    average: (arr: number[]) => Value.arr.sum(arr) / arr.length,
    zeroes: (length: number): number[] => new Array(length).map(() => 0),
  };

  public static obj = {
    key_by_value: <T>(obj: Dict<T>, v: T) => {
      for (let k of Object.keys(obj)) {
        if (obj[k] === v) {
          return k;
        }
      }
    },
  };

  public static int = {
    random: (min_value: number, max_value: number) => min_value + Math.round(Math.random() * (max_value - min_value)),
    get_future_timestamp_in_months: (months_to_add: number) => new Date().getTime() + 1000 * 3600 * 24 * 30 * months_to_add,
    hours_as_miliseconds: (h: number) =>  h * 1000 * 60 * 60,
  };

  public static noop = (): void => undefined;

  public static is = (v: FlatTypes) => ({in: (array_or_str: FlatTypes[]|string): boolean => Value.arr.contains(array_or_str, v)});  // Value.this(v).in(array_or_string)

}

(( /* EXTENSIONS AND CONFIG */ ) => {

  if (typeof openpgp === 'object' && openpgp && typeof openpgp.config === 'object') {
    openpgp.config.versionstring = `FlowCrypt ${Catch.version() || ''} Gmail Encryption`;
    openpgp.config.commentstring = 'Seamlessly send and receive encrypted email';
    // openpgp.config.require_uid_self_cert = false;
  }

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

Catch.initialize();
