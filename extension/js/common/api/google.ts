/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

// tslint:disable:no-direct-ajax

const BUILD = 'consumer'; // todo

import { Catch } from '../platform/catch.js';
import { Store, AccountStore, Serializable } from '../platform/store.js';
import { Api, AuthError, ReqMethod, ProgressCbs, ProgressCb, ChunkedCb, ProviderContactsResults, AjaxError, RecipientType } from './api.js';
import { Env, Ui } from '../browser.js';
import { Dict, Value, Str } from '../core/common.js';
import { GoogleAuthWindowResult$result, BrowserWidnow, AddrParserResult, BrowserMsg } from '../extension.js';
import { Mime, SendableMsgBody } from '../core/mime.js';
import { Att } from '../core/att.js';
import { FormatError, Pgp, Contact } from '../core/pgp.js';
import { tabsQuery, windowsCreate } from './chrome.js';
import { Buf } from '../core/buf.js';
import { gmailBackupSearchQuery, GOOGLE_API_HOST, GOOGLE_OAUTH_SCREEN_HOST } from '../core/const.js';
import { EmailProviderApi, SendableMsg } from './email_provider_api.js';
import { Xss } from '../platform/xss.js';

type GoogleAuthTokenInfo = { issued_to: string, audience: string, scope: string, expires_in: number, access_type: 'offline' };
type GoogleAuthTokensResponse = { access_token: string, expires_in: number, refresh_token?: string, id_token: string, token_type: 'Bearer' };
export type AuthReq = { acctEmail?: string, scopes: string[], messageId?: string, csrfToken: string };
export type GmailResponseFormat = 'raw' | 'full' | 'metadata';
type AuthResultSuccess = { result: 'Success', acctEmail: string, error?: undefined };
type AuthResultError = { result: GoogleAuthWindowResult$result, acctEmail?: string, error?: string };
export type AuthRes = AuthResultSuccess | AuthResultError;

export class GoogleAcctNotConnected extends Error { }

export namespace GmailRes { // responses

  export type GmailUsersMeProfile = { emailAddress: string, historyId: string, messagesTotal: number, threadsTotal: string };
  export type GmailMsg$header = { name: string, value: string };
  export type GmailMsg$payload$body = { attachmentId: string, size: number, data?: string };
  export type GmailMsg$payload$part = { body?: GmailMsg$payload$body, filename?: string, mimeType?: string, headers?: GmailMsg$header[] };
  export type GmailMsg$payload = { parts?: GmailMsg$payload$part[], headers?: GmailMsg$header[], mimeType?: string, body?: GmailMsg$payload$body };
  export type GmailMsg$labelId = 'INBOX' | 'UNREAD' | 'CATEGORY_PERSONAL' | 'IMPORTANT' | 'SENT' | 'CATEGORY_UPDATES' | 'TRASH';
  export type GmailMsg = {
    id: string; historyId: string; threadId?: string | null; payload: GmailMsg$payload; internalDate?: number | string;
    labelIds?: GmailMsg$labelId[]; snippet?: string; raw?: string;
  };
  export type GmailMsgList$message = { id: string, threadId: string };
  export type GmailMsgList = { messages?: GmailMsgList$message[], resultSizeEstimate: number, nextPageToken?: string };
  export type GmailLabels$label = {
    id: string, name: string, messageListVisibility: 'show' | 'hide', labelListVisibility: 'labelShow' | 'labelHide', type: 'user' | 'system',
    messagesTotal?: number, messagesUnread?: number, threadsTotal?: number, threadsUnread?: number, color?: { textColor: string, backgroundColor: string }
  };
  export type GmailLabels = { labels: GmailLabels$label[] };
  export type GmailAtt = { attachmentId: string, size: number, data: Buf };
  export type GmailMsgSend = { id: string };
  export type GmailThread = { id: string, historyId: string, messages: GmailMsg[] };
  export type GmailThreadList = { threads: { historyId: string, id: string, snippet: string }[], nextPageToken: string, resultSizeEstimate: number };
  export type GmailDraftCreate = { id: string };
  export type GmailDraftDelete = {};
  export type GmailDraftUpdate = {};
  export type GmailDraftGet = { id: string, message: GmailMsg };
  export type GmailDraftMeta = { id: string, message: { id: string, threadId: string } };
  export type GmailDraftList = { drafts: GmailDraftMeta[], nextPageToken: string };
  export type GmailDraftSend = {};
  export type GmailAliases = { sendAs: GmailAliases$sendAs[] };
  type GmailAliases$sendAs = { sendAsEmail: string, displayName: string, replyToAddress: string, signature: string, isDefault: boolean, treatAsAlias: boolean, verificationStatus: string };

