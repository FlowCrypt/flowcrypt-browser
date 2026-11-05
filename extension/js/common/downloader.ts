/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailRes } from './api/email-provider/gmail/gmail-parser.js';
import { Gmail } from './api/email-provider/gmail/gmail.js';
import { Attachment, Attachment$treatAs } from './core/attachment.js';
import { Buf } from './core/buf.js';
import { ExpirationCache } from './core/expiration-cache.js';

export class Downloader {
  private readonly chunkDownloads = new ExpirationCache<string>('chunk', 2 * 60 * 60 * 1000); // 2 hours
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

  public queueAttachmentChunkDownload = async (a: Attachment, treatAs: Attachment$treatAs): Promise<{ result: Promise<Buf> }> => {
    if (a.hasData()) {
      return { result: Promise.resolve(a.getData()) };
    }
    const result = this.chunkDownloads.getOrCreate(a.id ?? '', async () => {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const chunk = await this.gmail.attachmentGetChunk(a.msgId!, a.id!, treatAs);
      // Background messaging can return an object of byte values without the Buf prototype.
      const data = chunk instanceof Buf ? chunk : new Buf(Object.values(chunk));
      return data.toBase64Str();
    });
    return { result: result.then(encoded => Buf.fromBase64Str(encoded)) };
  };

  public waitForAttachmentChunkDownload = async (a: Attachment, treatAs: Attachment$treatAs) => {
    if (a.hasData()) return a.getData();
    const { result } = await this.queueAttachmentChunkDownload(a, treatAs);
    return await result;
  };

  public msgGetRaw = async (msgId: string): Promise<string> => {
    const msg = await this.rawMessages.getOrCreate(msgId, () => this.gmail.msgGet(msgId, 'raw'));
    return msg.raw || '';
  };

  public msgGetFull = async (msgId: string): Promise<GmailRes.GmailMsg> => {
    return await this.fullMessages.getOrCreate(msgId, () => this.gmail.msgGet(msgId, 'full'));
  };
}
