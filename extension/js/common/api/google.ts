/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, AuthError, ReqMethod, ProgressCbs, R, SendableMsg, ProgressCb, ChunkedCb, ProviderContactsResults } from './api.js';
import { Env, Ui, Xss } from '../browser.js';
import { Catch } from '../platform/catch.js';
import { Store, Contact, AccountStore, Serializable } from '../platform/store.js';
import { Dict, Value, Str } from '../core/common.js';
import { GoogleAuthWindowResult$result, BrowserWidnow, AddrParserResult } from '../extension.js';
import { Mime, SendableMsgBody } from '../core/mime.js';
import { Att } from '../core/att.js';
import { FormatError, Pgp } from '../core/pgp.js';
import { tabsQuery, windowsCreate } from './chrome.js';

type GoogleAuthTokenInfo = { issued_to: string, audience: string, scope: string, expires_in: number, access_type: 'offline' };
type GoogleAuthTokensResponse = { access_token: string, expires_in: number, refresh_token?: string };
export type AuthReq = { acctEmail?: string, scopes: string[], messageId?: string, omitReadScope?: boolean };
export type GmailResponseFormat = 'raw' | 'full' | 'metadata';
type AuthResultSuccess = { result: 'Success', acctEmail: string, error?: undefined };
type AuthResultError = { result: GoogleAuthWindowResult$result, acctEmail?: string, error?: string };
export type AuthRes = AuthResultSuccess | AuthResultError;

declare const openpgp: typeof OpenPGP;

export class Google extends Api {

  private static GMAIL_USELESS_CONTACTS_FILTER = '-to:txt.voice.google.com -to:craigslist.org';
  public static GMAIL_RECOVERY_EMAIL_SUBJECTS = ['Your FlowCrypt Backup',
    'Your CryptUp Backup', 'All you need to know about CryptUP (contains a backup)', 'CryptUP Account Backup'];
  private static GMAIL_SEARCH_QUERY_LENGTH_LIMIT = 6000;

  private static call = async (acctEmail: string, method: ReqMethod, url: string, parameters: Dict<Serializable> | string) => {
    const data = method === 'GET' || method === 'DELETE' ? parameters : JSON.stringify(parameters);
    const headers = { Authorization: await GoogleAuth.googleApiAuthHeader(acctEmail) };
    const request = { url, method, data, headers, crossDomain: true, contentType: 'application/json; charset=UTF-8', async: true };
    return await GoogleAuth.apiGoogleCallRetryAuthErrorOneTime(acctEmail, request);
  }

