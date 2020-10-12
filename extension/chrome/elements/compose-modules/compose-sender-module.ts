/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Settings } from '../../../js/common/settings.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';

export class ComposeSenderModule extends ViewModule<ComposeView> {

  public getSender = (): string => {
    if (this.view.S.now('input_from').length) {
      return String(this.view.S.now('input_from').val());
    }
    if (this.view.replyParams?.from) {
      return this.view.replyParams.from;
    }
    return this.view.acctEmail;
  }

  public renderSendFromOrChevron = async () => {
    if (this.view.isReplyBox) {
      const { sendAs } = await AcctStore.get(this.view.acctEmail, ['sendAs']);
      if (Object.keys(sendAs!).length > 1) {
        const showAliasChevronHtml = '<img tabindex="22" id="render_send_from" src="/img/svgs/chevron-left.svg" title="Choose sending address">';
        const inputAddrContainer = this.view.S.cached('container_cc_bcc_buttons');
        Xss.sanitizeAppend(inputAddrContainer, showAliasChevronHtml);
        inputAddrContainer.find('#render_send_from').click(this.view.setHandler(() => this.renderSendFromIfMoreThanOneAlias(), this.view.errModule.handle(`render send-from`)));
      }
    } else {
      await this.renderSendFromIfMoreThanOneAlias();
    }
  }

  public checkEmailAliases = async () => {
    try {
      const refreshResult = await Settings.refreshSendAs(this.view.acctEmail);
      if (refreshResult) {
        if (refreshResult.aliasesChanged || refreshResult.defaultEmailChanged) {
          await this.renderSendFromIfMoreThanOneAlias();
        }
        if (refreshResult.footerChanged && !this.view.draftModule.wasMsgLoadedFromDraft) {
          const sendAsAlias = refreshResult.sendAs[this.getSender()];
          if (sendAsAlias && !this.view.isReplyBox) {
            this.view.footerModule.onFooterUpdated(sendAsAlias.footer || undefined);
          }
        }
      }
    } catch (e) {
      if (ApiErr.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      }
      ApiErr.reportIfSignificant(e);
    }
  }

  private renderSendFromIfMoreThanOneAlias = async () => {
    const { sendAs } = await AcctStore.get(this.view.acctEmail, ['sendAs']);
    $('#render_send_from').remove(); // created in renderSendFromChevron, if any
    const emailAliases = Object.keys(sendAs!);
    const inputAddrContainer = $('.recipients-inputs');
    inputAddrContainer.find('#input_from').remove();
    if (emailAliases.length > 1) {
      inputAddrContainer.addClass('show_send_from');
      Xss.sanitizeAppend(inputAddrContainer, '<select id="input_from" tabindex="1" data-test="input-from"></select>');
      const fmtOpt = (addr: string) => `<option value="${Xss.escape(addr)}" ${this.getSender() === addr ? 'selected' : ''}>${Xss.escape(addr)}</option>`;
      emailAliases.sort((a, b) => (sendAs![a].isDefault === sendAs![b].isDefault) ? 0 : sendAs![a].isDefault ? -1 : 1);
      Xss.sanitizeAppend(inputAddrContainer.find('#input_from'), emailAliases.map(fmtOpt).join('')).change(() => this.view.myPubkeyModule.reevaluateShouldAttachOrNot());
      this.view.S.now('input_from').change(this.view.setHandler(() => this.actionInputFromChangeHanlder()));
      if (this.view.isReplyBox) {
        this.view.sizeModule.resizeComposeBox();
      }
    }
  }

  private actionInputFromChangeHanlder = async () => {
    await this.view.recipientsModule.reEvaluateRecipients(this.view.recipientsModule.getRecipients());
    await this.view.recipientsModule.setEmailsPreview(this.view.recipientsModule.getRecipients());
    this.view.footerModule.onFooterUpdated(await this.view.footerModule.getFooterFromStorage(this.view.senderModule.getSender()));
  }

}
