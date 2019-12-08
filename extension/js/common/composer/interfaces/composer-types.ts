/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { RecipientType } from '../../api/api';
import { Pwd } from '../../core/pgp';

export type RecipientStatus = 0 | 1 | 2 | 3 | 4 | 5;

export class RecipientStatuses {
  static EVALUATING: RecipientStatus = 0;
  static HAS_PGP: RecipientStatus = 1;
  static NO_PGP: RecipientStatus = 2;
  static EXPIRED: RecipientStatus = 3;
  static WRONG: RecipientStatus = 4;
  static FAILED: RecipientStatus = 5;
}

export type Recipients = {
  to?: string[],
  cc?: string[],
  bcc?: string[]
};

export interface BaseRecipient {
  email: string;
  sendingType: RecipientType;
}

export interface RecipientElement extends BaseRecipient {
  element: HTMLElement;
  id: string;
  status: RecipientStatus;
  evaluating?: Promise<void>;
}

export type MessageToReplyOrForward = {
  headers: {
    references: string,
    'message-id': string,
    date?: string,
    from?: string
  },
  isOnlySigned?: boolean,
  text?: string,
  decryptedFiles: File[]
};

export type ComposerUrlParams = {
  disableDraftSaving: boolean;
  isReplyBox: boolean;
  tabId: string;
  acctEmail: string;
  threadId: string;
  replyMsgId: string;
  draftId: string;
  subject: string;
  from: string | undefined;
  to: string[];
  cc: string[];
  bcc: string[];
  frameId: string;
  parentTabId: string;
  skipClickPrompt: boolean;
  debug: boolean;
  removeAfterClose: boolean;
  placement: 'settings' | 'gmail' | undefined;
  replyPubkeyMismatch: boolean;
};

export type PubkeyResult = { pubkey: string, email: string, isMine: boolean };
export type CollectPubkeysResult = { armoredPubkeys: PubkeyResult[], emailsWithoutPubkeys: string[] };

export type PopoverOpt = 'encrypt' | 'sign' | 'richText';
export type PopoverChoices = { [key in PopoverOpt]: boolean };

export type NewMsgData = { recipients: Recipients, subject: string, plaintext: string, plainhtml: string, pwd: Pwd | undefined, sender: string };

export class SendBtnTexts {
  public static readonly BTN_ENCRYPT_AND_SEND: string = "Encrypt and Send";
  public static readonly BTN_SIGN_AND_SEND: string = "Sign and Send";
  public static readonly BTN_ENCRYPT_SIGN_AND_SEND: string = "Encrypt, Sign and Send";
  public static readonly BTN_PLAIN_SEND: string = "Send plain";
  public static readonly BTN_WRONG_ENTRY: string = "Re-enter recipient..";
  public static readonly BTN_SENDING: string = "Sending..";
}
