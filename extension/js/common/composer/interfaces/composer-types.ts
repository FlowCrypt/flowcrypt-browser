/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export type SendingType = 'to' | 'cc' | 'bcc';

export type Recipients = {
  to: string[],
  cc: string[],
  bcc: string[]
};

export interface BaseRecipient {
  email: string;
  sendingType: SendingType;
}

export interface RecipientElement extends BaseRecipient {
  element: HTMLElement;
  id: string;
  isWrong?: boolean;
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
  frameId: string;
  parentTabId: string;
  skipClickPrompt: boolean;
  debug: boolean;
};
