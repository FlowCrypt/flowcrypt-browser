
import { readFileSync } from 'fs';

type GmailMsg$header = { name: string, value: string };
type GmailMsg$payload$body = { attachmentId: string, size: number, data?: string };
type GmailMsg$payload$part = { body?: GmailMsg$payload$body, filename?: string, mimeType?: string, headers?: GmailMsg$header[] };
type GmailMsg$payload = { parts?: GmailMsg$payload$part[], headers?: GmailMsg$header[], mimeType?: string, body?: GmailMsg$payload$body };
type GmailMsg$labelId = 'INBOX' | 'UNREAD' | 'CATEGORY_PERSONAL' | 'IMPORTANT' | 'SENT' | 'CATEGORY_UPDATES';
type GmailMsg = {
  id: string; historyId: string; threadId?: string | null; payload: GmailMsg$payload; internalDate?: number | string;
  labelIds?: GmailMsg$labelId[]; snippet?: string; raw?: string;
};
type AcctDataFile = { messages: GmailMsg[]; attachments: { [id: string]: { data: string, size: number } } };

const DATA: { [acct: string]: AcctDataFile } = {};

export class Data {

  constructor(private acct: string) {
    if (!DATA[acct]) {
      DATA[acct] = JSON.parse(readFileSync(`./test/source/mock/data/${acct.replace(/[^a-z0-9]+/g, '')}.json`, { encoding: 'UTF-8' })) as AcctDataFile;
    }
  }

  public storeMessage = (msg: GmailMsg) => {
    DATA[this.acct].messages.push(msg);
  }

  public getMessage = (id: string): GmailMsg | undefined => {
    return DATA[this.acct].messages.find(m => m.id === id);
  }

  public getMessagesByThread = (threadId: string) => {
    return DATA[this.acct].messages.filter(m => m.threadId === threadId);
  }

  public searchMessages = (subject: string) => {
    return DATA[this.acct].messages.filter(m => m.payload && m.payload.headers && m.payload.headers.find(h => h.name === 'Subject')!.value.includes(subject));
  }

  public getAttachment = (attachmentId: string) => {
    return DATA[this.acct].attachments[attachmentId];
  }
}
