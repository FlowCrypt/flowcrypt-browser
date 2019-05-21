/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Att } from '../../../js/common/core/att.js';
import { Xss, Ui, Env, Browser } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Settings } from '../../../js/common/settings.js';
import { Api } from '../../../js/common/api/api.js';
import { Lang } from '../../../js/common/lang.js';
import { GoogleAuth } from '../../../js/common/api/google.js';
import { Buf } from '../../../js/common/core/buf.js';
import { Assert } from '../../../js/common/assert.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const parentTabId = Assert.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');

  if (Catch.environment() === 'ex:dev') {
    Xss.sanitizeAppend('.storage_link_container', ` - <a href="${Xss.escape(Env.urlCreate('/chrome/dev/storage.htm', { controls: true }))}">Storage</a>`);
  }

  if (acctEmail) {

    const { dev_outlook_allow } = await Store.getGlobal(['dev_outlook_allow']);
    if (dev_outlook_allow === true) {
      $('.action_allow_outlook').prop('checked', true);
    }

    $('.email').text(acctEmail);

    $('.action_allow_outlook').change(Ui.event.handle(async target => {
      await Store.setGlobal({ 'dev_outlook_allow': Boolean($(target).prop('checked')) });
      window.location.reload();
    }));

    $('.action_open_compatibility').click(Ui.event.handle(() => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/compatibility.htm')));

    $('.action_open_decrypt').click(Ui.event.handle(() => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/decrypt.htm')));

    $('.action_backup').click(Ui.event.prevent('double', () => collectInfoAndDownloadBackupFile(acctEmail).catch(Catch.reportErr)));

    $('.action_fetch_aliases').click(Ui.event.prevent('parallel', async (self, done) => {
      Xss.sanitizeRender(self, Ui.spinner('white'));
      try {
        const all = await Settings.refreshAcctAliases(acctEmail);
        await Ui.modal.info('Updated to: ' + all.join(', '));
      } catch (e) {
        if (Api.err.isNetErr(e)) {
          await Ui.modal.error('Network error, please try again');
        } else if (Api.err.isAuthPopupNeeded(e)) {
          await Ui.modal.warning('Error: account needs to be re-connected first.');
          BrowserMsg.send.notificationShowAuthPopupNeeded(parentTabId, { acctEmail });
        } else {
          Catch.reportErr(e);
          await Ui.modal.error(`Error happened: ${String(e)}`);
        }
      }
      await Ui.time.sleep(100);
      window.location.reload();
      done();
    }));

    $('.action_throw_unchecked').click(() => Catch.test('error'));

    $('.action_throw_err').click(Ui.event.handle(async () => {
      Catch.test('error');
    }));

    $('.action_throw_obj').click(Ui.event.handle(async () => {
      Catch.test('object');
    }));

    $('.action_reset_account').click(Ui.event.prevent('double', async () => {
      if (await Ui.modal.confirm(Lang.setup.confirmResetAcct(acctEmail))) {
        await collectInfoAndDownloadBackupFile(acctEmail);
        if (await Ui.modal.confirm('Proceed to reset? Don\'t come back telling me I didn\'t warn you.')) {
          await Settings.acctStorageReset(acctEmail);
          window.parent.location.reload();
        }
      }
    }));

    $('.action_reset_managing_auth').click(Ui.event.handle(async () => {
      await Store.removeGlobal(['cryptup_account_email', 'cryptup_account_subscription', 'cryptup_account_uuid']);
      BrowserMsg.send.reload(parentTabId, {});
    }));

    $('.action_make_google_auth_token_unusable').click(Ui.event.handle(async () => {
      await Store.setAcct(acctEmail, { google_token_access: 'flowcrypt_test_bad_access_token' });
      BrowserMsg.send.reload(parentTabId, {});
    }));

    $('.action_make_google_refresh_token_unusable').click(Ui.event.handle(async () => {
      await Store.setAcct(acctEmail, { google_token_refresh: 'flowcrypt_test_bad_refresh_token' });
      BrowserMsg.send.reload(parentTabId, {});
    }));

    $('.action_account_email_changed').click(Ui.event.handle(async () => {
      if (await Ui.modal.confirm(Lang.setup.confirmManualAcctEmailChange(acctEmail))) {
        const response = await GoogleAuth.newAuthPopup({ acctEmail });
        if (response.result === 'Success' && response.acctEmail) {
          if (response.acctEmail === acctEmail) {
            await Ui.modal.info(`Account email address seems to be the same, nothing to update: ${acctEmail}`);
          } else if (response.acctEmail) {
            if (await Ui.modal.confirm(`Change your Google Account email from ${acctEmail} to ${response.acctEmail}?`)) {
              try {
                await Settings.acctStorageChangeEmail(acctEmail, response.acctEmail);
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
    }));

    const collectInfoAndDownloadBackupFile = async (acctEmail: string) => {
      const name = 'FlowCrypt_BACKUP_FILE_' + acctEmail.replace('[^a-z0-9]+', '') + '.txt';
      const backupText = await collectInfoForAccountBackup(acctEmail);
      Browser.saveToDownloads(new Att({ name, type: 'text/plain', data: Buf.fromUtfStr(backupText) }));
      await Ui.delay(1000);
    };

    const collectInfoForAccountBackup = async (acctEmail: string) => {
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
        'acctEmail: ' + acctEmail,
      ];
      const globalStorage = await Store.getGlobal(['version']);
      const acctStorage = await Store.getAcct(acctEmail, ['is_newly_created_key', 'setup_date', 'full_name']);
      text.push('global_storage: ' + JSON.stringify(globalStorage));
      text.push('account_storage: ' + JSON.stringify(acctStorage));
      text.push('');
      const keyinfos = await Store.keysGet(acctEmail);
      for (const keyinfo of keyinfos) {
        text.push('');
        text.push('key_longid: ' + keyinfo.longid);
        text.push('key_primary: ' + keyinfo.primary);
        text.push(keyinfo.private);
      }
      text.push('');
      return text.join('\n');
    };

  }

})();
