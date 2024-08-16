/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../../common/browser/browser-msg.js';
import { PgpArmor } from '../../../common/core/crypto/pgp/pgp-armor';
import { Catch } from '../../../common/platform/catch';
import { IntervalFunction, WebmailElementReplacer } from '../generic/webmail-element-replacer.js';

export class ThunderbirdElementReplacer extends WebmailElementReplacer {
  public setReplyBoxEditable: () => Promise<void>;
  public reinsertReplyBox: (replyMsgId: string) => void;
  public scrollToReplyBox: (replyMsgId: string) => void;
  public scrollToCursorInReplyBox: (replyMsgId: string, cursorOffsetTop: number) => void;

  public getIntervalFunctions = (): IntervalFunction[] => {
    return [{ interval: 1000, handler: () => this.replaceThunderbirdMsgPane() }];
  };

  public replaceThunderbirdMsgPane = async () => {
    if (Catch.isThunderbirdMail()) {
      const fullMsg = await BrowserMsg.send.bg.await.thunderbirdMsgDecrypt();
      if (fullMsg && this.checkIfPgpEncryptedMsg(fullMsg)) {
        console.log('ready for decryption!');
        // note : embeddedMsg for pgp_block injection -> replaceArmoredBlocks
        // do secure compose badge injection eg. signed or encrypted, (secure email status rendering) etc
        // render decrypted message right into the messageDisplay
      }
      // else if signed message found
    }
  };

  private checkIfPgpEncryptedMsg = (fullMsg: messenger.messages.MessagePart) => {
    const isPgpEncryptedMsg =
      fullMsg.headers &&
      'openpgp' in fullMsg.headers &&
      fullMsg.parts &&
      fullMsg.parts[0]?.parts?.length === 2 &&
      fullMsg.parts[0]?.parts[1].contentType === 'application/pgp-encrypted' &&
      fullMsg.parts[0]?.parts[0].body?.trim().startsWith(PgpArmor.ARMOR_HEADER_DICT.encryptedMsg.begin) &&
      fullMsg.parts[0]?.parts[0].body?.trim().endsWith(PgpArmor.ARMOR_HEADER_DICT.encryptedMsg.end as string);
    return isPgpEncryptedMsg;
  };
}