  export type OpenId = { // 'name' is the full name, picture is url
    at_hash: string; exp: number; iat: number; sub: string; aud: string; azp: string; iss: "https://accounts.google.com";
    name: string; picture: string; locale: 'en' | string; family_name: string; given_name: string;
  };

}

export class Google extends EmailProviderApi {

  private static GMAIL_USELESS_CONTACTS_FILTER = '-to:txt.voice.google.com -to:craigslist.org';
  private static GMAIL_SEARCH_QUERY_LENGTH_LIMIT = 1400;

  public static webmailUrl = (acctEmail: string) => `https://mail.google.com/mail/u/${acctEmail}`;

  private static call = async (acctEmail: string, method: ReqMethod, url: string, parameters: Dict<Serializable> | string): Promise<any> => {
    const data = method === 'GET' || method === 'DELETE' ? parameters : JSON.stringify(parameters);
    const headers = { Authorization: await GoogleAuth.googleApiAuthHeader(acctEmail) };
    const request = { url, method, data, headers, crossDomain: true, contentType: 'application/json; charset=UTF-8', async: true };
    return await GoogleAuth.apiGoogleCallRetryAuthErrorOneTime(acctEmail, request);
  }

  public static gmailCall = async (acctEmail: string, method: ReqMethod, path: string, params: Dict<Serializable> | string | undefined, progress?: ProgressCbs, contentType?: string) => {
    progress = progress || {};
    let data, url;
    if (typeof progress.upload === 'function') {
      url = `${GOOGLE_API_HOST}/upload/gmail/v1/users/me/${path}?uploadType=multipart`;
      data = params;
    } else {
      url = `${GOOGLE_API_HOST}/gmail/v1/users/me/${path}`;
      if (method === 'GET' || method === 'DELETE') {
        data = params;
      } else {
        data = JSON.stringify(params);
      }
    }
    contentType = contentType || 'application/json; charset=UTF-8';
    const headers = { 'Authorization': await GoogleAuth.googleApiAuthHeader(acctEmail) };
    const xhr = Api.getAjaxProgressXhrFactory(progress);
    const request = { xhr, url, method, data, headers, crossDomain: true, contentType, async: true };
    return await GoogleAuth.apiGoogleCallRetryAuthErrorOneTime(acctEmail, request);
  }

  private static encodeAsMultipartRelated = (parts: Dict<string>) => { // todo - this could probably be achieved with emailjs-mime-builder
    const boundary = 'this_sucks_' + Str.sloppyRandom(10);
    let body = '';
    for (const type of Object.keys(parts)) {
      body += '--' + boundary + '\n';
      body += 'Content-Type: ' + type + '\n';
      if (type.includes('json')) {
        body += '\n' + parts[type] + '\n\n';
      } else {
        body += 'Content-Transfer-Encoding: base64\n';
        body += '\n' + btoa(parts[type]) + '\n\n';
      }
    }
    body += '--' + boundary + '--';
    return { contentType: 'multipart/related; boundary=' + boundary, body };
  }

