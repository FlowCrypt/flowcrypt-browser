/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Url } from '../../js/common/core/common.js';
import { Assert } from '../../js/common/assert.js';
import { RenderMessage, RenderMessageWithFrameId } from '../../js/common/render-message.js';
import { Attachment } from '../../js/common/core/attachment.js';
import { Xss } from '../../js/common/platform/xss.js';
import { PgpBlockViewAttachmentsModule } from './pgp_block_modules/pgp-block-attachmens-module.js';
import { PgpBlockViewErrorModule } from './pgp_block_modules/pgp-block-error-module.js';
import { PgpBlockViewPrintModule } from './pgp_block_modules/pgp-block-print-module.js';
import { PgpBlockViewQuoteModule } from './pgp_block_modules/pgp-block-quote-module.js';
import { PgpBlockViewRenderModule } from './pgp_block_modules/pgp-block-render-module.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { Bm } from '../../js/common/browser/browser-msg.js';

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
    chrome.runtime.onMessage.addListener((message: Bm.Raw) => {
      if (message.name === 'pgp_block_render') {
        const msg = message.data.bm as RenderMessageWithFrameId;
        if (msg.frameId === this.frameId) {
          this.processMessage(msg);
          return true;
        }
      }
      return false;
    });
    window.addEventListener('load', () => window.parent.postMessage({ readyToReceive: this.frameId }, '*'));
  }

  public render = async () => {
    //
  };

  public setHandlers = () => {
    $('.pgp_print_button').on(
      'click',
      this.setHandler(() => this.printModule.printPGPBlock())
    );
  };

  private processMessage = (data: RenderMessage) => {
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
        data.separateQuotedContentAndRenderText.isHtml
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
