/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../common/platform/catch';
import { IntervalFunction, WebmailElementReplacer } from '../generic/webmail-element-replacer';

export class ThunderbirdElementReplacer extends WebmailElementReplacer {
  // public getIntervalFunctions: () => IntervalFunction[];
  public setReplyBoxEditable: () => Promise<void>;
  public reinsertReplyBox: (replyMsgId: string) => void;
  public scrollToReplyBox: (replyMsgId: string) => void;
  public scrollToCursorInReplyBox: (replyMsgId: string, cursorOffsetTop: number) => void;

  public getIntervalFunctions = (): IntervalFunction[] => {
    return [{ interval: 1000, handler: () => this.replaceThunderbirdMsgPane() }];
  };

  private replaceThunderbirdMsgPane = () => {
    if (Catch.isThunderbirdMail()) {
      console.log('todo');
      // const fullMsg = (await messenger.runtime.sendMessage('decrypt')) as messenger.messages.MessagePart;
      //   if (fullMsg?.headers && 'openpgp' in fullMsg.headers) {
      //     // note : embeddedMsg for pgp_block injection -> replaceArmoredBlocks
      //     // do secure compose badge injection eg. signed or encrypted, (secure email status rendering) etc
      //     // render decrypted message right into the messageDisplay
    }
  };
}
