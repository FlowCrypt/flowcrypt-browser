/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Composer } from '../composer.js';
import { NewMsgData } from '../composer-types.js';
import { SendableMsg } from '../../../../js/common/api/email_provider/sendable-msg';

export interface MailFormatterInterface {
  sendableMsg(newMsgData: NewMsgData, signingPrv?: OpenPGP.key.Key): Promise<SendableMsg>;
}

export class BaseMailFormatter {

  protected composer: Composer;
  protected richtext: boolean;
  protected acctEmail: string;

  constructor(composer: Composer) {
    this.composer = composer;
    this.richtext = composer.sendBtn.popover.choices.richtext;
    this.acctEmail = this.composer.view.acctEmail;
  }

  protected headers = (newMsg: NewMsgData) => {
    return { from: newMsg.from, recipients: newMsg.recipients, subject: newMsg.subject, thread: this.composer.view.threadId };
  }
}
