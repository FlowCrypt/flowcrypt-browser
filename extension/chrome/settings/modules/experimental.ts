/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Value } from '../../../js/common/common.js';
import { Att } from '../../../js/common/att.js';
import { Xss, Ui, Env, Browser } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Settings } from '../../../js/common/settings.js';
import { Api } from '../../../js/common/api.js';
import { Lang } from '../../../js/common/lang.js';
import { Catch } from '../../../js/common/catch.js';

Catch.try(async () => {

  const urlParams = Env.urlParams(['acctEmail', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  const parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  // this is for debugging
  if ((Value.is('mjkiaimhi').in(window.location.href) || Value.is('filter').in(['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com']))) {
    Xss.sanitizeAppend('.storage_link_container', ` - <a href="${Xss.escape(Env.urlCreate('/chrome/dev/storage.htm', { controls: true }))}">Storage</a>`);
  }

  if (acctEmail) {

    const { dev_outlook_allow } = await Store.getGlobal(['dev_outlook_allow']);
    if (dev_outlook_allow === true) {
      $('.action_allow_outlook').prop('checked', true);
    }

    $('.email').text(acctEmail);

    $('.action_allow_outlook').change(Ui.event.handle(async target => {
      await Store.set(null, { 'dev_outlook_allow': $(target).prop('checked') });
      window.location.reload();
    }));

    $('.action_open_decrypt').click(Ui.event.handle(() => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/decrypt.htm')));

    $('.action_open_decrypt_ignore_mdc').click(Ui.event.handle(() => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/settings/modules/decrypt_ignore_mdc.htm')));

    $('.action_backup').click(Ui.event.prevent('double', () => collectInfoAndDownloadBackupFile(acctEmail).catch(Catch.rejection)));

    $('.action_fetch_aliases').click(Ui.event.prevent('parallel', async (self, done) => {
      Xss.sanitizeRender(self, Ui.spinner('white'));
      try {
        const all = await Settings.refreshAcctAliases(acctEmail);
        alert('Updated to: ' + all.join(', '));
      } catch (e) {
        if (Api.err.isNetErr(e)) {
          alert('Network error, please try again');
        } else if (Api.err.isAuthPopupNeeded(e)) {
          alert('Error: account needs to be re-connected first.');
          BrowserMsg.send(parentTabId, 'notification_show_auth_popup_needed', { acctEmail });
        } else {
          Catch.handleException(e);
          alert(`Error happened: ${e.message}`);
        }
      }
      window.location.reload();
      done();
    }));

    $('.action_exception').click(() => Catch.test());

    $('.action_reset_account').click(Ui.event.prevent('double', async () => {
      if (confirm(Lang.setup.confirmResetAcct(acctEmail))) {
        await collectInfoAndDownloadBackupFile(acctEmail);
        if (confirm('Confirm? Don\'t come back telling me I didn\'t warn you.')) {
          await Settings.acctStorageReset(acctEmail);
          window.parent.location.reload();
        }
      }
    }));

    $('.action_attest_log').click(Ui.event.handle(() => Settings.redirectSubPage(acctEmail, parentTabId, '/chrome/dev/storage.htm', Env.urlCreate('', {
      filter: acctEmail,
      keys: 'attest_log',
      title: `Attest Log - ${acctEmail}`,
    }).replace('?', '&'))));

    $('.action_flush_attest_info').click(Ui.event.handle(async () => {
      await Store.remove(acctEmail, ['attests_requested', 'attests_processed', 'attest_log']);
      alert('Internal attest info flushed');
      window.location.reload();
    }));

    $('.action_reset_managing_auth').click(Ui.event.handle(async () => {
      await Store.remove(null, ['cryptup_account_email', 'cryptup_account_subscription', 'cryptup_account_uuid']);
      BrowserMsg.send(parentTabId, 'reload');
    }));

    $('.action_make_google_auth_token_unusable').click(Ui.event.handle(async () => {
      await Store.set(acctEmail, { google_token_access: 'flowcrypt_test_bad_access_token' });
      BrowserMsg.send(parentTabId, 'reload');
    }));

    $('.action_make_google_refresh_token_unusable').click(Ui.event.handle(async () => {
      await Store.set(acctEmail, { google_token_refresh: 'flowcrypt_test_bad_refresh_token' });
      BrowserMsg.send(parentTabId, 'reload');
    }));

    $('.action_account_email_changed').click(Ui.event.handle(async () => {
      if (confirm(Lang.setup.confirmManualAcctEmailChange(acctEmail))) {
        const tabId = await BrowserMsg.requiredTabId();
        const response = await Api.google.authPopup(acctEmail, tabId);
        if (response && response.success === true && response.acctEmail) {
          if (response.acctEmail === acctEmail) {
            alert(`Account email address seems to be the same, nothing to update: ${acctEmail}`);
          } else if (response.acctEmail) {
            if (confirm(`Change your Google Account email from ${acctEmail} to ${response.acctEmail}?`)) {
              try {
                await Settings.acctStorageChangeEmail(acctEmail, response.acctEmail);
                alert(`Email address changed to ${response.acctEmail}. You should now check that your public key is properly submitted.`);
                BrowserMsg.send(null, 'settings', { path: 'index.htm', page: '/chrome/settings/modules/keyserver.htm', acctEmail: response.acctEmail });
              } catch (e) {
                Catch.handleException(e);
                alert('There was an error changing google account, please write human@flowcrypt.com');
              }
            }
          } else {
            alert('Not able to retrieve new account email, please write at human@flowcrypt.com');
          }
        } else if (response && response.success === false && ((response.result === 'Denied' && response.error === 'access_denied') || response.result === 'Closed')) {
          alert('Canceled by user, skippoing.');
        } else {
          Catch.log('failed to log into google', response);
          alert('Failed to connect to Gmail. Please try again. If this happens repeatedly, please write us at human@flowcrypt.com.');
          window.location.reload();
        }
      }
    }));

    const collectInfoAndDownloadBackupFile = async (acctEmail: string) => {
      const name = 'FlowCrypt_BACKUP_FILE_' + acctEmail.replace('[^a-z0-9]+', '') + '.txt';
      const backupText = await collectInfoForAccountBackup(acctEmail);
      Browser.saveToDownloads(new Att({ name, type: 'text/plain', data: backupText }));
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
      const acctStorage = await Store.getAcct(acctEmail, ['is_newly_created_key', 'setup_date', 'version', 'full_name']);
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
