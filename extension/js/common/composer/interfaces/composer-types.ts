/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SendingType } from '../../api/api';

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
  sendingType: SendingType;
}

export interface RecipientElement extends BaseRecipient {
  element: HTMLElement;
  id: string;
  status: RecipientStatus;
  evaluating?: Promise<void>;
}

export type MessageToReplyOrForward = {
  headers: {
    date?: string,
    from?: string
  },
  isSigned?: boolean,
  text?: string
};

export type ComposerUrlParams = {
  disableDraftSaving: boolean;
  isReplyBox: boolean;
  tabId: string;
  acctEmail: string;
  threadId: string;
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
};
