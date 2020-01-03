/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Composer } from '../composer.js';
import { NewMsgData } from '../composer-types.js';
import { SendableMsg } from '../../../../js/common/api/email_provider/email_provider_api.js';

export interface MailFormatterInterface {
  sendableMsg(newMsgData: NewMsgData, signingPrv?: OpenPGP.key.Key): Promise<SendableMsg>;
}

export class BaseMailFormatter {

  protected composer: Composer;
  protected richText: boolean;
  protected acctEmail: string;

  constructor(composer: Composer) {
    this.composer = composer;
    this.richText = composer.sendBtn.popover.choices.richText;
    this.acctEmail = this.composer.view.acctEmail;
  }
}
