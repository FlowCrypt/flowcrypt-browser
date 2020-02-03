/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { NewMsgData } from '../composer-types.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg';
import { ComposeView } from '../../compose.js';

export interface MailFormatterInterface {
  sendableMsg(newMsgData: NewMsgData, signingPrv?: OpenPGP.key.Key): Promise<SendableMsg>;
}

export class BaseMailFormatter {

  protected view: ComposeView;
  protected richtext: boolean;
  protected acctEmail: string;

  constructor(view: ComposeView) {
    this.view = view;
    this.richtext = view.sendBtnModule.popover.choices.richtext;
    this.acctEmail = this.view.acctEmail;
  }

  protected headers = (newMsg: NewMsgData) => {
    return { from: newMsg.from, recipients: newMsg.recipients, subject: newMsg.subject, thread: this.view.threadId };
  }

}
