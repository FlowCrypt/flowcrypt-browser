/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { AddressObject, ParsedMail, StructuredHeader } from 'mailparser';

import { readdir, readFile } from 'fs';
import { Util } from '../../util/index';
import { ParseMsgResult } from '../../util/parse';
import { Buf } from '../../core/buf';
import { Xss } from '../../platform/xss';

type GmailMsg$header = { name: string; value: string };
type GmailMsg$payload$body = { attachmentId?: string; size: number; data?: string };
type GmailMsg$payload$part = {
  partId?: string;
  body?: GmailMsg$payload$body;
  filename?: string;
  mimeType?: string;
  headers?: GmailMsg$header[];
  parts?: GmailMsg$payload$part[];
};
type GmailMsg$payload = {
  partId?: string;
  filename?: string;
  parts?: GmailMsg$payload$part[];
  headers?: GmailMsg$header[];
  mimeType?: string;
  body?: GmailMsg$payload$body;
};
type GmailMsg$labelId = 'INBOX' | 'UNREAD' | 'CATEGORY_PERSONAL' | 'IMPORTANT' | 'SENT' | 'CATEGORY_UPDATES' | 'DRAFT';
type GmailThread = { historyId: string; id: string; snippet: string };
type Label = {
  id: string;
  name: string;
  messageListVisibility: 'show' | 'hide';
  labelListVisibility: 'labelShow' | 'labelHide';
  type: 'system';
};
type AcctDataFile = {
  messages: GmailMsg[];
  drafts: GmailMsg[];
  attachments: { [id: string]: { data: string; size: number; filename?: string } };
  labels: Label[];
};
type ExportedMsg = {
  acctEmail: string;
  full: GmailMsg;
  raw: GmailMsg;
  attachments: { [id: string]: { data: string; size: number } };
};

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

  public constructor(msg: { id: string; labelId: GmailMsg$labelId; raw: string; mimeMsg: ParsedMail }) {
    this.id = msg.id;
    this.historyId = msg.id;
    this.threadId = msg.id;
    this.labelIds = [msg.labelId];
    this.raw = msg.raw;
    const contentTypeHeader = msg.mimeMsg.headers.get('content-type') as StructuredHeader;
    const toHeader = msg.mimeMsg.headers.get('to') as AddressObject;
    const fromHeader = msg.mimeMsg.headers.get('from') as AddressObject;
    const subjectHeader = msg.mimeMsg.headers.get('subject') as string;
    const dateHeader = msg.mimeMsg.headers.get('date') as Date;
    const messageIdHeader = msg.mimeMsg.headers.get('message-id') as string;
    const mimeVersionHeader = msg.mimeMsg.headers.get('mime-version') as string;
    let body: GmailMsg$payload$body | undefined;
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
        {
          name: 'Content-Type',
          value: `${contentTypeHeader.value}; boundary=\"${contentTypeHeader.params.boundary}\"`,
        },
        { name: 'Message-Id', value: messageIdHeader },
        { name: 'Mime-Version', value: mimeVersionHeader },
      ],
      body,
    };
    if (toHeader) {
      this.payload.headers?.push({ name: 'To', value: toHeader.value.map(a => a.address).join(',') });
    }
    if (fromHeader && fromHeader.value[0].address) {
      this.payload.headers?.push({ name: 'From', value: fromHeader.value[0].address });
    }
    if (subjectHeader) {
      this.payload.headers?.push({ name: 'Subject', value: subjectHeader });
    }
    if (dateHeader) {
      this.payload.headers?.push({ name: 'Date', value: dateHeader.toString() });
    }
  }
}

export class GmailParser {
  public static findHeader = (apiGmailMsgObj: GmailMsg | GmailMsg$payload, headerName: string) => {
    const node: GmailMsg$payload = apiGmailMsgObj.hasOwnProperty('payload')
      ? (apiGmailMsgObj as GmailMsg).payload! // eslint-disable-line @typescript-eslint/no-non-null-assertion
      : (apiGmailMsgObj as GmailMsg$payload);
    if (typeof node.headers !== 'undefined') {
      for (const header of node.headers) {
        if (header.name.toLowerCase() === headerName.toLowerCase()) {
          return header.value;
        }
      }
    }
    return undefined;
  };
}

const DATA: { [acct: string]: AcctDataFile } = {};

/**
 * This class is badly designed - it acts like a class (whose object should contain its own data),
 *   but the data is shared globally across objects. Would be more appropriate to make this a static class.
 *   Either that, or have each instance hold data independently (unless it turns out there are memory issues)
 */
export class GoogleData {
  /**
   * This is the proper way to add messages to mock api for testing:
   *   1) log into flowcrypt.compatibility@gmail.com
   *   2) go to Settings -> Inbox and find your message
   *   3) click "download api export"
   *   4) save the json file to exported-messages folder
   */
  private static exportedMsgsPath = './test/source/mock/google/exported-messages/';

