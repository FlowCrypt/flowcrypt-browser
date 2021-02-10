/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { NewMsgData, RecipientElement } from './compose-types.js';
import { SquireEditor, WillPasteEvent } from '../../../types/squire.js';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Recipients } from '../../../js/common/api/email-provider/email-provider-api.js';
import { Str } from '../../../js/common/core/common.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';

export class ComposeInputModule extends ViewModule<ComposeView> {

  public squire = new window.Squire(this.view.S.cached('input_text').get(0));

  public setHandlers = () => {
    this.view.S.cached('add_intro').click(this.view.setHandler(el => this.actionAddIntroHandler(el), this.view.errModule.handle(`add intro`)));
    this.handlePaste();
    this.handlePasteImages();
    this.initShortcuts();
    this.resizeReplyBox();
    this.scrollIntoView();
    this.handleRTL();
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
    this.squire.setHTML(
      Xss.htmlSanitize(Xss.htmlSanitizeKeepBasicTags(html, 'IMG-KEEP'))
    );
  }

  public extract = (type: 'text' | 'html', elSel: 'input_text' | 'input_intro', flag?: 'SKIP-ADDONS') => {
    let html = this.view.S.cached(elSel)[0].innerHTML;
    if (elSel === 'input_text' && flag !== 'SKIP-ADDONS') {
      html += this.view.quoteModule.getTripleDotSanitizedFormattedHtmlContent();
    }
    if (type === 'html') {
      return Xss.htmlSanitizeKeepBasicTags(html, 'IMG-KEEP');
    }
    return Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(html, '\n')).trim();
  }

  public extractAttachments = () => {
    return this.view.S.cached('fineuploader').find('.qq-upload-file').toArray().map((el) => $(el).text().trim());
  }

  public extractAll = (): NewMsgData => {
    const recipientElements = this.view.recipientsModule.getRecipients();
    const recipients = this.mapRecipients(recipientElements);
    const subject = this.view.isReplyBox && this.view.replyParams ? this.view.replyParams.subject : String($('#input_subject').val() || '');
    const plaintext = this.view.inputModule.extract('text', 'input_text');
    const plainhtml = this.view.inputModule.extract('html', 'input_text');
    const password = this.view.S.cached('input_password').val();
    const pwd = typeof password === 'string' && password ? password : undefined;
    const from = this.view.senderModule.getSender();
    return { recipients, subject, plaintext, plainhtml, pwd, from };
  }

  public isRichText = () => {
    return this.view.sendBtnModule.popover.choices.richtext;
  }

  private handlePaste = () => {
    this.squire.addEventListener('willPaste', (e: WillPasteEvent) => {
      const div = document.createElement('div');
      div.appendChild(e.fragment);
      const html = div.innerHTML;
      const sanitized = this.isRichText() ? Xss.htmlSanitizeKeepBasicTags(html, 'IMG-KEEP') : Xss.htmlSanitizeAndStripAllTags(html, '<br>');
      Xss.setElementContentDANGEROUSLY(div, sanitized); // xss-sanitized
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
            this.view.draftModule.draftSave().catch(Catch.reportErr);
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

  private handleRTL = () => {
    const checkRTL = () => {
      let container = $(this.squire.getSelection().commonAncestorContainer);
      if (container.prop('tagName') !== 'DIV') { // commonAncestorContainer might be a text node
        container = container.closest('div');
      }
      const ltrCheck = new RegExp('^[' + Str.ltrChars + ']');
      const rtlCheck = new RegExp('^[' + Str.rtlChars + ']');
      if (ltrCheck.test(container.text()) && container.attr('dir') !== 'ltr') { // Switch to LTR
        container.attr('dir', 'ltr');
      } else if (rtlCheck.test(container.text()) && container.attr('dir') !== 'rtl') { // Switch to RTL
        container.attr('dir', 'rtl');
      } else {
        // keep the previous direction for digits, punctuation marks, and other characters
      }
    };
    this.squire.addEventListener('input', checkRTL);
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
      const removeFormatting = (self: SquireEditor) => {
        self.removeAllFormatting();
      };
      this.squire.setKeyHandler(ctrlKey + 'b', mapKeyToFormat('B'));
      this.squire.setKeyHandler(ctrlKey + 'u', mapKeyToFormat('U'));
      this.squire.setKeyHandler(ctrlKey + 'i', mapKeyToFormat('I'));
      this.squire.setKeyHandler(ctrlKey + '\\', removeFormatting);
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
      if (this.view.isReplyBox) {
        this.view.sizeModule.resizeComposeBox();
      }
    });
  }

  // https://github.com/FlowCrypt/flowcrypt-browser/issues/2400
  private scrollIntoView = () => {
    this.squire.addEventListener('cursor', () => {
      try {
        // keep the cursor of the reply box in the vieport, #3403
        if (this.view.isReplyBox) {
          BrowserMsg.send.scrollToReplyBox(this.view.parentTabId, {
            replyMsgId: `#${this.view.frameId}`,
            cursor: this.squire.getCursorPosition()
          });
        }
        // keep the cursor of the compose/reply box visible in #input_text, #3403
        const inputText = this.view.S.cached('input_text').get(0);
        const offsetBottom = this.squire.getCursorPosition().bottom - inputText.getBoundingClientRect().top;
        const editorRootHeight = this.view.S.cached('input_text').height() || 0;
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
    this.view.S.cached('intro_container').css('display', 'table-row');
    this.view.S.cached('input_intro').focus();
    this.view.sizeModule.setInputTextHeightManuallyIfNeeded();
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

  // We need this method to test images in drafts because we can't paste them dirctly in tests.
  private insertDebugElements = () => {
    this.view.S.cached('body').append('<input type="hidden" id="test_insertImage" data-test="action-insert-image" />'); // xss-direct
    $('#test_insertImage').on('click', this.view.setHandler(async (input) => {
      this.squire.insertImage(String($(input).val()), {});
      await this.view.draftModule.draftSave();
    }));
  }
}
