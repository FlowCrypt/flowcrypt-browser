/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Att } from '../../../js/common/core/att.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Composer } from './composer.js';
import { ComposerComponent } from './composer-abstract-component.js';
import { ComposerSendBtnPopover } from './composer-send-btn-popover.js';
import { GeneralMailFormatter } from './formatters/composer-mail-formatter.js';
import { GmailRes } from '../../../js/common/api/email_provider/gmail/gmail-parser.js';
import { KeyInfo } from '../../../js/common/core/pgp-key.js';
import { PgpKey } from '../../../js/common/core/pgp-key.js';
import { SendBtnTexts } from './composer-types.js';
import { SendableMsg } from '../../../js/common/api/email_provider/email_provider_api.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class ComposerSendBtn extends ComposerComponent {

  public additionalMsgHeaders: { [key: string]: string } = {};

  public btnUpdateTimeout?: number;

  private isSendMessageInProgress = false;

  public popover: ComposerSendBtnPopover;

  constructor(composer: Composer) {
    super(composer);
    this.popover = new ComposerSendBtnPopover(composer);
  }

  initActions = (): void => {
    this.composer.S.cached('body').keypress(Ui.ctrlEnter(() => !this.composer.size.composeWindowIsMinimized && this.extractProcessSendMsg()));
    this.composer.S.cached('send_btn').click(this.view.setHandlerPrevent('double', () => this.extractProcessSendMsg()));
    this.popover.initActions();
  }

  isSendMessageInProgres = (): boolean => {
    return this.isSendMessageInProgress;
  }

  resetSendBtn = (delay?: number) => {
    const doReset = () => {
      Xss.sanitizeRender(this.composer.S.cached('send_btn_text'), `<i></i>${this.btnText()}`);
      this.composer.S.cached('send_btn').addClass('green').removeClass('gray').prop('disabled', false);
      this.composer.S.cached('toggle_send_options').addClass('green').removeClass('gray').show();
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

  disableBtn = () => {
    this.composer.S.cached('send_btn').removeClass('green').addClass('gray').prop('disabled', true);
    this.composer.S.cached('toggle_send_options').removeClass('green').addClass('gray');
  }

  enableBtn = () => {
    this.composer.S.cached('send_btn').removeClass('gray').addClass('green').prop('disabled', false);
    this.composer.S.cached('toggle_send_options').removeClass('gray').addClass('green');
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
    this.composer.sendBtn.disableBtn();
    this.composer.S.cached('toggle_send_options').hide();
    try {
      this.composer.errs.throwIfFormNotReady();
      this.composer.S.now('send_btn_text').text('Loading...');
      Xss.sanitizeRender(this.composer.S.now('send_btn_i'), Ui.spinner('white'));
      this.composer.S.cached('send_btn_note').text('');
      const newMsgData = this.composer.input.extractAll();
      await this.composer.errs.throwIfFormValsInvalid(newMsgData);
      const senderKi = await this.composer.storage.getKey(this.composer.sender.getSender());
      let signingPrv: OpenPGP.key.Key | undefined;
      if (this.popover.choices.sign) {
        signingPrv = await this.decryptSenderKey(senderKi);
        if (!signingPrv) {
          return; // user has canceled the pass phrase dialog, or didn't respond to it in time
        }
      }
      const msgObj = await GeneralMailFormatter.processNewMsg(this.composer, newMsgData, senderKi, signingPrv);
      await this.finalizeSendableMsg(msgObj, senderKi);
      await this.doSendMsg(msgObj);
    } catch (e) {
      await this.composer.errs.handleSendErr(e);
    } finally {
      this.composer.sendBtn.enableBtn();
      this.composer.S.cached('toggle_send_options').show();
    }
  }

  private finalizeSendableMsg = async (msg: SendableMsg, senderKi: KeyInfo) => {
    const choices = this.composer.sendBtn.popover.choices;
    for (const k of Object.keys(this.additionalMsgHeaders)) {
      msg.headers[k] = this.additionalMsgHeaders[k];
    }
    if (choices.encrypt && !choices.richText) {
      for (const a of msg.atts) {
        a.type = 'application/octet-stream'; // so that Enigmail+Thunderbird does not attempt to display without decrypting
      }
    }
    if (this.composer.myPubkey.shouldAttach()) {
      msg.atts.push(Att.keyinfoAsPubkeyAtt(senderKi));
    }
    await this.addNamesToMsg(msg);
  }

  private doSendMsg = async (msg: SendableMsg) => {
    let msgSentRes: GmailRes.GmailMsgSend;
    try {
      this.isSendMessageInProgress = true;
      msgSentRes = await this.composer.emailProvider.msgSend(msg, (progress) => this.renderUploadProgress(progress));
    } catch (e) {
      if (msg.thread && ApiErr.isNotFound(e) && this.view.threadId) { // cannot send msg because threadId not found - eg user since deleted it
        msg.thread = undefined;
        msgSentRes = await this.composer.emailProvider.msgSend(msg, (progress) => this.renderUploadProgress(progress));
      } else {
        this.isSendMessageInProgress = false;
        throw e;
      }
    }
    BrowserMsg.send.notificationShow(this.view.parentTabId, { notification: `Your ${this.view.isReplyBox ? 'reply' : 'message'} has been sent.` });
    BrowserMsg.send.focusBody(this.view.parentTabId); // Bring focus back to body so Gmails shortcuts will work
    await this.composer.draft.draftDelete();
    this.isSendMessageInProgress = false;
    if (this.view.isReplyBox) {
      this.composer.render.renderReplySuccess(msg, msgSentRes.id);
    } else {
      this.composer.render.closeMsg();
    }
  }

  private decryptSenderKey = async (senderKi: KeyInfo): Promise<OpenPGP.key.Key | undefined> => {
    const prv = await PgpKey.read(senderKi.private);
    const passphrase = await this.composer.storage.passphraseGet(senderKi);
    if (typeof passphrase === 'undefined' && !prv.isFullyDecrypted()) {
      BrowserMsg.send.passphraseDialog(this.view.parentTabId, { type: 'sign', longids: [senderKi.longid] });
      if ((typeof await this.composer.storage.whenMasterPassphraseEntered(60)) !== 'undefined') { // pass phrase entered
        return await this.decryptSenderKey(senderKi);
      } else { // timeout - reset - no passphrase entered
        this.resetSendBtn();
        return undefined;
      }
    } else {
      if (!prv.isFullyDecrypted()) {
        await PgpKey.decrypt(prv, passphrase!); // checked !== undefined above
      }
      return prv;
    }
  }

  public renderUploadProgress = (progress: number | undefined) => {
    if (progress && this.composer.atts.attach.hasAtt()) {
      progress = Math.floor(progress);
      this.composer.S.now('send_btn_text').text(`${SendBtnTexts.BTN_SENDING} ${progress < 100 ? `${progress}%` : ''}`);
    }
  }

  private addNamesToMsg = async (msg: SendableMsg): Promise<void> => {
    const { sendAs } = await Store.getAcct(this.view.acctEmail, ['sendAs']);
    const addNameToEmail = async (emails: string[]): Promise<string[]> => {
      return await Promise.all(emails.map(async email => {
        let name: string | undefined;
        if (sendAs && sendAs[email]?.name) {
          name = sendAs[email].name!;
        } else {
          const [contact] = await Store.dbContactGet(undefined, [email]);
          if (contact?.name) {
            name = contact.name;
          }
        }
        return name ? `${name.replace(/[<>,'"/\\\n\r\t]/g, '')} <${email}>` : email;
      }));
    };
    msg.recipients.to = await addNameToEmail(msg.recipients.to || []);
    msg.recipients.cc = await addNameToEmail(msg.recipients.cc || []);
    msg.recipients.bcc = await addNameToEmail(msg.recipients.bcc || []);
    msg.from = (await addNameToEmail([msg.from]))[0];
  }

}
