/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { TransferableAttachment } from './core/attachment.js';

export type RenderMessage = {
  setTestState?: 'ready' | 'working' | 'waiting';
  resizePgpBlockFrame?: boolean;
  separateQuotedContentAndRenderText?: { decryptedContent: string; isHtml: boolean };
  renderText?: string;
  setFrameColor?: 'green' | 'gray' | 'red';
  renderEncryptionStatus?: string;
  renderSignatureStatus?: string;
  renderVerificationInProgress?: boolean;
  renderInnerAttachments?: {
    attachments: TransferableAttachment[];
    isEncrypted: boolean;
  };
};
