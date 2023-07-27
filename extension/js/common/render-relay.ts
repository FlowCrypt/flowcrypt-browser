/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { RelayManagerInterface } from './relay-manager-interface.js';
import { RenderInterface } from './render-interface.js';
import { PrintMailInfo, RenderMessage } from './render-message.js';
import { TransferableAttachment } from './core/attachment.js';
import { PromiseCancellation, Str } from './core/common.js';
import { Catch } from './platform/catch.js';
import { Xss } from './platform/xss.js';
import { ProgressCb } from './api/shared/api.js';
import { Bm } from './browser/browser-msg.js';

export class RenderRelay implements RenderInterface {
  public readonly cancellation: PromiseCancellation = { cancel: false };
  private retry?: () => void;
  private progressOperation?: {
    text: string;
    operationId: string; // we can possibly receive a callback from an operation started by the replaced RenderRelay, so need to check operationId
  };
  public constructor(
    private relayManager: RelayManagerInterface,
    private frameId: string,
    private processor: (renderModule: RenderInterface) => Promise<void>
  ) {}

  public static getPercentage = (percent: number | undefined, loaded: number, total: number, expectedTransferSize: number) => {
    if (typeof percent === 'undefined') {
      if (total || expectedTransferSize) {
        percent = Math.round((loaded / (total || expectedTransferSize)) * 100);
      }
    }
    return percent;
  };

  public startProgressRendering = (text: string) => {
    this.relay({ renderText: text }); // we want to enqueue this initial message in case of hanging...
    const operationId = Str.sloppyRandom(10);
    this.progressOperation = { text, operationId };
    return (expectedTransferSize: number) => {
      // the `download` shortcut function can be used in some cases
      // if not lost by messaging, it will be given priority over message-based progress implementation
      const download: ProgressCb = (percent, loaded, total) => this.renderProgress({ operationId, percent, loaded, total, expectedTransferSize });
      return {
        operationId,
        expectedTransferSize,
        download, // shortcut
      };
    };
  };

  public renderProgress = ({ operationId, percent, loaded, total, expectedTransferSize }: Bm.AjaxProgress) => {
    if (this.progressOperation && this.progressOperation.operationId === operationId) {
      const perc = RenderRelay.getPercentage(percent, loaded, total, expectedTransferSize);
      if (typeof perc !== 'undefined') {
        this.relay({ renderText: `${this.progressOperation.text} ${perc}%` }, { progressOperationRendering: true });
      }
      return true;
    }
    return false;
  };

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

  private relay = (message: RenderMessage, options?: { progressOperationRendering: true }) => {
    if (!this.cancellation.cancel) {
      if (!options?.progressOperationRendering) {
        // "unsubscribe" from further progress callbacks
        this.progressOperation = undefined;
      }
      this.relayManager.relay(this.frameId, message, options?.progressOperationRendering);
    }
  };
}
