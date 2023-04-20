/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { RenderInterface } from './render-interface.js';
import { RenderMessage } from './render-message.js';

export class RenderRelay implements RenderInterface {
  public constructor(private frameWindow: Window) {}
  public setTestState = (state: 'ready' | 'working' | 'waiting') => {
    this.relay({ setTestState: state });
  };
  public resizePgpBlockFrame = () => {
    this.relay({ resizePgpBlockFrame: true });
  };

  public separateQuotedContentAndRenderText = (decryptedContent: string, isHtml: boolean) => {
    this.relay({ separateQuotedContentAndRenderText: { decryptedContent, isHtml } });
  };

  public renderText = (text: string) => {
    this.relay({ renderText: text });
  };

  public setFrameColor = (color: 'green' | 'gray' | 'red') => {
    this.relay({ setFrameColor: color });
  };

  public renderEncryptionStatus = (status: string) => {
    this.relay({ renderEncryptionStatus: status });
  };

  public renderSignatureStatus = (status: string) => {
    this.relay({ renderSignatureStatus: status });
  };

  private relay = (message: RenderMessage) => {
    this.frameWindow.postMessage(message, '*'); // todo: targetOrigin
  };
}
