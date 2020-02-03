/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/platform/store.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';

export class ComposerFooter extends ViewModule<ComposeView> {

  public getFooterFromStorage = async (sender: string): Promise<string | undefined> => {
    const { sendAs } = await Store.getAcct(this.view.acctEmail, ['sendAs']);
    if (!sendAs) {
      return;
    }
    return sendAs[sender]?.footer || undefined;
  }

  /**
   * Only replacing footer if it was not yet rendered in textbox
   * Since user has to first explicitly click ellipsis to render footer (not very common),
   * it does not bother us if old footer stays in the text (eg when user later changes sendFrom address)
   */
  public onFooterUpdated = (newFooter: string | undefined) => {
    if (this.view.quoteModule.tripleDotSanitizedHtmlContent) { // footer not yet rendered
      this.view.quoteModule.tripleDotSanitizedHtmlContent.footer = newFooter ? this.createFooterHtml(newFooter) : '';
    } else if (this.view.S.cached('triple_dot')[0] && newFooter) { // ellipsis preset (not yet clicked), but not visible (likely no footer earlier)
      this.view.quoteModule.tripleDotSanitizedHtmlContent = { footer: this.createFooterHtml(newFooter), quote: '' };
    }
  }

  public createFooterHtml = (footer: string) => {
    const sanitizedPlainFooter = Xss.htmlSanitizeAndStripAllTags(footer, '\n');
    const sanitizedHtmlFooter = sanitizedPlainFooter.replace(/\n/g, '<br>');
    const footerFirstLine = sanitizedPlainFooter.split('\n')[0];
    if (!footerFirstLine) {
      return '';
    }
    if (/^[*-_=+#~ ]+$/.test(footerFirstLine)) {
      return sanitizedHtmlFooter;  // first line of footer is already a footer separator, made of special characters
    }
    return `--<br>${sanitizedHtmlFooter}`; // create a custom footer separator
  }

}