  public static gmail = {
    buildSearchQuery: {
      or: (arr: string[], quoted: boolean = false) => {
        if (quoted) {
          return '("' + arr.join('") OR ("') + '")';
        } else {
          return '(' + arr.join(') OR (') + ')';
        }
      },
    },
    usersMeProfile: async (acctEmail: string | undefined, accessToken?: string): Promise<GmailRes.GmailUsersMeProfile> => {
      const url = `${GOOGLE_API_HOST}/gmail/v1/users/me/profile`;
      let r: GmailRes.GmailUsersMeProfile;
      if (acctEmail && !accessToken) {
        r = await Google.call(acctEmail, 'GET', url, {}) as GmailRes.GmailUsersMeProfile;
      } else if (!acctEmail && accessToken) {
        const contentType = 'application/json; charset=UTF-8';
        const headers = { 'Authorization': `Bearer ${accessToken}` };
        r = await Api.ajax({ url, method: 'GET', headers, crossDomain: true, contentType, async: true }, Catch.stackTrace()) as GmailRes.GmailUsersMeProfile;
      } else {
        throw new Error('Google.gmail.users_me_profile: need either account_email or access_token');
      }
      r.emailAddress = r.emailAddress.toLowerCase();
      return r;
    },
    threadGet: (acctEmail: string, threadId: string, format?: GmailResponseFormat, progressCb?: ProgressCb): Promise<GmailRes.GmailThread> =>
      Google.gmailCall(acctEmail, 'GET', `threads/${threadId}`, {
        format,
      }, { download: progressCb }),
    threadList: (acctEmail: string, labelId: string): Promise<GmailRes.GmailThreadList> => Google.gmailCall(acctEmail, 'GET', `threads`, {
      labelIds: labelId !== 'ALL' ? labelId : undefined,
      includeSpamTrash: Boolean(labelId === 'SPAM' || labelId === 'TRASH'),
      // pageToken: page_token,
      // q,
      // maxResults
    }),
    threadModify: (acctEmail: string, id: string, rmLabels: string[], addLabels: string[]): Promise<GmailRes.GmailThread> => Google.gmailCall(acctEmail, 'POST', `threads/${id}/modify`, {
      removeLabelIds: rmLabels || [], // todo - insufficient permission - need https://github.com/FlowCrypt/flowcrypt-browser/issues/1304
      addLabelIds: addLabels || [],
    }),
    draftCreate: (acctEmail: string, mimeMsg: string, threadId: string): Promise<GmailRes.GmailDraftCreate> => Google.gmailCall(acctEmail, 'POST', 'drafts', {
      message: {
        raw: Buf.fromUtfStr(mimeMsg).toBase64UrlStr(),
        threadId,
      },
    }),
    draftDelete: (acctEmail: string, id: string): Promise<GmailRes.GmailDraftDelete> => Google.gmailCall(acctEmail, 'DELETE', 'drafts/' + id, undefined),
    draftUpdate: (acctEmail: string, id: string, mimeMsg: string): Promise<GmailRes.GmailDraftUpdate> => Google.gmailCall(acctEmail, 'PUT', `drafts/${id}`, {
      message: {
        raw: Buf.fromUtfStr(mimeMsg).toBase64UrlStr(),
      },
    }),
    draftGet: (acctEmail: string, id: string, format: GmailResponseFormat = 'full'): Promise<GmailRes.GmailDraftGet> => Google.gmailCall(acctEmail, 'GET', `drafts/${id}`, {
      format,
    }),
    draftList: (acctEmail: string): Promise<GmailRes.GmailDraftList> => Google.gmailCall(acctEmail, 'GET', 'drafts', undefined),
    draftSend: (acctEmail: string, id: string): Promise<GmailRes.GmailDraftSend> => Google.gmailCall(acctEmail, 'POST', 'drafts/send', {
      id,
    }),
    msgSend: async (acctEmail: string, message: SendableMsg, progressCb?: ProgressCb): Promise<GmailRes.GmailMsgSend> => {
      message.headers.From = message.from;
      for (const key of Object.keys(message.recipients)) {
        const sendingType = key as RecipientType;
        if (message.recipients[sendingType] && message.recipients[sendingType]!.length) {
          message.headers[sendingType[0].toUpperCase() + sendingType.slice(1)] = message.recipients[sendingType]!.join(',');
        }
      }
      message.headers.Subject = message.subject;
      const mimeMsg = await Mime.encode(message.body, message.headers, message.atts);
      const request = Google.encodeAsMultipartRelated({ 'application/json; charset=UTF-8': JSON.stringify({ threadId: message.thread }), 'message/rfc822': mimeMsg });
      return Google.gmailCall(acctEmail, 'POST', 'messages/send', request.body, { upload: progressCb || Value.noop }, request.contentType);
    },
    msgList: (acctEmail: string, q: string, includeDeleted: boolean = false, pageToken?: string): Promise<GmailRes.GmailMsgList> => Google.gmailCall(acctEmail, 'GET', 'messages', {
      q,
      includeSpamTrash: includeDeleted,
      pageToken,
    }),
    /**
     * Attempting to `msgGet format:raw` from within content scripts would likely fail if the mime message is 1MB or larger,
     * because strings over 1 MB may fail to get to/from bg page. A way to mitigate that would be to pass `R.GmailMsg$raw` prop
     * as a Buf instead of a string.
    */
    msgGet: async (acctEmail: string, msgId: string, format: GmailResponseFormat, progressCb?: ProgressCb): Promise<GmailRes.GmailMsg> =>
      Google.gmailCall(acctEmail, 'GET', `messages/${msgId}`, {
        format: format || 'full'
      }, { download: progressCb }),
    msgsGet: (acctEmail: string, msgIds: string[], format: GmailResponseFormat): Promise<GmailRes.GmailMsg[]> => {
      return Promise.all(msgIds.map(id => Google.gmail.msgGet(acctEmail, id, format)));
    },
    labelsGet: (acctEmail: string): Promise<GmailRes.GmailLabels> => Google.gmailCall(acctEmail, 'GET', `labels`, {}),
    attGet: async (acctEmail: string, msgId: string, attId: string, progressCb?: ProgressCb): Promise<GmailRes.GmailAtt> => {
      type RawGmailAttRes = { attachmentId: string, size: number, data: string };
      const { attachmentId, size, data } = await Google.gmailCall(acctEmail, 'GET', `messages/${msgId}/attachments/${attId}`, {}, { download: progressCb }) as RawGmailAttRes;
      return { attachmentId, size, data: Buf.fromBase64UrlStr(data) }; // data should be a Buf for ease of passing to/from bg page
    },
    attGetChunk: (acctEmail: string, msgId: string, attId: string): Promise<Buf> => new Promise((resolve, reject) => {
      if (Env.isContentScript()) {
        // content script CORS not allowed anymore, have to drag it through background page
        // https://www.chromestatus.com/feature/5629709824032768
        BrowserMsg.send.bg.await.ajaxGmailAttGetChunk({ acctEmail, msgId, attId }).then(({ chunk }) => resolve(chunk)).catch(reject);
        return;
      }
      const stack = Catch.stackTrace();
      const minBytes = 1000;
      let processed = 0;
      const processChunkAndResolve = (chunk: string) => {
        if (!processed++) {
          // make json end guessing easier
          chunk = chunk.replace(/[\n\s\r]/g, '');
          // the response is a chunk of json that may not have ended. One of:
          // {"length":123,"data":"kks
          // {"length":123,"data":"kksdwei
          // {"length":123,"data":"kksdwei"
          // {"length":123,"data":"kksdwei"}
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
              resolve(Buf.fromBase64UrlStr(parsedJsonDataField)); // tslint:disable-line:no-unsafe-any
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
        const method = 'GET';
        const url = `${GOOGLE_API_HOST}/gmail/v1/users/me/messages/${msgId}/attachments/${attId}`;
        r.open(method, url, true);
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
              reject(AjaxError.fromXhr({ status, readyState: r.readyState }, { method, url }, stack));
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
              reject(AjaxError.fromXhr({ status, readyState: r.readyState }, { method, url }, stack));
              window.clearInterval(responsePollInterval);
            }
          }
        };
      }).catch(reject);
    }),
    findHeader: (apiGmailMsgObj: GmailRes.GmailMsg | GmailRes.GmailMsg$payload, headerName: string) => {
      const node: GmailRes.GmailMsg$payload = apiGmailMsgObj.hasOwnProperty('payload') ? (apiGmailMsgObj as GmailRes.GmailMsg).payload : apiGmailMsgObj as GmailRes.GmailMsg$payload;
      if (typeof node.headers !== 'undefined') {
        for (const header of node.headers) {
          if (header.name.toLowerCase() === headerName.toLowerCase()) {
            return header.value;
          }
        }
      }
      return undefined;
    },
    findAtts: (msgOrPayloadOrPart: GmailRes.GmailMsg | GmailRes.GmailMsg$payload | GmailRes.GmailMsg$payload$part, internalResults: Att[] = [], internalMsgId?: string) => {
      if (msgOrPayloadOrPart.hasOwnProperty('payload')) {
        internalMsgId = (msgOrPayloadOrPart as GmailRes.GmailMsg).id;
        Google.gmail.findAtts((msgOrPayloadOrPart as GmailRes.GmailMsg).payload, internalResults, internalMsgId);
      }
      if (msgOrPayloadOrPart.hasOwnProperty('parts')) {
        for (const part of (msgOrPayloadOrPart as GmailRes.GmailMsg$payload).parts!) {
          Google.gmail.findAtts(part, internalResults, internalMsgId);
        }
      }
      if (msgOrPayloadOrPart.hasOwnProperty('body') && (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).body!.hasOwnProperty('attachmentId')) {
        internalResults.push(new Att({
          msgId: internalMsgId,
          id: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).body!.attachmentId,
          length: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).body!.size,
          name: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).filename,
          type: (msgOrPayloadOrPart as GmailRes.GmailMsg$payload$part).mimeType,
          inline: (Google.gmail.findHeader(msgOrPayloadOrPart, 'content-disposition') || '').toLowerCase().indexOf('inline') === 0,
        }));
      }
      return internalResults;
    },
    findBodies: (gmailMsg: GmailRes.GmailMsg | GmailRes.GmailMsg$payload | GmailRes.GmailMsg$payload$part, internalResults: SendableMsgBody = {}): SendableMsgBody => {
      const isGmailMsg = (v: any): v is GmailRes.GmailMsg => v && typeof (v as GmailRes.GmailMsg).payload !== 'undefined';
      const isGmailMsgPayload = (v: any): v is GmailRes.GmailMsg$payload => v && typeof (v as GmailRes.GmailMsg$payload).parts !== 'undefined';
      const isGmailMsgPayloadPart = (v: any): v is GmailRes.GmailMsg$payload$part => v && typeof (v as GmailRes.GmailMsg$payload$part).body !== 'undefined';
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
    fetchAtts: async (acctEmail: string, atts: Att[], progressCb?: ProgressCb) => {
      if (!atts.length) {
        return;
      }
      let lastProgressPercent = -1;
      const loadedAr: Array<number> = [];
      // 1.33 is a coefficient we need to multiply because total size we need to download is larger than all files together
      const total = atts.map(x => x.length).reduce((a, b) => a + b) * 1.33;
      const responses = await Promise.all(atts.map((a, index) => Google.gmail.attGet(acctEmail, a.msgId!, a.id!, (_, loaded, s) => {
        if (progressCb) {
          loadedAr[index] = loaded || 0;
          const totalLoaded = loadedAr.reduce((a, b) => a + b);
          const progressPercent = Math.round((totalLoaded * 100) / total);
          if (progressPercent !== lastProgressPercent) {
            lastProgressPercent = progressPercent;
            progressCb(progressPercent, totalLoaded, total);
          }
        }
      })));
      for (const i of responses.keys()) {
        atts[i].setData(responses[i].data);
      }
    },
    /**
     * This will keep triggering callback with new emails as they are being discovered
     */
    searchContacts: async (acctEmail: string, userQuery: string, knownContacts: Contact[], chunkedCb: ChunkedCb) => {
      let gmailQuery = `is:sent ${Google.GMAIL_USELESS_CONTACTS_FILTER} `;
      if (userQuery) {
        const variationsOfTo = userQuery.split(/[ .]/g).filter(v => !['com', 'org', 'net'].includes(v));
        if (!variationsOfTo.includes(userQuery)) {
          variationsOfTo.push(userQuery);
        }
        gmailQuery += '(';
        while (variationsOfTo.length) {
          gmailQuery += `to:${variationsOfTo.pop()}`;
          if (gmailQuery.length > Google.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
            break;
          }
          if (variationsOfTo.length > 1) {
            gmailQuery += ' OR ';
          }
        }
        gmailQuery += ')';
      }
      for (const contact of knownContacts.filter(c => Str.isEmailValid(c.email))) {
        if (gmailQuery.length > Google.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
          break;
        }
        gmailQuery += ` -to:${contact.email}`;
      }
      await Google.apiGmailLoopThroughEmailsToCompileContacts(acctEmail, gmailQuery, chunkedCb);
    },
    /**
     * Extracts the encrypted message from gmail api. Sometimes it's sent as a text, sometimes html, sometimes attachments in various forms.
     */
    extractArmoredBlock: async (acctEmail: string, msgId: string, format: GmailResponseFormat, progressCb?: ProgressCb): Promise<string> => {
      const gmailMsg = await Google.gmail.msgGet(acctEmail, msgId, format);
      if (format === 'full') {
        const bodies = Google.gmail.findBodies(gmailMsg);
        const atts = Google.gmail.findAtts(gmailMsg);
        const fromTextBody = Pgp.armor.clip(Buf.fromBase64UrlStr(bodies['text/plain'] || '').toUtfStr());
        if (fromTextBody) {
          return fromTextBody;
        }
        const fromHtmlBody = Pgp.armor.clip(Xss.htmlSanitizeAndStripAllTags(Buf.fromBase64UrlStr(bodies['text/html'] || '').toUtfStr(), '\n'));
        if (fromHtmlBody) {
          return fromHtmlBody;
        }
        if (atts.length) {
          for (const att of atts) {
            if (att.treatAs() === 'encryptedMsg') {
              await Google.gmail.fetchAtts(acctEmail, [att], progressCb);
              const armoredMsg = Pgp.armor.clip(att.getData().toUtfStr());
              if (!armoredMsg) {
                throw new FormatError('Problem extracting armored message', att.getData().toUtfStr());
              }
              return armoredMsg;
            }
          }
          throw new FormatError('Armored message not found', JSON.stringify(gmailMsg.payload, undefined, 2));
        } else {
          throw new FormatError('No attachments', JSON.stringify(gmailMsg.payload, undefined, 2));
        }
      } else { // format === raw
        const mimeMsg = Buf.fromBase64UrlStr(gmailMsg.raw!);
        const decoded = await Mime.decode(mimeMsg);
        if (decoded.text !== undefined) {
          const armoredMsg = Pgp.armor.clip(decoded.text); // todo - the message might be in attachments
          if (armoredMsg) {
            return armoredMsg;
          } else {
            throw new FormatError('Could not find armored message in parsed raw mime', mimeMsg.toUtfStr());
          }
        } else {
          throw new FormatError('No text in parsed raw mime', mimeMsg.toUtfStr());
        }
      }
    },
    fetchAcctAliases: async (acctEmail: string): Promise<GmailRes.GmailAliases> => Google.gmailCall(acctEmail, 'GET', 'settings/sendAs', {}),
    fetchMsgsHeadersBasedOnQuery: async (acctEmail: string, q: string, headerNames: string[], msgLimit: number) => {
      const { messages } = await Google.gmail.msgList(acctEmail, q, false);
      return await Google.extractHeadersFromMsgs(acctEmail, messages || [], headerNames, msgLimit);
    },
    fetchKeyBackups: async (acctEmail: string) => {
      const res = await Google.gmail.msgList(acctEmail, gmailBackupSearchQuery(acctEmail), true);
      if (!res.messages) {
        return [];
      }
      const msgIds = res.messages.map(m => m.id);
      const msgs = await Google.gmail.msgsGet(acctEmail, msgIds, 'full');
      const atts: Att[] = [];
      for (const msg of msgs) {
        atts.push(...Google.gmail.findAtts(msg));
      }
      await Google.gmail.fetchAtts(acctEmail, atts);
      const { keys } = await Pgp.key.readMany(Buf.fromUtfStr(atts.map(a => a.getData().toUtfStr()).join('\n')));
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

  private static apiGmailGetNewUniqueRecipientsFromHeaders = async (toHeaders: string[], allResults: Contact[], allRawEmails: string[]): Promise<Contact[]> => {
    if (!toHeaders.length) {
      return [];
    }
    const rawParsedResults: AddrParserResult[] = [];
    toHeaders = Value.arr.unique(toHeaders);
    for (const to of toHeaders) {
      rawParsedResults.push(...(window as unknown as BrowserWidnow)['emailjs-addressparser'].parse(to));
    }
    for (const rawParsedRes of rawParsedResults) {
      if (rawParsedRes.address && allRawEmails.indexOf(rawParsedRes.address) === -1) {
        allRawEmails.push(rawParsedRes.address);
      }
    }
    const newValidResults = await Promise.all(rawParsedResults
      .filter(r => r.address && Str.isEmailValid(r.address))
      .map(({ address, name }) => Store.dbContactObj({ email: address!, name }))); // address! because we .filter based on r.address being truthy
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
    const allResults: Contact[] = [];
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
      const uniqueNewValidResults = await Google.apiGmailGetNewUniqueRecipientsFromHeaders(headers.to, allResults, allRawEmails);
      if (!uniqueNewValidResults.length) {
        break;
      }
      allResults.push(...uniqueNewValidResults);
      chunkedCb({ new: uniqueNewValidResults, all: allResults });
    }
    chunkedCb({ new: [], all: allResults });
  }

  private static extractHeadersFromMsgs = async (acctEmail: string, msgsIds: GmailRes.GmailMsgList$message[], headerNames: string[], msgLimit: number): Promise<Dict<string[]>> => {
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
    client_id: "717284730244-ostjo2fdtr3ka4q9td69tdr9acmmru2p.apps.googleusercontent.com",
    url_code: `${GOOGLE_OAUTH_SCREEN_HOST}/o/oauth2/auth`,
    url_tokens: `${GOOGLE_API_HOST}/oauth2/v4/token`,
    url_redirect: "urn:ietf:wg:oauth:2.0:oob:auto",
    state_header: "CRYPTUP_STATE_",
    scopes: {
      profile: "https://www.googleapis.com/auth/userinfo.profile", // needed for openid
      compose: "https://www.googleapis.com/auth/gmail.compose",
      modify: 'https://www.googleapis.com/auth/gmail.modify',
      contacts: 'https://www.google.com/m8/feeds/',
    },
    legacy_scopes: {
      read: 'https://www.googleapis.com/auth/gmail.readonly', // deprecated in favor of modify, which also includes read
      gmail: 'https://mail.google.com/', // causes a freakish oauth warn: "can permannently delete all your email" ...
    }
  };

  public static hasReadScope = (scopes: string[]) => scopes.indexOf(GoogleAuth.OAUTH.scopes.modify) !== -1 || scopes.indexOf(GoogleAuth.OAUTH.legacy_scopes.read) !== -1;

  public static defaultScopes = (group: 'default' | 'contacts' | 'compose_only' = 'default') => {
    const { profile, contacts, compose, modify } = GoogleAuth.OAUTH.scopes;
    console.info(`Not using scope ${modify} because not approved on oauth screen yet`);
    const read = GoogleAuth.OAUTH.legacy_scopes.read; // todo - remove as soon as "modify" is approved by google
    if (group === 'default') {
      if (BUILD === 'consumer') {
        // todo - replace "read" with "modify" when approved by google
        return [profile, compose, read]; // consumer may freak out that extension asks for their contacts early on
      } else if (BUILD === 'enterprise') {
        // todo - replace "read" with "modify" when approved by google
        return [profile, compose, read, contacts]; // enterprise expects their contact search to work properly
      } else {
        throw new Error(`Unknown build ${BUILD}`);
      }
    } else if (group === 'contacts') {
      // todo - replace "read" with "modify" when approved by google
      return [profile, compose, read, contacts];
    } else if (group === 'compose_only') {
      return [profile, compose]; // consumer may freak out that the extension asks for read email permission
    } else {
      throw new Error(`Unknown scope group ${group}`);
    }
  }

  public static googleApiAuthHeader = async (acctEmail: string, forceRefresh = false): Promise<string> => {
    if (!acctEmail) {
      throw new Error('missing account_email in api_gmail_call');
    }
    const storage = await Store.getAcct(acctEmail, ['google_token_access', 'google_token_expires', 'google_token_scopes', 'google_token_refresh']);
    if (!storage.google_token_access || !storage.google_token_refresh) {
      throw new GoogleAcctNotConnected(`Account ${acctEmail} not connected to FlowCrypt Browser Extension`);
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

  public static apiGoogleCallRetryAuthErrorOneTime = async (acctEmail: string, request: JQuery.AjaxSettings): Promise<any> => {
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

  public static newAuthPopup = async ({ acctEmail, scopes }: { acctEmail?: string, scopes?: string[] }): Promise<AuthRes> => {
    if (acctEmail) {
      acctEmail = acctEmail.toLowerCase();
    }
    scopes = await GoogleAuth.apiGoogleAuthPopupPrepareAuthReqScopes(acctEmail, scopes || GoogleAuth.defaultScopes());
    const authRequest: AuthReq = { acctEmail, scopes, csrfToken: `csrf-${Pgp.password.random()}` };
    const url = GoogleAuth.apiGoogleAuthCodeUrl(authRequest);
    const oauthWin = await windowsCreate({ url, left: 100, top: 50, height: 700, width: 600, type: 'popup' });
    if (!oauthWin || !oauthWin.tabs || !oauthWin.tabs.length) {
      return { result: 'Error', error: 'No oauth window renturned after initiating it', acctEmail };
    }
    const authRes = await Promise.race([
      GoogleAuth.waitForAndProcessOauthWindowResult(oauthWin.id, acctEmail, scopes, authRequest.csrfToken),
      GoogleAuth.waitForOauthWindowClosed(oauthWin.id, acctEmail),
    ]);
    try {
      chrome.windows.remove(oauthWin.id);
    } catch (e) {
      if (String(e).indexOf('No window with id') === -1) {
        Catch.reportErr(e);
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

  private static processOauthResTitle = (title: string): { result: GoogleAuthWindowResult$result, code?: string, error?: string, csrf?: string } => {
    const parts = title.split(' ', 2);
    const result = parts[0] as GoogleAuthWindowResult$result;
    const params = Env.urlParams(['code', 'state', 'error'], parts[1]);
    let authReq: AuthReq;
    try {
      authReq = GoogleAuth.apiGoogleAuthStateUnpack(String(params.state));
    } catch (e) {
      return { result: 'Error', error: `Wrong oauth state response: ${e}` };
    }
    if (!['Success', 'Denied', 'Error'].includes(result)) {
      return { result: 'Error', error: `Unknown google auth result '${result}'` };
    }
    return { result, code: params.code ? String(params.code) : undefined, error: params.error ? String(params.error) : undefined, csrf: authReq.csrfToken };
  }

  /**
   * Is the title actually just url of the page? (means real title not loaded yet)
   */
  private static isAuthUrl = (title: string) => title.match(/^(?:https?:\/\/)?accounts\.google\.com/) !== null || title.startsWith(GOOGLE_OAUTH_SCREEN_HOST.replace(/^https?:\/\//, ''));

  private static isForwarding = (title: string) => title.match(/^Forwarding /) !== null;

  private static waitForAndProcessOauthWindowResult = async (windowId: number, acctEmail: string | undefined, scopes: string[], csrfToken: string): Promise<AuthRes> => {
    while (true) {
      const [oauth] = await tabsQuery({ windowId });
      if (oauth && oauth.title && oauth.title.includes(GoogleAuth.OAUTH.state_header) && !GoogleAuth.isAuthUrl(oauth.title) && !GoogleAuth.isForwarding(oauth.title)) {
        const { result, error, code, csrf } = GoogleAuth.processOauthResTitle(oauth.title);
        if (error === 'access_denied') {
          return { acctEmail, result: 'Denied', error }; // sometimes it was coming in as {"result":"Error","error":"access_denied"}
        }
        if (result === 'Success') {
          if (!csrf || csrf !== csrfToken) {
            return { acctEmail, result: 'Error', error: `Wrong oauth CSRF token. Please try again.` };
          }
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

  private static apiGoogleAuthStateUnpack = (state: string): AuthReq => {
    if (!state.startsWith(GoogleAuth.OAUTH.state_header)) {
      throw new Error('Missing oauth state header');
    }
    return JSON.parse(state.replace(GoogleAuth.OAUTH.state_header, '')) as AuthReq;
  }

  private static googleAuthSaveTokens = async (acctEmail: string, tokensObj: GoogleAuthTokensResponse, scopes: string[]) => {
    const openid = GoogleAuth.parseIdToken(tokensObj.id_token);
    const { full_name, picture } = await Store.getAcct(acctEmail, ['full_name', 'picture']);
    const toSave: AccountStore = {
      openid,
      google_token_access: tokensObj.access_token,
      google_token_expires: new Date().getTime() + (tokensObj.expires_in as number) * 1000,
      google_token_scopes: scopes,
      full_name: full_name || openid.name,
      picture: picture || openid.picture,
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
    url: Env.urlCreate(`${GOOGLE_API_HOST}/oauth2/v1/tokeninfo`, { access_token: accessToken }),
    crossDomain: true,
    async: true,
  }, Catch.stackTrace()) as any as Promise<GoogleAuthTokenInfo>

  /**
   * oauth token will be valid for another 2 min
   */
  private static googleApiIsAuthTokenValid = (s: AccountStore) => s.google_token_access && (!s.google_token_expires || s.google_token_expires > new Date().getTime() + (120 * 1000));

  // todo - would be better to use a TS type guard instead of the type cast when checking OpenId
  // check for things we actually use: photo/name/locale
  private static parseIdToken = (idToken: string): GmailRes.OpenId => JSON.parse(Buf.fromBase64UrlStr(idToken.split(/\./g)[1]).toUtfStr()) as GmailRes.OpenId;

  private static retrieveAndSaveAuthToken = async (authCode: string, scopes: string[]): Promise<string> => {
    const tokensObj = await GoogleAuth.googleAuthGetTokens(authCode);
    await GoogleAuth.googleAuthCheckAccessToken(tokensObj.access_token); // https://groups.google.com/forum/#!topic/oauth2-dev/QOFZ4G7Ktzg
    const { emailAddress } = await Google.gmail.usersMeProfile(undefined, tokensObj.access_token);
    await GoogleAuth.googleAuthSaveTokens(emailAddress, tokensObj, scopes);
    return emailAddress;
  }

  private static apiGoogleAuthPopupPrepareAuthReqScopes = async (acctEmail: string | undefined, addScopes: string[]): Promise<string[]> => {
    if (acctEmail) {
      const { google_token_scopes } = await Store.getAcct(acctEmail, ['google_token_scopes']);
      addScopes.push(...(google_token_scopes || []));
    }
    addScopes = Value.arr.unique(addScopes);
    if (addScopes.includes(GoogleAuth.OAUTH.legacy_scopes.read) && addScopes.includes(GoogleAuth.OAUTH.scopes.modify)) {
      addScopes = Value.arr.withoutVal(addScopes, GoogleAuth.OAUTH.legacy_scopes.read); // modify scope is a superset of read scope
    }
    // todo - removed these following lines once "modify" scope is verified
    if (addScopes.includes(GoogleAuth.OAUTH.scopes.modify)) {
      addScopes = Value.arr.withoutVal(addScopes, GoogleAuth.OAUTH.scopes.modify);
      addScopes.push(GoogleAuth.OAUTH.legacy_scopes.read);
    }
    return addScopes;
  }
}
