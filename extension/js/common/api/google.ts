/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, AuthError, ReqMethod, ProgressCbs, R, SendableMsg, ProgressCb, ChunkedCb, ProviderContactsResults } from './api.js';
import { Env, Ui } from '../browser.js';
import { Catch } from '../catch.js';
import { Store, Contact, AccountStore, Serializable } from '../store.js';
import { Dict, Value, Str } from '../common.js';
import { GoogleAuthWindowResult$result, BrowserWidnow } from '../extension.js';
import { Mime, SendableMsgBody } from '../mime.js';
import { Att } from '../att.js';
import { FormatError, Pgp } from '../pgp.js';
import { tabsQuery, windowsCreate } from './chrome.js';

type GoogleAuthTokenInfo = { issued_to: string, audience: string, scope: string, expires_in: number, access_type: 'offline' };
type GoogleAuthTokensResponse = { access_token: string, expires_in: number, refresh_token?: string };
export type AuthReq = { acctEmail: string | null, scopes: string[], messageId?: string, omitReadScope?: boolean };
export type GmailResponseFormat = 'raw' | 'full' | 'metadata';
type AuthResultSuccess = { result: 'Success', acctEmail: string, error?: undefined };
type AuthResultError = { result: GoogleAuthWindowResult$result, acctEmail: string | null, error?: string };
export type AuthRes = AuthResultSuccess | AuthResultError;

declare const openpgp: typeof OpenPGP;

export class Google extends Api {

  private static GMAIL_USELESS_CONTACTS_FILTER = '-to:txt.voice.google.com -to:reply.craigslist.org -to:sale.craigslist.org -to:hous.craigslist.org';
  public static GMAIL_RECOVERY_EMAIL_SUBJECTS = ['Your FlowCrypt Backup',
    'Your CryptUp Backup', 'All you need to know about CryptUP (contains a backup)', 'CryptUP Account Backup'];

  private static call = async (acctEmail: string, method: ReqMethod, url: string, parameters: Dict<Serializable> | string) => {
    const data = method === 'GET' || method === 'DELETE' ? parameters : JSON.stringify(parameters);
    const headers = { Authorization: await GoogleAuth.googleApiAuthHeader(acctEmail) };
    const request = { url, method, data, headers, crossDomain: true, contentType: 'application/json; charset=UTF-8', async: true };
    return await GoogleAuth.apiGoogleCallRetryAuthErrorOneTime(acctEmail, request);
  }

  public static gmailCall = async (acctEmail: string, method: ReqMethod, path: string, params: Dict<Serializable> | string | null, progress?: ProgressCbs, contentType?: string) => {
    progress = progress || {};
    let data, url;
    if (typeof progress!.upload === 'function') { // substituted with {} above
      url = 'https://www.googleapis.com/upload/gmail/v1/users/me/' + path + '?uploadType=multipart';
      data = params || undefined;
    } else {
      url = 'https://www.googleapis.com/gmail/v1/users/me/' + path;
      if (method === 'GET' || method === 'DELETE') {
        data = params || undefined;
      } else {
        data = JSON.stringify(params) || undefined;
      }
    }
    contentType = contentType || 'application/json; charset=UTF-8';
    const headers = { 'Authorization': await GoogleAuth.googleApiAuthHeader(acctEmail) };
    const xhr = () => Api.getAjaxProgressXhr(progress);
    const request = { xhr, url, method, data, headers, crossDomain: true, contentType, async: true };
    return await GoogleAuth.apiGoogleCallRetryAuthErrorOneTime(acctEmail, request);
  }

  public static google = {
    plus: {
      peopleMe: (acctEmail: string): Promise<R.GooglePlusPeopleMe> => Google.call(acctEmail, 'GET', 'https://www.googleapis.com/plus/v1/people/me', { alt: 'json' }),
    },
  };

