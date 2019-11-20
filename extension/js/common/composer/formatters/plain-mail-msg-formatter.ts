/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { SendableMsg } from '../../api/email_provider_api.js';
import { Google } from '../../api/google.js';
import { SendBtnTexts, NewMsgData } from '../interfaces/composer-types.js';
import { BaseMailFormatter, MailFormatterInterface } from './composer-mail-formatter.js';

export class PlainMsgMailFormatter extends BaseMailFormatter implements MailFormatterInterface {

  async sendableMsg(newMsgData: NewMsgData): Promise<SendableMsg> {
    this.composer.S.now('send_btn_text').text(SendBtnTexts.BTN_SENDING);
    const atts = await this.composer.atts.attach.collectAtts();
    const body = { 'text/plain': newMsgData.plaintext };
    return await Google.createMsgObj(this.composer.urlParams.acctEmail, newMsgData.sender, newMsgData.recipients, newMsgData.subject, body, atts, this.composer.urlParams.threadId);
  }

}
