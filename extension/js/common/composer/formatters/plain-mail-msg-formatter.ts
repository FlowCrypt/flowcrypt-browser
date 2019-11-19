/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { SendableMsg } from '../../api/email_provider_api.js';
import { MailFormatterInterface, BaseMailFormatter } from './base-mail-formatter.js';
import { Google } from '../../api/google.js';
import { SendBtnTexts } from '../interfaces/composer-types.js';

export class PlainMsgMailFormatter extends BaseMailFormatter implements MailFormatterInterface {
  async createMsgObject(): Promise<SendableMsg> {
    this.composer.S.now('send_btn_text').text(SendBtnTexts.BTN_SENDING);
    const atts = await this.composer.attach.collectAtts();
    const body = { 'text/plain': this.newMsgData.plaintext };
    return await Google.createMsgObj(this.urlParams.acctEmail, this.composer.getSender(), this.newMsgData.recipients, this.newMsgData.subject, body, atts, this.urlParams.threadId);
  }
}
