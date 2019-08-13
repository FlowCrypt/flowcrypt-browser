/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export type RecipientElement = {
  email: string,
  element: HTMLElement
  id: string;
  isWrong?: boolean;
};

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
