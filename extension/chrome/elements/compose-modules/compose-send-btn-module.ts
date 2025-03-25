/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import * as DOMPurify from 'dompurify';

import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Attachment } from '../../../js/common/core/attachment.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { ComposerUserError } from './compose-err-module.js';
import { ComposeSendBtnPopoverModule } from './compose-send-btn-popover-module.js';
import { GeneralMailFormatter, MultipleMessages } from './formatters/general-mail-formatter.js';
import { GmailParser, GmailRes } from '../../../js/common/api/email-provider/gmail/gmail-parser.js';
import { KeyInfoWithIdentity } from '../../../js/common/core/crypto/key.js';
import { getUniqueRecipientEmails, SendBtnTexts, SendMsgsResult } from './compose-types.js';
import { SendableMsg } from '../../../js/common/api/email-provider/sendable-msg.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { ContactStore } from '../../../js/common/platform/store/contact-store.js';
import { EmailParts } from '../../../js/common/core/common.js';

export class ComposeSendBtnModule extends ViewModule<ComposeView> {
  public additionalMsgHeaders: { [key: string]: string } = {};
  public btnUpdateTimeout?: number;
  public popover: ComposeSendBtnPopoverModule;

  private isSendMessageInProgress = false;

  public constructor(view: ComposeView) {
    super(view);
    this.popover = new ComposeSendBtnPopoverModule(view);
  }

  public setHandlers = (): void => {
    const ctrlEnterHandler = Ui.ctrlEnter(() => !this.view.sizeModule.composeWindowIsMinimized && this.extractProcessSendMsg());
    this.view.S.cached('subject').add(this.view.S.cached('compose')).on('keydown', ctrlEnterHandler);
    this.view.S.cached('send_btn').on(
      'click',
      this.view.setHandlerPrevent('double', () => this.extractProcessSendMsg())
    );
    this.popover.setHandlers();
  };

  public isSendMessageInProgres = (): boolean => {
    return this.isSendMessageInProgress;
  };

  public resetSendBtn = (delay?: number) => {
    const doReset = () => {
      Xss.sanitizeRender(this.view.S.cached('send_btn_text'), `<i></i>${this.btnText()}`);
      this.view.S.cached('send_btn').addClass('green').removeClass('gray').prop('disabled', false);
      this.view.S.cached('toggle_send_options').addClass('green').removeClass('gray').show();
    };
    if (typeof this.btnUpdateTimeout !== 'undefined') {
      clearTimeout(this.btnUpdateTimeout);
    }
    if (!delay) {
      doReset();
    } else {
      Catch.setHandledTimeout(doReset, delay);
    }
  };

  public disableBtn = () => {
    this.view.S.cached('send_btn').removeClass('green').addClass('gray').prop('disabled', true);
    this.view.S.cached('toggle_send_options').removeClass('green').addClass('gray').prop('disabled', true);
  };

  public enableBtn = () => {
    this.view.S.cached('send_btn').removeClass('gray').addClass('green').prop('disabled', false);
    this.view.S.cached('toggle_send_options').removeClass('gray').addClass('green').prop('disabled', false);
  };

  public renderUploadProgress = (progress: number | undefined, progressRepresents: 'FIRST-HALF' | 'SECOND-HALF' | 'EVERYTHING') => {
    if (progress && this.view.attachmentsModule.attachment.hasAttachment()) {
      if (progressRepresents === 'FIRST-HALF') {
        progress = Math.floor(progress / 2); // show 0-50% instead of 0-100%
      } else if (progressRepresents === 'SECOND-HALF') {
        progress = Math.floor(50 + progress / 2); // show 50-100% instead of 0-100%
      } else {
        progress = Math.floor(progress); // show 0-100%
      }
      this.view.S.now('send_btn_text').text(`${SendBtnTexts.BTN_SENDING} ${progress < 100 ? `${progress}%` : ''}`);
    }
  };

