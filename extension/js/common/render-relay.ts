/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { RelayManagerInterface } from './relay-manager-interface.js';
import { RenderInterface } from './render-interface.js';
import { PrintMailInfo, RenderMessage } from './render-message.js';
import { TransferableAttachment } from './core/attachment.js';
import { PromiseCancellation, Str, Value } from './core/common.js';
import { Catch } from './platform/catch.js';
import { Xss } from './platform/xss.js';
import { ProgressCb } from './api/shared/api.js';
import { Bm } from './browser/browser-msg.js';

export class RenderRelay implements RenderInterface {
  public readonly cancellation: PromiseCancellation = { cancel: false };
  private retry?: () => void;
  private progressOperation?: {
    text: string;
    operationId: string; // to ignore possible stray notifications, we generate an id for each operation
  };
  public constructor(
    private relayManager: RelayManagerInterface,
    private frameId: string,
    private processor: (renderModule: RenderInterface) => Promise<void>
  ) {}

  public startProgressRendering = (text: string) => {
    const operationId = Str.sloppyRandom(10);
    this.relay({ progressOperation: { operationId, text, init: true } });
    return (expectedTransferSize: number) => {
      // the `download` shortcut function can be used in some cases
      // if not lost by messaging, it will be given priority over message-based progress implementation
      const download: ProgressCb = (percent, loaded, total) => this.renderProgress({ operationId, percent, loaded, total, expectedTransferSize });
      return {
        operationId,
        expectedTransferSize,
        download, // shortcut
        frameId: this.frameId,
      };
    };
  };

  public renderProgress = ({ operationId, percent, loaded, total, expectedTransferSize }: Bm.AjaxProgress) => {
    if (this.progressOperation && this.progressOperation.operationId === operationId) {
      const perc = Value.getPercentage(percent, loaded, total, expectedTransferSize);
      if (typeof perc !== 'undefined') {
        this.relay({ progressOperation: { ...this.progressOperation, perc } });
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

  private relay = (message: RenderMessage) => {
    if (!this.cancellation.cancel) {
      let dontEnqueue: boolean | undefined;
      if (message.progressOperation) {
        if (message.progressOperation.init) {
          this.progressOperation = { text: message.progressOperation.text, operationId: message.progressOperation.operationId };
        } else if (message.progressOperation.operationId !== this.progressOperation?.operationId) {
          return;
        } else {
          dontEnqueue = true;
        }
      } else {
        // "unsubscribe" from further progress callbacks
        this.progressOperation = undefined;
      }
      this.relayManager.relay(this.frameId, message, dontEnqueue);
    }
  };
}
