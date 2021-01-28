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
import { GeneralMailFormatter } from './formatters/general-mail-formatter.js';
import { GmailRes } from '../../../js/common/api/email-provider/gmail/gmail-parser.js';
import { KeyInfo, Key, KeyUtil } from '../../../js/common/core/crypto/key.js';
import { SendBtnTexts } from './compose-types.js';
import { SendableMsg } from '../../../js/common/api/email-provider/sendable-msg.js';
import { Str } from '../../../js/common/core/common.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { ContactStore } from '../../../js/common/platform/store/contact-store.js';

export class ComposeSendBtnModule extends ViewModule<ComposeView> {

  public additionalMsgHeaders: { [key: string]: string } = {};
  public btnUpdateTimeout?: number;
  public popover: ComposeSendBtnPopoverModule;

  private isSendMessageInProgress = false;

  constructor(view: ComposeView) {
    super(view);
    this.popover = new ComposeSendBtnPopoverModule(view);
  }

  public setHandlers = (): void => {
    const ctrlEnterHandler = Ui.ctrlEnter(() => !this.view.sizeModule.composeWindowIsMinimized && this.extractProcessSendMsg());
    this.view.S.cached('subject').add(this.view.S.cached('compose')).keypress(ctrlEnterHandler);
    this.view.S.cached('send_btn').click(this.view.setHandlerPrevent('double', () => this.extractProcessSendMsg()));
    this.popover.setHandlers();
  }