  public extractProcessSendMsg = async () => {
    if (this.view.S.cached('reply_msg_successful').is(':visible')) {
      return;
    }
    this.view.sendBtnModule.disableBtn();
    this.view.S.cached('toggle_send_options').hide();
    try {
      this.view.errModule.throwIfFormNotReady();
      this.isSendMessageInProgress = true;
      this.view.S.now('send_btn_text').text('Loading...');
      Xss.sanitizeRender(this.view.S.now('send_btn_i'), Ui.spinner('white'));
      this.view.S.cached('send_btn_note').text('');
      const newMsgData = await this.view.inputModule.extractAll();
      await this.view.errModule.throwIfFormValsInvalid(newMsgData);
      const emails = getUniqueRecipientEmails(newMsgData.recipients);
      await ContactStore.update(undefined, emails, { lastUse: Date.now() });
      const msgObj = await GeneralMailFormatter.processNewMsg(this.view, newMsgData);
      for (const msg of msgObj.msgs) {
        await this.finalizeSendableMsg({ msg, senderKi: msgObj.senderKi });
      }
      const result = await this.doSendMsgs(msgObj);
      if (!result.failures.length) {
        // toast isn't supported together with a confirmation/alert popup
        if (result.supplementaryOperationsErrors.length) {
          console.error(result.supplementaryOperationsErrors);
          Catch.setHandledTimeout(() => {
            Ui.toast(result.supplementaryOperationsErrors[0] as string);
          }, 0);
        }
        BrowserMsg.send.notificationShow(this.view.parentTabId, {
          notification: `Your ${this.view.isReplyBox ? 'reply' : 'message'} has been sent.`,
          group: 'compose',
        });
        BrowserMsg.send.focusBody(this.view.parentTabId); // Bring focus back to body so Gmails shortcuts will work
        if (this.view.isReplyBox) {
          this.view.renderModule.renderReplySuccess(msgObj.renderSentMessage.attachments, msgObj.renderSentMessage.recipients, result.sentIds[0]);
        } else {
          this.view.renderModule.closeMsg();
        }
      } else {
        await this.view.errModule.handleSendErr(result.failures[0].e, result);
      }
    } catch (e) {
      await this.view.errModule.handleSendErr(e, undefined);
    } finally {
      this.isSendMessageInProgress = false;
      this.view.sendBtnModule.enableBtn();
      this.view.S.cached('toggle_send_options').show();
    }
  };

  private btnText = (): string => {
    if (this.popover.choices.encrypt && this.popover.choices.sign) {
      return SendBtnTexts.BTN_ENCRYPT_SIGN_AND_SEND;
    } else if (this.popover.choices.sign) {
      return SendBtnTexts.BTN_SIGN_AND_SEND;
    } else {
      return SendBtnTexts.BTN_PLAIN_SEND;
    }
  };

  private finalizeSendableMsg = async ({ msg, senderKi }: { msg: SendableMsg; senderKi: KeyInfoWithIdentity | undefined }) => {
    const choices = this.view.sendBtnModule.popover.choices;
    for (const k of Object.keys(this.additionalMsgHeaders)) {
      msg.headers[k] = this.additionalMsgHeaders[k];
    }
    if (choices.encrypt && !choices.richtext) {
      for (const a of msg.attachments) {
        a.type = 'application/octet-stream'; // so that Enigmail+Thunderbird does not attempt to display without decrypting
      }
    }
    if (choices.richtext && !choices.encrypt && !choices.sign && msg.body['text/html']) {
      // extract inline images of plain rich-text messages (#3256)
      // todo - also apply to rich text signed-only messages
      const { htmlWithCidImages, imgAttachments } = this.extractInlineImagesToAttachments(msg.body['text/html']);
      msg.body['text/html'] = htmlWithCidImages;
      msg.attachments.push(...imgAttachments);
    }
    if (this.view.myPubkeyModule.shouldAttach() && senderKi) {
      // todo: report on undefined?
      msg.attachments.push(Attachment.keyinfoAsPubkeyAttachment(senderKi));
    }
  };

