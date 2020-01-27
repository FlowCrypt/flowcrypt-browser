/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../../js/common/assert.js';
import { Att } from '../../../js/common/core/att.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { GoogleAuth } from '../../../js/common/api/google-auth.js';
import { Lang } from '../../../js/common/lang.js';
import { Settings } from '../../../js/common/settings.js';
import { Store } from '../../../js/common/platform/store.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Url } from '../../../js/common/core/common.js';
import { View } from '../../../js/common/view.js';

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
  }

  public setHandlers = () => {
    $('.action_open_compatibility').click(this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/compatibility.htm')));
    $('.action_open_decrypt').click(this.setHandler(() => Settings.redirectSubPage(this.acctEmail, this.parentTabId, '/chrome/settings/modules/decrypt.htm')));
    $('.action_backup').click(this.setHandlerPrevent('double', () => this.collectInfoAndDownloadBackupFile().catch(Catch.reportErr)));
    $('.action_throw_unchecked').click(() => Catch.test('error'));
    $('.action_throw_err').click(this.setHandler(async () => Catch.test('error')));
    $('.action_throw_obj').click(this.setHandler(async () => Catch.test('object')));
    $('.action_reset_account').click(this.setHandlerPrevent('double', this.acctResetHandler));
    $('.action_reset_managing_auth').click(this.setHandler(el => this.resetManagingAuthHandler()));
    $('.action_make_google_auth_token_unusable').click(this.setHandler(el => this.makeGoogleAuthTokenUnusableHandler()));
    $('.action_make_google_refresh_token_unusable').click(this.setHandler(el => this.makeGoogleRefreshTokenUnusableHandler()));
    $('.action_account_email_changed').click(this.setHandler(el => this.acctEmailChangedHandler()));
  }

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
              BrowserMsg.send.bg.settings({ path: 'index.htm', page: '/chrome/settings/modules/keyserver.htm', acctEmail: response.acctEmail });
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
  }

  private makeGoogleAuthTokenUnusableHandler = async () => {
    await Store.setAcct(this.acctEmail, { google_token_access: 'flowcrypt_test_bad_access_token' });
    BrowserMsg.send.reload(this.parentTabId, {});
  }

  private makeGoogleRefreshTokenUnusableHandler = async () => {
    await Store.setAcct(this.acctEmail, { google_token_refresh: 'flowcrypt_test_bad_refresh_token' });
    BrowserMsg.send.reload(this.parentTabId, {});
  }

  private resetManagingAuthHandler = async () => {
    await Store.setAcct(this.acctEmail, { subscription: undefined, uuid: undefined });
    BrowserMsg.send.reload(this.parentTabId, {});
  }

  private acctResetHandler = async () => {
    if (await Ui.modal.confirm(Lang.setup.confirmResetAcct(this.acctEmail))) {
      await this.collectInfoAndDownloadBackupFile();
      if (await Ui.modal.confirm('Proceed to reset? Don\'t come back telling me I didn\'t warn you.')) {
        await Settings.acctStorageReset(this.acctEmail);
        window.parent.location.reload();
      }
    }
  }

  private collectInfoAndDownloadBackupFile = async () => {
    const name = `FlowCrypt_BACKUP_FILE_${this.acctEmail.replace(/[^a-z0-9]+/, '')}.txt`;
    const backupText = await this.collectInfoForAccountBackup();
    Browser.saveToDownloads(new Att({ name, type: 'text/plain', data: Buf.fromUtfStr(backupText) }));
    await Ui.delay(1000);
  }

  private collectInfoForAccountBackup = async () => {
    const text = [
      'This file contains sensitive information, please put it in a safe place.',
      '',
      'DO NOT DISPOSE OF THIS FILE UNLESS YOU KNOW WHAT YOU ARE DOING',
      '',
      'NOTE DOWN YOUR PASS PHRASE IN A SAFE PLACE THAT YOU CAN FIND LATER',
      '',
      'If this key was registered on a keyserver (typically they are), you will need this same key (and pass phrase!) to replace it.',
      'In other words, losing this key or pass phrase may cause people to have trouble writing you encrypted emails, even if you use another key (on FlowCrypt or elsewhere) later on!',
      '',
      'acctEmail: ' + this.acctEmail,
    ];
    const globalStorage = await Store.getGlobal(['version']);
    const acctStorage = await Store.getAcct(this.acctEmail, ['is_newly_created_key', 'setup_date', 'full_name']);
    text.push('global_storage: ' + JSON.stringify(globalStorage));
    text.push('account_storage: ' + JSON.stringify(acctStorage));
    text.push('');
    const keyinfos = await Store.keysGet(this.acctEmail);
    for (const keyinfo of keyinfos) {
      text.push('');
      text.push('key_longid: ' + keyinfo.longid);
      text.push('key_primary: ' + keyinfo.primary);
      text.push(keyinfo.private);
    }
    text.push('');
    return text.join('\n');
  }

});
