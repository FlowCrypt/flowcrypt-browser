/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './composer-abstract-component.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { NewMsgData, RecipientElement } from './composer-types.js';
import { Recipients } from '../../../js/common/api/email_provider/email_provider_api.js';
import { SquireEditor, WillPasteEvent } from '../../../types/squire.js';
import { Catch } from '../../../js/common/platform/catch.js';

export class ComposerInput extends ComposerComponent {

  public squire = new window.Squire(this.composer.S.cached('input_text').get(0));

  private isRichText = () => {
    return this.composer.sendBtn.popover.choices.richText;
  }

  initActions = () => {
    this.composer.S.cached('add_intro').click(this.view.setHandler(el => this.actionAddIntroHandler(el), this.composer.errs.handlers(`add intro`)));
    this.handlePaste();
    this.handlePasteImages();
    this.initShortcuts();
    this.resizeReplyBox();
  }

  removeRichTextFormatting = () => {
    this.squire.setHTML(Xss.htmlSanitizeAndStripAllTags(this.squire.getHTML(), '<br>'));
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
    const pwd = typeof password === 'string' && password ? password : undefined;
    const sender = this.composer.sender.getSender();
    return { recipients, subject, plaintext, plainhtml, pwd, sender };
  }

  // -- private

  private handlePaste = () => {
    this.squire.addEventListener('willPaste', (e: WillPasteEvent) => {
      const plainTextDiv = document.createElement('div');
      plainTextDiv.appendChild(e.fragment);
      plainTextDiv.innerHTML = this.isRichText() ? Xss.htmlSanitize(plainTextDiv.innerHTML) : Xss.htmlSanitizeAndStripAllTags(plainTextDiv.innerHTML, '<br>'); // xss-sanitized
      e.fragment.appendChild(plainTextDiv);
    });
  }

  private handlePasteImages = () => {
    this.squire.addEventListener('drop', (e: DragEvent) => {
      if (!this.isRichText()) {
        return;
      }
      if (!e.dataTransfer?.files.length) {
        return;
      }
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        this.squire.insertImage(reader.result as ArrayBuffer, { name: file.name, title: file.name });
      };
      reader.readAsDataURL(file);
    });
    this.squire.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault(); // this is needed for 'drop' event to fire
    });
  }

  private initShortcuts = () => {
    try {
      const isMac = /Mac OS X/.test(navigator.userAgent);
      const ctrlKey = isMac ? 'meta-' : 'ctrl-';
      const mapKeyToFormat = (tag: string) => {
        return (self: SquireEditor, event: Event) => {
          event.preventDefault();
          if (!this.isRichText()) {
            return;
          }
          const range = self.getSelection();
          if (self.hasFormat(tag)) {
            self.changeFormat(null, { tag }, range); // tslint:disable-line:no-null-keyword
          } else {
            self.changeFormat({ tag }, null, range); // tslint:disable-line:no-null-keyword
          }
        };
      };
      const noop = (self: SquireEditor, event: Event) => {
        event.preventDefault();
      };
      this.squire.setKeyHandler(ctrlKey + 'b', mapKeyToFormat('B'));
      this.squire.setKeyHandler(ctrlKey + 'u', mapKeyToFormat('U'));
      this.squire.setKeyHandler(ctrlKey + 'i', mapKeyToFormat('I'));
      this.squire.setKeyHandler(ctrlKey + 'shift-7', noop); // default is 'S'
      this.squire.setKeyHandler(ctrlKey + 'shift-5', noop); // default is 'SUB', { tag: 'SUP' }
      this.squire.setKeyHandler(ctrlKey + 'shift-6', noop); // default is 'SUP', { tag: 'SUB' }
      this.squire.setKeyHandler(ctrlKey + 'shift-8', noop); // default is 'makeUnorderedList'
      this.squire.setKeyHandler(ctrlKey + 'shift-9', noop); // default is 'makeOrderedList'
      this.squire.setKeyHandler(ctrlKey + '[', noop); // default is 'decreaseQuoteLevel'
      this.squire.setKeyHandler(ctrlKey + ']', noop); // default is 'increaseQuot
    } catch (e) {
      Catch.reportErr(e);
    }
  }

  private resizeReplyBox = () => {
    this.squire.addEventListener('input', () => {
      if (this.composer.view.isReplyBox) {
        this.composer.size.resizeComposeBox();
      }
    });
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
