/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import * as DOMPurify from 'dompurify';

import { Attachment } from '../../../../js/common/core/attachment.js';
import { BaseMailFormatter } from './base-mail-formatter.js';
import { Buf } from '../../../../js/common/core/buf.js';
import { Dict } from '../../../../js/common/core/common.js';
import { NewMsgData, SendBtnTexts } from '../compose-types.js';
import { SendableMsg } from '../../../../js/common/api/email-provider/sendable-msg.js';
import { SendableMsgBody, Mime } from '../../../../js/common/core/mime.js';

export class PlainMsgMailFormatter extends BaseMailFormatter {

  public sendableMsg = async (newMsg: NewMsgData): Promise<SendableMsg> => {
    this.view.S.now('send_btn_text').text(SendBtnTexts.BTN_SENDING);
    const attachments = this.isDraft ? [] : await this.view.attsModule.attach.collectAtts();
    const body: SendableMsgBody = { 'text/plain': newMsg.plaintext };
    if (this.richtext) {
      const { htmlWithInlineImages, imgAttachments } = this.extractInlineImagesToAttachments(newMsg.plainhtml);
      attachments.push(...imgAttachments);
      body['text/html'] = htmlWithInlineImages;
    }
    return SendableMsg.createPlain(this.acctEmail, this.headers(newMsg), body, attachments);
  }

  public extractInlineImagesToAttachments = (html: string) => {
    const imgAttachments: Attachment[] = [];
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (!node) {
        return;
      }
      if ('src' in node) {
        const img: Element = node;
        const src = img.getAttribute('src') as string;
        const { mimeType, data } = this.parseInlineImageSrc(src);
        const imgAttachment = new Attachment({ name: img.getAttribute('name') || '', type: mimeType, data: Buf.fromBase64Str(data), inline: true });
        const imgAttNode = Mime.createAttNode(imgAttachment);
        const imgAttachmentId: string = imgAttNode._headers.find((header: Dict<string>) => header.key === 'X-Attachment-Id').value;
        console.log('imgAttachmentId', imgAttachmentId);
        img.setAttribute('src', `cid:${imgAttachmentId}`);
        imgAttachments.push(imgAttachment);
      }
    });
    const htmlWithInlineImages = DOMPurify.sanitize(html);
    DOMPurify.removeAllHooks();
    return { htmlWithInlineImages, imgAttachments };
  }

  private parseInlineImageSrc = (src: string) => {
    let mimeType;
    let data = '';
    const matches = src.match(/data:(image\/\w+);base64,(.*)/);
    if (matches) {
      [, mimeType, data] = matches;
    }
    return { mimeType, data };
  }
}
