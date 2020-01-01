/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

// tslint:disable:oneliner-object-literal

'use strict';

import { Api, ChunkedCb, ProgressCb } from '../api.js';

import { Contact } from '../../core/pgp-key.js';
import { GmailRes } from './gmail/gmail-parser.js';
import { GmailResponseFormat } from './gmail/gmail.js';
import { SendableMsg } from './sendable-msg.js';

export type Recipients = { to?: string[], cc?: string[], bcc?: string[] };
export type ProviderContactsQuery = { substring: string };

export type ReplyParams = {
  to: string[];
  cc: string[];
  bcc: string[];
  from: string;
  subject: string;
};

/**
 * todo - remove Gmail specific formats, and make this universal interface for both Gmail and Outlook
 */
export interface EmailProviderInterface {
  draftGet(id: string, format: GmailResponseFormat): Promise<GmailRes.GmailDraftGet>;
  draftCreate(mimeMsg: string, threadId: string): Promise<GmailRes.GmailDraftCreate>;
  draftUpdate(id: string, mimeMsg: string): Promise<GmailRes.GmailDraftUpdate>;
  draftDelete(id: string): Promise<GmailRes.GmailDraftDelete>;
  msgSend(message: SendableMsg, progressCb?: ProgressCb): Promise<GmailRes.GmailMsgSend>;
  guessContactsFromSentEmails(userQuery: string, knownContacts: Contact[], chunkedCb: ChunkedCb): Promise<void>;
  msgGet(msgId: string, format: GmailResponseFormat, progressCb?: ProgressCb): Promise<GmailRes.GmailMsg>;
  msgList(q: string, includeDeleted?: boolean, pageToken?: string): Promise<GmailRes.GmailMsgList>;
}

export class EmailProviderApi extends Api {

  constructor(protected acctEmail: string) {
    super();
  }

}