  private exludePplSearchQuery = /(?:-from|-to):"?([a-zA-Z0-9@.\-_]+)"?/g;
  private includePplSearchQuery = /(?:from|to):"?([a-zA-Z0-9@.\-_]+)"?/g;

  public constructor(private acct: string) {
    if (!DATA[acct]) {
      throw new Error('Missing DATA: use withInitializedData instead of direct constructor');
    }
  }

  public static withInitializedData = async (acct: string): Promise<GoogleData> => {
    if (typeof DATA[acct] === 'undefined') {
      const acctData: AcctDataFile = {
        drafts: [],
        messages: [],
        attachments: {},
        labels: [
          {
            id: 'INBOX',
            name: 'Inbox',
            messageListVisibility: 'show',
            labelListVisibility: 'labelShow',
            type: 'system',
          },
          {
            id: 'DRAFT',
            name: 'Drafts',
            messageListVisibility: 'show',
            labelListVisibility: 'labelShow',
            type: 'system',
          },
        ],
      };
      const dir = GoogleData.exportedMsgsPath;
      const filenames: string[] = await new Promise((res, rej) => readdir(dir, (e, f) => (e ? rej(e) : res(f))));
      const filePromises = filenames.map(f => new Promise((res, rej) => readFile(dir + f, (e, d) => (e ? rej(e) : res(d)))));
      const files = (await Promise.all(filePromises)) as Uint8Array[];
      for (const file of files) {
        const utfStr = new TextDecoder().decode(file);
        try {
          const json = JSON.parse(utfStr) as ExportedMsg;
          if (json.acctEmail.split(':')[0] === acct.split(':')[0]) {
            Object.assign(acctData.attachments, json.attachments);
            json.full.raw = json.raw.raw;
            if (json.full.labelIds && json.full.labelIds.includes('DRAFT')) {
              acctData.drafts.push(json.full);
            } else {
              acctData.messages.push(json.full);
            }
          }
        } catch (e) {
          console.log(`Error while parsing JSON. error: ${e}`);
        }
      }
      DATA[acct] = acctData;
    }
    return new GoogleData(acct);
  };

  public static fmtMsg = (m: GmailMsg, format: 'raw' | 'full' | 'metadata' | string) => {
    format = format || 'full';
    if (!['raw', 'full', 'metadata'].includes(format)) {
      throw new Error(`Unknown format: ${format}`);
    }
    const msgCopy = JSON.parse(JSON.stringify(m)) as GmailMsg;
    if (format === 'raw') {
      if (!msgCopy.raw) {
        throw new Error(`MOCK: format=raw missing data for message id ${m.id}. Solution: add them to ./test/source/mock/data/google/exported-messages`);
      }
    } else {
      msgCopy.raw = undefined;
    }
    if (format === 'metadata' || format === 'raw') {
      if (msgCopy.payload) {
        msgCopy.payload.body = undefined;
        msgCopy.payload.parts = undefined;
      }
    }
    return msgCopy;
  };

  public static getMockGmailPage = async (acct: string, msgId?: string, htmlRenderer?: (msgId: string, prerendered?: string) => string | undefined) => {
    let msgBlock = '';
    let attachmentsBlock = '';
    if (msgId) {
      /* eslint-disable @typescript-eslint/no-non-null-assertion */
      const payload = (await GoogleData.withInitializedData(acct)).getMessage(msgId)!.payload!;
      const fromHeader = payload.headers!.find(header => header.name === 'From')!;
      const fromAddress = Xss.escape(fromHeader!.value);
      let htmlData: string | undefined;
      let processedParts: GmailMsg$payload$part[] = [];
      if (payload.mimeType === 'text/plain') {
        const textData = Buf.fromBase64Str(payload.body!.data!).toUtfStr();
        htmlData = GoogleData.htmlFromText(textData);
      } else {
        ({ htmlData, processedParts } = GoogleData.getHtmlDataToDisplay(payload) ?? { htmlData: undefined, processedParts: [] });
      }
      const updatedHtmlData = htmlRenderer ? htmlRenderer(msgId, htmlData) : htmlData;
      const otherParts = GoogleData.getFileParts(payload.parts, processedParts);
      if (otherParts.length) {
        attachmentsBlock =
          `<div class="ho"><span class="aVW"><span>${otherParts.length}</span> Attachments</span></div>
        <div class="aQH">` +
          otherParts
            .map(
              part => `<span class="aZo" style="display: block; float: left; margin: 0 0 16px 16px; height: 120px; width: 180px; position: relative;">
                <a
    target="_blank"
    role="link"
    class="aQy e" style="background-color: #f1f1f1; display: inline-block; height: 120px; width: 180px; overflow: hidden; position: relative; z-index: 0;    text-decoration: none;"
    href="#dummy">
    <div class="aYv" style="position: relative; height: 85px; text-align: center;"></div>
    <div class="aYy" style="background-color: #f5f5f5; border-top: 1px solid #e5e5e5; bottom: 0; left: 0; position: absolute; right: 0;">
    <div><div>
              <span class="aV3">${Xss.escape(part.filename!)}</span>
              </div></div></div>
              </a></span>`
            )
            .join('') +
          '</div>';
      }
      /* eslint-enable @typescript-eslint/no-non-null-assertion */
      msgBlock = `<div class="adn ads" data-legacy-message-id="${msgId}">
    <div class="gs">
      <span email="${fromAddress}" name="mock sender" class="gD"><span>Mock Sender</span></span>
      <div class="a3s">${updatedHtmlData ?? ''}</div>
      ${attachmentsBlock}
    </div>
  </div>
  `;
    }
    return `<!DOCTYPE HTML><html>
  <body>
  <div class="gb_Cb">
    <div class="gb_Ib">${acct}</div>
  </div>
  <div class="gb_hb">
    <div class="gb_lb">Full Name</div>
  </div>
  <!-- Compose Button Selector -->
  <div class="aeN" style="width: 180px; ">
  </div>
  ${msgBlock}
  </body></html>
  `;
  };

