/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attachment } from './core/attachment.js';

export interface LoaderContextInterface {
  renderPlainAttachment(a: Attachment, attachmentEl?: JQuery, error?: string): void;

  // prependAttachments is used to render encrypted attachment prepending AttachmentContainerInner
  prependEncryptedAttachment(a: Attachment): void;

  hideAttachment(attachmentSel?: JQuery): void;

  /**
   * XSS WARNING
   *
   * newHtmlContent must be XSS safe
   */
  // eslint-disable-next-line @typescript-eslint/naming-convention
  setMsgBody_DANGEROUSLY(newHtmlContent_MUST_BE_XSS_SAFE: string, method: 'set' | 'append' | 'after'): void; // xss-dangerous-function
}
