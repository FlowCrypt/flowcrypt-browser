/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { TransferableAttachment } from './core/attachment.js';
import { PromiseCancellation } from './core/common.js';
import { PrintMailInfo } from './render-message.js';

export interface RenderInterfaceBase {
  resizePgpBlockFrame(): void;
  renderText(text: string): void;
  setFrameColor(color: 'red' | 'green' | 'gray'): void;
  renderEncryptionStatus(status: string): void;
  renderSignatureStatus(status: string): void;
}

export interface RenderInterface extends RenderInterfaceBase {
  cancellation: PromiseCancellation;
  renderAsRegularContent(content: string): void;
  setPrintMailInfo(info: PrintMailInfo): void;
  clearErrorStatus(): void;
  renderPassphraseNeeded(longids: string[]): void;
  renderErr(errBoxContent: string, renderRawMsg: string | undefined, errMsg?: string): void;
  renderInnerAttachments(attachments: TransferableAttachment[], isEncrypted: boolean): void;
  separateQuotedContentAndRenderText(decryptedContent: string, isHtml: boolean): void;
  renderVerificationInProgress(): void;
  renderSignatureOffline(retry: () => void): void;
}
