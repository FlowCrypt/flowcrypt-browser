/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AddrParserResult, BrowserWindow } from '../../../browser/browser-window.js';
import { ChunkedCb, ProgressCb } from '../../api.js';
import { Dict, Str, Value } from '../../../core/common.js';
import { EmailProviderApi, EmailProviderInterface, Backups } from '../email-provider-api.js';
import { GOOGLE_API_HOST, gmailBackupSearchQuery } from '../../../core/const.js';
import { GmailParser, GmailRes } from './gmail-parser.js';
import { AjaxErr } from '../../error/api-error-types.js';
import { Att } from '../../../core/att.js';
import { BrowserMsg } from '../../../browser/browser-msg.js';
import { Buf } from '../../../core/buf.js';
import { Catch } from '../../../platform/catch.js';
import { Contact, KeyUtil } from '../../../core/crypto/key.js';
import { Env } from '../../../browser/env.js';
import { FormatError } from '../../../core/crypto/pgp/pgp-msg.js';
import { Google } from '../../google.js';
import { GoogleAuth } from '../../google-auth.js';
import { Mime } from '../../../core/mime.js';
import { PgpArmor } from '../../../core/crypto/pgp/pgp-armor.js';
import { SendableMsg } from '../sendable-msg.js';
import { Xss } from '../../../platform/xss.js';
import { KeyStore } from '../../../platform/store/key-store.js';
import { ContactStore } from '../../../platform/store/contact-store.js';

export type GmailResponseFormat = 'raw' | 'full' | 'metadata';

export class Gmail extends EmailProviderApi implements EmailProviderInterface {

  private readonly GMAIL_USELESS_CONTACTS_FILTER = '-to:txt.voice.google.com -to:craigslist.org';
  private readonly GMAIL_SEARCH_QUERY_LENGTH_LIMIT = 1400;

  public privatebuildSearchQueryOr = (arr: string[], quoted: boolean = false) => {
    if (quoted) {
      return '("' + arr.join('") OR ("') + '")';
    } else {
      return '(' + arr.join(') OR (') + ')';
    }
  }

  public threadGet = async (threadId: string, format?: GmailResponseFormat, progressCb?: ProgressCb): Promise<GmailRes.GmailThread> => {
    return await Google.gmailCall<GmailRes.GmailThread>(this.acctEmail, 'GET', `threads/${threadId}`, { format }, { download: progressCb });
  }

  public threadList = async (labelId: string): Promise<GmailRes.GmailThreadList> => {
    return await Google.gmailCall<GmailRes.GmailThreadList>(this.acctEmail, 'GET', `threads`, {
      labelIds: labelId !== 'ALL' ? labelId : undefined,
      includeSpamTrash: Boolean(labelId === 'SPAM' || labelId === 'TRASH'),
      // pageToken: page_token,
      // q,
      // maxResults
    });
  }

  public threadModify = async (id: string, rmLabels: string[], addLabels: string[]): Promise<GmailRes.GmailThread> => {
    return await Google.gmailCall<GmailRes.GmailThread>(this.acctEmail, 'POST', `threads/${id}/modify`, {
      removeLabelIds: rmLabels || [], // todo - insufficient permission - need https://github.com/FlowCrypt/flowcrypt-browser/issues/1304
      addLabelIds: addLabels || [],
    });
  }

  public draftCreate = async (mimeMsg: string, threadId: string): Promise<GmailRes.GmailDraftCreate> => {
    return await Google.gmailCall<GmailRes.GmailDraftCreate>(this.acctEmail, 'POST', 'drafts', { message: { raw: Buf.fromUtfStr(mimeMsg).toBase64UrlStr(), threadId } });
  }

  public draftDelete = async (id: string): Promise<GmailRes.GmailDraftDelete> => {
    return await Google.gmailCall<GmailRes.GmailDraftDelete>(this.acctEmail, 'DELETE', 'drafts/' + id, undefined);
  }

  public draftUpdate = async (id: string, mimeMsg: string): Promise<GmailRes.GmailDraftUpdate> => {
    return await Google.gmailCall<GmailRes.GmailDraftUpdate>(this.acctEmail, 'PUT', `drafts/${id}`, { message: { raw: Buf.fromUtfStr(mimeMsg).toBase64UrlStr() } });
  }

  public draftGet = async (id: string, format: GmailResponseFormat = 'full'): Promise<GmailRes.GmailDraftGet> => {
    return await Google.gmailCall<GmailRes.GmailDraftGet>(this.acctEmail, 'GET', `drafts/${id}`, { format });
  }

  public draftList = async (): Promise<GmailRes.GmailDraftList> => {
    return await Google.gmailCall<GmailRes.GmailDraftList>(this.acctEmail, 'GET', 'drafts', undefined);
  }

