/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../../js/common/assert.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { GoogleOAuth } from '../../../js/common/api/authentication/google/google-oauth.js';
import { Lang } from '../../../js/common/lang.js';
import { Settings } from '../../../js/common/settings.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { InMemoryStore } from '../../../js/common/platform/store/in-memory-store.js';
import { InMemoryStoreKeys } from '../../../js/common/core/const.js';

View.run(
  class ExperimentalView extends View {
    protected fesUrl?: string;
    private acctEmail: string;
    private parentTabId: string;

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['acctEmail', 'parentTabId']);
      this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
      this.parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
      if (!this.acctEmail) {
        throw new Error('acctEmail is required');
      }
      BrowserMsg.listen(this.parentTabId);
    }

    public render = async () => {
      const storage = await AcctStore.get(this.acctEmail, ['fesUrl']);
      this.fesUrl = storage.fesUrl;
      $('.email').text(this.acctEmail);
    };

    public setHandlers = () => {
      $('.action_open_compatibility').on(
        'click',
        this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/compatibility.htm'))
      );
      $('.action_open_decrypt').on(
        'click',
        this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/decrypt.htm'))
      );
      $('.action_throw_unchecked').on('click', e => {
        e.preventDefault();
        Catch.test('error');
      });
      $('.action_throw_err').on(
        'click',
        this.setHandler((el, e) => {
          e.preventDefault();
          Catch.test('error');
        })
      );
      $('.action_throw_obj').on(
        'click',
        this.setHandler((el, e) => {
          e.preventDefault();
          Catch.test('object');
        })
      );
      $('.action_reset_account').on(
        'click',
        this.setHandler(async (el, e) => {
          e.preventDefault();
          await this.acctResetHandler();
        })
      );
      $('.action_make_google_auth_token_unusable').on(
        'click',
        this.setHandler(async (el, e) => {
          e.preventDefault();
          await this.makeGoogleAuthTokenUnusableHandler();
        })
      );
      $('.action_make_google_refresh_token_unusable').on(
        'click',
        this.setHandler(async (el, e) => {
          e.preventDefault();
          await this.makeGoogleRefreshTokenUnusableHandler();
        })
      );
      $('.action_account_email_changed').on(
        'click',
        this.setHandler(async (el, e) => {
          e.preventDefault();
          await this.acctEmailChangedHandler();
        })
      );
    };

    // -- PRIVATE

    private acctEmailChangedHandler = async () => {
      if (await Ui.modal.confirm(Lang.setup.confirmManualAcctEmailChange(this.acctEmail))) {
        const response = await GoogleOAuth.newAuthPopup({ acctEmail: this.acctEmail });
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
                await Ui.modal.error(`There was an error changing google account, please ${Lang.general.contactMinimalSubsentence(!!this.fesUrl)}`);
              }
            }
          } else {
            await Ui.modal.error(`Not able to retrieve new account email, please ${Lang.general.contactMinimalSubsentence(!!this.fesUrl)}`);
          }
        } else if (response.result === 'Denied' || response.result === 'Closed') {
          await Ui.modal.info('Canceled by user, skipping.');
        } else {
          Catch.report('failed to log into google in action_account_email_changed', response);
          await Ui.modal.error(
            'Failed to connect to Gmail (change). ' + Lang.general.contactIfHappensAgain(!!this.fesUrl) + `\n\n[${response.result}] ${response.error}`
          );
          window.location.reload();
        }
      }
    };

    private makeGoogleAuthTokenUnusableHandler = async () => {
      await InMemoryStore.set(this.acctEmail, InMemoryStoreKeys.GOOGLE_TOKEN_ACCESS, 'flowcrypt_test_bad_access_token');
      BrowserMsg.send.reload(this.parentTabId, {});
    };

    private makeGoogleRefreshTokenUnusableHandler = async () => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      await AcctStore.set(this.acctEmail, { google_token_refresh: 'flowcrypt_test_bad_refresh_token' });
      BrowserMsg.send.reload(this.parentTabId, {});
    };

    private acctResetHandler = async () => {
      if (await Settings.resetAccount(this.acctEmail)) {
        window.parent.location.reload();
      }
    };
  }
);
