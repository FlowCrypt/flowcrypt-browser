/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  // this is for debugging
  if ((tool.value('mjkiaimhi').in(window.location.href) || tool.value('filter').in(['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com']))) {
    $('.storage_link_container').append(' - <a href="' + tool.env.url_create('/chrome/dev/storage.htm', {controls: true, }) + '">Storage</a>');
  }

  if (account_email) {

    let {dev_outlook_allow} = await Store.get_global(['dev_outlook_allow']);
    if (dev_outlook_allow === true) {
      $('.action_allow_outlook').prop('checked', true);
    }

    $('.email').text(account_email);

    $('.action_allow_outlook').change(tool.ui.event.handle(async target => {
      await Store.set(null, {'dev_outlook_allow': $(target).prop('checked')});
      window.location.reload();
    }));

    $('.action_open_decrypt').click(tool.ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/decrypt.htm')));

    $('.action_open_decrypt_ignore_mdc').click(tool.ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/decrypt_ignore_mdc.htm')));

    $('.action_backup').click(tool.ui.event.prevent(tool.ui.event.double(), () => collect_info_and_download_backup_file(account_email).catch(tool.catch.rejection)));

    $('.action_fetch_aliases').click(tool.ui.event.prevent(tool.ui.event.parallel(), async self => {
      $(self).html(tool.ui.spinner('white'));
      try {
        let addresses = await Settings.fetch_account_aliases_from_gmail(account_email);
        let all = tool.arr.unique(addresses.concat(account_email));
        await Store.set(account_email, { addresses: all });
        alert('Updated to: ' + all.join(', '));
      } catch(e) {
        if(tool.api.error.is_network_error(e)) {
          alert('Network error, please try again');
        } else if(tool.api.error.is_auth_popup_needed(e)) {
          alert('Error: account needs to be re-connected first.');
          tool.browser.message.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
        } else {
          tool.catch.handle_exception(e);
          alert(`Error happened: ${e.message}`);
        }
      }
      window.location.reload();

    }));

    $('.action_exception').click(() => tool.catch.test());

    $('.action_reset_account').click(tool.ui.event.prevent(tool.ui.event.double(), async () => {
      if (confirm('This will remove all your FlowCrypt settings for ' + account_email + ' including your keys. It is not a recommended thing to do.\n\nMAKE SURE TO BACK UP YOUR PRIVATE KEY IN A SAFE PLACE FIRST OR YOU MAY LOSE IT')) {
        await collect_info_and_download_backup_file(account_email);
        if (confirm('Confirm? Don\'t come back telling me I didn\'t warn you.')) {
          await Settings.reset_cryptup_account_storages(account_email);
          window.parent.location.reload();
        }
      }
    }));

    $('.action_attest_log').click(tool.ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/dev/storage.htm', tool.env.url_create('', {filter: account_email, keys: 'attest_log', title: `Attest Log - ${account_email}`}).replace('?', '&'))));

    $('.action_email_client').click(tool.ui.event.handle(() => tool.browser.message.send(parent_tab_id, 'redirect', {location: tool.env.url_create('/chrome/settings/inbox/inbox.htm', {account_email})})));

    $('.action_flush_attest_info').click(tool.ui.event.handle(async () => {
      await Store.remove(account_email, ['attests_requested', 'attests_processed', 'attest_log']);
      alert('Internal attest info flushed');
      window.location.reload();
    }));

    $('.action_reset_managing_auth').click(tool.ui.event.handle(async () => {
      await Store.remove(null, ['cryptup_account_email', 'cryptup_account_subscription', 'cryptup_account_uuid', 'cryptup_account_verified']);
      tool.browser.message.send(parent_tab_id, 'reload');
    }));

    $('.action_make_google_auth_token_unusable').click(tool.ui.event.handle(async () => {
      await Store.set(account_email, {google_token_access: 'flowcrypt_test_bad_access_token'});
      tool.browser.message.send(parent_tab_id, 'reload');
    }));

    $('.action_make_google_refresh_token_unusable').click(tool.ui.event.handle(async () => {
      await Store.set(account_email, {google_token_refresh: 'flowcrypt_test_bad_refresh_token'});
      tool.browser.message.send(parent_tab_id, 'reload');
    }));

    let collect_info_and_download_backup_file = async (account_email: string) => {
      let name = 'FlowCrypt_BACKUP_FILE_' + account_email.replace('[^a-z0-9]+', '') + '.txt';
      let backup_text = await collect_info_for_account_backup(account_email);
      tool.file.save_to_downloads(new Attachment({name, type: 'text/plain', data: backup_text}));
      await tool.ui.delay(1000);
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
