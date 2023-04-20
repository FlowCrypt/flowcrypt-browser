/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

export interface RenderInterface {
  setTestState(state: 'ready' | 'working' | 'waiting'): void;
  resizePgpBlockFrame(): void;
  separateQuotedContentAndRenderText(decryptedContent: string, isHtml: boolean): void;
  renderText(text: string): void;
  setFrameColor(color: 'red' | 'green' | 'gray'): void;
  renderEncryptionStatus(status: string): void;
  renderSignatureStatus(status: string): void; // todo: need to implement "offline error"->"click"->retry scenario
}
