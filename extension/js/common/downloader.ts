/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailRes } from './api/email-provider/gmail/gmail-parser.js';
import { Gmail } from './api/email-provider/gmail/gmail.js';
import { Attachment, Attachment$treatAs } from './core/attachment.js';
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

  public queueAttachmentChunkDownload = async (a: Attachment, treatAs: Attachment$treatAs): Promise<{ result: Promise<Buf> }> => {
    if (a.hasData()) {
      return { result: Promise.resolve(a.getData()) };
    }
    // Couldn't use async await for chunkDownloads.get
    // because if we call `await chunkDownloads.get`
    // then return type becomes Buf|undfined instead of Promise<Buf>|undfined
    return new Promise((resolve, reject) => {
      this.chunkDownloads
        .get(a)
        .then(async download => {
          if (!download) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            download = this.gmail.attachmentGetChunk(a.msgId!, a.id!, treatAs);
            await this.chunkDownloads.set(a, download);
          }
          resolve({ result: download });
        })
        .catch(e => {
          reject(e);
        });
    });
  };

  public waitForAttachmentChunkDownload = async (a: Attachment, treatAs: Attachment$treatAs) => {
    if (a.hasData()) return a.getData();
    return this.chunkDownloads.await(a, (await this.queueAttachmentChunkDownload(a, treatAs)).result);
  };

  public msgGetRaw = async (msgId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      this.rawMessages
        .get(msgId)
        .then(async msgDownload => {
          if (!msgDownload) {
            msgDownload = this.gmail.msgGet(msgId, 'raw');
            await this.rawMessages.set(msgId, msgDownload);
          }
          const msg = await this.rawMessages.await(msgId, msgDownload);
          resolve(msg.raw || '');
        })
        .catch(e => {
          reject(e);
        });
    });
  };

  public msgGetFull = async (msgId: string): Promise<GmailRes.GmailMsg> => {
    return new Promise((resolve, reject) => {
      this.fullMessages
        .get(msgId)
        .then(async msgDownload => {
          if (!msgDownload) {
            msgDownload = this.gmail.msgGet(msgId, 'full');
            await this.fullMessages.set(msgId, msgDownload);
          }
          const msg = await this.rawMessages.await(msgId, msgDownload);
          resolve(msg);
        })
        .catch(e => {
          reject(e);
        });
    });
  };
}
