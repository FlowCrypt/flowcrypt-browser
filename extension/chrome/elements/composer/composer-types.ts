/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { RecipientType } from '../../../js/common/api/api.js';
import { Pwd } from '../../../js/common/core/pgp-msg.js';
import { Recipients } from '../../../js/common/api/email_provider/email_provider_api.js';

export type RecipientStatus = 0 | 1 | 2 | 3 | 4 | 5;

export class RecipientStatuses {
  static EVALUATING: RecipientStatus = 0;
  static HAS_PGP: RecipientStatus = 1;
  static NO_PGP: RecipientStatus = 2;
  static EXPIRED: RecipientStatus = 3;
  static WRONG: RecipientStatus = 4;
  static FAILED: RecipientStatus = 5;
}

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
