/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AddrParserResult, BrowserWindow } from '../../../browser/browser-window.js';
import { ChunkedCb, ProgressCb, EmailProviderContact } from '../../shared/api.js';
import { Dict, Str, Value, promiseAllWithLimit } from '../../../core/common.js';
import { EmailProviderApi, EmailProviderInterface, Backups } from '../email-provider-api.js';
import { GMAIL_GOOGLE_API_HOST, gmailBackupSearchQuery } from '../../../core/const.js';
import { GmailParser, GmailRes } from './gmail-parser.js';
import { Attachment } from '../../../core/attachment.js';
import { BrowserMsg } from '../../../browser/browser-msg.js';
import { Buf } from '../../../core/buf.js';
import { KeyUtil } from '../../../core/crypto/key.js';
import { Env } from '../../../browser/env.js';
import { Google } from './google.js';
import { GoogleOAuth } from '../../authentication/google/google-oauth.js';
import { SendableMsg } from '../sendable-msg.js';
import { KeyStore } from '../../../platform/store/key-store.js';
import { AjaxErr, ApiErr, MAX_RATE_LIMIT_ERROR_RETRY_COUNT } from '../../shared/api-error.js';
import { Time } from '../../../browser/time.js';

export type GmailResponseFormat = 'raw' | 'full' | 'metadata';

export class Gmail extends EmailProviderApi implements EmailProviderInterface {
  private readonly GMAIL_USELESS_CONTACTS_FILTER = '-to:txt.voice.google.com -to:craigslist.org';
  private readonly GMAIL_SEARCH_QUERY_LENGTH_LIMIT = 1400;

  public privatebuildSearchQueryOr = (arr: string[], quoted = false) => {
    if (quoted) {
      return '("' + arr.join('") OR ("') + '")';
    } else {
      return '(' + arr.join(') OR (') + ')';
    }
  };

  public threadGet = async (threadId: string, format?: GmailResponseFormat, progressCb?: ProgressCb, retryCount = 0): Promise<GmailRes.GmailThread> => {
    try {
      return await Google.gmailCall<GmailRes.GmailThread>(this.acctEmail, `threads/${threadId}`, { method: 'GET', data: { format } }, { download: progressCb });
    } catch (e) {
      if (ApiErr.isRateLimit(e) && retryCount < MAX_RATE_LIMIT_ERROR_RETRY_COUNT) {
        await Time.sleep(1000);
        return await this.threadGet(threadId, format, progressCb, retryCount + 1);
      }
      throw e;
    }
  };

  public threadList = async (labelId: string): Promise<GmailRes.GmailThreadList> => {
    return await Google.gmailCall<GmailRes.GmailThreadList>(this.acctEmail, `threads`, {
      method: 'GET',
      data: {
        labelIds: labelId !== 'ALL' ? labelId : undefined,
        includeSpamTrash: Boolean(labelId === 'SPAM' || labelId === 'TRASH'),
        // pageToken: page_token,
        // q,
        // maxResults
      },
    });
  };

  public threadModify = async (id: string, rmLabels: string[], addLabels: string[]): Promise<GmailRes.GmailThread> => {
    return await Google.gmailCall<GmailRes.GmailThread>(this.acctEmail, `threads/${id}/modify`, {
      method: 'POST',
      data: {
        removeLabelIds: rmLabels || [], // todo - insufficient permission - need https://github.com/FlowCrypt/flowcrypt-browser/issues/1304
        addLabelIds: addLabels || [],
      },
    });
  };

  public draftCreate = async (mimeMsg: string, threadId: string): Promise<GmailRes.GmailDraftCreate> => {
    return await Google.gmailCall<GmailRes.GmailDraftCreate>(this.acctEmail, 'drafts', {
      method: 'POST',
      data: {
        message: { raw: Buf.fromUtfStr(mimeMsg).toBase64UrlStr(), threadId },
      },
    });
  };

  public draftDelete = async (id: string): Promise<GmailRes.GmailDraftDelete> => {
    return await Google.gmailCall<GmailRes.GmailDraftDelete>(this.acctEmail, 'drafts/' + id, { method: 'DELETE' });
  };

  public draftUpdate = async (id: string, mimeMsg: string, threadId: string): Promise<GmailRes.GmailDraftUpdate> => {
    return await Google.gmailCall<GmailRes.GmailDraftUpdate>(this.acctEmail, `drafts/${id}`, {
      method: 'PUT',
      data: {
        message: { raw: Buf.fromUtfStr(mimeMsg).toBase64UrlStr(), threadId },
      },
    });
  };

  public draftGet = async (id: string, format: GmailResponseFormat = 'full'): Promise<GmailRes.GmailDraftGet> => {
    return await Google.gmailCall<GmailRes.GmailDraftGet>(this.acctEmail, `drafts/${id}`, { method: 'GET', data: { format } });
  };

