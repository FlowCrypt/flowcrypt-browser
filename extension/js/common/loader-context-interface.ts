/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Attachment } from './core/attachment.js';
import { Catch } from './platform/catch.js';
import { BindInterface } from './relay-manager-interface.js';
import { XssSafeFactory } from './xss-safe-factory.js';

export type JQueryEl = JQuery<HTMLElement>;

export interface LoaderContextBindInterface {
  bind(frameId: string, binder: BindInterface): void;
}

export interface LoaderContextInterface extends LoaderContextBindInterface {
  readonly factory: XssSafeFactory;

  renderPlainAttachment(a: Attachment, attachmentEl?: JQueryEl, error?: string): void;

  // prependAttachments is used to render encrypted attachment prepending AttachmentContainerInner
  prependEncryptedAttachment(a: Attachment): void;

  hideAttachment(attachmentSel?: JQueryEl): void;

  setMsgBody(frameXssSafe: string, method: 'set' | 'append' | 'after'): void;
}

export const bindNow = (frameId: string, binder: BindInterface) => {
  const embeddedReference = XssSafeFactory.getEmbeddedMsg(frameId);
  if (embeddedReference) {
    binder.bind(frameId, embeddedReference);
  } else {
    Catch.report('Unexpected: unable to reference a newly created message frame');
  }
};

export class LoaderContextBindNow implements LoaderContextBindInterface {
  public bind = (frameId: string, binder: BindInterface) => {
    bindNow(frameId, binder);
  };
}