  public static gmail = {
    buildSearchQuery: {
      or: (arr: string[], quoted: boolean = false) => {
        if (quoted) {
          return '("' + arr.join('") OR ("') + '")';
        } else {
          return '(' + arr.join(') OR (') + ')';
        }
      },
      backups: (acctEmail: string) => {
        return [
          'from:' + acctEmail,
          'to:' + acctEmail,
          '(subject:"' + Google.GMAIL_RECOVERY_EMAIL_SUBJECTS.join('" OR subject: "') + '")',
          '-is:spam',
        ].join(' ');
      },
    },
    usersMeProfile: async (acctEmail: string | null, accessToken?: string): Promise<R.GmailUsersMeProfile> => {
      const url = 'https://www.googleapis.com/gmail/v1/users/me/profile';
      if (acctEmail && !accessToken) {
        return await Google.call(acctEmail, 'GET', url, {}) as R.GmailUsersMeProfile;
      } else if (!acctEmail && accessToken) {
        const contentType = 'application/json; charset=UTF-8';
        const headers = { 'Authorization': `Bearer ${accessToken}` };
        return await Api.ajax({ url, method: 'GET', headers, crossDomain: true, contentType, async: true }, Catch.stackTrace()) as R.GmailUsersMeProfile;
      } else {
        throw new Error('Google.gmail.users_me_profile: need either account_email or access_token');
      }
    },
    threadGet: (acctEmail: string, threadId: string, format?: GmailResponseFormat): Promise<R.GmailThread> => Google.gmailCall(acctEmail, 'GET', `threads/${threadId}`, {
      format,
    }),
    threadList: (acctEmail: string, labelId: string): Promise<R.GmailThreadList> => Google.gmailCall(acctEmail, 'GET', `threads`, {
      labelIds: labelId !== 'ALL' ? labelId : undefined,
      includeSpamTrash: Boolean(labelId === 'SPAM' || labelId === 'TRASH'),
      // pageToken: page_token,
      // q,
      // maxResults
    }),
    threadModify: (acctEmail: string, id: string, rmLabels: string[], addLabels: string[]): Promise<R.GmailThread> => Google.gmailCall(acctEmail, 'POST', `threads/${id}/modify`, {
      removeLabelIds: rmLabels || [], // todo - insufficient permission - need https://github.com/FlowCrypt/flowcrypt-browser/issues/1304
      addLabelIds: addLabels || [],
    }),
    draftCreate: (acctEmail: string, mimeMsg: string, threadId: string): Promise<R.GmailDraftCreate> => Google.gmailCall(acctEmail, 'POST', 'drafts', {
      message: {
        raw: Str.base64urlEncode(mimeMsg),
        threadId: threadId || null,
      },
    }),
    draftDelete: (acctEmail: string, id: string): Promise<R.GmailDraftDelete> => Google.gmailCall(acctEmail, 'DELETE', 'drafts/' + id, null),
    draftUpdate: (acctEmail: string, id: string, mimeMsg: string): Promise<R.GmailDraftUpdate> => Google.gmailCall(acctEmail, 'PUT', `drafts/${id}`, {
      message: {
        raw: Str.base64urlEncode(mimeMsg),
      },
    }),
    draftGet: (acctEmail: string, id: string, format: GmailResponseFormat = 'full'): Promise<R.GmailDraftGet> => Google.gmailCall(acctEmail, 'GET', `drafts/${id}`, {
      format,
    }),
    draftSend: (acctEmail: string, id: string): Promise<R.GmailDraftSend> => Google.gmailCall(acctEmail, 'POST', 'drafts/send', {
      id,
    }),
    msgSend: async (acctEmail: string, message: SendableMsg, progressCb?: ProgressCb): Promise<R.GmailMsgSend> => {
      message.headers.From = message.from;
      message.headers.To = message.to.join(',');
      message.headers.Subject = message.subject;
      const mimeMsg = await Mime.encode(message.body, message.headers, message.atts);
      const request = Api.encodeAsMultipartRelated({ 'application/json; charset=UTF-8': JSON.stringify({ threadId: message.thread }), 'message/rfc822': mimeMsg });
      return Google.gmailCall(acctEmail, 'POST', 'messages/send', request.body, { upload: progressCb || Value.noop }, request.contentType);
    },
    msgList: (acctEmail: string, q: string, includeDeleted: boolean = false): Promise<R.GmailMsgList> => Google.gmailCall(acctEmail, 'GET', 'messages', {
      q,
      includeSpamTrash: includeDeleted,
    }),
    msgGet: (acctEmail: string, msgId: string, format: GmailResponseFormat): Promise<R.GmailMsg> => Google.gmailCall(acctEmail, 'GET', `messages/${msgId}`, {
      format: format || 'full',
    }),
    msgsGet: (acctEmail: string, msgIds: string[], format: GmailResponseFormat): Promise<R.GmailMsg[]> => {
      return Promise.all(msgIds.map(id => Google.gmail.msgGet(acctEmail, id, format)));
    },
    labelsGet: (acctEmail: string): Promise<R.GmailLabels> => Google.gmailCall(acctEmail, 'GET', `labels`, {}),
    attGet: async (acctEmail: string, msgId: string, attId: string, progressCb: ProgressCb | null = null): Promise<R.GmailAtt> => {
      const r = await Google.gmailCall(acctEmail, 'GET', `messages/${msgId}/attachments/${attId}`, {}, { download: progressCb }) as R.GmailAtt;
      r.data = Str.base64urlDecode(r.data);
      return r;
    },
    attGetChunk: (acctEmail: string, messageId: string, attId: string): Promise<string> => new Promise(async (resolve, reject) => {
      const minBytes = 1000;
      let processed = 0;
      const processChunkAndResolve = (chunk: string) => {
        if (!processed++) {
          // make json end guessing easier
          chunk = chunk.replace(/[\n\s\r]/g, '');
          // the response is a chunk of json that may not have ended. One of:
          // {"length":12345,"data":"kksdwei
          // {"length":12345,"data":"kksdweiooiowei
          // {"length":12345,"data":"kksdweiooiowei"
          // {"length":12345,"data":"kksdweiooiowei"}
          if (chunk[chunk.length - 1] !== '"' && chunk[chunk.length - 2] !== '"') {
            chunk += '"}'; // json end
          } else if (chunk[chunk.length - 1] !== '}') {
            chunk += '}'; // json end
          }
          let parsedJsonDataField;
          try {
            parsedJsonDataField = JSON.parse(chunk).data; // tslint:disable-line:no-unsafe-any
          } catch (e) {
            console.log(e);
            reject({ code: null, message: "Chunk response could not be parsed" });
            return;
          }
          for (let i = 0; parsedJsonDataField && i < 50; i++) {
            try {
              resolve(Str.base64urlDecode(parsedJsonDataField)); // tslint:disable-line:no-unsafe-any
              return;
            } catch (e) {
              // the chunk of data may have been cut at an inconvenient index
              // shave off up to 50 trailing characters until it can be decoded
              parsedJsonDataField = parsedJsonDataField.slice(0, -1); // tslint:disable-line:no-unsafe-any
            }
          }
          reject({ code: null, message: "Chunk response could not be decoded" });
        }
      };
      GoogleAuth.googleApiAuthHeader(acctEmail).then(authToken => {
        const r = new XMLHttpRequest();
        r.open('GET', `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attId}`, true);
        r.setRequestHeader('Authorization', authToken);
        r.send();
        let status: number;
        const responsePollInterval = Catch.setHandledInterval(() => {
          if (status >= 200 && status <= 299 && r.responseText.length >= minBytes) {
            window.clearInterval(responsePollInterval);
            processChunkAndResolve(r.responseText);
            r.abort();
          }
        }, 10);
        r.onreadystatechange = () => {
          if (r.readyState === 2 || r.readyState === 3) { // headers, loading
            status = r.status;
            if (status >= 300) {
              reject({ code: status, message: `Fail status ${status} received when downloading a chunk` });
              window.clearInterval(responsePollInterval);
              r.abort();
            }
          }
          if (r.readyState === 3 || r.readyState === 4) { // loading, done
            if (status >= 200 && status <= 299 && r.responseText.length >= minBytes) { // done as a success - resolve in case response_poll didn't catch this yet
              processChunkAndResolve(r.responseText);
              window.clearInterval(responsePollInterval);
              if (r.readyState === 3) {
                r.abort();
              }
            } else {  // done as a fail - reject
              reject({ code: null, message: 'Network connection error when downloading a chunk', internal: 'network' });
              window.clearInterval(responsePollInterval);
            }
          }
        };
      }).catch(reject);
    }),
    findHeader: (apiGmailMsgObj: R.GmailMsg | R.GmailMsg$payload, headerName: string) => {
      const node: R.GmailMsg$payload = apiGmailMsgObj.hasOwnProperty('payload') ? (apiGmailMsgObj as R.GmailMsg).payload : apiGmailMsgObj as R.GmailMsg$payload;
      if (typeof node.headers !== 'undefined') {
        for (const header of node.headers) {
          if (header.name.toLowerCase() === headerName.toLowerCase()) {
            return header.value;
          }
        }
      }
      return null;
    },
    findAtts: (msgOrPayloadOrPart: R.GmailMsg | R.GmailMsg$payload | R.GmailMsg$payload$part, internalResults: Att[] = [], internalMsgId: string | null = null) => {
      if (msgOrPayloadOrPart.hasOwnProperty('payload')) {
        internalMsgId = (msgOrPayloadOrPart as R.GmailMsg).id;
        Google.gmail.findAtts((msgOrPayloadOrPart as R.GmailMsg).payload, internalResults, internalMsgId);
      }
      if (msgOrPayloadOrPart.hasOwnProperty('parts')) {
        for (const part of (msgOrPayloadOrPart as R.GmailMsg$payload).parts!) {
          Google.gmail.findAtts(part, internalResults, internalMsgId);
        }
      }
      if (msgOrPayloadOrPart.hasOwnProperty('body') && (msgOrPayloadOrPart as R.GmailMsg$payload$part).body!.hasOwnProperty('attachmentId')) {
        internalResults.push(new Att({
          msgId: internalMsgId,
          id: (msgOrPayloadOrPart as R.GmailMsg$payload$part).body!.attachmentId,
          length: (msgOrPayloadOrPart as R.GmailMsg$payload$part).body!.size,
          name: (msgOrPayloadOrPart as R.GmailMsg$payload$part).filename,
          type: (msgOrPayloadOrPart as R.GmailMsg$payload$part).mimeType,
          inline: (Google.gmail.findHeader(msgOrPayloadOrPart, 'content-disposition') || '').toLowerCase().indexOf('inline') === 0,
        }));
      }
      return internalResults;
    },
    findBodies: (gmailMsg: R.GmailMsg | R.GmailMsg$payload | R.GmailMsg$payload$part, internalResults: SendableMsgBody = {}): SendableMsgBody => {
      const isGmailMsg = (v: any): v is R.GmailMsg => v && typeof (v as R.GmailMsg).payload !== 'undefined';
      const isGmailMsgPayload = (v: any): v is R.GmailMsg$payload => v && typeof (v as R.GmailMsg$payload).parts !== 'undefined';
      const isGmailMsgPayloadPart = (v: any): v is R.GmailMsg$payload$part => v && typeof (v as R.GmailMsg$payload$part).body !== 'undefined';
      if (isGmailMsg(gmailMsg)) {
        Google.gmail.findBodies(gmailMsg.payload, internalResults);
      }
      if (isGmailMsgPayload(gmailMsg) && gmailMsg.parts) {
        for (const part of gmailMsg.parts) {
          Google.gmail.findBodies(part, internalResults);
        }
      }
      if (isGmailMsgPayloadPart(gmailMsg) && gmailMsg.body && typeof gmailMsg.body.data !== 'undefined' && gmailMsg.body.size !== 0) {
        if (gmailMsg.mimeType) {
          internalResults[gmailMsg.mimeType] = gmailMsg.body.data;
        }
      }
      return internalResults;
    },
    fetchAtts: async (acctEmail: string, atts: Att[]) => {
      const responses = await Promise.all(atts.map(a => Google.gmail.attGet(acctEmail, a.msgId!, a.id!)));
      for (const i of responses.keys()) {
        atts[i].setData(responses[i].data);
      }
    },
    searchContacts: async (acctEmail: string, userQuery: string, knownContacts: Contact[], chunkedCb: ChunkedCb) => {
      // This will keep triggering callback with new emails as they are being discovered
      const gmailQuery = ['is:sent', Google.GMAIL_USELESS_CONTACTS_FILTER];
      if (userQuery) {
        const variationsOfTo = userQuery.split(/[ .]/g).filter(v => !Value.is(v).in(['com', 'org', 'net']));
        if (!Value.is(userQuery).in(variationsOfTo)) {
          variationsOfTo.push(userQuery);
        }
        gmailQuery.push(`(to:${variationsOfTo.join(' OR to:')})`);
      }
      const filteredContacts = knownContacts.filter(c => Str.isEmailValid(c.email));
      for (const contact of filteredContacts) {
        gmailQuery.push(`-to:${contact.email}`);
      }
      await Google.apiGmailLoopThroughEmailsToCompileContacts(acctEmail, gmailQuery.join(' '), chunkedCb);
    },
    /*
    * Extracts the encrypted message from gmail api. Sometimes it's sent as a text, sometimes html, sometimes attachments in various forms.
    * success_callback(str armored_pgp_message)
    * error_callback(str error_type, str html_formatted_data_to_display_to_user)
    *    ---> html_formatted_data_to_display_to_user might be unknown type of mime message, or pgp message with broken format, etc.
    *    ---> The motivation is that user might have other tool to process this. Also helps debugging issues in the field.
    */
    extractArmoredBlock: async (acctEmail: string, msgId: string, format: GmailResponseFormat): Promise<string> => {
      const gmailMsg = await Google.gmail.msgGet(acctEmail, msgId, format);
      if (format === 'full') {
        const bodies = Google.gmail.findBodies(gmailMsg);
        const atts = Google.gmail.findAtts(gmailMsg);
        const armoredMsgFromBodies = Pgp.armor.clip(Str.base64urlDecode(bodies['text/plain'] || '')) || Pgp.armor.clip(Pgp.armor.strip(Str.base64urlDecode(bodies['text/html'] || '')));
        if (armoredMsgFromBodies) {
          return armoredMsgFromBodies;
        } else if (atts.length) {
          for (const att of atts) {
            if (att.treatAs() === 'message') {
              await Google.gmail.fetchAtts(acctEmail, [att]);
              const armoredMsg = Pgp.armor.clip(att.asText());
              if (!armoredMsg) {
                throw new FormatError('Problem extracting armored message', att.asText());
              }
              return armoredMsg;
            }
          }
          throw new FormatError('Armored message not found', JSON.stringify(gmailMsg.payload, undefined, 2));
        } else {
          throw new FormatError('No attachments', JSON.stringify(gmailMsg.payload, undefined, 2));
        }
      } else { // format === raw
        const mimeMsg = await Mime.decode(Str.base64urlDecode(gmailMsg.raw!));
        if (mimeMsg.text !== undefined) {
          const armoredMsg = Pgp.armor.clip(mimeMsg.text); // todo - the message might be in attachments
          if (armoredMsg) {
            return armoredMsg;
          } else {
            throw new FormatError('Could not find armored message in parsed raw mime', Str.base64urlDecode(gmailMsg.raw!));
          }
        } else {
          throw new FormatError('No text in parsed raw mime', Str.base64urlDecode(gmailMsg.raw!));
        }
      }
    },
    fetchMsgsBasedOnQueryAndExtractFirstAvailableHeader: async (acctEmail: string, q: string, headerNames: string[]) => {
      const { messages } = await Google.gmail.msgList(acctEmail, q, false);
      return await Google.fetchMsgsSequentiallyFromListExtractFirstAvailableHeader(acctEmail, messages || [], headerNames);
    },
    fetchKeyBackups: async (acctEmail: string) => {
      const res = await Google.gmail.msgList(acctEmail, Google.gmail.buildSearchQuery.backups(acctEmail), true);
      if (!res.messages) {
        return [];
      }
      const msgIds = res.messages.map(m => m.id);
      const msgs = await Google.gmail.msgsGet(acctEmail, msgIds, 'full');
      let atts: Att[] = [];
      for (const msg of msgs) {
        atts = atts.concat(Google.gmail.findAtts(msg));
      }
      await Google.gmail.fetchAtts(acctEmail, atts);
      const keys: OpenPGP.key.Key[] = [];
      for (const att of atts) {
        try {
          const key = openpgp.key.readArmored(att.asText()).keys[0];
          if (key.isPrivate()) {
            keys.push(key);
          }
        } catch (err) { } // tslint:disable-line:no-empty
      }
      return keys;
    },
  };

