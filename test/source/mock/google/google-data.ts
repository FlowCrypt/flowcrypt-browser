/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AddressObject, ParsedMail, StructuredHeader } from 'mailparser';

import UserMessages from '../../../samples/mock-data';
import { Util } from '../../util/index';
import { readFileSync, readdirSync } from 'fs';
import { acctsWithoutMockData } from '../../mock';
import { Buf } from '../../core/buf';

type GmailMsg$header = { name: string, value: string };
type GmailMsg$payload$body = { attachmentId?: string, size: number, data?: string };
type GmailMsg$payload$part = { partId?: string, body?: GmailMsg$payload$body, filename?: string, mimeType?: string, headers?: GmailMsg$header[], parts?: GmailMsg$payload$part[] };
type GmailMsg$payload = { partId?: string, filename?: string, parts?: GmailMsg$payload$part[], headers?: GmailMsg$header[], mimeType?: string, body?: GmailMsg$payload$body };
type GmailMsg$labelId = 'INBOX' | 'UNREAD' | 'CATEGORY_PERSONAL' | 'IMPORTANT' | 'SENT' | 'CATEGORY_UPDATES' | 'DRAFT';
type GmailThread = { historyId: string; id: string; snippet: string; };
type Label = { id: string, name: "CATEGORY_SOCIAL", messageListVisibility: "hide", labelListVisibility: "labelHide", type: 'system' };
type AcctDataFile = { messages: GmailMsg[]; drafts: GmailMsg[], attachments: { [id: string]: { data: string, size: number, filename?: string } }, labels: Label[] };
type ExportedMsg = { acctEmail: string, full: GmailMsg, raw: GmailMsg, attachments: { [id: string]: { data: string, size: number } } };

export class GmailMsg {

  public id: string;
  public historyId: string;
  public sizeEstimate?: number;
  public threadId: string | null;
  public payload?: GmailMsg$payload;
  public internalDate?: number | string;
  public labelIds?: GmailMsg$labelId[];
  public snippet?: string;
  public raw?: string;

  constructor(msg: { id: string, labelId: GmailMsg$labelId, raw: string, mimeMsg: ParsedMail }) {
    this.id = msg.id;
    this.historyId = msg.id;
    this.threadId = msg.id;
    this.labelIds = [msg.labelId];
    this.raw = msg.raw;
    const contentTypeHeader = msg.mimeMsg.headers.get('content-type')! as StructuredHeader;
    const toHeader = msg.mimeMsg.headers.get('to')! as AddressObject;
    const fromHeader = msg.mimeMsg.headers.get('from')! as AddressObject;
    const subjectHeader = msg.mimeMsg.headers.get('subject')! as string;
    const dateHeader = msg.mimeMsg.headers.get('date')! as Date;
    const messageIdHeader = msg.mimeMsg.headers.get('message-id')! as string;
    const mimeVersionHeader = msg.mimeMsg.headers.get('mime-version')! as string;
    let body;
    if (msg.mimeMsg.text) {
      const textBase64 = Buffer.from(msg.mimeMsg.text, 'utf-8').toString('base64');
      body = { attachmentId: '', size: textBase64.length, data: textBase64 };
    } else if (typeof msg.mimeMsg.html === 'string') {
      const htmlBase64 = Buffer.from(msg.mimeMsg.html, 'utf-8').toString('base64');
      body = { attachmentId: '', size: htmlBase64.length, data: htmlBase64 };
    }
    this.payload = {
      mimeType: contentTypeHeader.value,
      headers: [
        { name: "Content-Type", value: `${contentTypeHeader.value}; boundary=\"${contentTypeHeader.params.boundary}\"` },
        { name: "Message-Id", value: messageIdHeader },
        { name: "Mime-Version", value: mimeVersionHeader }
      ],
      body
    };
    if (toHeader) {
      this.payload.headers!.push({ name: 'To', value: toHeader.value.map(a => a.address).join(',') });
    }
    if (fromHeader) {
      this.payload.headers!.push({ name: 'From', value: fromHeader.value[0].address });
    }
    if (subjectHeader) {
      this.payload.headers!.push({ name: 'Subject', value: subjectHeader });
    }
    if (dateHeader) {
      this.payload.headers!.push({ name: 'Date', value: dateHeader.toString() });
    }
  }
}

const DATA: { [acct: string]: AcctDataFile } = {};

/**
 * This class is badly designed - it acts like a class (whose object should contain its own data),
 *   but the data is shared globally across objects. Would be more appropriate to make this a static class.
 *   Either that, or have each instance hold data independently (unless it turns out there are memory issues)
 */
export class GoogleData {

  private exludePplSearchQuery = /(?:-from|-to):"?([a-zA-Z0-9@.\-_]+)"?/g;
  private includePplSearchQuery = /(?:from|to):"?([a-zA-Z0-9@.\-_]+)"?/g;