  public draftSend = async (id: string): Promise<GmailRes.GmailDraftSend> => {
    return await Google.gmailCall<GmailRes.GmailDraftSend>(this.acctEmail, 'POST', 'drafts/send', { id });
  }

  public msgSend = async (sendableMsg: SendableMsg, progressCb?: ProgressCb): Promise<GmailRes.GmailMsgSend> => {
    const cbs = { upload: progressCb || Value.noop };
    const jsonPart = JSON.stringify({ threadId: sendableMsg.thread });
    const mimeMsg = await sendableMsg.toMime();
    const request = Google.encodeAsMultipartRelated({ 'application/json; charset=UTF-8': jsonPart, 'message/rfc822': mimeMsg });
    return await Google.gmailCall<GmailRes.GmailMsgSend>(this.acctEmail, 'POST', 'messages/send', request.body, cbs, request.contentType);
  }

  public msgList = async (q: string, includeDeleted: boolean = false, pageToken?: string): Promise<GmailRes.GmailMsgList> => {
    return await Google.gmailCall<GmailRes.GmailMsgList>(this.acctEmail, 'GET', 'messages', { q, includeSpamTrash: includeDeleted, pageToken });
  }

  /**
   * Attempting to `msgGet format:raw` from within content scripts would likely fail if the mime message is 1MB or larger,
   * because strings over 1 MB may fail to get to/from bg page. A way to mitigate that would be to pass `R.GmailMsg$raw` prop
   * as a Buf instead of a string.
   */
  public msgGet = async (msgId: string, format: GmailResponseFormat, progressCb?: ProgressCb): Promise<GmailRes.GmailMsg> => {
    return await Google.gmailCall<GmailRes.GmailMsg>(this.acctEmail, 'GET', `messages/${msgId}`, { format: format || 'full' }, { download: progressCb });
  }

  public msgsGet = async (msgIds: string[], format: GmailResponseFormat): Promise<GmailRes.GmailMsg[]> => {
    return await Promise.all(msgIds.map(id => this.msgGet(id, format)));
  }

  public labelsGet = async (): Promise<GmailRes.GmailLabels> => {
    return await Google.gmailCall<GmailRes.GmailLabels>(this.acctEmail, 'GET', `labels`, {});
  }

  public attGet = async (msgId: string, attId: string, progressCb?: ProgressCb): Promise<GmailRes.GmailAtt> => {
    type RawGmailAttRes = { attachmentId: string, size: number, data: string };
    const { attachmentId, size, data } = await Google.gmailCall<RawGmailAttRes>(this.acctEmail, 'GET', `messages/${msgId}/attachments/${attId}`, {}, { download: progressCb });
    return { attachmentId, size, data: Buf.fromBase64UrlStr(data) }; // data should be a Buf for ease of passing to/from bg page
  }

