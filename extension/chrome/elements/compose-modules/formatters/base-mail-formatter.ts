/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { NewMsgData } from '../compose-types.js';
import { ComposeView } from '../../compose.js';
import { Key } from '../../../../js/common/core/crypto/key.js';
import { SmimeKey } from '../../../../js/common/core/crypto/smime/smime-key.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { Buf } from '../../../../js/common/core/buf.js';

export class BaseMailFormatter {

  protected view: ComposeView;
  protected richtext: boolean;
  protected acctEmail: string;

  constructor(view: ComposeView, protected isDraft = false) {
    this.view = view;
    this.richtext = view.sendBtnModule.popover.choices.richtext;
    this.acctEmail = this.view.acctEmail;
  }

  protected headers = (newMsg: NewMsgData) => {
    return { from: newMsg.from, recipients: newMsg.recipients, subject: newMsg.subject, thread: this.view.threadId };
  }

  protected signMimeMessage = async (signingPrv: Key, mimeEncodedMessage: string, newMsg: NewMsgData) => {
    const data = await SmimeKey.sign(signingPrv, Buf.fromUtfStr(mimeEncodedMessage));
    return await SendableMsg.createSMimeSigned(this.acctEmail, this.headers(newMsg), data);
  }
}