  private static getFileParts = (parts: GmailMsg$payload$part[] | undefined, skipParts: GmailMsg$payload$part[]): { filename: string }[] => {
    if (!parts) return [];
    return parts
      .filter(part => part.mimeType !== 'multipart/alternative' && !skipParts.includes(part))
      .map(part => {
        if (part.mimeType === 'multipart/mixed') {
          return GoogleData.getFileParts(part.parts, skipParts);
        }
        return [{ filename: part.filename || 'noname' }];
      })
      .reduce((a, b) => a.concat(b), []);
  };

  private static msgSubject = (m: GmailMsg): string => {
    const subjectHeader = m.payload && m.payload.headers && m.payload.headers.find(h => h.name === 'Subject');
    return (subjectHeader && subjectHeader.value) || '';
  };

  private static msgPeople = (m: GmailMsg): string => {
    return String(
      m.payload &&
        m.payload.headers &&
        m.payload.headers
          .filter(h => h.name === 'To' || h.name === 'From')
          .map(h => h.value)
          .filter(h => !!h)
          .join(',')
    );
  };

  private static getHtmlDataToDisplay = (
    partsContainer: GmailMsg$payload | GmailMsg$payload$part
  ): { htmlData: string; processedParts: GmailMsg$payload$part[] } | undefined => {
    const htmlPart = partsContainer.parts?.find(part => part.mimeType === 'text/html');
    const textPart = partsContainer.parts?.find(part => part.mimeType === 'text/plain');
    if (htmlPart) {
      const processedParts = [htmlPart];
      if (partsContainer.mimeType === 'multipart/alternative' && textPart) {
        // consume both html and text
        processedParts.push(textPart);
      }
      return { htmlData: Buf.fromBase64Str(htmlPart.body!.data!).toUtfStr(), processedParts };
    } else if (typeof textPart?.body?.data !== 'undefined') {
      const textData = Buf.fromBase64Str(textPart.body.data).toUtfStr();
      return { htmlData: GoogleData.htmlFromText(textData), processedParts: [textPart] };
    }
    // search inside multipart/alternative
    const alternativePart = partsContainer.parts?.find(part => part.mimeType === 'multipart/alternative');
    if (alternativePart) {
      return GoogleData.getHtmlDataToDisplay(alternativePart);
    }
    // search inside multipart/mixed
    const mixedPart = partsContainer.parts?.find(part => part.mimeType === 'multipart/mixed');
    if (mixedPart) {
      return GoogleData.getHtmlDataToDisplay(mixedPart);
    }
    return undefined;
  };

  private static htmlFromText = (textData: string): string => {
    return Xss.escape(textData).replace(/\n/g, '<br>') + '<br><br>';
  };

