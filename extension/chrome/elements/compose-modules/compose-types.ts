/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { RecipientType } from '../../../js/common/api/shared/api.js';
import { ParsedRecipients } from '../../../js/common/api/email-provider/email-provider-api.js';
import { KeyFamily, KeyInfo, PubkeyResult } from '../../../js/common/core/crypto/key.js';
import { EmailParts, Value } from '../../../js/common/core/common.js';

export enum RecipientStatus {
  EVALUATING,
  HAS_PGP,
  NO_PGP,
  EXPIRED,
  REVOKED,
  WRONG,
  FAILED
}

interface RecipientElementBase {
  sendingType: RecipientType;
  element: HTMLElement;
  id: string;
  status: RecipientStatus;
  evaluating?: Promise<void>;
}

export interface RecipientElement extends RecipientElementBase {
  email?: string;
  name?: string;
  invalid?: string;
}

export interface ValidRecipientElement extends RecipientElementBase, EmailParts {
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

export type CollectKeysResult = { pubkeys: PubkeyResult[], emailsWithoutPubkeys: string[], senderKis: KeyInfo[], family: KeyFamily };

export type PopoverOpt = 'encrypt' | 'sign' | 'richtext';
export type PopoverChoices = { [key in PopoverOpt]: boolean };

export type NewMsgData = { recipients: ParsedRecipients, subject: string, plaintext: string, plainhtml: string, pwd: string | undefined, from: string };

export class SendBtnTexts {
  public static readonly BTN_ENCRYPT_AND_SEND: string = "Encrypt and Send";
  public static readonly BTN_SIGN_AND_SEND: string = "Sign and Send";
  public static readonly BTN_ENCRYPT_SIGN_AND_SEND: string = "Encrypt, Sign and Send";
  public static readonly BTN_PLAIN_SEND: string = "Send plain";
  public static readonly BTN_WRONG_ENTRY: string = "Re-enter recipient..";
  public static readonly BTN_SENDING: string = "Sending..";
}

export const getUniqueRecipientEmails = (recipients: ParsedRecipients) => {
  return Value.arr.unique(Object.values(recipients).reduce((a, b) => a.concat(b), []).filter(x => x.email).map(x => x.email));
};
