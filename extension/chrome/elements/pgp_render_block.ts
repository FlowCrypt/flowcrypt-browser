/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Url } from '../../js/common/core/common.js';
import { Assert } from '../../js/common/assert.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { PgpBaseBlockView } from './pgp_base_block_view.js';
import { RenderMessage } from '../../js/common/render-message.js';
import { Attachment } from '../../js/common/core/attachment.js';

export class PgpRenderBlockView extends PgpBaseBlockView {
  public constructor() {
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse(['frameId', 'parentTabId', 'debug', 'acctEmail']);
    super(
      uncheckedUrlParams.debug === true,
      Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId'),
      Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId'),
      Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail')
    );
    window.addEventListener('message', this.handleMessage, true); // todo: capture?
    window.addEventListener('load', () => window.parent.postMessage({ readyToReceive: this.frameId }, '*'));
  }

  public render = async () => {
    // await this.renderModule.initPrintView();
  };

  public setHandlers = () => {
    /*
    $('.pgp_print_button').on(
      'click',
      this.setHandler(() => this.renderModule.printPGPBlock())
    );
    */
  };

  private handleMessage = (event: MessageEvent<unknown>) => {
    const data = event.data as RenderMessage;
    // todo: order better
    if (data?.renderEncryptionStatus) {
      this.renderModule.renderEncryptionStatus(data.renderEncryptionStatus);
    }
    if (data?.renderVerificationInProgress) {
      $('#pgp_signature').addClass('gray_label').text('verifying signature...');
    }
    if (data?.renderSignatureStatus) {
      this.renderModule.renderSignatureStatus(data.renderSignatureStatus); // todo: "offline"->click->reload?
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
    if (data?.setTestState) {
      Ui.setTestState(data.setTestState);
    }
  };
}

View.run(PgpRenderBlockView);
