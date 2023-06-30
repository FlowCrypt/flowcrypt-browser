/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailRes } from './api/email-provider/gmail/gmail-parser.js';
import { Gmail } from './api/email-provider/gmail/gmail.js';
import { Attachment } from './core/attachment.js';
import { Buf } from './core/buf.js';
import { ExpirationCache } from './core/expiration-cache.js';

export class Downloader {
  private readonly chunkDownloads = new ExpirationCache<Attachment, Promise<Buf>>(2 * 60 * 60 * 1000); // 2 hours
  private readonly fullMessages = new ExpirationCache<string, Promise<GmailRes.GmailMsg>>(24 * 60 * 60 * 1000); // 24 hours
  private readonly rawMessages = new ExpirationCache<string, Promise<GmailRes.GmailMsg>>(24 * 60 * 60 * 1000); // 24 hours

  public constructor(private readonly gmail: Gmail) {}

  public deleteExpired = (): void => {
    this.fullMessages.deleteExpired();
    this.rawMessages.deleteExpired();
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

  public waitForAttachmentChunkDownload = async (a: Attachment) => {
    if (a.hasData()) return a.getData();
    return this.chunkDownloads.await(a, this.queueAttachmentChunkDownload(a).result);
  };

  public msgGetRaw = async (msgId: string): Promise<string> => {
    let msgDownload = this.rawMessages.get(msgId);
    if (!msgDownload) {
      msgDownload = this.gmail.msgGet(msgId, 'raw');
      this.rawMessages.set(msgId, msgDownload);
    }
    return (await this.rawMessages.await(msgId, msgDownload)).raw || '';
  };

  public msgGetFull = async (msgId: string): Promise<GmailRes.GmailMsg> => {
    let msgDownload = this.fullMessages.get(msgId);
    if (!msgDownload) {
      msgDownload = this.gmail.msgGet(msgId, 'full');
      this.fullMessages.set(msgId, msgDownload);
    }
    return await this.fullMessages.await(msgId, msgDownload);
  };
}
