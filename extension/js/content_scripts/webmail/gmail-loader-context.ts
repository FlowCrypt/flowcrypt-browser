/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attachment } from '../../common/core/attachment.js';
import { JQueryEl, LoaderContextInterface } from '../../common/loader-context-interface.js';
import { XssSafeFactory } from '../../common/xss-safe-factory.js';

export class GmailLoaderContext implements LoaderContextInterface {
  public constructor(private readonly factory: XssSafeFactory, public msgEl: JQueryEl, private readonly attachmentsContainerInner: JQueryEl) {}

  /* eslint-disable @typescript-eslint/naming-convention */
  /**
   * XSS WARNING
   *
   * newHtmlContent must be XSS safe
   */
  // prettier-ignore
  public static updateMsgBodyEl_DANGEROUSLY( // xss-dangerous-function
    el: HTMLElement | JQueryEl,
    method: 'set' | 'append' | 'after',
    newHtmlContent_MUST_BE_XSS_SAFE: string
  ): JQueryEl {
    /* eslint-enable @typescript-eslint/naming-convention */
    // Messages in Gmail UI have to be replaced in a very particular way
    // The first time we update element, it should be completely replaced so that Gmail JS will lose reference to the original element and stop re-rendering it
    // Gmail message re-rendering causes the PGP message to flash back and forth, confusing the user and wasting cpu time
    // Subsequent times, it can be updated naturally
    const msgBody = $(el);
    const replace = !msgBody.is('.message_inner_body'); // not a previously replaced element, needs replacing
    if (method === 'set') {
      if (replace) {
        const parent = msgBody.parent();
        msgBody.replaceWith(this.wrapMsgBodyEl(newHtmlContent_MUST_BE_XSS_SAFE)); // xss-safe-value
        this.ensureHasParentNode(msgBody); // Gmail is using msgBody.parentNode (#2271)
        return parent.find('.message_inner_body'); // need to return new selector - old element was replaced
      } else {
        return msgBody.html(newHtmlContent_MUST_BE_XSS_SAFE); // xss-safe-value
      }
    } else if (method === 'append') {
      if (replace) {
        const parent = msgBody.parent();
        const wrapper = msgBody.wrap(this.wrapMsgBodyEl(''));
        wrapper.append(newHtmlContent_MUST_BE_XSS_SAFE); // xss-reinsert // xss-safe-value
        this.ensureHasParentNode(wrapper); // Gmail is using msgBody.parentNode (#2271)
        return parent.find('.message_inner_body'); // need to return new selector - old element was replaced
      } else {
        return msgBody.append(newHtmlContent_MUST_BE_XSS_SAFE); // xss-safe-value
      }
    } else if (method === 'after') {
      msgBody.after(newHtmlContent_MUST_BE_XSS_SAFE);
      return msgBody;
    } else {
      throw new Error('Unknown update_message_body_element method:' + method);
    }
  }

  private static ensureHasParentNode = (el: JQuery<HTMLElement>) => {
    if (!el.parent().length) {
      const dummyParent = $('<div>');
      dummyParent.append(el); // xss-direct
    }
  };

  private static wrapMsgBodyEl = (htmlContent: string) => {
    return '<div class="message_inner_body evaluated">' + htmlContent + '</div>';
  };

  public renderPlainAttachment = (a: Attachment, attachmentSel?: JQueryEl, error?: string) => {
    // simply show existing attachment
    if (!attachmentSel) {
      // todo: do we need this clause?
      this.attachmentsContainerInner
        .show()
        .addClass('attachment_processed')
        .find('.attachment_loader')
        .text(error || 'Please reload page');
    } else {
      const el = attachmentSel.show();
      if (error) {
        el.children('.attachment_loader').text(error);
      } else {
        el.addClass('attachment_processed').children('.attachment_loader').remove();
      }
    }
  };

  public prependEncryptedAttachment = (a: Attachment) => {
    this.attachmentsContainerInner.prepend(this.factory.embeddedAttachment(a, true)); // xss-safe-factory
  };

  /* eslint-disable @typescript-eslint/naming-convention */
  /**
   * XSS WARNING
   *
   * newHtmlContent must be XSS safe
   */
  // prettier-ignore
  public setMsgBody_DANGEROUSLY = (newHtmlContent_MUST_BE_XSS_SAFE: string, method: 'set' | 'append' | 'after') => { // xss-dangerous-function
    /* eslint-enable @typescript-eslint/naming-convention */
    this.msgEl = GmailLoaderContext.updateMsgBodyEl_DANGEROUSLY(this.msgEl, method, newHtmlContent_MUST_BE_XSS_SAFE); // xss-safe-value
  };

  public hideAttachment = (attachmentEl: JQueryEl) => {
    attachmentEl.hide();
    if (!attachmentEl.length) {
      this.attachmentsContainerInner.children('.attachment_loader').text('Missing file info');
    }
  };
}