  private static apiGmailLoopThroughEmailsToCompileContacts = async (acctEmail: string, query: string, chunkedCb: (r: ProviderContactsResults) => void) => {
    let allResults: Contact[] = [];
    while (true) {
      const headers = await Google.gmail.fetchMsgsBasedOnQueryAndExtractFirstAvailableHeader(acctEmail, query, ['to', 'date']);
      if (headers.to) {
        const rawParsedResults = (window as BrowserWidnow)['emailjs-addressparser'].parse(headers.to);
        const newValidResultPairs = rawParsedResults.filter(r => Str.isEmailValid(r.address));
        const newValidResults = newValidResultPairs.map(r => Store.dbContactObj(r.address, r.name, undefined, undefined, undefined, false, undefined));
        query += rawParsedResults.map(raw => ` -to:"${raw.address}"`).join('');
        allResults = allResults.concat(newValidResults);
        chunkedCb({ new: newValidResults, all: allResults });
        if (query.length > 6000) { // gmail search string can handle about this much
          chunkedCb({ new: [], all: allResults });
          return;
        }
      } else {
        chunkedCb({ new: [], all: allResults });
        return;
      }
    }
  }

  private static fetchMsgsSequentiallyFromListExtractFirstAvailableHeader = async (acctEmail: string, messages: R.GmailMsgList$message[], headerNames: string[]): Promise<Dict<string>> => {
    for (const message of messages) {
      const headerVals: Dict<string> = {};
      const msgGetRes = await Google.gmail.msgGet(acctEmail, message.id, 'metadata');
      for (const headerName of headerNames) {
        const value = Google.gmail.findHeader(msgGetRes, headerName);
        if (value !== null) {
          headerVals[headerName] = value;
        } else {
          break;
        }
      }
      if (Object.values(headerVals).length === headerNames.length) {
        return headerVals; // all requested header values found in one msg
      }
    }
    return {};
  }

}