  private extractInlineImagesToAttachments = (html: string) => {
    const imgAttachments: Attachment[] = [];
    DOMPurify.addHook('afterSanitizeAttributes', node => {
      if (!node) {
        return;
      }
      if ('src' in node) {
        const img = node as HTMLImageElement;
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const src = img.getAttribute('src')!;
        const { mimeType, data } = this.parseInlineImageSrc(src);
        if (mimeType && data) {
          const imgAttachment = new Attachment({
            cid: Attachment.attachmentId(),
            name: img.getAttribute('name') || '',
            type: mimeType,
            data: Buf.fromBase64Str(data),
            inline: true,
          });
          img.setAttribute('src', `cid:${imgAttachment.cid}`);
          imgAttachments.push(imgAttachment);
        } else {
          throw new ComposerUserError(`
            Unable to parse an inline image <details>
              <summary>See error details</summary>
              src="${Xss.escape(src)}"
            </details>
          `);
        }
      }
    });
    const htmlWithCidImages = DOMPurify.sanitize(html);
    DOMPurify.removeAllHooks();
    return { htmlWithCidImages, imgAttachments };
  };

  private parseInlineImageSrc = (src: string) => {
    let mimeType;
    let data = '';
    const parts = src.split(/[:;,]/);
    if (parts.length === 4 && parts[0] === 'data' && /^image\/\w+/.exec(parts[1]) && parts[2] === 'base64') {
      mimeType = parts[1];
      data = parts[3];
    }
    return { mimeType, data };
  };

  private attemptSendMsg = async (msg: SendableMsg): Promise<GmailRes.GmailMsgSend> => {
    // if this is a password-encrypted message, then we've already shown progress for uploading to backend
    // and this requests represents second half of uploadable effort. Else this represents all (no previous heavy requests)
    // todo: this isn't correct when we're sending multiple messages
    const progressRepresents = this.view.pwdOrPubkeyContainerModule.isVisible() ? 'SECOND-HALF' : 'EVERYTHING';
    try {
      return await this.view.emailProvider.msgSend(msg, p => this.renderUploadProgress(p, progressRepresents));
    } catch (e) {
      if (msg.thread && ApiErr.isNotFound(e) && this.view.threadId) {
        // cannot send msg because threadId not found - eg user since deleted it
        msg.thread = undefined;
        // give it another try, this time without msg.thread
        // todo: progressRepresents?
        return await this.attemptSendMsg(msg);
      } else {
        throw e;
      }
    }
  };

  private bindMessageId = async (externalId: string, id: string, supplementaryOperationsErrors: unknown[]) => {
    try {
      const gmailMsg = await this.view.emailProvider.msgGet(id, 'metadata');
      const messageId = GmailParser.findHeader(gmailMsg, 'message-id');
      if (messageId) {
        await this.view.acctServer.messageGatewayUpdate(externalId, messageId);
      } else {
        throw new Error('Failed to extract Message-ID of sent message');
      }
    } catch (e) {
      supplementaryOperationsErrors.push(`Failed to bind Gateway ID of the message: ${e}`);
      Catch.reportErr(e);
    }
  };

  private doSendMsgs = async (msgObj: MultipleMessages): Promise<SendMsgsResult> => {
    const sentIds: string[] = [];
    const supplementaryOperations: Promise<void>[] = [];
    const supplementaryOperationsErrors: unknown[] = [];
    const success: EmailParts[] = [];
    const failures: { recipient: EmailParts; e: unknown }[] = [];
    for (const msg of msgObj.msgs) {
      const msgRecipients = msg.getAllRecipients();
      try {
        const msgSentRes = await this.attemptSendMsg(msg);
        success.push(...msgRecipients);
        sentIds.push(msgSentRes.id);
        if (msg.externalId) {
          supplementaryOperations.push(this.bindMessageId(msg.externalId, msgSentRes.id, supplementaryOperationsErrors));
        }
      } catch (e) {
        failures.push(
          ...msgRecipients.map(recipient => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            return { recipient, e };
          })
        );
      }
    }
    try {
      if (!failures.length) {
        supplementaryOperations.push(this.view.draftModule.draftDelete());
      }
      await Promise.all(supplementaryOperations);
    } catch (e) {
      Catch.reportErr(e);
      supplementaryOperationsErrors.push(e);
    }
    return { success, failures, supplementaryOperationsErrors, sentIds };
  };
}
