/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './interfaces/composer-component.js';
import { RecipientElement, Recipients, SendBtnTexts, NewMsgData } from './interfaces/composer-types.js';
import { Composer } from './composer.js';
import { Xss } from '../platform/xss.js';
import { Ui } from '../browser.js';
import { Catch, UnreportableError } from '../platform/catch.js';
import { Api } from '../api/api.js';
import { BrowserMsg, Extension } from '../extension.js';
import { ComposerUserError, ComposerResetBtnTrigger, ComposerNotReadyError } from './interfaces/composer-errors.js';
import { Pwd, Pgp, KeyInfo } from '../core/pgp.js';
import { Store } from '../platform/store.js';
import { GmailRes } from '../api/google.js';
import { SendableMsg } from '../api/email_provider_api.js';
import { Att } from '../core/att.js';
import { GeneralMailFormatter } from './composer-mail-formatter.js';
import { ComposerSendBtnPopover } from './composer-send-btn-popover.js';

export class ComposerSendBtn extends ComposerComponent {

  public additionalMsgHeaders: { [key: string]: string } = {};

  public btnUpdateTimeout?: number;

  private isSendMessageInProgress = false;

  public popover: ComposerSendBtnPopover;

  constructor(composer: Composer) {
    super(composer);
    this.popover = new ComposerSendBtnPopover(composer);
  }

  initActions(): void {
    this.composer.S.cached('body').keypress(Ui.ctrlEnter(() => !this.composer.composerWindowSize.isMinimized() && this.extractProcessSendMsg()));
    this.composer.S.cached('send_btn').click(Ui.event.prevent('double', () => this.extractProcessSendMsg()));
    this.popover.initActions();
  }

  isSendMessageInProgres(): boolean {
    return this.isSendMessageInProgress;
  }