  /**
   * This is the proper way to add messages to mock api for testing:
   *   1) log into flowcrypt.compatibility@gmail.com
   *   2) go to Encrypted Inbox and find your message
   *   3) click "download api export"
   *   4) save the json file to exported-messages folder
   */
  private exportedMsgsPath = './test/source/mock/google/exported-messages/';

  /**
   * The original way was to export whole account at once, encrypt it and download it later.
   * There are several problems with this approach:
   *  - need to re-export whole inbox each time we want to add a message
   *  - many messages are included that are not needed for testing
   *  - lack of visibility or ability to easily edit messages
   *  - messages may contain sensitive information, so we cannot freely include them
   *      in the repo - they are encrypted and new developers cannot run tests without
   *      a test-secrets.json file, which is inconvenient
   *  This list of message ids will be skipped when importing the bulk import, instead
   *    they will be imported from the newer mechanism - exported-messages folder.
   *  We will be transferring used messages to this mechanism one by one, until there
   *    are no more messages in the bulk import, at which point we can remove this prop
   *    as well as all functionality that relates to it.
   */
  private skipBulkImportMessages = ['171d138c8750863b'];

  public static fmtMsg = (m: GmailMsg, format: 'raw' | 'full' | 'metadata' | string) => {
    format = format || 'full';
    if (!['raw', 'full', 'metadata'].includes(format)) {
      throw new Error(`Unknown format: ${format}`);
    }
    const msgCopy = JSON.parse(JSON.stringify(m)) as GmailMsg;
    if (format === 'raw') {
      if (!msgCopy.raw) {
        throw new Error(`MOCK: format=raw missing data for message id ${m.id}. Solution: add them to ./test/source/mock/data/acct.json`);
      }
    } else {
      msgCopy.raw = undefined;
    }
    if (format === 'metadata' || format === 'raw') {
      msgCopy.payload!.body = undefined;
      msgCopy.payload!.parts = undefined;
    }
    return msgCopy;
  }

  private static msgSubject = (m: GmailMsg): string => {
    const subjectHeader = m.payload && m.payload.headers && m.payload.headers.find(h => h.name === 'Subject');
    return (subjectHeader && subjectHeader.value) || '';
  }

  private static msgPeople = (m: GmailMsg): string => {
    return String(m.payload && m.payload.headers && m.payload.headers.filter(h => h.name === 'To' || h.name === 'From').map(h => h.value!).filter(h => !!h).join(','));
  }

  constructor(private acct: string) {
    if (!DATA[acct]) {
      if (acctsWithoutMockData.includes(acct)) {
        DATA[acct] = { drafts: [], messages: [], attachments: {}, labels: [] };
      } else {
        const bulkExport = JSON.parse(readFileSync(`./test/samples/${acct.replace(/[^a-z0-9]+/g, '')}.json`, { encoding: 'utf-8' })) as AcctDataFile;
        bulkExport.messages = bulkExport.messages.filter(m => !this.skipBulkImportMessages.includes(m.id));
        DATA[acct] = bulkExport;
      }
      if (UserMessages[acct]) { // todo - remove this part, and move messages to use the "exported" messages functionality below
        DATA[acct].drafts = UserMessages[acct].drafts;
        DATA[acct].messages.push(...UserMessages[acct].messages);
      }
      for (const filename of readdirSync(this.exportedMsgsPath)) {
        const json = JSON.parse(Buf.fromUint8(readFileSync(this.exportedMsgsPath + filename)).toUtfStr()) as ExportedMsg;
        if (!DATA[json.acctEmail]) {
          DATA[json.acctEmail] = { drafts: [], messages: [], attachments: {}, labels: [] };
        }
        Object.assign(DATA[json.acctEmail].attachments, json.attachments);
        json.full.raw = json.raw.raw;
        DATA[json.acctEmail].messages.push(json.full);
      }
    }
  }

  public storeSentMessage = (parsedMail: ParsedMail, base64Msg: string): string => {
    let bodyContentAtt: { data: string; size: number; filename?: string; id: string } | undefined;
    for (const att of parsedMail.attachments || []) {
      const attId = Util.lousyRandom();
      const gmailAtt = { data: att.content.toString('base64'), size: att.size, filename: att.filename, id: attId };
      DATA[this.acct].attachments[attId] = gmailAtt;
      if (att.filename === 'encrypted.asc') {
        bodyContentAtt = gmailAtt;
      }
    }
    let body: GmailMsg$payload$body;
    if (parsedMail.text) {
      body = { data: parsedMail.text, size: parsedMail.text.length };
    } else if (bodyContentAtt) {
      body = { attachmentId: bodyContentAtt.id, size: bodyContentAtt.size };
    } else {
      throw new Error('MOCK storeSentMessage: no parsedMail body, no appropriate bodyContentAtt');
    }
    const barebonesGmailMsg: GmailMsg = { // todo - could be improved - very barebones
      id: `msg_id_${Util.lousyRandom()}`,
      threadId: null, // tslint:disable-line:no-null-keyword
      historyId: '',
      labelIds: ['SENT' as GmailMsg$labelId],
      payload: {
        headers: [{ name: 'Subject', value: parsedMail.subject }],
        body
      },
      raw: base64Msg
    };
    DATA[this.acct].messages.push(barebonesGmailMsg);
    return barebonesGmailMsg.id;
  }

