/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailRes } from './api/email-provider/gmail/gmail-parser';
import { Gmail } from './api/email-provider/gmail/gmail.js';
import { Attachment } from './core/attachment.js';
import { Buf } from './core/buf.js';
import { Dict } from './core/common.js';
import { MsgBlock } from './core/msg-block.js';
import { MessageInfo } from './render-message.js';

export type ProcessedMessage = {
  isBodyEmpty: boolean;
  blocks: MsgBlock[];
  attachments: Attachment[];
  messageInfo: MessageInfo;
  from?: string;
};

export interface MessageCacheEntry {
  download: { full: Promise<GmailRes.GmailMsg>; raw?: Promise<GmailRes.GmailMsg> };
  processedFull?: ProcessedMessage;
}

export class Downloader {
  private chunkDownloads: { attachment: Attachment; result: Promise<Buf> }[] = [];
  private messages: Dict<MessageCacheEntry> = {};

  public constructor(private readonly gmail: Gmail) {}

  /* 
  private queueAttachmentDownload = (a: Attachment) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.attachmentDownloads.push({ attachment: a, result: this.gmail.attachmentGet(a.msgId!, a.id!) });
  };
  */

  public queueAttachmentChunkDownload = (a: Attachment) => {
    if (a.hasData()) {
      return { attachment: a, result: Promise.resolve(a.getData()) };
    }
    let download = this.chunkDownloads.find(d => d.attachment === a);
    if (!download) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      download = { attachment: a, result: this.gmail.attachmentGetChunk(a.msgId!, a.id!) };
      this.chunkDownloads.push(download);
    }
    return download;
  };

  public msgGetCached = (msgId: string): MessageCacheEntry => {
    // todo: retries? exceptions?
    let msgDownload = this.messages[msgId];
    if (!msgDownload) {
      this.messages[msgId] = { download: { full: this.gmail.msgGet(msgId, 'full') } };
      msgDownload = this.messages[msgId];
    }
    return msgDownload;
  };
}
