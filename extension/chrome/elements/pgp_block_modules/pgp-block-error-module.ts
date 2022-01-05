/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { FormatError } from '../../../js/common/core/crypto/pgp/msg-util.js';
import { Lang } from '../../../js/common/lang.js';
import { PgpBlockView } from '../pgp_block.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { isFesUsed } from '../../../js/common/shared.js';

export class PgpBlockViewErrorModule {

  constructor(private view: PgpBlockView) {
  }

  public renderErr = async (errBoxContent: string, renderRawMsg: string | undefined) => {
    this.view.renderModule.setFrameColor('red');
    const showRawMsgPrompt = renderRawMsg ? '<a href="#" class="action_show_raw_pgp_block">show original message</a>' : '';
    await this.view.renderModule.renderContent(`<div class="error">${errBoxContent.replace(/\n/g, '<br>')}</div>${showRawMsgPrompt}`, true);
    $('.action_show_raw_pgp_block').click(this.view.setHandler(async () => { // this may contain content missing MDC
      this.view.renderModule.renderEncryptionStatus('decrypt error: security hazard');
      this.view.renderModule.renderSignatureStatus('not signed');
      Xss.sanitizeAppend('#pgp_block', `<div class="raw_pgp_block">${Xss.escape(renderRawMsg!)}</div>`); // therefore the .escape is crucial
    }));
    $('.button.settings_keyserver').click(this.view.setHandler(async () => await Browser.openSettingsPage('index.htm', this.view.acctEmail, '/chrome/settings/modules/keyserver.htm')));
    $('.button.settings').click(this.view.setHandler(async () => await Browser.openSettingsPage('index.htm', this.view.acctEmail)));
    $('.button.settings_add_key').click(this.view.setHandler(async () => await Browser.openSettingsPage('index.htm', this.view.acctEmail, '/chrome/settings/modules/add_key.htm')));
    $('.button.reply_pubkey_mismatch').click(this.view.setHandler(() => BrowserMsg.send.replyPubkeyMismatch(this.view.parentTabId)));
    Ui.setTestState('ready');
  };

  public handlePrivateKeyMismatch = async (armoredPubs: string[], message: Uint8Array, isPwdMsg: boolean) => { // todo - make it work for multiple stored keys
    const msgDiagnosis = await BrowserMsg.send.bg.await.pgpMsgDiagnosePubkeys({ armoredPubs, message });
    if (msgDiagnosis.found_match) {
      await this.renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.encryptedCorrectlyFileBug, undefined);
    } else if (isPwdMsg) {
      await this.renderErr(Lang.pgpBlock.pwdMsgOnlyReadableOnWeb + this.btnHtml('ask sender to re-send', 'gray2 short reply_pubkey_mismatch'), undefined);
    } else {
      const startText = msgDiagnosis.receivers === 1 ? Lang.pgpBlock.cantOpen + Lang.pgpBlock.singleSender + Lang.pgpBlock.askResend : Lang.pgpBlock.yourKeyCantOpenImportIfHave;
      await this.renderErr(startText + this.btnHtml('import missing key', 'gray2 settings_add_key') + '&nbsp; &nbsp;'
        + this.btnHtml('ask sender to update', 'gray2 short reply_pubkey_mismatch') + '&nbsp; &nbsp;' + this.btnHtml('settings', 'gray2 settings_keyserver'), undefined);
    }
  };

  public handleInitializeErr = async (acctEmail: string, e: any) => {
    if (ApiErr.isNetErr(e)) {
      await this.renderErr(`Could not load message due to network error. ${Ui.retryLink()}`, undefined);
    } else if (ApiErr.isAuthErr(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      await this.renderErr(`Could not load message due to missing auth. ${Ui.retryLink()}`, undefined);
    } else if (e instanceof FormatError) {
      await this.renderErr(Lang.pgpBlock.cantOpen + Lang.pgpBlock.badFormat + Lang.pgpBlock.dontKnowHowOpen(await isFesUsed(acctEmail)), e.data);
    } else if (ApiErr.isInPrivateMode(e)) {
      await this.renderErr(`FlowCrypt does not work in a Firefox Private Window (or when Firefox Containers are used). Please try in a standard window.`, undefined);
    } else {
      Catch.reportErr(e);
      await this.renderErr(Xss.escape(String(e)), this.view.encryptedMsgUrlParam ? this.view.encryptedMsgUrlParam.toUtfStr() : undefined);
    }
  };

  public btnHtml = (text: string, addClasses: string) => {
    return `<button class="button long ${addClasses}" style="margin:30px 0;" target="cryptup">${text}</button>`;
  };

}
