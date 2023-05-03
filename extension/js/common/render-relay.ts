/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { RelayManagerInterface } from './relay-manager-interface.js';
import { RenderInterface } from './render-interface.js';
import { PrintMailInfo, RenderMessage } from './render-message.js';
import { TransferableAttachment } from './core/attachment.js';

export class RenderRelay implements RenderInterface {
  public constructor(private relayManager: RelayManagerInterface, private frameId: string) {}

  public renderErr = (errBoxContent: string, renderRawMsg: string | undefined, errMsg?: string | undefined) => {
    this.relay({ renderErr: { errBoxContent, renderRawMsg, errMsg } });
  };

  public renderInnerAttachments = (attachments: TransferableAttachment[], isEncrypted: boolean) => {
    this.relay({ renderInnerAttachments: { attachments, isEncrypted } });
  };

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

  public renderVerificationInProgress = () => {
    this.relay({ renderVerificationInProgress: true });
  };

  public renderPassphraseNeeded = (longids: string[]) => {
    this.relay({ renderPassphraseNeeded: longids });
  };

  public clearErrorStatus = () => {
    this.relay({ clearErrorStatus: true });
  };

  public setPrintMailInfo = (printMailInfo: PrintMailInfo) => {
    this.relay({ printMailInfo });
  };

  public renderAsRegularContent = (content: string) => {
    this.relay({ renderAsRegularContent: content });
  };

  private relay = (message: RenderMessage) => {
    this.relayManager.relay(this.frameId, message);
  };
}