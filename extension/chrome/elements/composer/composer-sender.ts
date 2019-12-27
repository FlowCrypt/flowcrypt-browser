/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { SendAsAlias, Store } from '../../../js/common/platform/store.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { ComposerComponent } from './composer-abstract-component.js';
import { Dict } from '../../../js/common/core/common.js';
import { Settings } from '../../../js/common/settings.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class ComposerSender extends ComposerComponent {

  public initActions = () => {
    // none
  }

  public getSender = (): string => {
    if (this.composer.S.now('input_from').length) {
      return String(this.composer.S.now('input_from').val());
    }
    if (this.view.replyParams?.from) {
      return this.view.replyParams.from;
    }
    return this.view.acctEmail;
  }

  /**
   * The chevron-left is rotated to become a down chevron, and rendered along with to cc and bcc buttons
   * This is used for reply boxes (send-from are rendered automatically for new msgs)
   */
  public renderSendFromChevron = async () => {
    const { sendAs } = await Store.getAcct(this.view.acctEmail, ['sendAs']);
    if (sendAs && Object.keys(sendAs).length > 1) {
      const showAliasChevronHtml = '<img tabindex="22" id="render_send_from" src="/img/svgs/chevron-left.svg" title="Choose sending address">';
      const inputAddrContainer = this.composer.S.cached('container_cc_bcc_buttons');
      Xss.sanitizeAppend(inputAddrContainer, showAliasChevronHtml);
      inputAddrContainer.find('#render_send_from').click(this.view.setHandler(() => this.renderSendFrom(sendAs), this.composer.errs.handlers(`render send-from`)));
    }
  }

  public renderSendFrom = (sendAs: Dict<SendAsAlias>) => {
    $('#render_send_from').remove(); // created in renderSendFromChevron, if any
    const emailAliases = Object.keys(sendAs);
    const inputAddrContainer = $('.recipients-inputs');
    inputAddrContainer.find('#input_from').remove();
    if (emailAliases.length > 1) {
      inputAddrContainer.addClass('show_send_from');
      Xss.sanitizeAppend(inputAddrContainer, '<select id="input_from" tabindex="1" data-test="input-from"></select>');
      const fmtOpt = (addr: string) => `<option value="${Xss.escape(addr)}" ${this.getSender() === addr ? 'selected' : ''}>${Xss.escape(addr)}</option>`;
      emailAliases.sort((a, b) => (sendAs[a].isDefault === sendAs[b].isDefault) ? 0 : sendAs[a].isDefault ? -1 : 1);
      Xss.sanitizeAppend(inputAddrContainer.find('#input_from'), emailAliases.map(fmtOpt).join('')).change(() => this.composer.myPubkey.reevaluateShouldAttachOrNot());
      this.composer.S.now('input_from').change(this.view.setHandler(() => this.actionInputFromChangeHanlder()));
      if (this.view.isReplyBox) {
        this.composer.size.resizeComposeBox();
      }
    }
  }

  public checkEmailAliases = async () => {
    try {
      const refreshResult = await Settings.refreshSendAs(this.view.acctEmail);
      if (refreshResult) {
        if (refreshResult.aliasesChanged || refreshResult.defaultEmailChanged) {
          this.renderSendFrom(refreshResult.sendAs);
        }
        if (refreshResult.footerChanged && !this.composer.draft.wasMsgLoadedFromDraft) {
          const sendAsAlias = refreshResult.sendAs[this.getSender()];
          if (sendAsAlias && !this.view.isReplyBox) {
            this.composer.footer.onFooterUpdated(sendAsAlias.footer || undefined);
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

  private actionInputFromChangeHanlder = async () => {
    await this.composer.recipients.reEvaluateRecipients(this.composer.recipients.getRecipients());
    await this.composer.recipients.setEmailsPreview(this.composer.recipients.getRecipients());
    this.composer.footer.onFooterUpdated(await this.composer.footer.getFooterFromStorage(this.composer.sender.getSender()));
  }

}
