/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { NewMsgData, RecipientElement } from './composer-types.js';
import { SquireEditor, WillPasteEvent } from '../../../types/squire.js';

import { Catch } from '../../../js/common/platform/catch.js';
import { ComposerComponent } from './composer-abstract-component.js';
import { Recipients } from '../../../js/common/api/email_provider/email_provider_api.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class ComposerInput extends ComposerComponent {
  public squire = new window.Squire(this.composer.S.cached('input_text').get(0));

  public initActions = () => {
    this.composer.S.cached('add_intro').click(this.view.setHandler(el => this.actionAddIntroHandler(el), this.composer.errs.handlers(`add intro`)));
    this.handlePaste();
    this.handlePasteImages();
    this.initShortcuts();
    this.resizeReplyBox();
    this.scrollIntoView();
    this.squire.setConfig({ addLinks: this.isRichText() });
    if (this.view.debug) {
      this.insertDebugElements();
    }
  }

  public addRichTextFormatting = () => {
    this.squire.setConfig({ addLinks: true });
  }

  public removeRichTextFormatting = () => {
    this.squire.setHTML(Xss.htmlSanitizeAndStripAllTags(this.squire.getHTML(), '<br>'));
    this.squire.setConfig({ addLinks: false });
  }

  public inputTextHtmlSetSafely = (html: string) => {
    Xss.sanitizeRender(this.composer.S.cached('input_text'), Xss.htmlSanitizeKeepBasicTags(html, 'IMG-KEEP'));
  }

  public extract = (type: 'text' | 'html', elSel: 'input_text' | 'input_intro', flag?: 'SKIP-ADDONS') => {
    let html = this.composer.S.cached(elSel)[0].innerHTML;
    if (elSel === 'input_text' && flag !== 'SKIP-ADDONS') {
      html += this.composer.quote.getTripleDotSanitizedFormattedHtmlContent();
    }
    if (type === 'html') {
      return Xss.htmlSanitizeKeepBasicTags(html, 'IMG-KEEP');
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

  private handlePaste = () => {
    this.squire.addEventListener('willPaste', (e: WillPasteEvent) => {
      const div = document.createElement('div');
      div.appendChild(e.fragment);
      const html = div.innerHTML;
      div.innerHTML = this.isRichText() ? Xss.htmlSanitizeKeepBasicTags(html, 'IMG-KEEP') : Xss.htmlSanitizeAndStripAllTags(html, '<br>'); // xss-sanitized
      e.fragment.appendChild(div);
    });
  }

  private handlePasteImages = () => {
    this.squire.addEventListener('drop', (ev: DragEvent) => {
      try {
        if (!this.isRichText()) {
          return;
        }
        if (!ev.dataTransfer?.files.length) {
          return;
        }
        const file = ev.dataTransfer.files[0];
        const reader = new FileReader();
        reader.onload = () => {
          try {
            this.squire.insertImage(reader.result as ArrayBuffer, { name: file.name, title: file.name });
          } catch (e) {
            Catch.reportErr(e);
          }
        };
        reader.readAsDataURL(file);
      } catch (e) {
        Catch.reportErr(e);
      }
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
          try {
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
          } catch (e) {
            Catch.reportErr(e);
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
    this.squire.addEventListener('cursor', () => {
      if (this.composer.view.isReplyBox) {
        this.composer.size.resizeComposeBox();
      }
    });
  }

  // https://github.com/FlowCrypt/flowcrypt-browser/issues/2400
  private scrollIntoView = () => {
    this.squire.addEventListener('cursor', () => {
      try {
        const inputText = this.composer.S.cached('input_text').get(0);
        const offsetBottom = this.squire.getCursorPosition().bottom - inputText.getBoundingClientRect().top;
        const editorRootHeight = this.composer.S.cached('input_text').height() || 0;
        if (offsetBottom > editorRootHeight) {
          const scrollBy = offsetBottom - editorRootHeight;
          inputText.scrollBy(0, Math.round(scrollBy));
        }
      } catch (e) {
        Catch.reportErr(e);
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

  // We need this method to test imagees in drafts because we can't paste them dirctly in tests.
  private insertDebugElements = () => {
    this.composer.S.cached('body').append('<input type="hidden" id="test_insertImage" data-test="action-insert-image" />'); // xss-direct
    $('#test_insertImage').on('click', this.view.setHandler((input) => {
      const base64Img = $(input).val();
      this.squire.insertImage(base64Img! as string, {});
    }));
  }

  private isRichText = () => {
    return this.composer.sendBtn.popover.choices.richText;
  }
}
