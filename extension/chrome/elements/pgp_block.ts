/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Url } from '../../js/common/core/common.js';
import { Assert } from '../../js/common/assert.js';
import { RenderMessage } from '../../js/common/render-message.js';
import { Attachment } from '../../js/common/core/attachment.js';
import { Xss } from '../../js/common/platform/xss.js';
import { PgpBlockViewAttachmentsModule } from './pgp_block_modules/pgp-block-attachments-module.js';
import { PgpBlockViewErrorModule } from './pgp_block_modules/pgp-block-error-module.js';
import { PgpBlockViewPrintModule } from './pgp_block_modules/pgp-block-print-module.js';
import { PgpBlockViewQuoteModule } from './pgp_block_modules/pgp-block-quote-module.js';
import { PgpBlockViewRenderModule } from './pgp_block_modules/pgp-block-render-module.js';
import { CommonHandlers, Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';

export class PgpBlockView extends View {
  public readonly acctEmail: string; // needed for attachment decryption, probably should be refactored out
  public readonly parentTabId: string;
  public readonly frameId: string;

  public readonly debug: boolean;
  public readonly attachmentsModule: PgpBlockViewAttachmentsModule;
  public readonly quoteModule: PgpBlockViewQuoteModule;
  public readonly errorModule: PgpBlockViewErrorModule;
  public readonly renderModule: PgpBlockViewRenderModule;
  public readonly printModule = new PgpBlockViewPrintModule();
  private readonly tabId = BrowserMsg.generateTabId();
  private progressOperation?: {
    text: string;
    operationId: string; // to ignore possible stray notifications, we generate an id for each operation
  };

  public constructor() {
    super();
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse(['frameId', 'parentTabId', 'debug', 'acctEmail']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    this.frameId = Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId');
    this.debug = uncheckedUrlParams.debug === true;
    // modules
    this.attachmentsModule = new PgpBlockViewAttachmentsModule(this);
    this.quoteModule = new PgpBlockViewQuoteModule(this);
    this.errorModule = new PgpBlockViewErrorModule(this);
    this.renderModule = new PgpBlockViewRenderModule(this);
  }

  public getDest = () => {
    return this.tabId;
  };

  public render = async () => {
    //
  };

  public setHandlers = () => {
    $('.pgp_print_button').on(
      'click',
      this.setHandler(() => this.printModule.printPGPBlock())
    );
    BrowserMsg.addListener('pgp_block_render', async (msg: RenderMessage) => {
      this.processMessage(msg);
    });
    BrowserMsg.addListener('confirmation_result', CommonHandlers.createAsyncResultHandler());
    BrowserMsg.listen(this.getDest());
    BrowserMsg.send.pgpBlockReady(this, { frameId: this.frameId, messageSender: this.getDest() });
    // Added this listener to handle cases where 'inbox_page/setup-webmail-content-script' is not ready to retrieve 'pgpBlockReady' events.
    // This can occur if 'setHandlers' is called before 'Inbox.setHandlers' is fully initialized.
    // https://github.com/FlowCrypt/flowcrypt-browser/pull/5783#discussion_r1663636264
    BrowserMsg.addListener('set_handler_ready_for_pgp_block', async () => {
      BrowserMsg.send.pgpBlockReady(this, { frameId: this.frameId, messageSender: this.getDest() });
    });
  };

  private renderProgress = ({ operationId, text, perc, init }: { operationId: string; text: string; perc?: number; init?: boolean }) => {
    if (init) {
      this.progressOperation = { operationId, text };
    } else if (this.progressOperation?.operationId !== operationId) {
      return;
    }
    const renderText = perc ? `${text} ${Math.min(perc, 100)}%` : text;
    this.renderModule.renderText(renderText);
  };

  private processMessage = (data: RenderMessage) => {
    if (data?.progressOperation) {
      this.renderProgress(data.progressOperation);
    } else {
      this.progressOperation = undefined;
    }
    // messages aren't merged when queueing, so the order is arbitrary
    if (data?.renderEncryptionStatus) {
      this.renderModule.renderEncryptionStatus(data.renderEncryptionStatus);
    }
    if (data?.renderVerificationInProgress) {
      $('#pgp_signature').removeClass('green_label red_label').addClass('gray_label').text('verifying signature...');
    }
    if (data?.renderSignatureStatus) {
      this.renderModule.renderSignatureStatus(data.renderSignatureStatus);
    }
    if (data?.renderText) {
      this.renderModule.renderText(data.renderText);
    }
    if (data?.resizePgpBlockFrame) {
      this.renderModule.resizePgpBlockFrame();
    }
    if (data?.separateQuotedContentAndRenderText) {
      this.quoteModule.separateQuotedContentAndRenderText(
        data.separateQuotedContentAndRenderText.decryptedContent,
        data.separateQuotedContentAndRenderText.isHtml,
        data.separateQuotedContentAndRenderText.isChecksumInvalid
      );
    }
    if (data?.setFrameColor) {
      this.renderModule.setFrameColor(data.setFrameColor);
    }
    if (data?.renderInnerAttachments) {
      const attachments = data.renderInnerAttachments.attachments.map(Attachment.fromTransferableAttachment);
      this.attachmentsModule.renderInnerAttachments(attachments, data.renderInnerAttachments.isEncrypted);
    }
    if (data?.renderErr) {
      this.errorModule.renderErr(data.renderErr.errBoxContent, data.renderErr.renderRawMsg, data.renderErr.errMsg);
    }
    if (data?.renderPassphraseNeeded) {
      this.renderModule.renderPassphraseNeeded(data.renderPassphraseNeeded);
    }
    if (data?.clearErrorStatus) {
      this.renderModule.clearErrorStatus();
    }
    if (data?.done) {
      Ui.setTestState('ready');
    }
    if (data?.printMailInfo) {
      Xss.sanitizeRender('.print_user_email', data.printMailInfo.userNameAndEmail);
      this.printModule.printMailInfoHtml = data.printMailInfo.html;
    }
    if (data?.renderAsRegularContent) {
      this.renderModule.renderAsRegularContent(data.renderAsRegularContent);
    }
    if (data?.renderSignatureOffline) {
      this.renderModule.renderSignatureOffline();
    }
  };
}

View.run(PgpBlockView);
