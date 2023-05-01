/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Lang } from '../../../js/common/lang.js';
import { PgpBaseBlockView } from '../pgp_base_block_view.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Str } from '../../../js/common/core/common.js';

export class PgpBlockViewErrorModule {
  private debugId = Str.sloppyRandom();

  public constructor(private view: PgpBaseBlockView) {}

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

  public handlePrivateKeyMismatch = async (armoredPubs: string[], message: Uint8Array | string, isPwdMsg: boolean) => {
    // todo - make it work for multiple stored keys
    const msgDiagnosis = await BrowserMsg.send.bg.await.pgpMsgDiagnosePubkeys({ armoredPubs, message });
    if (msgDiagnosis.found_match) {
      await this.renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.encryptedCorrectlyFileBug, undefined);
    } else if (isPwdMsg) {
      await this.renderErr(Lang.pgpBlock.pwdMsgOnlyReadableOnWeb + this.btnHtml('ask sender to re-send', 'gray2 short reply_pubkey_mismatch'), undefined);
    } else {
      const startText =
        msgDiagnosis.receivers === 1
          ? Lang.pgpBlock.cantOpen + Lang.pgpBlock.singleSender + Lang.pgpBlock.askResend
          : Lang.pgpBlock.yourKeyCantOpenImportIfHave;
      await this.renderErr(
        startText +
          this.btnHtml('import missing key', 'gray2 settings_add_key') +
          '&nbsp; &nbsp;' +
          this.btnHtml('ask sender to update', 'gray2 short reply_pubkey_mismatch') +
          '&nbsp; &nbsp;' +
          this.btnHtml('settings', 'gray2 settings_keyserver'),
        undefined
      );
    }
  };

  public btnHtml = (text: string, addClasses: string) => {
    return `<button class="button long ${addClasses}" style="margin:30px 0;" target="cryptup">${text}</button>`;
  };
}
