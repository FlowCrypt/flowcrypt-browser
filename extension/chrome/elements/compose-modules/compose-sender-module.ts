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
    if (this.view.S.now('input_from').val()) {
      return String(this.view.S.now('input_from').val());
    }
    if (this.view.replyParams?.myEmail) {
      return this.view.replyParams.myEmail;
    }
    return this.view.acctEmail;
  };

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
      if (ApiErr.isAuthErr(e)) {
        BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      }
      ApiErr.reportIfSignificant(e);
    }
  };

  public renderSendFromIfMoreThanOneAlias = async () => {
    const { sendAs } = await AcctStore.get(this.view.acctEmail, ['sendAs']);
    const emailAliases = Object.keys(sendAs!); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    const fromContainer = $('#input-container-from');
    if (emailAliases.length > 1) {
      const fmtOpt = (addr: string) => `<option value="${Xss.escape(addr)}" ${this.getSender() === addr ? 'selected' : ''}>${Xss.escape(addr)}</option>`;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      emailAliases.sort((a, b) => (sendAs![a].isDefault === sendAs![b].isDefault ? 0 : sendAs![a].isDefault ? -1 : 1));
      Xss.sanitizeRender(fromContainer.find('#input_from'), emailAliases.map(fmtOpt).join('')).change(() =>
        this.view.myPubkeyModule.reevaluateShouldAttachOrNot()
      );
      this.view.S.now('input_from').change(this.view.setHandler(() => this.actionInputFromChangeHandler()));
      if (this.view.isReplyBox) {
        this.view.sizeModule.resizeComposeBox();
      }
    } else {
      // if user doesn't have alias, then just hide from container
      fromContainer.hide();
    }
  };

  private actionInputFromChangeHandler = async () => {
    await this.view.recipientsModule.reEvaluateRecipients(this.view.recipientsModule.getValidRecipients());
    this.view.footerModule.onFooterUpdated(await this.view.footerModule.getFooterFromStorage(this.view.senderModule.getSender()));

    const inputEl = this.view.S.cached('input_text');
    const inputHtml = inputEl.html();
    const footer = this.view.quoteModule.tripleDotSanitizedHtmlContent?.footer ?? '';
    let htmlWithUpdatedFooter = inputHtml;
    if (inputHtml.includes('---------- Forwarded message ---------')) {
      // Update signature for forwarded messages
      const forwardSignaturePattern = /(--<br>[\s\S]*?)(?=<br>--<br>[\s\S]*?$|$)/gm;
      const matches = inputHtml.match(forwardSignaturePattern);

      if (matches?.length) {
        const lastSignature = matches[matches.length - 1];
        htmlWithUpdatedFooter = inputHtml.replace(lastSignature, footer);
      }
    } else {
      const signaturePattern =
        /--\s*<br\s*\/?>\s*[\s\S]*?(?=<br><\/div><div><br><\/div><div>|<br><br><blockquote dir="ltr"|On .* at .*, .*? wrote:|<br><\div><div><br><\div>|$)/;
      htmlWithUpdatedFooter = inputHtml.replace(signaturePattern, footer);
    }
    Xss.sanitizeRender(inputEl, htmlWithUpdatedFooter);
  };
}
