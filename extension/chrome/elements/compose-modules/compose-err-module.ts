/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserEventErrHandler, Ui } from '../../../js/common/browser/ui.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { NewMsgData, SendBtnTexts } from './compose-types.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { BrowserExtension } from '../../../js/common/browser/browser-extension.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Settings } from '../../../js/common/settings.js';
import { Str } from '../../../js/common/core/common.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { ViewModule } from '../../../js/common/view-module.js';
import { ComposeView } from '../compose.js';
import { AjaxErrMsgs } from '../../../js/common/api/shared/api-error.js';

export class ComposerUserError extends Error { }
class ComposerNotReadyError extends ComposerUserError { }
export class ComposerResetBtnTrigger extends Error { }

export const PUBKEY_LOOKUP_RESULT_FAIL: 'fail' = 'fail';
export const PUBKEY_LOOKUP_RESULT_WRONG: 'wrong' = 'wrong';

export class ComposeErrModule extends ViewModule<ComposeView> {

  private debugId = Str.sloppyRandom();

  public handle = (couldNotDoWhat: string): BrowserEventErrHandler => {
    return {
      network: async () => await Ui.modal.info(`Could not ${couldNotDoWhat} (network error). Please try again.`),
      auth: async () => Settings.offerToLoginWithPopupShowModalOnErr(this.view.acctEmail, undefined, `Could not ${couldNotDoWhat}.\n`),
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
  };

  public debugFocusEvents = (...selNames: string[]) => {
    for (const selName of selNames) {
      this.view.S.cached(selName)
        .focusin(e => this.debug(`** ${selName} receiving focus from(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`))
        .focusout(e => this.debug(`** ${selName} giving focus to(${e.relatedTarget ? e.relatedTarget.outerHTML : undefined})`));
    }
  };

  public debug = (msg: string) => {
    if (this.view.debug) {
      console.log(`[${this.debugId}] ${msg}`);
    }
  };

  public handleSendErr = async (e: any) => {
    if (ApiErr.isNetErr(e)) {
      let netErrMsg = 'Could not send message due to network error. Please check your internet connection and try again.\n';
      netErrMsg += '(This may also be caused by <a href="https://flowcrypt.com/docs/help/network-error.html">missing extension permissions</a>).)';
      await Ui.modal.error(netErrMsg);
    } else if (ApiErr.isAuthErr(e)) {
      BrowserMsg.send.notificationShowAuthPopupNeeded(this.view.parentTabId, { acctEmail: this.view.acctEmail });
      Settings.offerToLoginWithPopupShowModalOnErr(this.view.acctEmail);
    } else if (ApiErr.isReqTooLarge(e)) {
      await Ui.modal.error(`Could not send: message or attachments too large.`);
    } else if (ApiErr.isBadReq(e)) {
      if (e.resMsg === AjaxErrMsgs.GOOGLE_INVALID_TO_HEADER || e.resMsg === AjaxErrMsgs.GOOGLE_RECIPIENT_ADDRESS_REQUIRED) {
        await Ui.modal.error('Error from google: Invalid recipients\n\nPlease remove recipients, add them back and re-send the message.');
      } else {
        if (await Ui.modal.confirm(`Google returned an error when sending message. Please help us improve FlowCrypt by reporting the error to us.`)) {
          const page = '/chrome/settings/modules/help.htm';
          const pageUrlParams = { bugReport: BrowserExtension.prepareBugReport(`composer: send: bad request (errMsg: ${e.resMsg})`, {}, e) };
          await Browser.openSettingsPage('index.htm', this.view.acctEmail, page, pageUrlParams);
        }
      }
    } else if (e instanceof ComposerUserError) {
      await Ui.modal.error(e.message, true);
    } else {
      if (!(e instanceof ComposerResetBtnTrigger || e instanceof ComposerNotReadyError)) {
        Catch.reportErr(e);
        await Ui.modal.error(`Failed to send message due to: ${String(e)}`);
      }
    }
    if (!(e instanceof ComposerNotReadyError)) {
      this.view.sendBtnModule.resetSendBtn(100);
    }
  };

  public throwIfFormNotReady = (): void => {
    if (this.view.S.cached('triple_dot').hasClass('progress')) {
      throw new ComposerNotReadyError('Retrieving previous message, please wait.');
    }
    const btnReadyTexts = [
      SendBtnTexts.BTN_ENCRYPT_AND_SEND,
      SendBtnTexts.BTN_SIGN_AND_SEND,
      SendBtnTexts.BTN_ENCRYPT_SIGN_AND_SEND,
      SendBtnTexts.BTN_PLAIN_SEND
    ];
    const recipients = this.view.recipientsModule.getRecipients();
    if (btnReadyTexts.includes(this.view.S.now('send_btn_text').text().trim()) && recipients.length) {
      return; // all good
    }
    if (this.view.S.now('send_btn_text').text().trim() === SendBtnTexts.BTN_WRONG_ENTRY) {
      throw new ComposerUserError('Please re-enter recipients marked in red color.');
    }
    if (!recipients.length) {
      throw new ComposerUserError('Please add a recipient first');
    }
    throw new ComposerNotReadyError('Still working, please wait.');
  };

  public throwIfFormValsInvalid = async ({ subject, plaintext, from }: NewMsgData) => {
    if (!subject && ! await Ui.modal.confirm('Send without a subject?')) {
      throw new ComposerResetBtnTrigger();
    }
    let footer = await this.view.footerModule.getFooterFromStorage(from);
    if (footer) { // format footer the way it would be in outgoing plaintext
      footer = Xss.htmlUnescape(Xss.htmlSanitizeAndStripAllTags(this.view.footerModule.createFooterHtml(footer), '\n')).trim();
    }
    if ((!plaintext.trim() || (footer && plaintext.trim() === footer.trim())) && ! await Ui.modal.confirm('Send empty message?')) {
      throw new ComposerResetBtnTrigger();
    }
  };

  public throwIfEncryptionPasswordInvalid = async ({ subject, pwd }: { subject: string, pwd?: string }) => {
    if (pwd) {
      if (await this.view.storageModule.isPwdMatchingPassphrase(pwd)) {
        throw new ComposerUserError('Please do not use your private key pass phrase as a password for this message.\n\n' +
          'You should come up with some other unique password that you can share with recipient.');
      }
      if (subject.toLowerCase().includes(pwd.toLowerCase())) {
        throw new ComposerUserError(`Please do not include the password in the email subject. ` +
          `Sharing password over email undermines password based encryption.\n\n` +
          `You can ask the recipient to also install FlowCrypt, messages between FlowCrypt users don't need a password.`);
      }
      const intro = this.view.S.cached('input_intro').length ? this.view.inputModule.extract('text', 'input_intro') : '';
      if (intro.toLowerCase().includes(pwd.toLowerCase())) {
        throw new ComposerUserError('Please do not include the password in the email intro. ' +
          `Sharing password over email undermines password based encryption.\n\n` +
          `You can ask the recipient to also install FlowCrypt, messages between FlowCrypt users don't need a password.`);
      }
    } else {
      this.view.S.cached('input_password').focus();
      throw new ComposerUserError('Some recipients don\'t have encryption set up. Please add a password.');
    }
  };

}
