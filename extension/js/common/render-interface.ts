/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { TransferableAttachment } from './core/attachment.js';
import { PrintMailInfo } from './render-message.js';

export interface RenderInterfaceBase {
  resizePgpBlockFrame(): void;
  renderText(text: string): void;
  setFrameColor(color: 'red' | 'green' | 'gray'): void;
  renderEncryptionStatus(status: string): void;
  renderSignatureStatus(status: string): void; // todo: need to implement "offline error"->"click"->retry scenario
}

export interface RenderInterface extends RenderInterfaceBase {
  setPrintMailInfo(info: PrintMailInfo): void;
  clearErrorStatus(): void;
  renderPassphraseNeeded(longids: string[]): void;
  renderErr(errBoxContent: string, renderRawMsg: string | undefined, errMsg?: string): void;
  renderInnerAttachments(attachments: TransferableAttachment[], isEncrypted: boolean): void;
  setTestState(state: 'ready' | 'working' | 'waiting'): void;
  separateQuotedContentAndRenderText(decryptedContent: string, isHtml: boolean): void;
  renderVerificationInProgress(): void;
}
