/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { ParsedMail } from 'mailparser';
import UserMessages from '../../../samples/mock-data';
import { Util } from '../../util/index';
import { readFileSync } from 'fs';

type GmailMsg$header = { name: string, value: string };
type GmailMsg$payload$body = { attachmentId: string, size: number, data?: string };
type GmailMsg$payload$part = { body?: GmailMsg$payload$body, filename?: string, mimeType?: string, headers?: GmailMsg$header[] };
type GmailMsg$payload = { parts?: GmailMsg$payload$part[], headers?: GmailMsg$header[], mimeType?: string, body?: GmailMsg$payload$body };
type GmailMsg$labelId = 'INBOX' | 'UNREAD' | 'CATEGORY_PERSONAL' | 'IMPORTANT' | 'SENT' | 'CATEGORY_UPDATES' | 'DRAFT';
export type GmailMsg = {
  id: string; historyId: string; threadId?: string | null; payload: GmailMsg$payload; internalDate?: number | string;
  labelIds?: GmailMsg$labelId[]; snippet?: string; raw?: string;
};
export type GmailDraft = {
  id: string,
  message: GmailMsg
};
type GmailThread = { historyId: string; id: string; snippet: string; };
type Label = { id: string, name: "CATEGORY_SOCIAL", messageListVisibility: "hide", labelListVisibility: "labelHide", type: 'system' };
type AcctDataFile = { messages: GmailMsg[]; drafts: GmailDraft[], attachments: { [id: string]: { data: string, size: number } }, labels: Label[] };

const DATA: { [acct: string]: AcctDataFile } = {};

export class GoogleData {

  private exludePplSearchQuery = /(?:-from|-to):"?([a-zA-Z0-9@.\-_]+)"?/g;
  private includePplSearchQuery = /(?:from|to):"?([a-zA-Z0-9@.\-_]+)"?/g;

  constructor(private acct: string) {
    if (!DATA[acct]) {
      DATA[acct] = JSON.parse(readFileSync(`./test/samples/${acct.replace(/[^a-z0-9]+/g, '')}.json`, { encoding: 'UTF-8' })) as AcctDataFile;
      if (UserMessages[acct]) {
        DATA[acct].drafts = UserMessages[acct].drafts;
        DATA[acct].messages.push(...UserMessages[acct].messages);
      }
    }
  }

  public storeSentMessage = (parsedMail: ParsedMail): string => {
    const barebonesGmailMsg: GmailMsg = { // todo - could be improved - very barebones
      id: `msg_id_${Util.lousyRandom()}`,
      threadId: null, // tslint:disable-line:no-null-keyword
      historyId: '',
      labelIds: ['SENT' as GmailMsg$labelId],
      payload: {
        headers: [{ name: 'Subject', value: parsedMail.subject }],
        body: { data: parsedMail.text, attachmentId: '', size: parsedMail.text.length }
      },
    };
    DATA[this.acct].messages.push(barebonesGmailMsg);
    return barebonesGmailMsg.id;
  }

  public getMessage = (id: string): GmailMsg | undefined => {
    return DATA[this.acct].messages.find(m => m.id === id);
  }

  public getMessageBySubject = (subject: string): GmailMsg | undefined => {
    return DATA[this.acct].messages.find(m => {
      if (m.payload.headers) {
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

  public getDraft = (id: string): GmailDraft | undefined => {
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
      if (!threads.map(t => t.id).includes(thread.id)) {
        threads.push(thread);
      }
    }
    return threads;
  }

  private static msgSubject = (m: GmailMsg): string => {
    const subjectHeader = m.payload && m.payload.headers && m.payload.headers.find(h => h.name === 'Subject');
    return (subjectHeader && subjectHeader.value) || '(no subject)';
  }

  private static msgPeople = (m: GmailMsg): string => {
    return String(m.payload && m.payload.headers && m.payload.headers.filter(h => h.name === 'To' || h.name === 'From').map(h => h.value!).filter(h => !!h).join(','));
  }

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
      msgCopy.payload.body = undefined;
      msgCopy.payload.parts = undefined;
    }
    return msgCopy;
  }

}
