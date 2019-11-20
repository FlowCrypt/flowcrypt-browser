/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypcom */

'use strict';

import { ComposerComponent } from './interfaces/composer-component.js';
import { Ui, BrowserEventErrHandler } from '../browser.js';
import { BrowserMsg, Extension } from '../extension.js';
import { Catch, UnreportableError } from '../platform/catch.js';
import { Str } from '../core/common.js';
import { Api } from '../api/api.js';
import { ComposerUserError, ComposerResetBtnTrigger, ComposerNotReadyError } from './interfaces/composer-errors.js';
import { SendBtnTexts } from './interfaces/composer-types.js';
import { KeyInfo, Pwd } from '../core/pgp.js';

export class ComposerErrs extends ComposerComponent {

  private debugId = Str.sloppyRandom();

  initActions() {
    // none
  }

  public handlers = (couldNotDoWhat: string): BrowserEventErrHandler => {
    return {
      network: async () => await Ui.modal.info(`Could not ${couldNotDoWhat} (network error). Please try again.`),
      authPopup: async () => BrowserMsg.send.notificationShowAuthPopupNeeded(this.urlParams.parentTabId, { acctEmail: this.urlParams.acctEmail }),
      auth: async () => {
        if (await Ui.modal.confirm(`Could not ${couldNotDoWhat}.\nYour FlowCrypt account information is outdated, please review your account settings.`)) {
          BrowserMsg.send.subscribeDialog(this.urlParams.parentTabId, { isAuthErr: true });
        }
      },
      other: async (e: any) => {
        if (e instanceof Error) {
          e.stack = (e.stack || '') + `\n\n[compose action: ${couldNotDoWhat}]`;
        } else if (typeof e === 'object' && e && typeof (e as any).stack === 'undefined') {
          try {
            (e as any).stack = `[compose action: ${couldNotDoWhat}]`;
          } catch (e) {
            // no need
          }
        }
        Catch.reportErr(e);
        await Ui.modal.info(`Could not ${couldNotDoWhat} (unknown error). If this repeats, please contact human@flowcrypt.com.\n\n(${String(e)})`);
      },
    };
  }

  public debugFocusEvents = (...selNames: string[]) => {
    for (const selName of selNames) {
      this.composer.S.cached(selName)
        .focusin(e => this.debug(`** ${selName} receiving focus from(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`))
        .focusout(e => this.debug(`** ${selName} giving focus to(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`));
    }
  }

  public debug = (msg: string) => {
    if (this.urlParams.debug) {
      console.log(`[${this.debugId}] ${msg}`);
    }
  }

  public handleSendErr = async (e: any) => {
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
      this.composer.composerSendBtn.resetSendBtn(100);
    }
  }

  public throwIfFormNotReady = (): void => {
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

  public throwIfFormValsInvalid = async ({ subject, plaintext }: { subject: string, plaintext: string }) => {
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

}