export class GoogleAuth {

  public static OAUTH = {
    "client_id": "717284730244-ostjo2fdtr3ka4q9td69tdr9acmmru2p.apps.googleusercontent.com",
    "url_code": "https://accounts.google.com/o/oauth2/auth",
    "url_tokens": "https://www.googleapis.com/oauth2/v4/token",
    "url_redirect": "urn:ietf:wg:oauth:2.0:oob:auto",
    "state_header": "CRYPTUP_STATE_",
    "scopes": [
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.profile"
    ]
  };

  private static SCOPE_DICT: Dict<string> = { read: 'https://www.googleapis.com/auth/gmail.readonly', compose: 'https://www.googleapis.com/auth/gmail.compose' };

  public static scope = (scope: string[]): string[] => scope.map(s => GoogleAuth.SCOPE_DICT[s] as string);

  public static hasScope = (scopes: string[], scope: string) => scopes && Value.is(GoogleAuth.SCOPE_DICT[scope]).in(scopes);

  public static googleApiAuthHeader = async (acctEmail: string, forceRefresh = false): Promise<string> => {
    if (!acctEmail) {
      throw new Error('missing account_email in api_gmail_call');
    }
    const storage = await Store.getAcct(acctEmail, ['google_token_access', 'google_token_expires', 'google_token_scopes', 'google_token_refresh']);
    if (!storage.google_token_access || !storage.google_token_refresh) {
      throw new Error('Account not connected to FlowCrypt Browser Extension');
    } else if (GoogleAuth.googleApiIsAuthTokenValid(storage) && !forceRefresh) {
      return `Bearer ${storage.google_token_access}`;
    } else { // refresh token
      const refreshTokenRes = await GoogleAuth.googleAuthRefreshToken(storage.google_token_refresh);
      await GoogleAuth.googleAuthCheckAccessToken(refreshTokenRes.access_token); // https://groups.google.com/forum/#!topic/oauth2-dev/QOFZ4G7Ktzg
      await GoogleAuth.googleAuthSaveTokens(acctEmail, refreshTokenRes, storage.google_token_scopes || []);
      const auth = await Store.getAcct(acctEmail, ['google_token_access', 'google_token_expires']);
      if (GoogleAuth.googleApiIsAuthTokenValid(auth)) { // have a valid gmail_api oauth token
        return `Bearer ${auth.google_token_access}`;
      } else {
        throw new AuthError('Could not refresh google auth token - did not become valid');
      }
    }
  }

