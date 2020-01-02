/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserEventErrHandler, Ui } from '../../../js/common/browser/ui.js';
import { Catch, UnreportableError } from '../../../js/common/platform/catch.js';
import { NewMsgData, SendBtnTexts } from './composer-types.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { BrowserExtension } from '../../../js/common/browser/browser-extension.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { ComposerComponent } from './composer-abstract-component.js';
import { KeyInfo } from '../../../js/common/core/pgp-key.js';
import { Settings } from '../../../js/common/settings.js';
import { Str } from '../../../js/common/core/common.js';
import { Xss } from '../../../js/common/platform/xss.js';

export class ComposerUserError extends Error { }
export class ComposerNotReadyError extends ComposerUserError { }
export class ComposerResetBtnTrigger extends Error { }

export const PUBKEY_LOOKUP_RESULT_FAIL: 'fail' = 'fail';
export const PUBKEY_LOOKUP_RESULT_WRONG: 'wrong' = 'wrong';

export class ComposerErrs extends ComposerComponent {

  private debugId = Str.sloppyRandom();

  public initActions = () => {
    // none
  }

  public handlers = (couldNotDoWhat: string): BrowserEventErrHandler => {
    return {
      network: async () => await Ui.modal.info(`Could not ${couldNotDoWhat} (network error). Please try again.`),
      authPopup: async () => BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail }),
      auth: async () => {
        Settings.offerToLoginWithPopupShowModalOnErr(this.view.acctEmail, undefined, `Could not ${couldNotDoWhat}.\n`);
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
    if (this.view.debug) {
      console.log(`[${this.debugId}] ${msg}`);
    }
  }

  public handleSendErr = async (e: any) => {
    if (ApiErr.isNetErr(e)) {
      await Ui.modal.error('Could not send message due to network error. Please check your internet connection and try again.');
    } else if (ApiErr.isAuthPopupNeeded(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      await Ui.modal.error('Could not send message because FlowCrypt needs to be re-connected to google account.');
    } else if (ApiErr.isAuthErr(e)) {
      Settings.offerToLoginWithPopupShowModalOnErr(this.view.acctEmail);
    } else if (ApiErr.isReqTooLarge(e)) {
      await Ui.modal.error(`Could not send: message or attachments too large.`);
    } else if (ApiErr.isBadReq(e)) {
      const errMsg = e.parseErrResMsg('google');
      if (errMsg === e.STD_ERR_MSGS.GOOGLE_INVALID_TO_HEADER || errMsg === e.STD_ERR_MSGS.GOOGLE_RECIPIENT_ADDRESS_REQUIRED) {
        await Ui.modal.error('Error from google: Invalid recipients\n\nPlease remove recipients, add them back and re-send the message.');
      } else {
        if (await Ui.modal.confirm(`Google returned an error when sending message. Please help us improve FlowCrypt by reporting the error to us.`)) {
          const page = '/chrome/settings/modules/help.htm';
          const pageUrlParams = { bugReport: BrowserExtension.prepareBugReport(`composer: send: bad request (errMsg: ${errMsg})`, {}, e) };
          BrowserMsg.send.bg.settings({ acctEmail: this.view.acctEmail, page, pageUrlParams });
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
      this.composer.sendBtn.resetSendBtn(100);
    }
  }

  public throwIfFormNotReady = (): void => {
    if (this.composer.S.cached('triple_dot').hasClass('progress')) {
      throw new ComposerNotReadyError('Retrieving previous message, please wait.');
    }
    const btnReadyTexts = [
      SendBtnTexts.BTN_ENCRYPT_AND_SEND,
      SendBtnTexts.BTN_SIGN_AND_SEND,
      SendBtnTexts.BTN_ENCRYPT_SIGN_AND_SEND,
      SendBtnTexts.BTN_PLAIN_SEND
    ];
    const recipients = this.composer.recipients.getRecipients();
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

  public throwIfFormValsInvalid = async ({ subject, plaintext, sender }: NewMsgData) => {
    if (!subject && ! await Ui.modal.confirm('Send without a subject?')) {
      throw new ComposerResetBtnTrigger();
    }
    let footer = await this.composer.footer.getFooterFromStorage(sender);
    if (footer) { // format footer the way it would be in outgoing plaintext
      footer = Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(this.composer.footer.createFooterHtml(footer), '\n')).trim();
    }
    if ((!plaintext.trim() || (footer && plaintext.trim() === footer.trim())) && ! await Ui.modal.confirm('Send empty message?')) {
      throw new ComposerResetBtnTrigger();
    }
  }

  public throwIfEncryptionPasswordInvalid = async (senderKi: KeyInfo, { subject, pwd }: { subject: string, pwd?: string }) => {
    if (pwd) {
      const pp = await this.composer.storage.passphraseGet(senderKi);
      if (pp && pwd.toLowerCase() === pp.toLowerCase()) {
        throw new ComposerUserError('Please do not use your private key pass phrase as a password for this message.\n\n' +
          'You should come up with some other unique password that you can share with recipient.');
      }
      if (subject.toLowerCase().includes(pwd.toLowerCase())) {
        throw new ComposerUserError(`Please do not include the password in the email subject. ` +
          `Sharing password over email undermines password based encryption.\n\n` +
          `You can ask the recipient to also install FlowCrypt, messages between FlowCrypt users don't need a password.`);
      }
      const intro = this.composer.S.cached('input_intro').length ? this.composer.input.extract('text', 'input_intro') : '';
      if (intro.toLowerCase().includes(pwd.toLowerCase())) {
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
