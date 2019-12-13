/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './composer-abstract-component.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { NewMsgData, RecipientElement } from './composer-types.js';
import { Recipients } from '../../../js/common/api/email_provider/email_provider_api.js';

export class ComposerInput extends ComposerComponent {

  initActions = () => {
    this.composer.S.cached('add_intro').click(this.view.setHandler(el => this.actionAddIntroHandler(el), this.composer.errs.handlers(`add intro`)));
    this.composer.S.cached('input_text').get(0).onpaste = (clipEv) => this.composer.input.textPastedIntoBodyHandler(clipEv);
  }

  public inputTextHtmlSetSafely = (html: string) => {
    Xss.sanitizeRender(this.composer.S.cached('input_text'), Xss.htmlSanitizeKeepBasicTags(html));
  }

  public extract = (type: 'text' | 'html', elSel: 'input_text' | 'input_intro', flag?: 'SKIP-ADDONS') => {
    let html = this.composer.S.cached(elSel)[0].innerHTML;
    if (elSel === 'input_text' && this.composer.quote.expandingHTMLPart && flag !== 'SKIP-ADDONS') {
      html += `<br /><br />${this.composer.quote.expandingHTMLPart}`;
    }
    if (type === 'html') {
      return Xss.htmlSanitizeKeepBasicTags(html);
    }
    return Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(html, '\n')).trim();
  }

  public extractAll = (): NewMsgData => {
    const recipientElements = this.composer.recipients.getRecipients();
    const recipients = this.mapRecipients(recipientElements);
    const subject = this.view.isReplyBox && this.view.replyParams ? this.view.replyParams.subject : String($('#input_subject').val() || '');
    const plaintext = this.composer.input.extract('text', 'input_text');
    const plainhtml = this.composer.input.extract('html', 'input_text');
    const password = this.composer.S.cached('input_password').val();
    const pwd = password ? { answer: String(password) } : undefined;
    const sender = this.composer.sender.getSender();
    return { recipients, subject, plaintext, plainhtml, pwd, sender };
  }

  // -- private

  private textPastedIntoBodyHandler = (clipboardEvent: ClipboardEvent) => {
    if (!clipboardEvent.clipboardData) {
      return;
    }
    const clipboardHtmlData = clipboardEvent.clipboardData.getData('text/html');
    if (!clipboardHtmlData) {
      return; // if it's text, let the original handlers paste it
    }
    clipboardEvent.preventDefault();
    clipboardEvent.stopPropagation();
    const sanitized = Xss.htmlSanitizeAndStripAllTags(clipboardHtmlData, '<br>');
    // the lines below simulate ctrl+v, but not perfectly (old selected text does not get deleted)
    const selection = window.getSelection();
    if (selection) {
      const r = selection.getRangeAt(0);
      r.insertNode(r.createContextualFragment(sanitized));
    }
  }

  private actionAddIntroHandler = (addIntroBtn: HTMLElement) => {
    $(addIntroBtn).css('display', 'none');
    this.composer.S.cached('intro_container').css('display', 'table-row');
    this.composer.S.cached('input_intro').focus();
    this.composer.size.setInputTextHeightManuallyIfNeeded();
  }

  private mapRecipients = (recipients: RecipientElement[]) => {
    const result: Recipients = { to: [], cc: [], bcc: [] };
    for (const recipient of recipients) {
      switch (recipient.sendingType) {
        case "to":
          result.to!.push(recipient.email);
          break;
        case "cc":
          result.cc!.push(recipient.email);
          break;
        case "bcc":
          result.bcc!.push(recipient.email);
          break;
      }
    }
    return result;
  }

}
