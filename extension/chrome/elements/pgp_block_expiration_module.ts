/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { PgpBlockView } from './pgp_block';
import { Store } from '../../js/common/platform/store.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Ui } from '../../js/common/browser.js';
import { Str } from '../../js/common/core/common.js';
import { Api, AuthError } from '../../js/common/api/api.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Xss } from '../../js/common/platform/xss';
import { Backend } from '../../js/common/api/backend';
import { Settings } from '../../js/common/settings';

export class PgpBlockViewExpirationModule {

  public adminCodes: string[] | undefined;

  constructor(private view: PgpBlockView) {
  }

  public renderFutureExpiration(date: string) {
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

  public async recoverStoredAdminCodes() {
    const storage = await Store.getGlobal(['admin_codes']);
    if (this.view.short && storage.admin_codes && storage.admin_codes[this.view.short] && storage.admin_codes[this.view.short].codes) {
      this.adminCodes = storage.admin_codes[this.view.short].codes;
    }
  }

  public async renderMsgExpirationRenewOptions(target: HTMLElement) {
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

  private async handleExtendMsgExpirationClicked(self: HTMLElement) {
    const nDays = Number($(self).attr('href')!.replace('#', ''));
    Xss.sanitizeRender($(self).parent(), `Updating..${Ui.spinner('green')}`);
    try {
      const fcAuth = await Store.authInfo(this.view.acctEmail);
      if (!fcAuth) {
        throw new AuthError();
      }
      const r = await Backend.messageExpiration(fcAuth, this.adminCodes || [], nDays);
      if (r.updated) { // todo - make backend return http error code when not updated, and skip this if/else
        window.location.reload();
      } else {
        throw r;
      }
    } catch (e) {
      if (Api.err.isAuthErr(e)) {
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
