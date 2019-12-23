/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { SendableMsg } from '../../../../js/common/api/email_provider/email_provider_api.js';
import { SendBtnTexts, NewMsgData } from '../composer-types.js';
import { SendableMsgBody } from '../../../../js/common/core/mime.js';
import { BaseMailFormatter, MailFormatterInterface } from './base-mail-formatter.js';

export class PlainMsgMailFormatter extends BaseMailFormatter implements MailFormatterInterface {

  public sendableMsg = async (newMsgData: NewMsgData): Promise<SendableMsg> => {
    this.composer.S.now('send_btn_text').text(SendBtnTexts.BTN_SENDING);
    const atts = await this.composer.atts.attach.collectAtts();
    const body: SendableMsgBody = { 'text/plain': newMsgData.plaintext };
    if (this.richText) {
      body['text/html'] = newMsgData.plainhtml;
    }
    return await this.composer.emailProvider.createMsgObj(newMsgData.sender, newMsgData.recipients, newMsgData.subject, body, atts, this.composer.view.threadId);
  }

}
