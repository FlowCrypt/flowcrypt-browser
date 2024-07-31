/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../common/platform/catch';
import { IntervalFunction, WebmailElementReplacer } from '../generic/webmail-element-replacer';

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
      const fullMsg = (await messenger.runtime.sendMessage('thunderbird_msg_decrypt')) as messenger.messages.MessagePart;
      if (fullMsg?.headers && 'openpgp' in fullMsg.headers) {
        // console.log(this.isPgpEncryptedMsg(fullMsg));
        // note : embeddedMsg for pgp_block injection -> replaceArmoredBlocks
        // do secure compose badge injection eg. signed or encrypted, (secure email status rendering) etc
        // render decrypted message right into the messageDisplay
      }
    }
  };

  // private isPgpEncryptedMsg = (fullMsg: messenger.messages.MessagePart) => {
  //   const isPgpEncryptedMsg =
  //     fullMsg?.headers &&
  //     'openpgp' in fullMsg.headers &&
  //     fullMsg?.parts &&
  //     fullMsg.parts[0]?.parts?.length === 1 &&
  //     fullMsg.parts[0]?.parts[0].body?.startsWith(PgpArmor.ARMOR_HEADER_DICT.encryptedMsg.begin) &&
  //     fullMsg.parts[0]?.parts[0].body?.endsWith(PgpArmor.ARMOR_HEADER_DICT.encryptedMsg.begin);
  //   // content script complains that PgpArmor is not defined. Additionally, adding so in bundle causes an unhandled error.
  //   // needs further investigation.
  //   return isPgpEncryptedMsg;
  // };
}
