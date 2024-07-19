/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { IntervalFunction, WebmailElementReplacer } from '../generic/webmail-element-replacer';

export class ThunderbirdElementReplacer extends WebmailElementReplacer {
  public getIntervalFunctions: () => IntervalFunction[];
  public setReplyBoxEditable: () => Promise<void>;
  public reinsertReplyBox: (replyMsgId: string) => void;
  public scrollToReplyBox: (replyMsgId: string) => void;
  public scrollToCursorInReplyBox: (replyMsgId: string, cursorOffsetTop: number) => void;
}
