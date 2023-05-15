/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { TransferableAttachment } from './core/attachment.js';

export type PrintMailInfo = {
  userNameAndEmail: string;
  html: string;
};

export type MessageInfo = {
  printMailInfo: PrintMailInfo;
  isPwdMsgBasedOnMsgSnippet?: boolean;
};

export type RenderMessage = {
  setTestState?: 'ready' | 'working' | 'waiting';
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
  printMailInfo?: PrintMailInfo;
  renderAsRegularContent?: string;
};