  public static apiGoogleCallRetryAuthErrorOneTime = async (acctEmail: string, request: JQuery.AjaxSettings) => {
    try {
      return await Api.ajax(request, Catch.stackTrace());
    } catch (firstAttemptErr) {
      if (Api.err.isAuthErr(firstAttemptErr)) { // force refresh token
        request.headers!.Authorization = await GoogleAuth.googleApiAuthHeader(acctEmail, true);
        return await Api.ajax(request, Catch.stackTrace());
      }
      throw firstAttemptErr;
    }
  }

  public static newAuthPopup = async ({ acctEmail, omitReadScope, scopes }: { acctEmail: string | null, omitReadScope?: boolean, scopes?: string[] }): Promise<AuthRes> => {
    scopes = await GoogleAuth.apiGoogleAuthPopupPrepareAuthReqScopes(acctEmail, scopes || [], omitReadScope === true);
    const authRequest: AuthReq = { acctEmail, scopes };
    const url = GoogleAuth.apiGoogleAuthCodeUrl(authRequest);
    const oauthWin = await windowsCreate({ url, left: 100, top: 50, height: 700, width: 600, type: 'popup' });
    if (!oauthWin || !oauthWin.tabs || !oauthWin.tabs.length) {
      return { result: 'Error', error: 'No oauth window renturned after initiating it', acctEmail };
    }
    const authRes = await Promise.race([
      GoogleAuth.waitForAndProcessOauthWindowResult(oauthWin.id, acctEmail, scopes),
      GoogleAuth.waitForOauthWindowClosed(oauthWin.id, acctEmail),
    ]);
    chrome.windows.remove(oauthWin.id);
    return authRes;
  }