  public draftList = async (): Promise<GmailRes.GmailDraftList> => {
    return await Google.gmailCall<GmailRes.GmailDraftList>(this.acctEmail, 'drafts');
  };

  public draftSend = async (id: string): Promise<GmailRes.GmailDraftSend> => {
    return await Google.gmailCall<GmailRes.GmailDraftSend>(this.acctEmail, 'drafts/send', { method: 'POST', data: { id } });
  };

  public msgSend = async (sendableMsg: SendableMsg, progressCb?: ProgressCb): Promise<GmailRes.GmailMsgSend> => {
    const cbs = { upload: progressCb || Value.noop };
    const jsonPart = JSON.stringify({ threadId: sendableMsg.thread });
    const mimeMsg = await sendableMsg.toMime();
    const request = Google.encodeAsMultipartRelated({
      'application/json; charset=UTF-8': jsonPart,
      'message/rfc822': mimeMsg,
    });
    return await Google.gmailCall<GmailRes.GmailMsgSend>(
      this.acctEmail,
      'messages/send',
      { method: 'POST', data: request.body, contentType: request.contentType, dataType: 'TEXT' },
      cbs
    );
  };

  public msgList = async (q: string, includeDeleted = false, pageToken?: string): Promise<GmailRes.GmailMsgList> => {
    return await Google.gmailCall<GmailRes.GmailMsgList>(this.acctEmail, 'messages', {
      method: 'GET',
      data: {
        q,
        includeSpamTrash: includeDeleted,
        pageToken,
      },
    });
  };

  /**
   * Attempting to `msgGet format:raw` from within content scripts would likely fail if the mime message is 1MB or larger,
   * because strings over 1 MB may fail to get to/from bg page. A way to mitigate that would be to pass `R.GmailMsg$raw` prop
   * as a Buf instead of a string.
   */
  public msgGet = async (msgId: string, format: GmailResponseFormat, progressCb?: ProgressCb, retryCount = 0): Promise<GmailRes.GmailMsg> => {
    try {
      return await Google.gmailCall<GmailRes.GmailMsg>(
        this.acctEmail,
        `messages/${msgId}`,
        { method: 'GET', data: { format: format || 'full' } },
        progressCb ? { download: progressCb } : undefined
      );
    } catch (e) {
      if (ApiErr.isRateLimit(e) && retryCount < MAX_RATE_LIMIT_ERROR_RETRY_COUNT) {
        await Time.sleep(1000);
        return await this.msgGet(msgId, format, progressCb, retryCount + 1);
      }
      throw e;
    }
  };

  public msgsGet = async (msgIds: string[], format: GmailResponseFormat): Promise<GmailRes.GmailMsg[]> => {
    return await promiseAllWithLimit(
      30,
      msgIds.map(id => () => this.msgGet(id, format))
    );
  };

  public labelsGet = async (): Promise<GmailRes.GmailLabels> => {
    return await Google.gmailCall<GmailRes.GmailLabels>(this.acctEmail, 'labels', { method: 'GET' });
  };

  public attachmentGet = async (attachment: Attachment, progress?: { download: ProgressCb }): Promise<GmailRes.GmailAttachment> => {
    type RawGmailAttRes = { attachmentId: string; size: number; data: string };
    const { attachmentId, size, data } = await Google.gmailCall<RawGmailAttRes>(
      this.acctEmail,
      `messages/${attachment.msgId}/attachments/${attachment.id}`,
      { method: 'GET' },
      progress
    );
    return { attachmentId, size, data: Buf.fromBase64UrlStr(data) }; // data should be a Buf for ease of passing to/from bg page
  };