  public attGetChunk = async (msgId: string, attId: string): Promise<Buf> => {
    if (Env.isContentScript()) {
      // content script CORS not allowed anymore, have to drag it through background page
      // https://www.chromestatus.com/feature/5629709824032768
      const { chunk } = await BrowserMsg.send.bg.await.ajaxGmailAttGetChunk({ acctEmail: this.acctEmail, msgId, attId });
      return chunk;
    }
    const stack = Catch.stackTrace();
    const minBytes = 1000;
    let processed = 0;
    return await new Promise((resolve, reject) => {
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
      GoogleAuth.googleApiAuthHeader(this.acctEmail).then(authToken => {
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
              reject(AjaxErr.fromXhr({ status, readyState: r.readyState }, { method, url }, stack));
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
              reject(AjaxErr.fromXhr({ status, readyState: r.readyState }, { method, url }, stack));
              window.clearInterval(responsePollInterval);
            }
          }
        };
      }).catch(reject);
    });
  }

  public fetchAtts = async (atts: Att[], progressCb?: ProgressCb) => {
    if (!atts.length) {
      return;
    }
    let lastProgressPercent = -1;
    const loadedAr: Array<number> = [];
    // 1.33 is approximate ratio of downloaded data to what we expected, likely due to encoding
    const total = atts.map(x => x.length).reduce((a, b) => a + b) * 1.33;
    const responses = await Promise.all(atts.map((a, index) => this.attGet(a.msgId!, a.id!, (_, loaded, s) => {
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
  }

  /**
   * This will keep triggering callback with new emails as they are being discovered
   */
  public guessContactsFromSentEmails = async (userQuery: string, knownContacts: Contact[], chunkedCb: ChunkedCb): Promise<void> => {
    userQuery = userQuery.toLowerCase();
    let gmailQuery = `is:sent ${this.GMAIL_USELESS_CONTACTS_FILTER} `;
    const needles: string[] = [];
    if (userQuery) {
      needles.push(...userQuery.split(/[ .]/g).filter(v => !['com', 'org', 'net'].includes(v)));
      if (!needles.includes(userQuery)) {
        needles.push(userQuery);
      }
      gmailQuery += '(';
      for (let i = 0; i < needles.length; i++) {
        const needle = needles[i];
        gmailQuery += `to:${needle}`;
        if (gmailQuery.length > this.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
          break;
        }
        if (i < needles.length - 1) {
          gmailQuery += ' OR ';
        }
      }
      gmailQuery += ')';
    }
    for (const contact of knownContacts.filter(c => Str.isEmailValid(c.email))) {
      if (gmailQuery.length > this.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
        break;
      }
      gmailQuery += ` -to:${contact.email}`;
    }
    await this.apiGmailLoopThroughEmailsToCompileContacts(needles, gmailQuery, chunkedCb);
  }

  /**
   * Extracts the encrypted message from gmail api. Sometimes it's sent as a text, sometimes html, sometimes attachments in various forms.
   */
  public extractArmoredBlock = async (msgId: string, format: GmailResponseFormat, progressCb?: ProgressCb): Promise<{ armored: string, subject?: string, isPwdMsg: boolean }> => {
    // only track progress in this call if we are getting RAW mime, because these tend to be big, while 'full' and 'metadata' are tiny
    // since we often do full + get attachments below, the user would see 100% after the first short request,
    //   and then again 0% when attachments start downloading, which would be confusing
    const gmailMsg = await this.msgGet(msgId, format, format === 'raw' ? progressCb : undefined);
    const isPwdMsg = /https:\/\/flowcrypt\.com\/[a-zA-Z0-9]{10}$/.test(gmailMsg.snippet || '');
    const subject = gmailMsg.payload ? GmailParser.findHeader(gmailMsg.payload, 'subject') : undefined;
    if (format === 'full') {
      const bodies = GmailParser.findBodies(gmailMsg);
      const atts = GmailParser.findAtts(gmailMsg);
      const fromTextBody = PgpArmor.clip(Buf.fromBase64UrlStr(bodies['text/plain'] || '').toUtfStr());
      if (fromTextBody) {
        return { armored: fromTextBody, subject, isPwdMsg };
      }
      const fromHtmlBody = PgpArmor.clip(Xss.htmlSanitizeAndStripAllTags(Buf.fromBase64UrlStr(bodies['text/html'] || '').toUtfStr(), '\n'));
      if (fromHtmlBody) {
        return { armored: fromHtmlBody, subject, isPwdMsg };
      }
      if (atts.length) {
        for (const att of atts) {
          if (att.treatAs() === 'encryptedMsg') {
            await this.fetchAtts([att], progressCb);
            const armoredMsg = PgpArmor.clip(att.getData().toUtfStr());
            if (!armoredMsg) {
              throw new FormatError('Problem extracting armored message', att.getData().toUtfStr());
            }
            return { armored: armoredMsg, subject, isPwdMsg };
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
        const armoredMsg = PgpArmor.clip(decoded.text); // todo - the message might be in attachments
        if (armoredMsg) {
          return { armored: armoredMsg, subject, isPwdMsg };
        } else {
          throw new FormatError('Could not find armored message in parsed raw mime', mimeMsg.toUtfStr());
        }
      } else {
        throw new FormatError('No text in parsed raw mime', mimeMsg.toUtfStr());
      }
    }
  }

  public fetchAcctAliases = async (): Promise<GmailRes.GmailAliases> => {
    const res = await Google.gmailCall<GmailRes.GmailAliases>(this.acctEmail, 'GET', 'settings/sendAs', {}) as GmailRes.GmailAliases;
    for (const sendAs of res.sendAs) {
      sendAs.sendAsEmail = sendAs.sendAsEmail.toLowerCase();
    }
    return res;
  }

  public fetchMsgsHeadersBasedOnQuery = async (q: string, headerNames: string[], msgLimit: number) => {
    const { messages } = await this.msgList(q, false);
    return await this.extractHeadersFromMsgs(messages || [], headerNames, msgLimit);
  }

  public fetchKeyBackups = async (): Promise<Backups> => {
    const res = await this.msgList(gmailBackupSearchQuery(this.acctEmail), true);
    const msgIds = (res.messages || []).map(m => m.id);
    const msgs = await this.msgsGet(msgIds, 'full');
    const atts: Att[] = [];
    for (const msg of msgs) {
      atts.push(...GmailParser.findAtts(msg));
    }
    await this.fetchAtts(atts);
    const { keys: foundBackupKeys } = await KeyUtil.readMany(Buf.fromUtfStr(atts.map(a => a.getData().toUtfStr()).join('\n')));
    const backups = await Promise.all(foundBackupKeys.map(k => KeyStore.keyInfoObj(k)));
    const imported = await KeyStore.get(this.acctEmail);
    const importedLongids = imported.map(ki => ki.longid);
    const backedUpLongids = backups.map(ki => ki.longid);
    const keyinfos = {
      backups,
      backupsImported: backups.filter(backupKi => importedLongids.includes(backupKi.longid)),
      backupsNotImported: backups.filter(backupKi => !importedLongids.includes(backupKi.longid)),
      importedNotBackedUp: imported.filter(importedKi => !backedUpLongids.includes(importedKi.longid)),
    };
    const longids = {
      backups: Value.arr.unique(keyinfos.backups.map(ki => ki.longid)),
      backupsImported: Value.arr.unique(keyinfos.backupsImported.map(ki => ki.longid)),
      backupsNotImported: Value.arr.unique(keyinfos.backupsNotImported.map(ki => ki.longid)),
      importedNotBackedUp: Value.arr.unique(keyinfos.importedNotBackedUp.map(ki => ki.longid)),
    };
    return { keyinfos, longids };
  }

  private apiGmailBuildFilteredQuery = (query: string, allRawEmails: string[]) => {
    let filteredQuery = query;
    for (const rawEmail of allRawEmails) {
      filteredQuery += ` -to:"${rawEmail}"`;
      if (filteredQuery.length > this.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
        return filteredQuery;
      }
    }
    return filteredQuery;
  }

  private apiGmailGetNewUniqueRecipientsFromHeaders = async (toHeaders: string[], allResults: Contact[], allRawEmails: string[]): Promise<Contact[]> => {
    if (!toHeaders.length) {
      return [];
    }
    const rawParsedResults: AddrParserResult[] = [];
    toHeaders = Value.arr.unique(toHeaders);
    for (const to of toHeaders) {
      rawParsedResults.push(...(window as unknown as BrowserWindow)['emailjs-addressparser'].parse(to));
    }
    for (const rawParsedRes of rawParsedResults) {
      if (rawParsedRes.address && allRawEmails.indexOf(rawParsedRes.address) === -1) {
        allRawEmails.push(rawParsedRes.address);
      }
    }
    const rawValidEmails = rawParsedResults.filter(r => r.address && Str.isEmailValid(r.address));
    const newValidResults = await Promise.all(rawValidEmails.map(({ address, name }) => ContactStore.obj({ email: address!, name })));
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

  private apiGmailLoopThroughEmailsToCompileContacts = async (needles: string[], gmailQuery: string, chunkedCb: ChunkedCb) => {
    const allResults: Contact[] = [];
    const allRawEmails: string[] = [];
    const allMatchingResults: Contact[] = [];
    let lastFilteredQuery = '';
    let continueSearching = true;
    while (continueSearching) {
      const filteredQuery = this.apiGmailBuildFilteredQuery(gmailQuery, allRawEmails);
      if (filteredQuery === lastFilteredQuery) {
        break;
      }
      if (filteredQuery.length > this.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
        continueSearching = false;
      }
      const headers = await this.fetchMsgsHeadersBasedOnQuery(filteredQuery, ['to'], 50);
      lastFilteredQuery = filteredQuery;
      const uniqueNewValidResults = await this.apiGmailGetNewUniqueRecipientsFromHeaders(headers.to, allResults, allRawEmails);
      if (!uniqueNewValidResults.length) {
        break;
      }
      allResults.push(...uniqueNewValidResults);
      const uniqueNewValidMatchingResults = uniqueNewValidResults.filter(r => this.doesGmailsContactGuessResultMatchNeedles(needles, r));
      if (uniqueNewValidMatchingResults.length) {
        allMatchingResults.push(...uniqueNewValidMatchingResults);
        await chunkedCb({ new: uniqueNewValidMatchingResults, all: allMatchingResults });
      }
    }
    await chunkedCb({ new: [], all: allResults });
  }

  private doesGmailsContactGuessResultMatchNeedles = (needles: string[], contact: Contact): boolean => {
    if (!needles.length) {
      return true; // no search query provided, so anything matches
    }
    const comparable = `${contact.email}\n${contact.name || ''}`.toLowerCase();
    return !!needles.find(needle => comparable.includes(needle));
  }

  private extractHeadersFromMsgs = async (msgsIds: GmailRes.GmailMsgList$message[], headerNames: string[], msgLimit: number): Promise<Dict<string[]>> => {
    const headerVals: Dict<string[]> = {};
    for (const headerName of headerNames) {
      headerVals[headerName] = [];
    }
    for (const msg of await this.msgsGet(msgsIds.slice(0, msgLimit).map(m => m.id), 'metadata')) {
      for (const headerName of headerNames) {
        const value = GmailParser.findHeader(msg, headerName);
        if (typeof value !== 'undefined') {
          headerVals[headerName].push(value);
        }
      }
    }
    return headerVals;
  }

}