  private static waitForOauthWindowClosed = (oauthWinId: number, acctEmail: string | null): Promise<AuthRes> => new Promise(resolve => {
    const onOauthWinClosed = (closedWinId: number) => {
      if (closedWinId === oauthWinId) {
        chrome.windows.onRemoved.removeListener(onOauthWinClosed);
        resolve({ result: 'Closed', acctEmail });
      }
    };
    chrome.windows.onRemoved.addListener(onOauthWinClosed);
  })

  private static waitForAndProcessOauthWindowResult = async (windowId: number, acctEmail: string | null, scopes: string[]): Promise<AuthRes> => {
    while (true) {
      const [oauthTab] = await tabsQuery({ windowId });
      if (oauthTab && oauthTab.title && Value.is(GoogleAuth.OAUTH.state_header).in(oauthTab.title)) {
        const parts = oauthTab.title.split(' ', 2);
        const result = parts[0];
        const params = Env.urlParams(['code', 'state', 'error'], parts[1]);
        if (!Value.is(result).in(['Closed', 'Success', 'Denied', 'Error'])) {
          return { acctEmail, result: 'Error', error: `Unknown google auth result '${result}'` };
        }
        if (result === 'Success') {
          if (typeof params.code === 'string' && params.code) {
            const authorizedAcctEmail = await GoogleAuth.retrieveAndSaveAuthToken(params.code, scopes);
            return { acctEmail: authorizedAcctEmail, result: 'Success' };
          }
          return { acctEmail, result: 'Error', error: `Google auth result was 'Success' but no auth code` };
        }
        return { acctEmail, result: result as GoogleAuthWindowResult$result, error: params.error ? String(params.error) : '(no error provided)' };
      }
      await Ui.time.sleep(250);
    }
  }

