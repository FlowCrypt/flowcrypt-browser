/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../../js/common/assert.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { GoogleAuth } from '../../../js/common/api/email-provider/gmail/google-auth.js';
import { Lang } from '../../../js/common/lang.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { Api } from '../../../js/common/api/shared/api.js';

View.run(class ExperimentalView extends View {

  private acctEmail: string;
  private parentTabId: string;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
    if (!this.acctEmail) {
      throw new Error('acctEmail is required');
    }
  }

  public render = async () => {
    $('.email').text(this.acctEmail);
  };

  public setHandlers = () => {
    $('.action_open_compatibility').click(this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/compatibility.htm')));
    $('.action_open_decrypt').click(this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/decrypt.htm')));
    $('.action_backup').click(this.setHandler((el, e) => { e.preventDefault(); Settings.collectInfoAndDownloadBackupFile(this.acctEmail).catch(Catch.reportErr); }));
    $('.action_throw_unchecked').click((e) => { e.preventDefault(); Catch.test('error'); });
    $('.action_throw_err').click(this.setHandler((el, e) => { e.preventDefault(); Catch.test('error'); }));
    $('.action_throw_obj').click(this.setHandler((el, e) => { e.preventDefault(); Catch.test('object'); }));
    $('.action_reset_account').click(this.setHandler(async (el, e) => { e.preventDefault(); await this.acctResetHandler(); }));
    $('.action_reset_fc_auth').click(this.setHandler(async (el, e) => { e.preventDefault(); await this.resetFlowCryptAuthHandler(); }));
    $('.action_regenerate_uuid').click(this.setHandler(async (el, e) => { e.preventDefault(); await this.regenerateUuidHandler(); }));
    $('.action_make_google_auth_token_unusable').click(this.setHandler(async (el, e) => { e.preventDefault(); await this.makeGoogleAuthTokenUnusableHandler(); }));
    $('.action_make_google_refresh_token_unusable').click(this.setHandler(async (el, e) => { e.preventDefault(); await this.makeGoogleRefreshTokenUnusableHandler(); }));
    $('.action_account_email_changed').click(this.setHandler(async (el, e) => { e.preventDefault(); await this.acctEmailChangedHandler(); }));
  };

  // -- PRIVATE

  private acctEmailChangedHandler = async () => {
    if (await Ui.modal.confirm(Lang.setup.confirmManualAcctEmailChange(this.acctEmail))) {
      const response = await GoogleAuth.newAuthPopup({ acctEmail: this.acctEmail });
      if (response.result === 'Success' && response.acctEmail) {
        if (response.acctEmail === this.acctEmail) {
          await Ui.modal.info(`Account email address seems to be the same, nothing to update: ${this.acctEmail}`);
        } else if (response.acctEmail) {
          if (await Ui.modal.confirm(`Change your Google Account email from ${this.acctEmail} to ${response.acctEmail}?`)) {
            try {
              await Settings.acctStorageChangeEmail(this.acctEmail, response.acctEmail);
              await Ui.modal.info(`Email address changed to ${response.acctEmail}. You should now check that your public key is properly submitted.`);
              await Browser.openSettingsPage('index.htm', response.acctEmail, '/chrome/settings/modules/keyserver.htm');
            } catch (e) {
              Catch.reportErr(e);
              await Ui.modal.error('There was an error changing google account, please write human@flowcrypt.com');
            }
          }
        } else {
          await Ui.modal.error('Not able to retrieve new account email, please write at human@flowcrypt.com');
        }
      } else if (response.result === 'Denied' || response.result === 'Closed') {
        await Ui.modal.info('Canceled by user, skipping.');
      } else {
        Catch.report('failed to log into google in action_account_email_changed', response);
        await Ui.modal.error(`Failed to connect to Gmail (change). If this happens again, please email human@flowcrypt.com to get it fixed.\n\n[${response.result}] ${response.error}`);
        window.location.reload();
      }
    }
  };

  private makeGoogleAuthTokenUnusableHandler = async () => {
    await AcctStore.set(this.acctEmail, { google_token_access: 'flowcrypt_test_bad_access_token' });
    BrowserMsg.send.reload(this.parentTabId, {});
  };

  private makeGoogleRefreshTokenUnusableHandler = async () => {
    await AcctStore.set(this.acctEmail, { google_token_refresh: 'flowcrypt_test_bad_refresh_token' });
    BrowserMsg.send.reload(this.parentTabId, {});
  };

  private regenerateUuidHandler = async () => {
    await AcctStore.set(this.acctEmail, { uuid: Api.randomFortyHexChars() });
    BrowserMsg.send.reload(this.parentTabId, {});
  };

  private resetFlowCryptAuthHandler = async () => {
    await AcctStore.set(this.acctEmail, { uuid: undefined });
    BrowserMsg.send.reload(this.parentTabId, {});
  };

  private acctResetHandler = async () => {
    if (await Settings.resetAccount(this.acctEmail)) {
      window.parent.location.reload();
    }
  };

});