  public isSendMessageInProgres = (): boolean => {
    return this.isSendMessageInProgress;
  }

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
  }

  public disableBtn = () => {
    this.view.S.cached('send_btn').removeClass('green').addClass('gray').prop('disabled', true);
    this.view.S.cached('toggle_send_options').removeClass('green').addClass('gray');
  }

  public enableBtn = () => {
    this.view.S.cached('send_btn').removeClass('gray').addClass('green').prop('disabled', false);
    this.view.S.cached('toggle_send_options').removeClass('gray').addClass('green');
  }

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
  }

  private btnText = (): string => {
    if (this.popover.choices.encrypt && this.popover.choices.sign) {
      return SendBtnTexts.BTN_ENCRYPT_SIGN_AND_SEND;
    } else if (this.popover.choices.encrypt) {
      return SendBtnTexts.BTN_ENCRYPT_AND_SEND;
    } else if (this.popover.choices.sign) {
      return SendBtnTexts.BTN_SIGN_AND_SEND;
    } else {
      return SendBtnTexts.BTN_PLAIN_SEND;
    }
  }

  private extractProcessSendMsg = async () => {
    if (this.view.S.cached('reply_msg_successful').is(':visible')) {
      return;
    }
    this.view.sendBtnModule.disableBtn();
    this.view.S.cached('toggle_send_options').hide();
    try {
      this.view.errModule.throwIfFormNotReady();
      this.view.S.now('send_btn_text').text('Loading...');
      Xss.sanitizeRender(this.view.S.now('send_btn_i'), Ui.spinner('white'));
      this.view.S.cached('send_btn_note').text('');
      const newMsgData = this.view.inputModule.extractAll();
      await this.view.errModule.throwIfFormValsInvalid(newMsgData);
      const senderKi = await this.view.storageModule.getKey(this.view.senderModule.getSender());
      let signingPrv: Key | undefined;
      if (this.popover.choices.sign) {
        signingPrv = await this.decryptSenderKey(senderKi);
        if (!signingPrv) {
          return; // user has canceled the pass phrase dialog, or didn't respond to it in time
        }
      }
      await ContactStore.update(undefined, Array.prototype.concat.apply([], Object.values(newMsgData.recipients)), { last_use: Date.now() });
      const msgObj = await GeneralMailFormatter.processNewMsg(this.view, newMsgData, senderKi, signingPrv);
      await this.finalizeSendableMsg(msgObj, senderKi);
      await this.doSendMsg(msgObj);
    } catch (e) {
      await this.view.errModule.handleSendErr(e);
    } finally {
      this.view.sendBtnModule.enableBtn();
      this.view.S.cached('toggle_send_options').show();
    }
  }

  private finalizeSendableMsg = async (msg: SendableMsg, senderKi: KeyInfo) => {
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
    if (this.view.myPubkeyModule.shouldAttach()) {
      msg.attachments.push(Attachment.keyinfoAsPubkeyAttachment(senderKi));
    }
    await this.addNamesToMsg(msg);
  }

  private extractInlineImagesToAttachments = (html: string) => {
    const imgAttachments: Attachment[] = [];
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (!node) {
        return;
      }
      if ('src' in node) {
        const img: Element = node;
        const src = img.getAttribute('src') as string;
        const { mimeType, data } = this.parseInlineImageSrc(src);
        if (mimeType && data) {
          const imgAttachment = new Attachment({
            cid: Attachment.attachmentId(),
            name: img.getAttribute('name') || '',
            type: mimeType,
            data: Buf.fromBase64Str(data),
            inline: true
          });
          img.setAttribute('src', `cid:${imgAttachment.cid}`);
          imgAttachments.push(imgAttachment);
        } else {
          throw new ComposerUserError(`
            Unable to parse an inline image <details>
              <summary>with src="..."</summary>
              ${src}
            </details>
          `);
        }
      }
    });
    const htmlWithCidImages = DOMPurify.sanitize(html);
    DOMPurify.removeAllHooks();
    return { htmlWithCidImages, imgAttachments };
  }

  private parseInlineImageSrc = (src: string) => {
    let mimeType;
    let data = '';
    const parts = src.split(/[:;,]/);
    if (parts.length === 4 && parts[0] === 'data' && parts[1].match(/^image\/\w+/) && parts[2] === 'base64') {
      mimeType = parts[1];
      data = parts[3];
    }
    return { mimeType, data };
  }


  private doSendMsg = async (msg: SendableMsg) => {
    // if this is a password-encrypted message, then we've already shown progress for uploading to backend
    // and this requests represents second half of uploadable effort. Else this represents all (no previous heavy requests)
    const progressRepresents = this.view.pwdOrPubkeyContainerModule.isVisible() ? 'SECOND-HALF' : 'EVERYTHING';
    let msgSentRes: GmailRes.GmailMsgSend;
    try {
      this.isSendMessageInProgress = true;
      msgSentRes = await this.view.emailProvider.msgSend(msg, (p) => this.renderUploadProgress(p, progressRepresents));
    } catch (e) {
      if (msg.thread && ApiErr.isNotFound(e) && this.view.threadId) { // cannot send msg because threadId not found - eg user since deleted it
        msg.thread = undefined;
        msgSentRes = await this.view.emailProvider.msgSend(msg, (p) => this.renderUploadProgress(p, progressRepresents));
      } else {
        this.isSendMessageInProgress = false;
        throw e;
      }
    }
    BrowserMsg.send.notificationShow(this.view.parentTabId, { notification: `Your ${this.view.isReplyBox ? 'reply' : 'message'} has been sent.` });
    BrowserMsg.send.focusBody(this.view.parentTabId); // Bring focus back to body so Gmails shortcuts will work
    await this.view.draftModule.draftDelete();
    this.isSendMessageInProgress = false;
    if (this.view.isReplyBox) {
      this.view.renderModule.renderReplySuccess(msg, msgSentRes.id);
    } else {
      this.view.renderModule.closeMsg();
    }
  }

  private decryptSenderKey = async (senderKi: KeyInfo): Promise<Key | undefined> => {
    const prv = await KeyUtil.parse(senderKi.private);
    const passphrase = await this.view.storageModule.passphraseGet(senderKi);
    if (typeof passphrase === 'undefined' && !prv.fullyDecrypted) {
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'sign', longids: [senderKi.longid] });
      if ((typeof await this.view.storageModule.whenMasterPassphraseEntered(60)) !== 'undefined') { // pass phrase entered
        return await this.decryptSenderKey(senderKi);
      } else { // timeout - reset - no passphrase entered
        this.resetSendBtn();
        return undefined;
      }
    } else {
      if (!prv.fullyDecrypted) {
        await KeyUtil.decrypt(prv, passphrase!); // checked !== undefined above
      }
      return prv;
    }
  }

  private addNamesToMsg = async (msg: SendableMsg): Promise<void> => {
    const { sendAs } = await AcctStore.get(this.view.acctEmail, ['sendAs']);
    const addNameToEmail = async (emails: string[]): Promise<string[]> => {
      return await Promise.all(emails.map(async email => {
        let name: string | undefined;
        if (sendAs && sendAs[email]?.name) {
          name = sendAs[email].name!;
        } else {
          const [contact] = await ContactStore.get(undefined, [email]);
          if (contact?.name) {
            name = contact.name;
          }
        }
        const fixedEmail = Str.parseEmail(email).email;
        if (!fixedEmail) {
          throw new Error(`Recipient email ${email} is not valid`);
        }
        return name ? `${Str.rmSpecialCharsKeepUtf(name, 'ALLOW-SOME')} <${fixedEmail}>` : fixedEmail;
      }));
    };
    msg.recipients.to = await addNameToEmail(msg.recipients.to || []);
    msg.recipients.cc = await addNameToEmail(msg.recipients.cc || []);
    msg.recipients.bcc = await addNameToEmail(msg.recipients.bcc || []);
    msg.from = (await addNameToEmail([msg.from]))[0];
  }

}
