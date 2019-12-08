/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Contact } from '../../core/pgp.js';
import { SendableMsg } from '../../api/email_provider_api.js';
import { GmailRes } from '../../api/google.js';
import { ProgressCb, ChunkedCb } from '../../api/api.js';

export interface ComposerAppFunctionsInterface {
  emailProviderDraftGet: (draftId: string) => Promise<GmailRes.GmailDraftGet | undefined>;
  emailProviderDraftCreate: (acctEmail: string, mimeMsg: string, threadId?: string) => Promise<GmailRes.GmailDraftCreate>;
  emailProviderDraftUpdate: (draftId: string, mimeMsg: string) => Promise<GmailRes.GmailDraftUpdate>;
  emailProviderDraftDelete: (draftId: string) => Promise<GmailRes.GmailDraftDelete>;
  emailProviderMsgSend: (msg: SendableMsg, renderUploadProgress: ProgressCb) => Promise<GmailRes.GmailMsgSend>;
  emailProviderGuessContactsFromSentEmails: (query: string, knownContacts: Contact[], multiCb: ChunkedCb) => void;
  emailProviderExtractArmoredBlock: (msgId: string) => Promise<{ armored: string }>;
}