  public getMessage = (id: string): GmailMsg | undefined => {
    return DATA[this.acct].messages.find(m => m.id === id);
  }

  public getMessageBySubject = (subject: string): GmailMsg | undefined => {
    return DATA[this.acct].messages.find(m => {
      if (m.payload?.headers) {
        const subjectHeader = m.payload.headers.find(x => x.name === 'Subject');
        if (subjectHeader) {
          return subjectHeader.value.includes(subject);
        }
      }
      return false;
    });
  }

  public getMessagesByThread = (threadId: string) => {
    return DATA[this.acct].messages.filter(m => m.threadId === threadId);
  }

  public searchMessages = (q: string) => {
    const subject = (q.match(/subject:"([^"]+)"/) || [])[1];
    if (subject) {
      // if any subject query found, all else is ignored
      // messages just filtered by subject
      return this.searchMessagesBySubject(subject);
    }
    const excludePeople = (q.match(this.exludePplSearchQuery) || []).map(e => e.replace(/^(-from|-to):/, '').replace(/"/g, ''));
    q = q.replace(this.exludePplSearchQuery, ' ');
    const includePeople = (q.match(this.includePplSearchQuery) || []).map(e => e.replace(/^(from|to):/, '').replace(/"/g, ''));
    if (includePeople.length || excludePeople.length) {
      // if any to,from query found, all such queries are collected
      // no distinction made between to and from, just searches headers
      // to: and from: are joined with OR
      // -to: and -from: are joined with AND
      // rest of query ignored
      return this.searchMessagesByPeople(includePeople, excludePeople);
    }
    return [];
  }

  public addDraft = (id: string, raw: string, mimeMsg: ParsedMail) => {
    const draft = new GmailMsg({ labelId: 'DRAFT', id, raw, mimeMsg });
    const index = DATA[this.acct].drafts.findIndex(d => d.id === draft.id);
    if (index === -1) {
      DATA[this.acct].drafts.push(draft);
    } else {
      DATA[this.acct].drafts[index] = draft;
    }
  }

  public getDraft = (id: string): GmailMsg | undefined => {
    return DATA[this.acct].drafts.find(d => d.id === id);
  }

  public getAttachment = (attachmentId: string) => {
    return DATA[this.acct].attachments[attachmentId];
  }

  public getLabels = () => {
    return DATA[this.acct].labels;
  }

  public getThreads = () => {
    const threads: GmailThread[] = [];
    for (const thread of DATA[this.acct].messages.map(m => ({ historyId: m.historyId, id: m.threadId!, snippet: `MOCK SNIPPET: ${GoogleData.msgSubject(m)}` }))) {
      if (thread.id && !threads.map(t => t.id).includes(thread.id)) {
        threads.push(thread);
      }
    }
    return threads;
  }

  private searchMessagesBySubject = (subject: string) => {
    subject = subject.trim().toLowerCase();
    return DATA[this.acct].messages.filter(m => GoogleData.msgSubject(m).toLowerCase().includes(subject));
  }

  private searchMessagesByPeople = (includePeople: string[], excludePeople: string[]) => {
    includePeople = includePeople.map(person => person.trim().toLowerCase());
    excludePeople = excludePeople.map(person => person.trim().toLowerCase());
    return DATA[this.acct].messages.filter(m => {
      const msgPeople = GoogleData.msgPeople(m).toLowerCase();
      let shouldInclude = false;
      let shouldExclude = false;
      if (includePeople.length) { // filter who to include
        for (const includePerson of includePeople) {
          if (msgPeople.includes(includePerson)) {
            shouldInclude = true;
            break;
          }
        }
      } else { // do not filter who to include - include any
        shouldInclude = true;
      }
      if (excludePeople.length) { // filter who to exclude
        for (const excludePerson of excludePeople) {
          if (msgPeople.includes(excludePerson)) {
            shouldExclude = true;
            break;
          }
        }
      } else { // don't exclude anyone
        shouldExclude = false;
      }
      return shouldInclude && !shouldExclude;
    });
  }

}
