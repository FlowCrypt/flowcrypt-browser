/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from './storage.js';
import { Catch, Value, Str, Attachment, Env, BrowserMsg, Mime, Ui } from './common.js';
import * as t from '../../types/common';
import { Pgp } from './pgp.js';

declare const openpgp: typeof OpenPGP;

export type ProgressCallback = (percent: number|null, loaded: number|null, total: number|null) => void;
export type ProgressCallbacks = {upload?: ProgressCallback|null, download?: ProgressCallback|null};
export type GmailResponseFormat = 'raw'|'full'|'metadata';
export type ProviderContactsQuery = {substring: string};

type RequestFormat = 'JSON'|'FORM';
type ResponseFormat = 'json';
type RequestMethod = 'POST'|'GET'|'DELETE'|'PUT';
type ProviderContactsResults = {new: t.Contact[], all: t.Contact[]};

export namespace R { // responses

  export type FcHelpFeedback = {sent: boolean};
  export type FcAccountLogin = {registered: boolean, verified: boolean, subscription: t.SubscriptionInfo};
  export type FcAccountUpdate$result = {alias: string, email: string, intro: string, name: string, photo: string, default_message_expire: number};
  export type FcAccountUpdate = {result: FcAccountUpdate$result, updated: boolean};
  export type FcAccountSubscribe = {subscription: t.SubscriptionInfo};
  export type FcAccountCheck = {email: string|null, subscription: {level: t.SubscriptionLevel, expire: string, expired: boolean, method: t.PaymentMethod|null}|null};

  export type FcMessagePresignFiles = {approvals: {base_url: string, fields: {key: string}}[]};
  export type FcMessageConfirmFiles = {confirmed: string[], admin_codes: string[]};
  export type FcMessageToken = {token: string};
  export type FcMessageUpload = {short: string, admin_code: string};
  export type FcLinkMessage = {expire: string, deleted: boolean, url: string, expired: boolean};
  export type FcLinkMe$profile = {alias: string|null, name: string|null, photo: string|null, photo_circle: boolean, intro: string|null, web: string|null,
    phone: string|null, token: string|null, subscription_level: string|null, subscription_method: string|null, email: string|null};
  export type FcLinkMe = {profile: null|FcLinkMe$profile};
  export type ApirFcMessageExpiration = {updated: boolean};

  export type AttInitialConfirm = {attested: boolean};
  export type AttReplaceRequest = {saved: boolean};
  export type AttReplaceConfirm = {attested: boolean};
  export type AttTestWelcome = {sent: boolean};
  export type AttInitialLegacySugmit = {attested: boolean, saved: boolean};

  export type GmailUsersMeProfile = {emailAddress: string, historyId: string, messagesTotal: number, threadsTotal: string};
  export type GmailMessage$header = {name: string, value: string};
  export type GmailMessage$payload$body = {attachmentId: string, size: number, data?: string};
  export type GmailMessage$payload$part = {body?: GmailMessage$payload$body, filename?: string, mimeType?: string, headers?: GmailMessage$header[]};
  export type GmailMessage$payload = {parts?: GmailMessage$payload$part[], headers?: GmailMessage$header[], mimeType?: string, body?: GmailMessage$payload$body};
  export type GmailMessage$labelId = 'INBOX' | 'UNREAD' | 'CATEGORY_PERSONAL' | 'IMPORTANT' | 'SENT' | 'CATEGORY_UPDATES';
  export type GmailMessage = {id: string, historyId: string, threadId?: string|null, payload: GmailMessage$payload, raw?: string, internalDate?: number|string, labelIds: GmailMessage$labelId[],
    snippet?: string};
  export type GmailMessageList$message = {id: string, threadId: string};
  export type GmailMessageList = {messages?: GmailMessageList$message[], resultSizeEstimate: number};
  export type GmailLabels$label = {id: string, name: string, messageListVisibility: 'show'|'hide', labelListVisibility: 'labelShow'|'labelHide', type: 'user'|'system',
    messagesTotal?: number, messagesUnread?: number, threadsTotal?: number, threadsUnread?: number, color?: {textColor: string, backgroundColor: string}};
  export type GmailLabels = {labels: GmailLabels$label[]};
  export type GmailAttachment = {attachmentId: string, size: number, data: string};
  export type GmailMessageSend = {id: string};
  export type GmailThreadGet = {id: string, historyId: string, messages: GmailMessage[]};
  export type GmailThreadList = {threads: {historyId: string, id: string, snippet: string}[], nextPageToken: string, resultSizeEstimate: number};
  export type GmailDraftCreate = {id: string};
  export type GmailDraftDelete = {};
  export type GmailDraftUpdate = {};
  export type GmailDraftGet = {id: string, message: GmailMessage};
  export type GmailDraftSend = {};

