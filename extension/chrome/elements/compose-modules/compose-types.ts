/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { RecipientType } from '../../../js/common/api/shared/api.js';
import { Recipients } from '../../../js/common/api/email-provider/email-provider-api.js';
import { PubkeyResult } from '../../../js/common/core/crypto/key.js';

export type RecipientStatus = 0 | 1 | 2 | 3 | 4 | 5;

export class RecipientStatuses {
  public static EVALUATING: RecipientStatus = 0;
  public static HAS_PGP: RecipientStatus = 1;
  public static NO_PGP: RecipientStatus = 2;
  public static EXPIRED: RecipientStatus = 3;
  public static WRONG: RecipientStatus = 4;
  public static FAILED: RecipientStatus = 5;
}

export interface RecipientElement {
  email: string;
  sendingType: RecipientType;
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

export type CollectPubkeysResult = { armoredPubkeys: PubkeyResult[], emailsWithoutPubkeys: string[] };

export type PopoverOpt = 'encrypt' | 'sign' | 'richtext';
export type PopoverChoices = { [key in PopoverOpt]: boolean };

export type NewMsgData = { recipients: Recipients, subject: string, plaintext: string, plainhtml: string, pwd: string | undefined, from: string };

export class SendBtnTexts {
  public static readonly BTN_ENCRYPT_AND_SEND: string = "Encrypt and Send";
  public static readonly BTN_SIGN_AND_SEND: string = "Sign and Send";
  public static readonly BTN_ENCRYPT_SIGN_AND_SEND: string = "Encrypt, Sign and Send";
  public static readonly BTN_PLAIN_SEND: string = "Send plain";
  public static readonly BTN_WRONG_ENTRY: string = "Re-enter recipient..";
  public static readonly BTN_SENDING: string = "Sending..";
}