  resetSendBtn(delay?: number) {
    const doReset = () => {
      Xss.sanitizeRender(this.composer.S.cached('send_btn_text'), `<i></i>${this.btnText()}`);
      this.composer.S.cached('toggle_send_options').show();
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

  setBtnColor(color: 'green' | 'gray') {
    const classToAdd = color;
    const classToRemove = ['green', 'gray'].find(c => c !== color);
    this.composer.S.cached('send_btn').removeClass(classToRemove).addClass(classToAdd);
    this.composer.S.cached('toggle_send_options').removeClass(classToRemove).addClass(classToAdd);
  }

  private btnText(): string {
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
    this.composer.S.cached('toggle_send_options').hide();
    try {
      this.throwIfFormNotReady();
      this.composer.S.now('send_btn_text').text('Loading');
      Xss.sanitizeRender(this.composer.S.now('send_btn_i'), Ui.spinner('white'));
      this.composer.S.cached('send_btn_note').text('');
      const newMsgData = this.collectNewMsgData();
      await this.throwIfFormValsInvalid(newMsgData);
      const senderKi = await this.composer.app.storageGetKey(this.urlParams.acctEmail, this.composer.composerSender.getSender());
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
      await this.handleSendErr(e);
    } finally {
      this.composer.S.cached('toggle_send_options').show();
    }
  }

  private async finalizeSendableMsg(msg: SendableMsg, senderKi: KeyInfo) {
    const choices = this.composer.composerSendBtn.popover.choices;
    for (const k of Object.keys(this.additionalMsgHeaders)) {
      msg.headers[k] = this.additionalMsgHeaders[k];
    }
    if (choices.encrypt) {
      for (const a of msg.atts) {
        a.type = 'application/octet-stream'; // so that Enigmail+Thunderbird does not attempt to display without decrypting
      }
    }
    if (this.composer.S.cached('icon_pubkey').is('.active')) {
      msg.atts.push(Att.keyinfoAsPubkeyAtt(senderKi));
    }
    await this.addNamesToMsg(msg);
  }

  private doSendMsg = async (msg: SendableMsg) => {
    let msgSentRes: GmailRes.GmailMsgSend;
    try {
      this.isSendMessageInProgress = true;
      msgSentRes = await this.composer.app.emailProviderMsgSend(msg, this.renderUploadProgress);
    } catch (e) {
      if (msg.thread && Api.err.isNotFound(e) && this.urlParams.threadId) { // cannot send msg because threadId not found - eg user since deleted it
        msg.thread = undefined;
        msgSentRes = await this.composer.app.emailProviderMsgSend(msg, this.renderUploadProgress);
      } else {
        this.isSendMessageInProgress = false;
        throw e;
      }
    }
    BrowserMsg.send.notificationShow(this.urlParams.parentTabId, { notification: `Your ${this.urlParams.isReplyBox ? 'reply' : 'message'} has been sent.` });
    BrowserMsg.send.focusBody(this.urlParams.parentTabId); // Bring focus back to body so Gmails shortcuts will work
    await this.composer.composerDraft.draftDelete();
    this.isSendMessageInProgress = false;
    if (this.urlParams.isReplyBox) {
      this.renderReplySuccess(msg, msgSentRes.id);
    } else {
      this.composer.app.closeMsg();
    }
  }

  private decryptSenderKey = async (senderKi: KeyInfo): Promise<OpenPGP.key.Key | undefined> => {
    const prv = await Pgp.key.read(senderKi.private);
    const passphrase = await this.composer.app.storagePassphraseGet(senderKi);
    if (typeof passphrase === 'undefined' && !prv.isFullyDecrypted()) {
      BrowserMsg.send.passphraseDialog(this.urlParams.parentTabId, { type: 'sign', longids: [senderKi.longid] });
      if ((typeof await this.composer.app.whenMasterPassphraseEntered(60)) !== 'undefined') { // pass phrase entered
        return await this.decryptSenderKey(senderKi);
      } else { // timeout - reset - no passphrase entered
        this.resetSendBtn();
        return undefined;
      }
    } else {
      if (!prv.isFullyDecrypted()) {
        await Pgp.key.decrypt(prv, passphrase!); // checked !== undefined above
      }
      return prv;
    }
  }

  private handleSendErr = async (e: any) => {
    if (Api.err.isNetErr(e)) {
      await Ui.modal.error('Could not send message due to network error. Please check your internet connection and try again.');
    } else if (Api.err.isAuthPopupNeeded(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail });
      await Ui.modal.error('Could not send message because FlowCrypt needs to be re-connected to google account.');
    } else if (Api.err.isAuthErr(e)) {
      if (await Ui.modal.confirm('Your FlowCrypt account information is outdated, please review your account settings.')) {
        BrowserMsg.send.subscribeDialog(this.urlParams.parentTabId, { isAuthErr: true });
      }
    } else if (Api.err.isReqTooLarge(e)) {
      await Ui.modal.error(`Could not send: message or attachments too large.`);
    } else if (Api.err.isBadReq(e)) {
      const errMsg = e.parseErrResMsg('google');
      if (errMsg === e.STD_ERR_MSGS.GOOGLE_INVALID_TO_HEADER || errMsg === e.STD_ERR_MSGS.GOOGLE_RECIPIENT_ADDRESS_REQUIRED) {
        await Ui.modal.error('Error from google: Invalid recipients\n\nPlease remove recipients, add them back and re-send the message.');
      } else {
        if (await Ui.modal.confirm(`Google returned an error when sending message. Please help us improve FlowCrypt by reporting the error to us.`)) {
          const page = '/chrome/settings/modules/help.htm';
          const pageUrlParams = { bugReport: Extension.prepareBugReport(`composer: send: bad request (errMsg: ${errMsg})`, {}, e) };
          BrowserMsg.send.bg.settings({ acctEmail: this.urlParams.acctEmail, page, pageUrlParams });
        }
      }
    } else if (e instanceof ComposerUserError) {
      await Ui.modal.error(e.message);
    } else {
      if (!(e instanceof ComposerResetBtnTrigger || e instanceof UnreportableError || e instanceof ComposerNotReadyError)) {
        Catch.reportErr(e);
        await Ui.modal.error(`Failed to send message due to: ${String(e)}`);
      }
    }
    if (!(e instanceof ComposerNotReadyError)) {
      this.resetSendBtn(100);
    }
  }

  private mapRecipients = (recipients: RecipientElement[]) => {
    const result: Recipients = { to: [], cc: [], bcc: [] };
    for (const recipient of recipients) {
      switch (recipient.sendingType) {
        case "to":
          result.to!.push(recipient.email);
          break;
        case "cc":
          result.cc!.push(recipient.email);
          break;
        case "bcc":
          result.bcc!.push(recipient.email);
          break;
      }
    }
    return result;
  }

  public renderUploadProgress = (progress: number) => {
    if (this.composer.composerAtts.attach.hasAtt()) {
      progress = Math.floor(progress);
      this.composer.S.now('send_btn_text').text(`${SendBtnTexts.BTN_SENDING} ${progress < 100 ? `${progress}%` : ''}`);
    }
  }

  private addNamesToMsg = async (msg: SendableMsg): Promise<void> => {
    const { sendAs } = await Store.getAcct(this.urlParams.acctEmail, ['sendAs']);
    const addNameToEmail = async (emails: string[]): Promise<string[]> => {
      return await Promise.all(emails.map(async email => {
        let name: string | undefined;
        if (sendAs && sendAs[email] && sendAs[email].name) {
          name = sendAs[email].name!;
        } else {
          const [contact] = await this.composer.app.storageContactGet([email]);
          if (contact && contact.name) {
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

  private renderReplySuccess = (msg: SendableMsg, msgId: string) => {
    this.composer.app.renderReinsertReplyBox(msgId);
    if (!this.popover.choices.encrypt) {
      this.composer.S.cached('replied_body').addClass('pgp_neutral').removeClass('pgp_secure');
    }
    this.composer.S.cached('replied_body').css('width', ($('table#compose').width() || 500) - 30);
    this.composer.S.cached('compose_table').css('display', 'none');
    this.composer.S.cached('reply_msg_successful').find('div.replied_from').text(this.composer.composerSender.getSender());
    this.composer.S.cached('reply_msg_successful').find('div.replied_to span').text(msg.headers.To.replace(/,/g, ', '));
    const repliedBodyEl = this.composer.S.cached('reply_msg_successful').find('div.replied_body');
    Xss.sanitizeRender(repliedBodyEl, Xss.escapeTextAsRenderableHtml(this.composer.composerTextInput.extractAsText('input_text', 'SKIP-ADDONS')));
    const t = new Date();
    const time = ((t.getHours() !== 12) ?
      (t.getHours() % 12) : 12) + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
    this.composer.S.cached('reply_msg_successful').find('div.replied_time').text(time);
    this.composer.S.cached('reply_msg_successful').css('display', 'block');
    if (msg.atts.length) {
      this.composer.S.cached('replied_attachments').html(msg.atts.map(a => { // xss-safe-factory
        a.msgId = msgId;
        return this.composer.app.factoryAtt(a, true);
      }).join('')).css('display', 'block');
    }
    this.composer.composerWindowSize.resizeComposeBox();
  }

  private throwIfFormNotReady = (): void => {
    if (this.composer.S.cached('icon_show_prev_msg').hasClass('progress')) {
      throw new ComposerNotReadyError('Retrieving previous message, please wait.');
    }
    const btnReadyTexts = [
      SendBtnTexts.BTN_ENCRYPT_AND_SEND,
      SendBtnTexts.BTN_SIGN_AND_SEND,
      SendBtnTexts.BTN_ENCRYPT_SIGN_AND_SEND,
      SendBtnTexts.BTN_PLAIN_SEND
    ];
    const recipients = this.composer.composerContacts.getRecipients();
    if (btnReadyTexts.includes(this.composer.S.now('send_btn_text').text().trim()) && recipients.length) {
      return; // all good
    }
    if (this.composer.S.now('send_btn_text').text().trim() === SendBtnTexts.BTN_WRONG_ENTRY) {
      throw new ComposerUserError('Please re-enter recipients marked in red color.');
    }
    if (!recipients.length) {
      throw new ComposerUserError('Please add a recipient first');
    }
    throw new ComposerNotReadyError('Still working, please wait.');
  }

  private throwIfFormValsInvalid = async ({ subject, plaintext }: { subject: string, plaintext: string }) => {
    if (!((plaintext !== '' || await Ui.modal.confirm('Send empty message?')) && (subject !== '' || await Ui.modal.confirm('Send without a subject?')))) {
      throw new ComposerResetBtnTrigger();
    }
  }

  public throwIfEncryptionPasswordInvalid = async (senderKi: KeyInfo, { subject, pwd }: { subject: string, pwd?: Pwd }) => {
    if (pwd && pwd.answer) {
      const pp = await this.composer.app.storagePassphraseGet(senderKi);
      if (pp && pwd.answer.toLowerCase() === pp.toLowerCase()) {
        throw new ComposerUserError('Please do not use your private key pass phrase as a password for this message.\n\n' +
          'You should come up with some other unique password that you can share with recipient.');
      }
      if (subject.toLowerCase().includes(pwd.answer.toLowerCase())) {
        throw new ComposerUserError(`Please do not include the password in the email subject. ` +
          `Sharing password over email undermines password based encryption.\n\n` +
          `You can ask the recipient to also install FlowCrypt, messages between FlowCrypt users don't need a password.`);
      }
      const intro = this.composer.S.cached('input_intro').length ? this.composer.composerTextInput.extractAsText('input_intro') : '';
      if (intro.toLowerCase().includes(pwd.answer.toLowerCase())) {
        throw new ComposerUserError('Please do not include the password in the email intro. ' +
          `Sharing password over email undermines password based encryption.\n\n` +
          `You can ask the recipient to also install FlowCrypt, messages between FlowCrypt users don't need a password.`);
      }
    } else {
      this.composer.S.cached('input_password').focus();
      throw new ComposerUserError('Some recipients don\'t have encryption set up. Please add a password.');
    }
  }

  private collectNewMsgData = (): NewMsgData => {
    const recipientElements = this.composer.composerContacts.getRecipients();
    const recipients = this.mapRecipients(recipientElements);
    const subject = this.urlParams.subject || ($('#input_subject').val() === undefined ? '' : String($('#input_subject').val())); // replies have subject in url params
    const plaintext = this.composer.composerTextInput.extractAsText('input_text');
    const password = this.composer.S.cached('input_password').val();
    const pwd = password ? { answer: String(password) } : undefined;
    const sender = this.composer.composerSender.getSender();
    return { recipients, subject, plaintext, pwd, sender };
  }

}
