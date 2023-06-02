/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailRes } from './api/email-provider/gmail/gmail-parser.js';
import { Gmail } from './api/email-provider/gmail/gmail.js';
import { Attachment } from './core/attachment.js';
import { Buf } from './core/buf.js';
import { ExpirationCache } from './core/expiration-cache.js';
import { MsgBlock } from './core/msg-block.js';
import { MessageInfo } from './render-message.js';

export type ProcessedMessage = {
  isBodyEmpty: boolean;
  blocks: MsgBlock[];
  attachments: Attachment[];
  messageInfo: MessageInfo;
};

export interface MessageCacheEntry {
  download: { full: Promise<GmailRes.GmailMsg>; raw?: Promise<GmailRes.GmailMsg> };
  processedFull?: ProcessedMessage;
}

export class Downloader {
  private readonly chunkDownloads = new ExpirationCache<Attachment, Promise<Buf>>(2 * 60 * 60 * 1000); // 2 hours
  private readonly messages = new ExpirationCache<string, MessageCacheEntry>(24 * 60 * 60 * 1000); // 24 hours

  public constructor(private readonly gmail: Gmail) {}

  public deleteExpired = (): void => {
    this.messages.deleteExpired();
    this.chunkDownloads.deleteExpired(attachment => {
      return attachment.hasData();
    });
  };

  public queueAttachmentChunkDownload = (a: Attachment): { result: Promise<Buf> } => {
    if (a.hasData()) {
      return { result: Promise.resolve(a.getData()) };
    }
    let download = this.chunkDownloads.get(a);
    if (!download) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      download = this.gmail.attachmentGetChunk(a.msgId!, a.id!);
      this.chunkDownloads.set(a, download);
    }
    return { result: download };
  };

  public msgGetCached = (msgId: string): MessageCacheEntry => {
    // todo: retries? exceptions?
    let msgDownload = this.messages.get(msgId);
    if (!msgDownload) {
      const newEntry = { download: { full: this.gmail.msgGet(msgId, 'full') } };
      this.messages.set(msgId, newEntry);
      msgDownload = newEntry;
    }
    return msgDownload;
  };
}
