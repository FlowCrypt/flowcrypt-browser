/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { PgpBlockView } from '../pgp_block.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Str } from '../../../js/common/core/common.js';

export class PgpBlockViewErrorModule {
  private debugId = Str.sloppyRandom();

  public constructor(private view: PgpBlockView) {}

  public renderErr = (errBoxContent: string, renderRawMsg: string | undefined, errMsg?: string) => {
    this.view.renderModule.setFrameColor('red');
    this.view.renderModule.renderErrorStatus(errMsg || 'decrypt error');
    const showRawMsgPrompt = renderRawMsg ? '<a href="#" class="action_show_raw_pgp_block">show original message</a>' : '';
    this.view.renderModule.renderContent(`<div class="error">${errBoxContent.replace(/\n/g, '<br>')}</div>${showRawMsgPrompt}`, true);
    $('.action_show_raw_pgp_block').on(
      'click',
      this.view.setHandler(async () => {
        // this may contain content missing MDC
        this.view.renderModule.renderEncryptionStatus('decrypt error: security hazard');
        this.view.renderModule.renderSignatureStatus('not signed');
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        Xss.sanitizeAppend('#pgp_block', `<div class="raw_pgp_block">${Xss.escape(renderRawMsg!)}</div>`); // therefore the .escape is crucial
      })
    );
    $('.button.settings_keyserver').on(
      'click',
      this.view.setHandler(async () => await Browser.openSettingsPage('index.htm', this.view.acctEmail, '/chrome/settings/modules/keyserver.htm'))
    );
    $('.button.settings').on(
      'click',
      this.view.setHandler(async () => await Browser.openSettingsPage('index.htm', this.view.acctEmail))
    );
    $('.button.settings_add_key').on(
      'click',
      this.view.setHandler(async () => await Browser.openSettingsPage('index.htm', this.view.acctEmail, '/chrome/settings/modules/add_key.htm'))
    );
    $('.button.reply_pubkey_mismatch').on(
      'click',
      this.view.setHandler(() => BrowserMsg.send.replyPubkeyMismatch(this.view.parentTabId))
    );
    Ui.setTestState('ready');
  };

  public debug = (msg: string) => {
    if (this.view.debug) {
      console.log(`[${this.debugId}] ${msg}`);
    }
  };
}
