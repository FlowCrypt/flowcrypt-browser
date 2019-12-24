/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PgpBlockView } from '../pgp_block';
import { Store } from '../../../js/common/platform/store.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Str } from '../../../js/common/core/common.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { Backend, BackendRes } from '../../../js/common/api/backend.js';
import { Settings } from '../../../js/common/settings.js';
import { Lang } from '../../../js/common/lang.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { BackendAuthErr } from '../../../js/common/api/error/api-error-types.js';

export class PgpBlockViewPwdEncryptedMsgModule {

  public adminCodes: string[] | undefined;
  public passwordMsgLinkRes: BackendRes.FcLinkMsg | undefined;
  public userEnteredMsgPassword: string | undefined;

  constructor(private view: PgpBlockView) {
  }

  public renderFutureExpiration = (date: string) => {
    let btns = '';
    if (this.adminCodes && this.adminCodes.length) {
      btns += ' <a href="#" class="extend_expiration">extend</a>';
    }
    if (this.view.isOutgoing) {
      btns += ' <a href="#" class="expire_settings">settings</a>';
    }
    Xss.sanitizeAppend('#pgp_block', Ui.e('div', { class: 'future_expiration', html: `This message will expire on ${Str.datetimeToDate(date)}. ${btns}` }));
    $('.expire_settings').click(this.view.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.view.acctEmail, page: '/chrome/settings/modules/security.htm' })));
    $('.extend_expiration').click(this.view.setHandler(target => this.renderMsgExpirationRenewOptions(target)));
  }

  public recoverStoredAdminCodes = async () => {
    const storage = await Store.getGlobal(['admin_codes']);
    if (this.view.short && storage.admin_codes && storage.admin_codes[this.view.short]?.codes) {
      this.adminCodes = storage.admin_codes[this.view.short].codes;
    }
  }

  public renderMsgExpirationRenewOptions = async (target: HTMLElement) => {
    const parent = $(target).parent();
    const subscription = await Store.subscription(this.view.acctEmail);
    if (subscription.level && subscription.active) {
      const btns = `<a href="#7" class="do_extend">+7 days</a> <a href="#30" class="do_extend">+1 month</a> <a href="#365" class="do_extend">+1 year</a>`;
      Xss.sanitizeRender(parent, `<div style="font-family: monospace;">Extend message expiration: ${btns}</div>`);
      const element = await Ui.event.clicked('.do_extend');
      await this.handleExtendMsgExpirationClicked(element);
    } else {
      if (subscription.level && !subscription.active && subscription.method === 'trial') {
        await Ui.modal.warning('Your trial has ended. Please renew your subscription to proceed.');
      } else {
        await Ui.modal.info('FlowCrypt Advanced users can choose expiration of password encrypted messages. Try it free.');
      }
      BrowserMsg.send.subscribeDialog(this.view.parentTabId, {});
    }
  }

  public getDecryptPwd = async (suppliedPwd?: string | undefined): Promise<string | undefined> => {
    const pwd = suppliedPwd || this.userEnteredMsgPassword;
    if (pwd && this.view.hasChallengePassword) {
      const { hashed } = await BrowserMsg.send.bg.await.pgpHashChallengeAnswer({ answer: pwd });
      return hashed;
    }
    return pwd;
  }

  public renderPasswordPromptAndAwaitEntry = async (attempt: 'first' | 'retry'): Promise<string> => {
    let prompt = `<p>${attempt === 'first' ? '' : `<span style="color: red; font-weight: bold;">${Lang.pgpBlock.wrongPassword}</span>`}${Lang.pgpBlock.decryptPasswordPrompt}</p>`;
    const btn = `<button class="button green long decrypt" data-test="action-decrypt-with-password">decrypt message</button>`;
    prompt += `<p><input id="answer" placeholder="Password" data-test="input-message-password"></p><p>${btn}</p>`;
    await this.view.renderModule.renderContent(prompt, true);
    Ui.setTestState('ready');
    await Ui.event.clicked('.button.decrypt');
    Ui.setTestState('working'); // so that test suite can wait until ready again
    $(self).text('Opening');
    await Ui.delay(50); // give browser time to render
    return String($('#answer').val());
  }

  public renderPasswordEncryptedMsgLoadFail = async (linkRes: BackendRes.FcLinkMsg) => {
    if (linkRes.expired) {
      let expirationMsg = Lang.pgpBlock.msgExpiredOn + Str.datetimeToDate(linkRes.expire) + '. ' + Lang.pgpBlock.msgsDontExpire + '\n\n';
      if (linkRes.deleted) {
        expirationMsg += Lang.pgpBlock.msgDestroyed;
      } else if (this.view.isOutgoing && this.view.pwdEncryptedMsgModule.adminCodes) {
        expirationMsg += '<button class="button gray2 extend_expiration">renew message</button>';
      } else if (!this.view.isOutgoing) {
        expirationMsg += Lang.pgpBlock.askSenderRenew;
      }
      expirationMsg += '\n\n<button class="button gray2 action_security">security settings</button>';
      await this.view.errorModule.renderErr(expirationMsg, undefined);
      this.view.renderModule.setFrameColor('gray');
      $('.action_security').click(this.view.setHandler(() => BrowserMsg.send.bg.settings({ page: '/chrome/settings/modules/security.htm', acctEmail: this.view.acctEmail })));
      $('.extend_expiration').click(this.view.setHandler((el) => this.view.pwdEncryptedMsgModule.renderMsgExpirationRenewOptions(el)));
    } else if (!linkRes.url) {
      await this.view.errorModule.renderErr(Lang.pgpBlock.cannotLocate + Lang.pgpBlock.brokenLink, undefined);
    } else {
      await this.view.errorModule.renderErr(Lang.pgpBlock.cannotLocate + Lang.general.writeMeToFixIt + ' Details:\n\n' + Xss.escape(JSON.stringify(linkRes)), undefined);
    }
  }

  private handleExtendMsgExpirationClicked = async (self: HTMLElement) => {
    const nDays = Number($(self).attr('href')!.replace('#', ''));
    Xss.sanitizeRender($(self).parent(), `Updating..${Ui.spinner('green')}`);
    try {
      const fcAuth = await Store.authInfo(this.view.acctEmail);
      if (!fcAuth) {
        throw new BackendAuthErr();
      }
      const r = await Backend.messageExpiration(fcAuth, this.adminCodes || [], nDays);
      if (r.updated) { // todo - make backend return http error code when not updated, and skip this if/else
        window.location.reload();
      } else {
        throw r;
      }
    } catch (e) {
      if (ApiErr.isAuthErr(e)) {
        Settings.offerToLoginWithPopupShowModalOnErr(this.view.acctEmail);
      } else {
        Catch.report('error when extending message expiration', e);
      }
      Xss.sanitizeRender($(self).parent(), 'Error updating expiration. <a href="#" class="retry_expiration_change">Click here to try again</a>').addClass('bad');
      const el = await Ui.event.clicked('.retry_expiration_change');
      await this.handleExtendMsgExpirationClicked(el);
    }
  }

}
