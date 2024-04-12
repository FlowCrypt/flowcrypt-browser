/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailRes } from './api/email-provider/gmail/gmail-parser.js';
import { Gmail } from './api/email-provider/gmail/gmail.js';
import { Attachment, Attachment$treatAs } from './core/attachment.js';
import { Buf } from './core/buf.js';
import { ExpirationCache } from './core/expiration-cache.js';

export class Downloader {
  private readonly chunkDownloads = new ExpirationCache<Buf>('chunk', 2 * 60 * 60 * 1000); // 2 hours
  private readonly fullMessages = new ExpirationCache<GmailRes.GmailMsg>('full_message', 24 * 60 * 60 * 1000); // 24 hours
  private readonly rawMessages = new ExpirationCache<GmailRes.GmailMsg>('raw_message', 24 * 60 * 60 * 1000); // 24 hours

  public constructor(private readonly gmail: Gmail) {}

  public deleteExpired = (): void => {
    void this.fullMessages.deleteExpired();
    void this.rawMessages.deleteExpired();
    // todo: delete attachment which has data
    // (not sure how to implement this as chrome.storage doesn't accept keys which are not string types)
    // Original code is like as follows
    // this.chunkDownloads.deleteExpired(attachment => {
    //   return attachment.hasData();
    // });
    void this.chunkDownloads.deleteExpired();
  };

  public getOrDownloadAttachment = async (a: Attachment, treatAs: Attachment$treatAs): Promise<Buf> => {
    if (a.hasData()) {
      return a.getData();
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const attachmentId = a.id!;
    let attachment = await this.chunkDownloads.get(a.id ?? '');
    if (!attachment) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      attachment = await this.gmail.attachmentGetChunk(a.msgId!, attachmentId, treatAs);
      await this.chunkDownloads.set(attachmentId, attachment);
    }
    return attachment;
  };

  public msgGetRaw = async (msgId: string): Promise<string> => {
    let cachedMessage = await this.rawMessages.get(msgId);
    if (!cachedMessage) {
      cachedMessage = await this.gmail.msgGet(msgId, 'raw');
      await this.rawMessages.set(msgId, cachedMessage);
    }
    return cachedMessage.raw ?? '';
  };

  public msgGetFull = async (msgId: string): Promise<GmailRes.GmailMsg> => {
    let cachedMessage = await this.fullMessages.get(msgId);
    if (!cachedMessage) {
      cachedMessage = await this.gmail.msgGet(msgId, 'full');
      await this.fullMessages.set(msgId, cachedMessage);
    }
    return cachedMessage;
  };
}