  export type GooglePlusPeopleMe = {displayName: string, language: string, image: {url: string}};

}

export class Api {

  private static GMAIL_USELESS_CONTACTS_FILTER = '-to:txt.voice.google.com -to:reply.craigslist.org -to:sale.craigslist.org -to:hous.craigslist.org';
  private static GMAIL_SCOPE_DICT: t.Dict<string> = {read: 'https://www.googleapis.com/auth/gmail.readonly', compose: 'https://www.googleapis.com/auth/gmail.compose'};
  private static GOOGLE_OAUTH2 = typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest ? (chrome.runtime.getManifest() as t.FlowCryptManifest).oauth2 : null;
  public static GMAIL_RECOVERY_EMAIL_SUBJECTS = ['Your FlowCrypt Backup', 'Your CryptUp Backup', 'All you need to know about CryptUP (contains a backup)', 'CryptUP Account Backup'];

  public static auth = {
    window: (auth_url: string, window_closed_by_user: t.Callback) => {
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
    is_network_error: (e: t.Thrown) => {
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
    is_auth_error: (e: t.Thrown) => {
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
    is_standard_error: (e: t.Thrown, internal_type: string) => {
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
    is_auth_popup_needed: (e: t.Thrown) => {
      if (e && typeof e === 'object' && e.status === 400 && typeof e.responseJSON === 'object') {
        if (e.responseJSON.error === 'invalid_grant' && Value.is(e.responseJSON.error_description).in(['Bad Request', "Token has been expired or revoked."])) {
          return true;
        }
      }
      return false;
    },
    is_not_found: (e: t.Thrown): boolean => e && typeof e === 'object' && e.readyState === 4 && e.status === 404, // $.ajax rejection
    is_bad_request: (e: t.Thrown): boolean => e && typeof e === 'object' && e.readyState === 4 && e.status === 400, // $.ajax rejection
    is_server_error: (e: t.Thrown): boolean => e && typeof e === 'object' && e.readyState === 4 && e.status >= 500, // $.ajax rejection
  };

  public static google = {
    plus: {
      people_me: (account_email: string): Promise<R.GooglePlusPeopleMe> => Api.internal.api_google_call(account_email, 'GET', 'https://www.googleapis.com/plus/v1/people/me', {alt: 'json'}),
    },
    auth_popup: (account_email: string|null, tab_id: string, omit_read_scope=false, scopes:string[]=[]): Promise<t.AuthResult> => new Promise((resolve, reject) => {
      if (Env.is_background_page()) {
        throw {code: null, message: 'Cannot produce auth window from background script'};
      }
      let response_handled = false;
      Api.internal.api_google_auth_popup_prepare_auth_request_scopes(account_email, scopes, omit_read_scope).then(scopes => {
        let auth_request: t.AuthRequest = {tab_id, account_email, auth_responder_id: Str.random(20), scopes};
        BrowserMsg.listen({
          google_auth_window_result: (result: t.GoogleAuthWindowResult, sender: chrome.runtime.MessageSender, close_auth_window: VoidCallback) => {
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
    message: async (account_email: string, from:string='', to:string|string[]=[], subject:string='', body: t.SendableMessageBody, attachments:Attachment[]=[], thread_referrence:string|null=null): Promise<t.SendableMessage> => {
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
    users_me_profile: async (account_email: string|null, access_token?: string): Promise<R.GmailUsersMeProfile> => {
      let url = 'https://www.googleapis.com/gmail/v1/users/me/profile';
      if(account_email && !access_token) {
        return await Api.internal.api_google_call(account_email, 'GET', url, {});
      } else if (!account_email && access_token) {
        return await $.ajax({url, method: 'GET', headers: {'Authorization': `Bearer ${access_token}`}, crossDomain: true, contentType: 'application/json; charset=UTF-8', async: true});
      } else {
        throw new Error('Api.gmail.users_me_profile: need either account_email or access_token');
      }
    },
    thread_get: (account_email: string, thread_id: string, format: GmailResponseFormat|null): Promise<R.GmailThreadGet> => Api.internal.api_gmail_call(account_email, 'GET', `threads/${thread_id}`, {
      format,
    }),
    thread_list: (account_email: string, label_id: string): Promise<R.GmailThreadList> => Api.internal.api_gmail_call(account_email, 'GET', `threads`, {
      labelIds: label_id !== 'ALL' ? label_id : undefined,
      includeSpamTrash: Boolean(label_id === 'SPAM' || label_id === 'TRASH'),
      // pageToken: page_token,
      // q,
      // maxResults
    }),
    thread_modify: (account_email: string, id: string, remove_label_ids: string[], add_label_ids: string[]): Promise<R.GmailThreadGet> => Api.internal.api_gmail_call(account_email, 'POST', `threads/${id}/modify`, {
      removeLabelIds: remove_label_ids || [], // todo - insufficient permission - need https://github.com/FlowCrypt/flowcrypt-browser/issues/1304
      addLabelIds: add_label_ids || [],
    }),
    draft_create: (account_email: string, mime_message: string, thread_id: string): Promise<R.GmailDraftCreate> => Api.internal.api_gmail_call(account_email, 'POST', 'drafts', {
      message: {
        raw: Str.base64url_encode(mime_message),
        threadId: thread_id || null,
      },
    }),
    draft_delete: (account_email: string, id: string): Promise<R.GmailDraftDelete> => Api.internal.api_gmail_call(account_email, 'DELETE', 'drafts/' + id, null),
    draft_update: (account_email: string, id: string, mime_message: string): Promise<R.GmailDraftUpdate> => Api.internal.api_gmail_call(account_email, 'PUT', `drafts/${id}`, {
      message: {
        raw: Str.base64url_encode(mime_message),
      },
    }),
    draft_get: (account_email: string, id: string, format:GmailResponseFormat='full'): Promise<R.GmailDraftGet> => Api.internal.api_gmail_call(account_email, 'GET', `drafts/${id}`, {
      format,
    }),
    draft_send: (account_email: string, id: string): Promise<R.GmailDraftSend> => Api.internal.api_gmail_call(account_email, 'POST', 'drafts/send', {
      id,
    }),
    message_send: async (account_email: string, message: t.SendableMessage, progress_callback?: ProgressCallback): Promise<R.GmailMessageSend> => {
      message.headers.From = message.from;
      message.headers.To = message.to.join(',');
      message.headers.Subject = message.subject;
      let mime_message = await Mime.encode(message.body, message.headers, message.attachments);
      let request = Api.internal.encode_as_multipart_related({ 'application/json; charset=UTF-8': JSON.stringify({threadId: message.thread}), 'message/rfc822': mime_message });
      return Api.internal.api_gmail_call(account_email, 'POST', 'messages/send', request.body, {upload: progress_callback || Value.noop}, request.content_type);
    },
    message_list: (account_email: string, q: string, include_deleted:boolean=false): Promise<R.GmailMessageList> => Api.internal.api_gmail_call(account_email, 'GET', 'messages', {
      q,
      includeSpamTrash: include_deleted,
    }),
    message_get: (account_email: string, message_id: string, format: GmailResponseFormat): Promise<R.GmailMessage> => Api.internal.api_gmail_call(account_email, 'GET', `messages/${message_id}`, {
      format: format || 'full',
    }),
    messages_get: (account_email: string, message_ids: string[], format: GmailResponseFormat): Promise<R.GmailMessage[]> => {
      return Promise.all(message_ids.map(id => Api.gmail.message_get(account_email, id, format)));
    },
    labels_get: (account_email: string): Promise<R.GmailLabels> => Api.internal.api_gmail_call(account_email, 'GET', `labels`, {}),
    attachment_get: async (account_email: string, message_id: string, attachment_id: string, progress_callback:ProgressCallback|null=null): Promise<R.GmailAttachment> => {
      let r: R.GmailAttachment = await Api.internal.api_gmail_call(account_email, 'GET', `messages/${message_id}/attachments/${attachment_id}`, {}, {download: progress_callback});
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
    find_header: (api_gmail_message_object: R.GmailMessage|R.GmailMessage$payload, header_name: string) => {
      let node: R.GmailMessage$payload = api_gmail_message_object.hasOwnProperty('payload') ? (api_gmail_message_object as R.GmailMessage).payload : api_gmail_message_object as R.GmailMessage$payload;
      if (typeof node.headers !== 'undefined') {
        for (let header of node.headers) {
          if (header.name.toLowerCase() === header_name.toLowerCase()) {
            return header.value;
          }
        }
      }
      return null;
    },
    find_attachments: (message_or_payload_or_part: R.GmailMessage|R.GmailMessage$payload|R.GmailMessage$payload$part, internal_results:Attachment[]=[], internal_message_id:string|null=null) => {
      if (message_or_payload_or_part.hasOwnProperty('payload')) {
        internal_message_id = (message_or_payload_or_part as R.GmailMessage).id;
        Api.gmail.find_attachments((message_or_payload_or_part as R.GmailMessage).payload, internal_results, internal_message_id);
      }
      if (message_or_payload_or_part.hasOwnProperty('parts')) {
        for (let part of (message_or_payload_or_part as R.GmailMessage$payload).parts!) {
          Api.gmail.find_attachments(part, internal_results, internal_message_id);
        }
      }
      if (message_or_payload_or_part.hasOwnProperty('body') && (message_or_payload_or_part as R.GmailMessage$payload$part).body!.hasOwnProperty('attachmentId')) {
        internal_results.push(new Attachment({
          message_id: internal_message_id,
          id: (message_or_payload_or_part as R.GmailMessage$payload$part).body!.attachmentId,
          length: (message_or_payload_or_part as R.GmailMessage$payload$part).body!.size,
          name: (message_or_payload_or_part as R.GmailMessage$payload$part).filename,
          type: (message_or_payload_or_part as R.GmailMessage$payload$part).mimeType,
          inline: (Api.gmail.find_header(message_or_payload_or_part, 'content-disposition') || '').toLowerCase().indexOf('inline') === 0,
        }));
      }
      return internal_results;
    },
    find_bodies: (gmail_email_object: t.Dict<any>, internal_results:t.Dict<any>={}): t.SendableMessageBody => {
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
      return internal_results as t.SendableMessageBody;
    },
    fetch_attachments: async (account_email: string, attachments: Attachment[]) => {
      let responses = await Promise.all(attachments.map(a => Api.gmail.attachment_get(account_email, a.message_id!, a.id!)));
      for (let i of responses.keys()) {
        attachments[i].set_data(responses[i].data);
      }
    },
    search_contacts: async (account_email: string, user_query: string, known_contacts: t.Contact[], chunked_callback: (r: ProviderContactsResults) => void) => { // This will keep triggering callback with new emails as they are being discovered
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
    extract_armored_block: async (account_email: string, message_id: string, format: GmailResponseFormat): Promise<string> => {
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
    lookup_email: (emails: string[]): Promise<{results: t.PubkeySearchResult[]}> => Api.internal.api_attester_call('lookup/email', {
      email: emails.map(e => Str.parse_email(e).email),
    }),
    initial_legacy_submit: (email: string, pubkey: string, attest:boolean=false): Promise<R.AttInitialLegacySugmit> => Api.internal.api_attester_call('initial/legacy_submit', {
      email: Str.parse_email(email).email,
      pubkey: pubkey.trim(),
      attest,
    }),
    initial_confirm: (signed_attest_packet: string): Promise<R.AttInitialConfirm> => Api.internal.api_attester_call('initial/confirm', {
      signed_message: signed_attest_packet,
    }),
    replace_request: (email: string, signed_attest_packet: string, new_pubkey: string): Promise<R.AttReplaceRequest> => Api.internal.api_attester_call('replace/request', {
      signed_message: signed_attest_packet,
      new_pubkey,
      email,
    }),
    replace_confirm: (signed_attest_packet: string): Promise<R.AttReplaceConfirm> => Api.internal.api_attester_call('replace/confirm', {
      signed_message: signed_attest_packet,
    }),
    test_welcome: (email: string, pubkey: string): Promise<R.AttTestWelcome> => Api.internal.api_attester_call('test/welcome', {
      email,
      pubkey,
    }),
    diagnose_keyserver_pubkeys: async (account_email: string) => {
      let diagnosis = { has_pubkey_missing: false, has_pubkey_mismatch: false, results: {} as t.Dict<{attested: boolean, pubkey: string|null, match: boolean}> };
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
      create_sign: async (values: t.Dict<string>, decrypted_prv: OpenPGP.key.Key) => {
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
      parse: (text: string): t.ParsedAttest => {
        let accepted_values = {
          'ACT': 'action',
          'ATT': 'attester',
          'ADD': 'email_hash',
          'PUB': 'fingerprint',
          'OLD': 'fingerprint_old',
          'RAN': 'random',
        } as t.Dict<string>;
        let result: t.ParsedAttest = {
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
      } as t.Dict<string>)[type];
    },
    help_feedback: (account_email: string, message: string): Promise<R.FcHelpFeedback> => Api.internal.api_fc_call('help/feedback', {
      email: account_email,
      message,
    }),
    help_uninstall: (email: string, client: string) => Api.internal.api_fc_call('help/uninstall', {
      email,
      client,
      metrics: null,
    }),
    account_login: async (account_email: string, token:string|null=null): Promise<{verified: boolean, subscription: t.SubscriptionInfo}> => {
      let auth_info = await Store.auth_info();
      let uuid = auth_info.uuid || Pgp.hash.sha1(Str.random(40));
      let account = auth_info.account_email || account_email;
      let response: R.FcAccountLogin = await Api.internal.api_fc_call('account/login', {
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
    }) as Promise<R.FcAccountCheck>,
    account_check_sync: async () => { // callbacks true on updated, false not updated, null for could not fetch
      let emails = await Store.account_emails_get();
      if (emails.length) {
        let response = await Api.fc.account_check(emails);
        let auth_info = await Store.auth_info();
        let subscription = await Store.subscription();
        let local_storage_update: t.GlobalStore = {};
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
    account_update: async (update_values?: t.Dict<t.Serializable>): Promise<R.FcAccountUpdate> => {
      let auth_info = await Store.auth_info();
      let request = {account: auth_info.account_email, uuid: auth_info.uuid} as t.Dict<t.Serializable>;
      if (update_values) {
        for (let k of Object.keys(update_values)) {
          request[k] = update_values[k];
        }
      }
      return await Api.internal.api_fc_call('account/update', request);
    },
    account_subscribe: async (product: string, method: string, payment_source_token:string|null=null): Promise<R.FcAccountSubscribe> => {
      let auth_info = await Store.auth_info();
      let response: R.FcAccountSubscribe = await Api.internal.api_fc_call('account/subscribe', {
        account: auth_info.account_email,
        uuid: auth_info.uuid,
        method,
        source: payment_source_token,
        product,
      });
      await Store.set(null, { cryptup_account_subscription: response.subscription });
      return response;
    },
    message_presign_files: async (attachments: Attachment[], auth_method: t.FlowCryptApiAuthMethods): Promise<R.FcMessagePresignFiles> => {
      let response: R.FcMessagePresignFiles;
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
    message_confirm_files: (identifiers: string[]): Promise<R.FcMessageConfirmFiles> => Api.internal.api_fc_call('message/confirm_files', {
      identifiers,
    }),
    message_upload: async (encrypted_data_armored: string, auth_method: t.FlowCryptApiAuthMethods): Promise<R.FcMessageUpload> => { // todo - DEPRECATE THIS. Send as JSON to message/store
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
    message_token: async (): Promise<R.FcMessageToken> => {
      let auth_info = await Store.auth_info();
      return await Api.internal.api_fc_call('message/token', {account: auth_info.account_email, uuid: auth_info.uuid});
    },
    message_expiration: async (admin_codes: string[], add_days:null|number=null): Promise<R.ApirFcMessageExpiration> => {
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
    message_contact: (sender: string, message: string, message_token: t.FlowCryptApiAuthToken) => Api.internal.api_fc_call('message/contact', {
      message_token_account: message_token.account,
      message_token: message_token.token,
      sender,
      message,
    }),
    link_message: (short: string): Promise<R.FcLinkMessage> => Api.internal.api_fc_call('link/message', {
      short,
    }),
    link_me: (alias: string): Promise<R.FcLinkMe> => Api.internal.api_fc_call('link/me', {
      alias,
    }),
  };

  public static aws = {
    s3_upload: (items: {base_url:string, fields: t.Dict<t.Serializable|Attachment>, attachment: Attachment}[], progress_callback: ProgressCallback) => {
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
    get_ajax_progress_xhr: (progress_callbacks: ProgressCallbacks|null) => {
      let progress_reporting_xhr = new (window as t.FcWindow).XMLHttpRequest();
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
    api_call: async (base_url: string, path: string, fields: t.Dict<any>, format: RequestFormat, progress: ProgressCallbacks|null, headers:t.FlatHeaders|undefined=undefined, response_format:ResponseFormat='json', method:RequestMethod='POST') => {
      progress = progress || {} as ProgressCallbacks;
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
          throw response as t.StandardError;
        }
        return response;
      } catch(e) {
        if(e && typeof e === 'object' && e.readyState === 4) {
          e.url = request.url; // for debugging
        }
        throw e;
      }
    },
    api_google_auth_state_pack: (status_object: t.AuthRequest) => Api.GOOGLE_OAUTH2!.state_header + JSON.stringify(status_object),
    api_google_auth_code_url: (auth_request: t.AuthRequest) => Env.url_create(Api.GOOGLE_OAUTH2!.url_code, {
      client_id: Api.GOOGLE_OAUTH2!.client_id,
      response_type: 'code',
      access_type: 'offline',
      state: Api.internal.api_google_auth_state_pack(auth_request),
      redirect_uri: Api.GOOGLE_OAUTH2!.url_redirect,
      scope: (auth_request.scopes || []).join(' '),
      login_hint: auth_request.account_email,
    }),
    google_auth_save_tokens: async (account_email: string, tokens_object: t.GoogleAuthTokensResponse, scopes: string[]) => {
      let to_save: t.AccountStore = {
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
    }) as any as Promise<t.GoogleAuthTokensResponse>,
    google_auth_refresh_token: (refresh_token: string) => $.ajax({
      url: Env.url_create(Api.GOOGLE_OAUTH2!.url_tokens, { grant_type: 'refresh_token', refresh_token, client_id: Api.GOOGLE_OAUTH2!.client_id }),
      method: 'POST',
      crossDomain: true,
      async: true,
    }) as any as Promise<t.GoogleAuthTokensResponse>,
    google_auth_check_access_token: (access_token: string) => $.ajax({
      url: Env.url_create('https://www.googleapis.com/oauth2/v1/tokeninfo', { access_token }),
      crossDomain: true,
      async: true,
    }) as any as Promise<t.GoogleAuthTokenInfo>,
    google_auth_window_result_handler: async (result: t.GoogleAuthWindowResult): Promise<t.AuthResult> => {
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
    api_google_call: async (account_email: string, method: RequestMethod, url: string, parameters: t.Dict<t.Serializable>|string) => {
      let data = method === 'GET' || method === 'DELETE' ? parameters : JSON.stringify(parameters);
      let headers = { Authorization: await Api.internal.google_api_authorization_header(account_email) };
      let request = {url, method, data, headers, crossDomain: true, contentType: 'application/json; charset=UTF-8', async: true};
      return await Api.internal.api_google_call_retry_auth_error_one_time(account_email, request);
    },
    api_gmail_call: async (account_email: string, method: RequestMethod, resource: string, parameters: t.Dict<t.Serializable>|string|null, progress: ProgressCallbacks|null=null, contentType:string|null=null) => {
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
    google_api_is_auth_token_valid: (s: t.AccountStore) => s.google_token_access && (!s.google_token_expires || s.google_token_expires > new Date().getTime() + (120 * 1000)), // oauth token will be valid for another 2 min
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
    encode_as_multipart_related: (parts: t.Dict<string>) => { // todo - this could probably be achieved with emailjs-mime-builder
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
      let all_results: t.Contact[] = [];
      while(true) {
        let headers = await Api.gmail.fetch_messages_based_on_query_and_extract_first_available_header(account_email, query, ['to', 'date']);
        if (headers.to) {
          let raw_parsed_results = (window as t.BrowserWidnow)['emailjs-addressparser'].parse(headers.to);
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
    api_gmail_fetch_messages_sequentially_from_list_and_extract_first_available_header: async (account_email: string, messages: R.GmailMessageList$message[], header_names: string[]): Promise<t.FlatHeaders> => {
      for (let message of messages) {
        let header_values: t.FlatHeaders = {};
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
    api_attester_call: (path: string, values: t.Dict<any>) => Api.internal.api_call('https://attester.flowcrypt.com/', path, values, 'JSON', null, {'api-version': '3'} as t.FlatHeaders),
    api_fc_call: (path: string, values: t.Dict<any>, format='JSON' as RequestFormat) => Api.internal.api_call(Api.fc.url('api'), path, values, format, null, {'api-version': '3'} as t.FlatHeaders),
  };

}
