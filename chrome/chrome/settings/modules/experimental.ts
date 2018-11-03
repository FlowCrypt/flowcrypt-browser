/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/storage.js';
import { Catch, Env, Value, Attachment } from '../../../js/common/common.js';
import { Xss, Ui } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Settings } from '../settings.js';
import { Api } from '../../../js/common/api.js';

Catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  // this is for debugging
  if ((Value.is('mjkiaimhi').in(window.location.href) || Value.is('filter').in(['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com']))) {
    Xss.sanitize_append('.storage_link_container', ` - <a href="${Xss.html_escape(Env.url_create('/chrome/dev/storage.htm', {controls: true }))}">Storage</a>`);
  }

  if (account_email) {

    let {dev_outlook_allow} = await Store.get_global(['dev_outlook_allow']);
    if (dev_outlook_allow === true) {
      $('.action_allow_outlook').prop('checked', true);
    }

    $('.email').text(account_email);

    $('.action_allow_outlook').change(Ui.event.handle(async target => {
      await Store.set(null, {'dev_outlook_allow': $(target).prop('checked')});
      window.location.reload();
    }));

    $('.action_open_decrypt').click(Ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/decrypt.htm')));

    $('.action_open_decrypt_ignore_mdc').click(Ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/decrypt_ignore_mdc.htm')));

    $('.action_backup').click(Ui.event.prevent('double', () => collect_info_and_download_backup_file(account_email).catch(Catch.rejection)));

    $('.action_fetch_aliases').click(Ui.event.prevent('parallel', async (self, done) => {
      Xss.sanitize_render(self, Ui.spinner('white'));
      try {
        let all = await Settings.refresh_account_aliases(account_email);
        alert('Updated to: ' + all.join(', '));
      } catch(e) {
        if(Api.error.is_network_error(e)) {
          alert('Network error, please try again');
        } else if(Api.error.is_auth_popup_needed(e)) {
          alert('Error: account needs to be re-connected first.');
          BrowserMsg.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
        } else {
          Catch.handle_exception(e);
          alert(`Error happened: ${e.message}`);
        }
      }
      window.location.reload();
      done();
    }));

    $('.action_exception').click(() => Catch.test());

    $('.action_reset_account').click(Ui.event.prevent('double', async () => {
      if (confirm('This will remove all your FlowCrypt settings for ' + account_email + ' including your keys. It is not a recommended thing to do.\n\nMAKE SURE TO BACK UP YOUR PRIVATE KEY IN A SAFE PLACE FIRST OR YOU MAY LOSE IT')) {
        await collect_info_and_download_backup_file(account_email);
        if (confirm('Confirm? Don\'t come back telling me I didn\'t warn you.')) {
          await Settings.account_storage_reset(account_email);
          window.parent.location.reload();
        }
      }
    }));

    $('.action_attest_log').click(Ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/dev/storage.htm', Env.url_create('', {filter: account_email, keys: 'attest_log', title: `Attest Log - ${account_email}`}).replace('?', '&'))));

    $('.action_browser_modules').click(Ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/dev/modules.htm')));

    $('.action_flush_attest_info').click(Ui.event.handle(async () => {
      await Store.remove(account_email, ['attests_requested', 'attests_processed', 'attest_log']);
      alert('Internal attest info flushed');
      window.location.reload();
    }));

    $('.action_reset_managing_auth').click(Ui.event.handle(async () => {
      await Store.remove(null, ['cryptup_account_email', 'cryptup_account_subscription', 'cryptup_account_uuid']);
      BrowserMsg.send(parent_tab_id, 'reload');
    }));

    $('.action_make_google_auth_token_unusable').click(Ui.event.handle(async () => {
      await Store.set(account_email, {google_token_access: 'flowcrypt_test_bad_access_token'});
      BrowserMsg.send(parent_tab_id, 'reload');
    }));

    $('.action_make_google_refresh_token_unusable').click(Ui.event.handle(async () => {
      await Store.set(account_email, {google_token_refresh: 'flowcrypt_test_bad_refresh_token'});
      BrowserMsg.send(parent_tab_id, 'reload');
    }));

    $('.action_account_email_changed').click(Ui.event.handle(async () => {
      if(confirm(`Your current account email is ${account_email}.\n\nUse this when your Google Account email address has changed and the account above is outdated.\n\nIn the following step, please sign in with your updated Google Account.\n\nContinue?`)) {
        let tab_id = await BrowserMsg.required_tab_id();
        let response = await Api.google.auth_popup(account_email, tab_id);
        if (response && response.success === true && response.account_email) {
          if(response.account_email === account_email) {
            alert(`Account email address seems to be the same, nothing to update: ${account_email}`);
          } else if(response.account_email) {
            if(confirm(`Change your Google Account email from ${account_email} to ${response.account_email}?`)) {
              try {
                await Settings.account_storage_change_email(account_email, response.account_email);
                alert(`Email address changed to ${response.account_email}. You should now check that your public key is properly submitted.`);
                BrowserMsg.send(null, 'settings', {path: 'index.htm', page: '/chrome/settings/modules/keyserver.htm', account_email: response.account_email});
              } catch(e) {
                Catch.handle_exception(e);
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

    let collect_info_and_download_backup_file = async (account_email: string) => {
      let name = 'FlowCrypt_BACKUP_FILE_' + account_email.replace('[^a-z0-9]+', '') + '.txt';
      let backup_text = await collect_info_for_account_backup(account_email);
      Attachment.methods.save_to_downloads(new Attachment({name, type: 'text/plain', data: backup_text}));
      await Ui.delay(1000);
    };

    let collect_info_for_account_backup = async (account_email: string) => {
      let text = [
        'This file contains sensitive information, please put it in a safe place.',
        '',
        'DO NOT DISPOSE OF THIS FILE UNLESS YOU KNOW WHAT YOU ARE DOING',
        '',
        'NOTE DOWN YOUR PASS PHRASE IN A SAFE PLACE THAT YOU CAN FIND LATER',
        '',
        'If this key was registered on a keyserver (typically they are), you will need this same key (and pass phrase!) to replace it.',
        'In other words, losing this key or pass phrase may cause people to have trouble writing you encrypted emails, even if you use another key (on FlowCrypt or elsewhere) later on!',
        '',
        'account_email: ' + account_email,
      ];
      let global_storage = await Store.get_global(['version']);
      let account_storage = await Store.get_account(account_email, ['is_newly_created_key', 'setup_date', 'version', 'full_name']);
      text.push('global_storage: ' + JSON.stringify(global_storage));
      text.push('account_storage: ' + JSON.stringify(account_storage));
      text.push('');
      let keyinfos = await Store.keys_get(account_email);
      for (let keyinfo of keyinfos) {
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