  private static apiGoogleAuthCodeUrl = (authReq: AuthReq) => Env.urlCreate(GoogleAuth.OAUTH.url_code, {
    client_id: GoogleAuth.OAUTH.client_id,
    response_type: 'code',
    access_type: 'offline',
    state: GoogleAuth.apiGoogleAuthStatePack(authReq),
    redirect_uri: GoogleAuth.OAUTH.url_redirect,
    scope: (authReq.scopes || []).join(' '),
    login_hint: authReq.acctEmail,
  })

  private static apiGoogleAuthStatePack = (authReq: AuthReq) => GoogleAuth.OAUTH.state_header + JSON.stringify(authReq);

  private static googleAuthSaveTokens = async (acctEmail: string, tokensObj: GoogleAuthTokensResponse, scopes: string[]) => {
    const toSave: AccountStore = {
      google_token_access: tokensObj.access_token,
      google_token_expires: new Date().getTime() + (tokensObj.expires_in as number) * 1000,
      google_token_scopes: scopes,
    };
    if (typeof tokensObj.refresh_token !== 'undefined') {
      toSave.google_token_refresh = tokensObj.refresh_token;
    }
    await Store.setAcct(acctEmail, toSave);
  }

  private static googleAuthGetTokens = (code: string) => Api.ajax({
    url: Env.urlCreate(GoogleAuth.OAUTH.url_tokens, { grant_type: 'authorization_code', code, client_id: GoogleAuth.OAUTH.client_id, redirect_uri: GoogleAuth.OAUTH.url_redirect }),
    method: 'POST',
    crossDomain: true,
    async: true,
  }, Catch.stackTrace()) as any as Promise<GoogleAuthTokensResponse>

