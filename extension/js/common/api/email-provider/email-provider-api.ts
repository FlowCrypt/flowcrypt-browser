/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal

'use strict';

import { Api, ChunkedCb, ProgressCb } from '../shared/api.js';

import { KeyInfo } from '../../core/crypto/key.js';
import { GmailRes } from './gmail/gmail-parser.js';
import { GmailResponseFormat } from './gmail/gmail.js';
import { SendableMsg } from './sendable-msg.js';

export type Recipients = { to?: string[], cc?: string[], bcc?: string[] };
export type ProviderContactsQuery = { substring: string };

export type ReplyParams = {
  to: string[];
  cc: string[];
  bcc: string[];
  myEmail: string;
  from?: string;
  subject: string;
  inReplyTo?: string;
};

export type Backups = {
  keyinfos: { backups: KeyInfo[], backupsImported: KeyInfo[], backupsNotImported: KeyInfo[], importedNotBackedUp: KeyInfo[] },
  longids: { backups: string[], backupsImported: string[], backupsNotImported: string[], importedNotBackedUp: string[] },
};

/**
 * todo - remove Gmail specific formats, and make this universal interface for both Gmail and Outlook
 */
export interface EmailProviderInterface {
  draftGet(id: string, format: GmailResponseFormat): Promise<GmailRes.GmailDraftGet>;
  draftCreate(mimeMsg: string, threadId: string): Promise<GmailRes.GmailDraftCreate>;
  draftUpdate(id: string, mimeMsg: string, threadId: string): Promise<GmailRes.GmailDraftUpdate>;
  draftDelete(id: string): Promise<GmailRes.GmailDraftDelete>;
  msgSend(message: SendableMsg, progressCb?: ProgressCb): Promise<GmailRes.GmailMsgSend>;
  guessContactsFromSentEmails(userQuery: string, knownEmails: string[], chunkedCb: ChunkedCb): Promise<void>;
  msgGet(msgId: string, format: GmailResponseFormat, progressCb?: ProgressCb): Promise<GmailRes.GmailMsg>;
  msgList(q: string, includeDeleted?: boolean, pageToken?: string): Promise<GmailRes.GmailMsgList>;
  threadGet(threadId: string, format?: GmailResponseFormat, progressCb?: ProgressCb): Promise<GmailRes.GmailThread>;
}

export class EmailProviderApi extends Api {

  constructor(protected acctEmail: string) {
    super();
  }

}
