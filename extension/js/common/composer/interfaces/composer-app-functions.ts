/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Subscription, ContactUpdate, DbContactObjArg, SendAsAlias, GoogleAuthScopesNames } from '../../platform/store.js';
import { KeyInfo, Contact } from '../../core/pgp.js';
import { ProviderContactsQuery, SendableMsg } from '../../api/email_provider_api.js';
import { GmailRes } from '../../api/google.js';
import { ProgressCb, ChunkedCb } from '../../api/api.js';
import { Att } from '../../core/att.js';
import { PubkeyResult } from './composer-types.js';
import { Dict } from '../../core/common.js';

export interface ComposerAppFunctionsInterface {
  getScopes: () => { [key in GoogleAuthScopesNames]: boolean };
  doesRecipientHaveMyPubkey: (email: string) => Promise<boolean | undefined>;
  storageGetAddresses: () => Dict<SendAsAlias> | undefined;
  storageGetAddressesKeyserver: () => string[];
  storageGetHideMsgPassword: () => boolean;
  storageGetSubscription: () => Promise<Subscription>;
  storageGetKey: (acctEmail: string, senderEmail: string) => Promise<KeyInfo>;
  storageSetDraftMeta: (storeIfTrue: boolean, draftId: string, threadId: string, recipients?: string[], subject?: string) => Promise<void>;
  storagePassphraseGet: (senderEmail?: string) => Promise<string | undefined>;
  storageAddAdminCodes: (shortId: string, msgAdminCode: string, attAdminCodes: string[]) => Promise<void>;
  storageContactGet: (email: string[]) => Promise<(Contact | undefined)[]>;
  storageContactUpdate: (email: string | string[], update: ContactUpdate) => Promise<void>;
  storageContactSave: (contact: Contact) => Promise<void>;
  storageContactSearch: (query: ProviderContactsQuery) => Promise<Contact[]>;
  storageContactObj: (o: DbContactObjArg) => Promise<Contact>;
  emailProviderDraftGet: (draftId: string) => Promise<GmailRes.GmailDraftGet | undefined>;
  emailProviderDraftCreate: (acctEmail: string, mimeMsg: string, threadId?: string) => Promise<GmailRes.GmailDraftCreate>;
  emailProviderDraftUpdate: (draftId: string, mimeMsg: string) => Promise<GmailRes.GmailDraftUpdate>;
  emailProviderDraftDelete: (draftId: string) => Promise<GmailRes.GmailDraftDelete>;
  emailProviderMsgSend: (msg: SendableMsg, renderUploadProgress: ProgressCb) => Promise<GmailRes.GmailMsgSend>;
  emailProviderGuessContactsFromSentEmails: (query: string, knownContacts: Contact[], multiCb: ChunkedCb) => void;
  emailProviderExtractArmoredBlock: (msgId: string) => Promise<string>;
  renderAddPubkeyDialog: (emails: string[]) => void;
  renderReinsertReplyBox: (msgId: string) => void;
  renderHelpDialog: () => void;
  factoryAtt: (att: Att, isEncrypted: boolean) => string;
  closeMsg: () => void;
  whenMasterPassphraseEntered: (secondsTimeout?: number) => Promise<string | undefined>;
  lookupPubkeyFromDbOrKeyserverAndUpdateDbIfneeded: (email: string) => Promise<Contact | "fail">;
  collectAllAvailablePublicKeys: (acctEmail: string, recipients: string[]) => Promise<{ armoredPubkeys: PubkeyResult[], emailsWithoutPubkeys: string[] }>;
}
