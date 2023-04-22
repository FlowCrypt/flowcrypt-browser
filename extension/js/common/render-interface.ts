/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export interface RenderInterfaceBase {
  resizePgpBlockFrame(): void;
  renderText(text: string): void;
  setFrameColor(color: 'red' | 'green' | 'gray'): void;
  renderEncryptionStatus(status: string): void;
  renderSignatureStatus(status: string): void; // todo: need to implement "offline error"->"click"->retry scenario
}

export interface RenderInterface extends RenderInterfaceBase {
  setTestState(state: 'ready' | 'working' | 'waiting'): void;
  separateQuotedContentAndRenderText(decryptedContent: string, isHtml: boolean): void;
}
