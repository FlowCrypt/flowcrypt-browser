/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attachment } from './core/attachment.js';

export type JQueryEl = JQuery<HTMLElement>;

export interface LoaderContextInterface {
  renderPlainAttachment(a: Attachment, attachmentEl?: JQueryEl, error?: string): void;

  // prependAttachments is used to render encrypted attachment prepending AttachmentContainerInner
  prependEncryptedAttachment(a: Attachment): void;

  hideAttachment(attachmentSel?: JQueryEl): void;

  setMsgBody(frameXssSafe: string, method: 'set' | 'append' | 'after'): void;
}
