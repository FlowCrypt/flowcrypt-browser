/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailRes } from './api/email-provider/gmail/gmail-parser.js';
import { Gmail } from './api/email-provider/gmail/gmail.js';
import { Attachment, Attachment$treatAs } from './core/attachment.js';
import { Buf } from './core/buf.js';
import { ExpirationCache } from './core/expiration-cache.js';
import { Catch } from './platform/catch.js';

export class Downloader {
  private readonly chunkDownloads = new ExpirationCache<Promise<Buf>>('chunk', 2 * 60 * 60 * 1000); // 2 hours
  private readonly fullMessages = new ExpirationCache<Promise<GmailRes.GmailMsg>>('full_message', 24 * 60 * 60 * 1000); // 24 hours
  private readonly rawMessages = new ExpirationCache<Promise<GmailRes.GmailMsg>>('raw_message', 24 * 60 * 60 * 1000); // 24 hours

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
    // Couldn't use caching mechanism in firefox because in firefox it throws below error
    // because we tried to send promise with chrome.runtime and firefox doesn't support it
    // https://github.com/FlowCrypt/flowcrypt-browser/pull/5651#issuecomment-2054128442
    // Thrown[object]Error: Permission denied to access property "constructor" error
    // Need to remove below code once firefox supports it
    if (Catch.isFirefox()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return { result: this.gmail.attachmentGetChunk(a.msgId!, a.id!, treatAs) };
    }
    // Couldn't use async await for chunkDownloads.get
    // because if we call `await chunkDownloads.get`
    // then return type becomes Buf|undfined instead of Promise<Buf>|undfined
    return new Promise((resolve, reject) => {
      this.chunkDownloads
        .get(a.id ?? '')
        .then(async download => {
          if (!download || Object.keys(download).length < 1) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            download = this.gmail.attachmentGetChunk(a.msgId!, a.id!, treatAs);
            await this.chunkDownloads.set(a.id ?? '', download);
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
    if (Catch.isFirefox()) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const res = await this.queueAttachmentChunkDownload(a, treatAs);
      return await res.result;
    }
    return this.chunkDownloads.await(a.id ?? '', (await this.queueAttachmentChunkDownload(a, treatAs)).result);
  };

  public msgGetRaw = async (msgId: string): Promise<string> => {
    if (Catch.isFirefox()) {
      const msgDownload = await this.gmail.msgGet(msgId, 'raw');
      return msgDownload.raw || '';
    }
    return new Promise((resolve, reject) => {
      this.rawMessages
        .get(msgId)
        .then(async msgDownload => {
          if (!msgDownload || Object.keys(msgDownload).length < 1) {
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
    if (Catch.isFirefox()) {
      return await this.gmail.msgGet(msgId, 'full');
    }
    return new Promise((resolve, reject) => {
      this.fullMessages
        .get(msgId)
        .then(async msgDownload => {
          if (!msgDownload || Object.keys(msgDownload).length < 1) {
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