  public attachmentGetChunk = async (msgId: string, attachmentId: string, treatAs: string): Promise<Buf> => {
    if (Env.isContentScript()) {
      // content script CORS not allowed anymore, have to drag it through background page
      // https://www.chromestatus.com/feature/5629709824032768
      const { chunk } = await BrowserMsg.send.bg.await.ajaxGmailAttachmentGetChunk({
        acctEmail: this.acctEmail,
        msgId,
        attachmentId,
        treatAs,
      });
      return chunk;
    }
    let totalBytes = 0;
    const minBytes = 1000; // Define minBytes as per your requirement
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
          if (!chunk.endsWith('"') && chunk[chunk.length - 2] !== '"') {
            chunk += '"}'; // json end
          } else if (!chunk.endsWith('}')) {
            chunk += '}'; // json end
          }
          let parsedJsonDataField;
          try {
            parsedJsonDataField = (JSON.parse(chunk) as { data: string }).data;
          } catch (e) {
            console.info(e);
            reject(new Error('Chunk response could not be parsed'));
            return;
          }
          for (let i = 0; parsedJsonDataField && i < 50; i++) {
            try {
              resolve(Buf.fromBase64UrlStr(parsedJsonDataField));
              return;
            } catch {
              // the chunk of data may have been cut at an inconvenient index
              // shave off up to 50 trailing characters until it can be decoded
              parsedJsonDataField = parsedJsonDataField.slice(0, -1);
            }
          }
          reject(new Error('Chunk response could not be decoded'));
        }
      };
      GoogleOAuth.googleApiAuthHeader(this.acctEmail)
        .then(async authHeader => {
          const url = `${GMAIL_GOOGLE_API_HOST}/gmail/v1/users/me/messages/${msgId}/attachments/${attachmentId}`;
          const response: Response = await fetch(url, {
            method: 'GET',
            headers: authHeader,
          });

          if (!response.ok) throw AjaxErr.fromFetchResponse(response);
          if (!response.body) throw AjaxErr.fromNetErr('No response body!');
          const reader: ReadableStreamDefaultReader<Uint8Array> = response.body.getReader();
          let completeChunk = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = new TextDecoder().decode(value);
            totalBytes += value.length; // Update total bytes based on the Uint8Array length
            completeChunk += chunk;
            if (totalBytes >= minBytes || treatAs === 'publicKey') {
              // Process and return the chunk if the conditions are met
              return processChunkAndResolve(completeChunk); // Make sure this method returns Buf
            }
          }

          // If the loop completes without returning, it means the conditions were never met.
          // Depending on your needs, you might throw an error or handle this scenario differently.
          throw new Error('Failed to meet the minimum byte requirement or condition.');
        })

        .catch(reject);
    });
  };

  public fetchAttachmentsMissingData = async (attachments: Attachment[], progressCb?: ProgressCb) => {
    const attachmentsMissingData = attachments.filter(a => !a.hasData());
    if (!attachmentsMissingData.length) {
      return;
    }
    let lastProgressPercent = -1;
    const loadedAr: number[] = [];
    // 1.33 is approximate ratio of downloaded data to what we expected, likely due to encoding
    const total = attachmentsMissingData.map(x => x.length).reduce((a, b) => a + b) * 1.33;
    const responses = await Promise.all(
      attachmentsMissingData.map((a, index) =>
        this.attachmentGet(a, {
          download: (_, loaded) => {
            if (progressCb) {
              loadedAr[index] = loaded || 0;
              const totalLoaded = loadedAr.reduce((a, b) => a + b);
              const progressPercent = Math.round((totalLoaded * 100) / total);
              if (progressPercent !== lastProgressPercent) {
                lastProgressPercent = progressPercent;
                progressCb(progressPercent, totalLoaded, total);
              }
            }
          },
        })
      )
    );
    for (const i of responses.keys()) {
      attachmentsMissingData[i].setData(responses[i].data);
    }
  };

  public fetchAttachment = async (a: Attachment, progressFunction: (expectedTransferSize: number) => { download: ProgressCb }) => {
    const expectedTransferSize = a.length * 1.33; // todo: remove code duplication
    const response = await this.attachmentGet(a, progressFunction(expectedTransferSize));
    a.setData(response.data);
  };

  /**
   * This will keep triggering callback with new emails as they are being discovered
   */
  public guessContactsFromSentEmails = async (userQuery: string, knownEmails: string[], chunkedCb: ChunkedCb): Promise<void> => {
    userQuery = userQuery.toLowerCase();
    let gmailQuery = `is:sent ${this.GMAIL_USELESS_CONTACTS_FILTER} `;
    const needles: string[] = [];
    if (userQuery) {
      const needlesWithoutSpaces = userQuery.split(/ +/g);
      needles.push(
        ...needlesWithoutSpaces
          .map(bigNeedle => {
            const email = Str.parseEmail(bigNeedle);
            if (email?.email) {
              const match = /^(.*@.+)\.[^@]+?$/.exec(email.email);
              if (match) bigNeedle = match[1]; // omit the top-level domain
            }
            return bigNeedle.split('.').filter(v => !['com', 'org', 'net'].includes(v));
          })
          .reduce((a, b) => [...a, ...b])
      );
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
    for (const email of knownEmails) {
      if (gmailQuery.length > this.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
        break;
      }
      gmailQuery += ` -to:${email}`;
    }
    await this.apiGmailLoopThroughEmailsToCompileContacts(needles, gmailQuery, chunkedCb);
  };

  public fetchAcctAliases = async (): Promise<GmailRes.GmailAliases> => {
    const res = await Google.gmailCall<GmailRes.GmailAliases>(this.acctEmail, 'settings/sendAs');
    for (const sendAs of res.sendAs) {
      sendAs.sendAsEmail = sendAs.sendAsEmail.toLowerCase();
    }
    return res;
  };

  public fetchMsgsHeadersBasedOnQuery = async (q: string, headerNames: string[], msgLimit: number) => {
    const { messages } = await this.msgList(q, false);
    return await this.extractHeadersFromMsgs(messages || [], headerNames, msgLimit);
  };

  public fetchKeyBackups = async (): Promise<Backups> => {
    const res = await this.msgList(gmailBackupSearchQuery(this.acctEmail), true);
    const msgIds = (res.messages || []).map(m => m.id);
    const msgs = await this.msgsGet(msgIds, 'full');
    const attachments: Attachment[] = [];
    for (const msg of msgs) {
      attachments.push(...GmailParser.findAttachments(msg, msg.id));
    }
    await this.fetchAttachmentsMissingData(attachments);
    const { keys: foundBackupKeys } = await KeyUtil.readMany(Buf.fromUtfStr(attachments.map(a => a.getData().toUtfStr()).join('\n')));
    const backups = await Promise.all(foundBackupKeys.map(k => KeyUtil.keyInfoObj(k)));
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
  };

  private apiGmailBuildFilteredQuery = (query: string, allRawEmails: string[]) => {
    let filteredQuery = query;
    for (const rawEmail of allRawEmails) {
      filteredQuery += ` -to:"${rawEmail}"`;
      if (filteredQuery.length > this.GMAIL_SEARCH_QUERY_LENGTH_LIMIT) {
        return filteredQuery;
      }
    }
    return filteredQuery;
  };

  private apiGmailGetNewUniqueRecipientsFromHeaders = async (
    toHeaders: string[],
    allResults: EmailProviderContact[],
    allRawEmails: string[]
  ): Promise<EmailProviderContact[]> => {
    if (!toHeaders.length) {
      return [];
    }
    const rawParsedResults: AddrParserResult[] = [];
    toHeaders = Value.arr.unique(toHeaders);
    for (const to of toHeaders) {
      rawParsedResults.push(...(window as unknown as BrowserWindow)['emailjs-addressparser'].parse(to));
    }
    for (const rawParsedRes of rawParsedResults) {
      if (rawParsedRes.address && !allRawEmails.includes(rawParsedRes.address)) {
        allRawEmails.push(rawParsedRes.address);
      }
    }
    const rawValidEmails = rawParsedResults.filter(r => r.address && Str.isEmailValid(r.address));
    const newValidResults: EmailProviderContact[] = await Promise.all(
      rawValidEmails.map(a => {
        return { email: a.address!, name: a.name }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
      })
    );
    const uniqueNewValidResults: EmailProviderContact[] = [];
    for (const newValidRes of newValidResults) {
      if (!allResults.map(c => c.email).includes(newValidRes.email)) {
        const foundIndex = uniqueNewValidResults.map(c => c.email).indexOf(newValidRes.email);
        if (foundIndex === -1) {
          uniqueNewValidResults.push(newValidRes);
        } else if (newValidRes.name && !uniqueNewValidResults[foundIndex].name) {
          uniqueNewValidResults[foundIndex].name = newValidRes.name; // prefer to also save name if first encountered result is missing it
        }
      }
    }
    return uniqueNewValidResults;
  };

  private apiGmailLoopThroughEmailsToCompileContacts = async (needles: string[], gmailQuery: string, chunkedCb: ChunkedCb) => {
    const allResults: EmailProviderContact[] = [];
    const allRawEmails: string[] = [];
    const allMatchingResults: EmailProviderContact[] = [];
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
  };

  private doesGmailsContactGuessResultMatchNeedles = (needles: string[], contact: EmailProviderContact): boolean => {
    if (!needles.length) {
      return true; // no search query provided, so anything matches
    }
    const comparable = `${contact.email}\n${contact.name || ''}`.toLowerCase();
    return !!needles.find(needle => comparable.includes(needle));
  };

  private extractHeadersFromMsgs = async (msgsIds: GmailRes.GmailMsgList$message[], headerNames: string[], msgLimit: number): Promise<Dict<string[]>> => {
    const headerVals: Dict<string[]> = {};
    for (const headerName of headerNames) {
      headerVals[headerName] = [];
    }
    for (const msg of await this.msgsGet(
      msgsIds.slice(0, msgLimit).map(m => m.id),
      'metadata'
    )) {
      for (const headerName of headerNames) {
        const value = GmailParser.findHeader(msg, headerName);
        if (typeof value !== 'undefined') {
          headerVals[headerName].push(value);
        }
      }
    }
    return headerVals;
  };
}