  public storeSentMessage = (parseResult: ParseMsgResult, id: string): string => {
    let bodyContentAtt: { data: string; size: number; filename?: string; id: string } | undefined;
    const { html, text, attachments, from, subject, messageId } = parseResult.mimeMsg;
    const parts: GmailMsg$payload$part[] = [];
    for (const [index, attachment] of attachments.entries()) {
      const attId = Util.lousyRandom();
      const gmailAtt = {
        data: attachment.content.toString('base64'),
        size: attachment.size,
        filename: attachment.filename,
        id: attId,
      };
      DATA[this.acct].attachments[attId] = gmailAtt;
      if (attachment.filename === 'encrypted.asc') {
        bodyContentAtt = gmailAtt;
      }
      parts.push({
        partId: index.toString(),
        mimeType: attachment.contentType,
        filename: attachment.filename,
        body: {
          attachmentId: attId,
          size: attachment.size,
        },
      });
    }
    let body: GmailMsg$payload$body;
    let mimeType: string | undefined;
    if (html) {
      body = { data: Buf.fromUtfStr(html).toBase64Str(), size: html.length };
      mimeType = 'text/html';
    } else if (text) {
      body = { data: Buf.fromUtfStr(text).toBase64Str(), size: text.length };
      mimeType = 'text/plain';
    } else if (bodyContentAtt) {
      body = { attachmentId: bodyContentAtt.id, size: bodyContentAtt.size };
    } else {
      throw new Error('MOCK storeSentMessage: no parsedMail body, no appropriate bodyContentAtt');
    }
    const headers = [
      { name: 'Subject', value: subject || '' },
      { name: 'Message-ID', value: messageId || '' },
    ];
    if (from) {
      headers.push({ name: 'From', value: from.text });
    }
    const barebonesGmailMsg: GmailMsg = {
      // todo - could be improved - very barebones
      id,
      threadId: parseResult.threadId ?? null, // eslint-disable-line no-null/no-null
      historyId: '',
      labelIds: ['SENT' as GmailMsg$labelId],
      payload: {
        mimeType,
        headers,
        body,
        parts,
      },
      raw: parseResult.base64,
    };
    DATA[this.acct].messages.push(barebonesGmailMsg);
    return barebonesGmailMsg.id;
  };

  public getMessage = (id: string): GmailMsg | undefined => {
    return DATA[this.acct].messages.find(m => m.id === id);
  };

  public getMessagesAndDraftsByThread = (threadId: string) => {
    return this.getMessagesAndDrafts().filter(m => m.threadId === threadId);
  };

  public getMessagesByThread = (threadId: string) => {
    return DATA[this.acct].messages.filter(m => m.threadId === threadId);
  };

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
  };

  public addDraft = (id: string, raw: string, mimeMsg: ParsedMail) => {
    const draft = new GmailMsg({ labelId: 'DRAFT', id, raw, mimeMsg });
    const index = DATA[this.acct].drafts.findIndex(d => d.id === draft.id);
    if (index === -1) {
      DATA[this.acct].drafts.push(draft);
    } else {
      DATA[this.acct].drafts[index] = draft;
    }
  };

  public getDraft = (id: string): GmailMsg | undefined => {
    return DATA[this.acct].drafts.find(d => d.id === id);
  };

  public getAttachment = (attachmentId: string) => {
    return DATA[this.acct].attachments[attachmentId];
  };

  public getLabels = () => {
    return DATA[this.acct].labels;
  };

  public getThreads = (labelIds: string[] = []) => {
    const threads: GmailThread[] = [];
    for (const thread of this.getMessagesAndDrafts()
      .filter(m => (labelIds.length ? (m.labelIds || []).some(l => labelIds.includes(l)) : true))
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .map(m => ({ historyId: m.historyId, id: m.threadId!, snippet: `MOCK SNIPPET: ${GoogleData.msgSubject(m)}` }))) {
      if (thread.id && !threads.map(t => t.id).includes(thread.id)) {
        threads.push(thread);
      }
    }
    return threads;
  };

  public searchMessagesBySubject = (subject: string) => {
    subject = subject.trim().toLowerCase();
    const messages = DATA[this.acct].messages.filter(m => GoogleData.msgSubject(m).toLowerCase().includes(subject));
    return messages;
  };

  // returns ordinary messages and drafts
  private getMessagesAndDrafts = () => {
    return DATA[this.acct].messages.concat(DATA[this.acct].drafts);
  };

  private searchMessagesByPeople = (includePeople: string[], excludePeople: string[]) => {
    includePeople = includePeople.map(person => person.trim().toLowerCase());
    excludePeople = excludePeople.map(person => person.trim().toLowerCase());
    return DATA[this.acct].messages.filter(m => {
      const msgPeople = GoogleData.msgPeople(m).toLowerCase();
      let shouldInclude = false;
      let shouldExclude = false;
      if (includePeople.length) {
        // filter who to include
        for (const includePerson of includePeople) {
          if (msgPeople.includes(includePerson)) {
            shouldInclude = true;
            break;
          }
        }
      } else {
        // do not filter who to include - include any
        shouldInclude = true;
      }
      if (excludePeople.length) {
        // filter who to exclude
        for (const excludePerson of excludePeople) {
          if (msgPeople.includes(excludePerson)) {
            shouldExclude = true;
            break;
          }
        }
      } else {
        // don't exclude anyone
        shouldExclude = false;
      }
      return shouldInclude && !shouldExclude;
    });
  };
}
