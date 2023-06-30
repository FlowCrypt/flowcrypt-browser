/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { TransferableAttachment } from './core/attachment.js';

export type PrintMailInfo = {
  userNameAndEmail: string;
  html: string;
};

export type MessageInfo = {
  printMailInfo?: PrintMailInfo;
  isPwdMsgBasedOnMsgSnippet: boolean;
  from?: {
    email: string | undefined;
    name: string | undefined;
    full: string;
  };
  plainSubject: string | undefined; // todo: cover by unit tests
};

export type RenderMessage = {
  done?: true;
  resizePgpBlockFrame?: true;
  separateQuotedContentAndRenderText?: { decryptedContent: string; isHtml: boolean };
  renderText?: string;
  setFrameColor?: 'green' | 'gray' | 'red';
  renderEncryptionStatus?: string;
  renderSignatureStatus?: string;
  renderVerificationInProgress?: true;
  renderInnerAttachments?: {
    attachments: TransferableAttachment[];
    isEncrypted: boolean;
  };
  renderPassphraseNeeded?: string[]; // longids
  renderErr?: { errBoxContent: string; renderRawMsg: string | undefined; errMsg?: string };
  clearErrorStatus?: true;
  renderSignatureOffline?: true;
  printMailInfo?: PrintMailInfo;
  renderAsRegularContent?: string;
};

export type RenderMessageWithFrameId = {
  frameId: string;
} & RenderMessage;
