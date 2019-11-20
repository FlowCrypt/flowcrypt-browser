/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './interfaces/composer-component.js';
import { Xss } from '../platform/xss.js';
import { Ui } from '../browser.js';

export class ComposerTextInput extends ComposerComponent {

  initActions() {
    this.composer.S.cached('add_intro').click(Ui.event.handle(target => {
      $(target).css('display', 'none');
      this.composer.S.cached('intro_container').css('display', 'table-row');
      this.composer.S.cached('input_intro').focus();
      this.composer.composerWindowSize.setInputTextHeightManuallyIfNeeded();
    }, this.composer.composerErrs.handlers(`add intro`)));
    this.composer.S.cached('input_text').get(0).onpaste = this.composer.composerTextInput.inputTextPasteHtmlAsText;
  }

  public inputTextPasteHtmlAsText = (clipboardEvent: ClipboardEvent) => {
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

  public extractAsText = (elSel: 'input_text' | 'input_intro', flag: 'SKIP-ADDONS' | undefined = undefined) => {
    let html = this.composer.S.cached(elSel)[0].innerHTML;
    if (elSel === 'input_text' && this.composer.composerQuote.expandingHTMLPart && flag !== 'SKIP-ADDONS') {
      html += `<br /><br />${this.composer.composerQuote.expandingHTMLPart}`;
    }
    return Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(html, '\n')).trim();
  }

}
