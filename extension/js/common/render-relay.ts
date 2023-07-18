/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { RelayManagerInterface } from './relay-manager-interface.js';
import { RenderInterface } from './render-interface.js';
import { PrintMailInfo, RenderMessage } from './render-message.js';
import { TransferableAttachment } from './core/attachment.js';
import { PromiseCancellation } from './core/common.js';
import { Catch } from './platform/catch.js';
import { Xss } from './platform/xss.js';

export class RenderRelay implements RenderInterface {
  public readonly cancellation: PromiseCancellation = { cancel: false };
  private retry?: () => void;
  public constructor(
    private relayManager: RelayManagerInterface,
    private frameId: string,
    private processor: (renderModule: RenderInterface) => Promise<void>
  ) {}

  public clone = () => {
    return new RenderRelay(this.relayManager, this.frameId, this.processor);
  };

  public start = () => {
    this.processor(this)
      .catch(e => {
        // normally no exceptions come to this point so let's report it
        Catch.reportErr(e);
        this.renderErr(Xss.escape(String(e)), undefined);
      })
      .finally(() => this.relay({ done: true }));
  };

  public renderErr = (errBoxContent: string, renderRawMsg: string | undefined, errMsg?: string | undefined) => {
    this.relay({ renderErr: { errBoxContent, renderRawMsg, errMsg } });
  };

  public renderInnerAttachments = (attachments: TransferableAttachment[], isEncrypted: boolean) => {
    this.relay({ renderInnerAttachments: { attachments, isEncrypted } });
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

  public renderSignatureOffline = (retry: () => void) => {
    this.retry = retry;
    this.relay({ renderSignatureOffline: true });
  };

  public executeRetry = () => {
    const retry = this.retry;
    if (retry) {
      this.retry = undefined;
      retry();
    }
  };

  private relay = (message: RenderMessage) => {
    if (!this.cancellation.cancel) {
      this.relayManager.relay(this.frameId, message);
    }
  };
}
