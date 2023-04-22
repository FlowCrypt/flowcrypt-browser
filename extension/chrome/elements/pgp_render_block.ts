/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Url } from '../../js/common/core/common.js';
import { Assert } from '../../js/common/assert.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';
import { PgpBaseBlockView } from './pgp_base_block_view.js';
import { RenderMessage } from '../../js/common/render-message.js';

export class PgpRenderBlockView extends PgpBaseBlockView {
  public readonly debug: boolean;

  public constructor() {
    Ui.event.protect();
    const uncheckedUrlParams = Url.parse(['frameId', 'parentTabId', 'debug']);
    super(Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId'), Assert.urlParamRequire.string(uncheckedUrlParams, 'frameId'));
    this.debug = uncheckedUrlParams.debug === true;
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
    if (data?.setTestState) {
      Ui.setTestState(data.setTestState);
    }
  };
}

View.run(PgpRenderBlockView);