  private static googleAuthRefreshToken = (refreshToken: string) => Api.ajax({
    url: Env.urlCreate(GoogleAuth.OAUTH.url_tokens, { grant_type: 'refresh_token', refreshToken, client_id: GoogleAuth.OAUTH.client_id }),
    method: 'POST',
    crossDomain: true,
    async: true,
  }, Catch.stackTrace()) as any as Promise<GoogleAuthTokensResponse>

  private static googleAuthCheckAccessToken = (accessToken: string) => Api.ajax({
    url: Env.urlCreate('https://www.googleapis.com/oauth2/v1/tokeninfo', { access_token: accessToken }),
    crossDomain: true,
    async: true,
  }, Catch.stackTrace()) as any as Promise<GoogleAuthTokenInfo>

  /**
   * oauth token will be valid for another 2 min
   */
  private static googleApiIsAuthTokenValid = (s: AccountStore) => s.google_token_access && (!s.google_token_expires || s.google_token_expires > new Date().getTime() + (120 * 1000));

  // private static parseIdToken = (idToken: string) => JSON.parse(atob(idToken.split(/\./g)[1]));

  private static retrieveAndSaveAuthToken = async (authCode: string, scopes: string[]): Promise<string> => {
    const tokensObj = await GoogleAuth.googleAuthGetTokens(authCode);
    await GoogleAuth.googleAuthCheckAccessToken(tokensObj.access_token); // https://groups.google.com/forum/#!topic/oauth2-dev/QOFZ4G7Ktzg
    const { emailAddress } = await Google.gmail.usersMeProfile(null, tokensObj.access_token);
    await GoogleAuth.googleAuthSaveTokens(emailAddress, tokensObj, scopes);
    return emailAddress;
  }

  private static apiGoogleAuthPopupPrepareAuthReqScopes = async (acctEmail: string | null, requestedScopes: string[], omitReadScope: boolean): Promise<string[]> => {
    let currentTokensScopes: string[] = [];
    if (acctEmail) {
      const storage = await Store.getAcct(acctEmail, ['google_token_scopes']);
      currentTokensScopes = storage.google_token_scopes || [];
    }
    const authReqScopes = requestedScopes || [];
    for (const scope of GoogleAuth.OAUTH.scopes) {
      if (!Value.is(scope).in(requestedScopes)) {
        if (scope !== GoogleAuth.scope(['read'])[0] || !omitReadScope) { // leave out read messages permission if user chose so
          authReqScopes.push(scope);
        }
      }
    }
    for (const scope of currentTokensScopes) {
      if (!Value.is(scope).in(requestedScopes)) {
        authReqScopes.push(scope);
      }
    }
    return authReqScopes;
  }
}
