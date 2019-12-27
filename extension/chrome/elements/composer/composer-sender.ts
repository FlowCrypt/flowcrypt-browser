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

  public renderSenderAliasesOptionsToggle = async () => {
    const { sendAs } = await Store.getAcct(this.view.acctEmail, ['sendAs']);
    if (sendAs && Object.keys(sendAs).length > 1) {
      const showAliasChevronHtml = '<img tabindex="22" id="show_sender_aliases_options" src="/img/svgs/chevron-left.svg" title="Choose sending address">';
      const inputAddrContainer = this.composer.S.cached('email_copy_actions');
      Xss.sanitizeAppend(inputAddrContainer, showAliasChevronHtml);
      inputAddrContainer.find('#show_sender_aliases_options').click(this.view.setHandler((el) => {
        this.renderSenderAliasesOptions(sendAs);
        el.remove();
      }, this.composer.errs.handlers(`show sending address options`)));
    }
  }

  public renderSenderAliasesOptions = (sendAs: Dict<SendAsAlias>) => {
    let emailAliases = Object.keys(sendAs);
    const inputAddrContainer = $('.recipients-inputs');
    inputAddrContainer.find('#input_from').remove();
    if (emailAliases.length > 1) {
      inputAddrContainer.addClass('show_send_from');
      Xss.sanitizeAppend(inputAddrContainer, '<select id="input_from" tabindex="1" data-test="input-from"></select>');
      const fmtOpt = (addr: string) => `<option value="${Xss.escape(addr)}" ${this.getSender() === addr ? 'selected' : ''}>${Xss.escape(addr)}</option>`;
      emailAliases = emailAliases.sort((a, b) => {
        return (sendAs[a].isDefault === sendAs[b].isDefault) ? 0 : sendAs[a].isDefault ? -1 : 1;
      });
      Xss.sanitizeAppend(inputAddrContainer.find('#input_from'), emailAliases.map(fmtOpt).join('')).change(() => this.composer.myPubkey.reevaluateShouldAttachOrNot());
      this.composer.S.now('input_from').change(async () => {
        await this.composer.recipients.reEvaluateRecipients(this.composer.recipients.getRecipients());
        await this.composer.recipients.setEmailsPreview(this.composer.recipients.getRecipients());
        this.composer.quote.replaceFooter(await this.getFooter());
      });
      if (this.view.isReplyBox) {
        this.composer.size.resizeComposeBox();
      }
    }
  }

  public checkEmailAliases = async () => {
    try {
      const refreshResult = await Settings.refreshAcctAliases(this.view.acctEmail);
      if (refreshResult) {
        if (refreshResult.isAliasesChanged || refreshResult.isDefaultEmailChanged) {
          this.renderSenderAliasesOptions(refreshResult.sendAs);
        }
        if (refreshResult.isFooterChanged && !this.view.draftId) {
          const alias = refreshResult.sendAs[this.getSender()];
          if (alias && !this.view.isReplyBox) {
            this.composer.quote.replaceFooter(alias.footer || undefined);
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

  public getFooter = async (): Promise<string | undefined> => {
    const { sendAs } = await Store.getAcct(this.view.acctEmail, ['sendAs']);
    if (!sendAs) {
      return;
    }
    const sender = this.getSender();
    return sendAs[sender]?.footer || undefined;
  }

}