  public static gmailCall = async (acctEmail: string, method: ReqMethod, path: string, params: Dict<Serializable> | string | undefined, progress?: ProgressCbs, contentType?: string) => {
    progress = progress || {};
    let data, url;
    if (typeof progress!.upload === 'function') { // substituted with {} above
      url = 'https://www.googleapis.com/upload/gmail/v1/users/me/' + path + '?uploadType=multipart';
      data = params;
    } else {
      url = 'https://www.googleapis.com/gmail/v1/users/me/' + path;
      if (method === 'GET' || method === 'DELETE') {
        data = params;
      } else {
        data = JSON.stringify(params);
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
    usersMeProfile: async (acctEmail: string | undefined, accessToken?: string): Promise<R.GmailUsersMeProfile> => {
      const url = 'https://www.googleapis.com/gmail/v1/users/me/profile';
      let r: R.GmailUsersMeProfile;
      if (acctEmail && !accessToken) {
        r = await Google.call(acctEmail, 'GET', url, {}) as R.GmailUsersMeProfile;
      } else if (!acctEmail && accessToken) {
        const contentType = 'application/json; charset=UTF-8';
        const headers = { 'Authorization': `Bearer ${accessToken}` };
        r = await Api.ajax({ url, method: 'GET', headers, crossDomain: true, contentType, async: true }, Catch.stackTrace()) as R.GmailUsersMeProfile;
      } else {
        throw new Error('Google.gmail.users_me_profile: need either account_email or access_token');
      }
      r.emailAddress = r.emailAddress.toLowerCase();
      return r;
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
        threadId,
      },
    }),
    draftDelete: (acctEmail: string, id: string): Promise<R.GmailDraftDelete> => Google.gmailCall(acctEmail, 'DELETE', 'drafts/' + id, undefined),
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
    attGet: async (acctEmail: string, msgId: string, attId: string, progressCb?: ProgressCb): Promise<R.GmailAtt> => {
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
            console.info(e);
            reject(new Error("Chunk response could not be parsed"));
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
          reject(new Error("Chunk response could not be decoded"));
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
            } else { // done as a fail - reject
              reject({ message: 'Network connection error when downloading a chunk', internal: 'network' }); // todo - use a NetworkError of some sort
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
      return undefined;
    },
    findAtts: (msgOrPayloadOrPart: R.GmailMsg | R.GmailMsg$payload | R.GmailMsg$payload$part, internalResults: Att[] = [], internalMsgId?: string) => {
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
      let gmailQuery = `is:sent ${Google.GMAIL_USELESS_CONTACTS_FILTER}`;
      if (userQuery) {
        const variationsOfTo = userQuery.split(/[ .]/g).filter(v => !Value.is(v).in(['com', 'org', 'net']));
        if (!Value.is(userQuery).in(variationsOfTo)) {
          variationsOfTo.push(userQuery);
        }
        gmailQuery += ` (to:${variationsOfTo.join(' OR to:')})`;
      }
      const filteredContacts = knownContacts.filter(c => Str.isEmailValid(c.email));
      for (const contact of filteredContacts) {
        gmailQuery += ` -to:${contact.email}`;
        if (gmailQuery.length > Google.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
          break;
        }
      }
      await Google.apiGmailLoopThroughEmailsToCompileContacts(acctEmail, gmailQuery, chunkedCb);
    },
    /**
     * Extracts the encrypted message from gmail api. Sometimes it's sent as a text, sometimes html, sometimes attachments in various forms.
     */
    extractArmoredBlock: async (acctEmail: string, msgId: string, format: GmailResponseFormat): Promise<string> => {
      const gmailMsg = await Google.gmail.msgGet(acctEmail, msgId, format);
      if (format === 'full') {
        const bodies = Google.gmail.findBodies(gmailMsg);
        const atts = Google.gmail.findAtts(gmailMsg);
        const fromTextBody = Pgp.armor.clip(Str.base64urlDecode(bodies['text/plain'] || ''));
        if (fromTextBody) {
          return fromTextBody;
        }
        const fromHtmlBody = Pgp.armor.clip(Xss.htmlSanitizeAndStripAllTags(Str.base64urlDecode(bodies['text/plain'] || ''), '\n'));
        if (fromHtmlBody) {
          return fromHtmlBody;
        }
        if (atts.length) {
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
    fetchMsgsHeadersBasedOnQuery: async (acctEmail: string, q: string, headerNames: string[], msgLimit: number) => {
      const { messages } = await Google.gmail.msgList(acctEmail, q, false);
      return await Google.extractHeadersFromMsgs(acctEmail, messages || [], headerNames, msgLimit);
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

  private static apiGmailBuildFilteredQuery = (query: string, allRawEmails: string[]) => {
    let filteredQuery = query;
    for (const rawEmail of allRawEmails) {
      filteredQuery += ` -to:"${rawEmail}"`;
      if (filteredQuery.length > Google.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
        return filteredQuery;
      }
    }
    return filteredQuery;
  }

  private static apiGmailGetNewUniqueRecipientsFromHeaders = (toHeaders: string[], allResults: Contact[], allRawEmails: string[]): Contact[] => {
    if (!toHeaders.length) {
      return [];
    }
    let rawParsedResults: AddrParserResult[] = [];
    toHeaders = Value.arr.unique(toHeaders);
    for (const to of toHeaders) {
      rawParsedResults = rawParsedResults.concat((window as BrowserWidnow)['emailjs-addressparser'].parse(to));
    }
    for (const rawParsedRes of rawParsedResults) {
      if (rawParsedRes.address && allRawEmails.indexOf(rawParsedRes.address) === -1) {
        allRawEmails.push(rawParsedRes.address);
      }
    }
    const newValidResultPairs = rawParsedResults.filter(r => Str.isEmailValid(r.address));
    const newValidResults = newValidResultPairs.map(r => Store.dbContactObj(r.address, r.name, undefined, undefined, undefined, false, undefined));
    const uniqueNewValidResults: Contact[] = [];
    for (const newValidRes of newValidResults) {
      if (allResults.map(c => c.email).indexOf(newValidRes.email) === -1) {
        const foundIndex = uniqueNewValidResults.map(c => c.email).indexOf(newValidRes.email);
        if (foundIndex === -1) {
          uniqueNewValidResults.push(newValidRes);
        } else if (newValidRes.name && !uniqueNewValidResults[foundIndex].name) {
          uniqueNewValidResults[foundIndex].name = newValidRes.name; // prefer to also save name if first encountered result is missing it
        }
      }
    }
    return uniqueNewValidResults;
  }

  private static apiGmailLoopThroughEmailsToCompileContacts = async (acctEmail: string, query: string, chunkedCb: (r: ProviderContactsResults) => void) => {
    let allResults: Contact[] = [];
    const allRawEmails: string[] = [];
    let lastFilteredQuery = '';
    let continueSearching = true;
    while (continueSearching) {
      const filteredQuery = Google.apiGmailBuildFilteredQuery(query, allRawEmails);
      if (filteredQuery === lastFilteredQuery) {
        break;
      }
      if (filteredQuery.length > Google.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
        continueSearching = false;
      }
      const headers = await Google.gmail.fetchMsgsHeadersBasedOnQuery(acctEmail, filteredQuery, ['to'], 50);
      lastFilteredQuery = filteredQuery;
      const uniqueNewValidResults = Google.apiGmailGetNewUniqueRecipientsFromHeaders(headers.to, allResults, allRawEmails);
      if (!uniqueNewValidResults.length) {
        break;
      }
      allResults = allResults.concat(uniqueNewValidResults);
      chunkedCb({ new: uniqueNewValidResults, all: allResults });
    }
    chunkedCb({ new: [], all: allResults });
  }

  private static extractHeadersFromMsgs = async (acctEmail: string, msgsIds: R.GmailMsgList$message[], headerNames: string[], msgLimit: number): Promise<Dict<string[]>> => {
    const headerVals: Dict<string[]> = {};
    for (const headerName of headerNames) {
      headerVals[headerName] = [];
    }
    for (const msg of await Google.gmail.msgsGet(acctEmail, msgsIds.slice(0, msgLimit).map(m => m.id), 'metadata')) {
      for (const headerName of headerNames) {
        const value = Google.gmail.findHeader(msg, headerName);
        if (typeof value !== 'undefined') {
          headerVals[headerName].push(value);
        }
      }
    }
    return headerVals;
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

  public static scope = (scope: string[]): string[] => scope.map(s => {
    if (!GoogleAuth.SCOPE_DICT[s]) {
      throw new Error(`Unknown scope: ${s}`);
    }
    return GoogleAuth.SCOPE_DICT[s];
  })

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

  public static newAuthPopup = async ({ acctEmail, omitReadScope, scopes }: { acctEmail?: string, omitReadScope?: boolean, scopes?: string[] }): Promise<AuthRes> => {
    if (acctEmail) {
      acctEmail = acctEmail.toLowerCase();
    }
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
    try {
      chrome.windows.remove(oauthWin.id);
    } catch (e) {
      if (String(e).indexOf('No window with id') === -1) {
        Catch.handleErr(e);
      }
    }
    return authRes;
  }

  private static waitForOauthWindowClosed = (oauthWinId: number, acctEmail: string | undefined): Promise<AuthRes> => new Promise(resolve => {
    const onOauthWinClosed = (closedWinId: number) => {
      if (closedWinId === oauthWinId) {
        chrome.windows.onRemoved.removeListener(onOauthWinClosed);
        resolve({ result: 'Closed', acctEmail });
      }
    };
    chrome.windows.onRemoved.addListener(onOauthWinClosed);
  })

  private static processOauthResTitle = (title: string): { result: GoogleAuthWindowResult$result, code?: string, error?: string } => {
    const parts = title.split(' ', 2);
    const result = parts[0];
    const params = Env.urlParams(['code', 'state', 'error'], parts[1]);
    if (!Value.is(result).in(['Success', 'Denied', 'Error'])) {
      return { result: 'Error', error: `Unknown google auth result '${result}'` };
    }
    return { result: result as GoogleAuthWindowResult$result, code: params.code ? String(params.code) : undefined, error: params.error ? String(params.error) : undefined };
  }

  private static isAuthUrl = (title: string) => title.match(/^(?:https?:\/\/)?accounts\.google\.com/) !== null;

  private static isForwarding = (title: string) => title.match(/^Forwarding /) !== null;

  private static waitForAndProcessOauthWindowResult = async (windowId: number, acctEmail: string | undefined, scopes: string[]): Promise<AuthRes> => {
    while (true) {
      const [oauth] = await tabsQuery({ windowId });
      if (oauth && oauth.title && Value.is(GoogleAuth.OAUTH.state_header).in(oauth.title) && !GoogleAuth.isAuthUrl(oauth.title) && !GoogleAuth.isForwarding(oauth.title)) {
        const { result, error, code } = GoogleAuth.processOauthResTitle(oauth.title);
        if (error === 'access_denied') {
          return { acctEmail, result: 'Denied', error }; // sometimes it was coming in as {"result":"Error","error":"access_denied"}
        }
        if (result === 'Success') {
          if (code) {
            const authorizedAcctEmail = await GoogleAuth.retrieveAndSaveAuthToken(code, scopes);
            return { acctEmail: authorizedAcctEmail, result: 'Success' };
          }
          return { acctEmail, result: 'Error', error: `Google auth result was 'Success' but no auth code` };
        }
        return { acctEmail, result, error: error ? error : '(no error provided)' };
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
    const { emailAddress } = await Google.gmail.usersMeProfile(undefined, tokensObj.access_token);
    await GoogleAuth.googleAuthSaveTokens(emailAddress, tokensObj, scopes);
    return emailAddress;
  }

  private static apiGoogleAuthPopupPrepareAuthReqScopes = async (acctEmail: string | undefined, requestedScopes: string[], omitReadScope: boolean): Promise<string[]> => {
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
