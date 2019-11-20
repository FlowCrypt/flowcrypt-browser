/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './interfaces/composer-component.js';
import { Settings } from '../settings.js';
import { Xss } from '../platform/xss.js';
import { Dict } from '../core/common.js';
import { SendAsAlias } from '../platform/store.js';
import { Ui } from '../browser.js';
import { BrowserMsg } from '../extension.js';
import { Api } from '../api/api.js';
import { Catch } from '../platform/catch.js';

export class ComposerSender extends ComposerComponent {

  initActions() {
    // none
  }

  public getSender = (): string => {
    if (this.composer.S.now('input_from').length) {
      return String(this.composer.S.now('input_from').val());
    }
    if (this.urlParams.from) {
      return this.urlParams.from;
    }
    return this.urlParams.acctEmail;
  }

  public renderSenderAliasesOptionsToggle() {
    const sendAs = this.composer.app.storageGetAddresses();
    if (sendAs && Object.keys(sendAs).length > 1) {
      const showAliasChevronHtml = '<img tabindex="22" id="show_sender_aliases_options" src="/img/svgs/chevron-left.svg" title="Choose sending address">';
      const inputAddrContainer = this.composer.S.cached('email_copy_actions');
      Xss.sanitizeAppend(inputAddrContainer, showAliasChevronHtml);
      inputAddrContainer.find('#show_sender_aliases_options').click(Ui.event.handle((el) => {
        this.renderSenderAliasesOptions(sendAs);
        el.remove();
      }, this.composer.getErrHandlers(`show sending address options`)));
    }
  }

  public renderSenderAliasesOptions(sendAs: Dict<SendAsAlias>) {
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
      Xss.sanitizeAppend(inputAddrContainer.find('#input_from'), emailAliases.map(fmtOpt).join('')).change(() => this.composer.composerContacts.updatePubkeyIcon());
      this.composer.S.now('input_from').change(async () => {
        await this.composer.composerContacts.reEvaluateRecipients(this.composer.composerContacts.getRecipients());
        await this.composer.composerContacts.setEmailsPreview(this.composer.composerContacts.getRecipients());
        this.composer.composerContacts.updatePubkeyIcon();
        this.composer.composerQuote.replaceFooter(this.getFooter());
      });
      if (this.urlParams.isReplyBox) {
        this.composer.composerWindowSize.resizeComposeBox();
      }
    }
  }

  public async checkEmailAliases() {
    try {
      const refreshResult = await Settings.refreshAcctAliases(this.urlParams.acctEmail);
      if (refreshResult) {
        this.composer.app.updateSendAs(refreshResult.sendAs);
        if (refreshResult.isAliasesChanged || refreshResult.isDefaultEmailChanged) {
          this.renderSenderAliasesOptions(refreshResult.sendAs);
        }
        if (refreshResult.isFooterChanged && !this.urlParams.draftId) {
          const alias = refreshResult.sendAs[this.getSender()];
          if (alias) {
            this.composer.composerQuote.replaceFooter(alias.footer || undefined);
          }
        }
      }
    } catch (e) {
      if (Api.err.isAuthPopupNeeded(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail });
      } else if (Api.err.isSignificant(e)) {
        Catch.reportErr(e);
      }
    }
  }

  public getFooter = () => {
    const addresses = this.composer.app.storageGetAddresses();
    const sender = this.getSender();
    return addresses && addresses[sender] && addresses[sender].footer || undefined;
  }

}
