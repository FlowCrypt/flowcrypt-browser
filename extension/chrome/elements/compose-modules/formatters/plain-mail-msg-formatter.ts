/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BaseMailFormatter } from './base-mail-formatter.js';
import { NewMsgData, SendBtnTexts } from '../compose-types.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { SendableMsgBody } from '../../../../js/common/core/mime.js';

export class PlainMsgMailFormatter extends BaseMailFormatter {

  public sendableMsg = async (newMsg: NewMsgData): Promise<SendableMsg> => {
    this.view.S.now('send_btn_text').text(SendBtnTexts.BTN_SENDING);
    const attachments = this.isDraft ? [] : await this.view.attachmentsModule.attachment.collectAttachments();
    const body: SendableMsgBody = { 'text/plain': newMsg.plaintext };
    if (this.richtext) {
      body['text/html'] = newMsg.plainhtml;
    }
    return await SendableMsg.createPlain(this.acctEmail, this.headers(newMsg), body, attachments);
  }

}
