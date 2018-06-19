/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

  // this is for debugging
  if((tool.value('mjkiaimhi').in(window.location.href) || tool.value('filter').in(['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com']))) {
    $('.storage_link_container').append(' - <a href="' + tool.env.url_create('/chrome/dev/storage.htm', {controls: true, }) + '">Storage</a>');
  }
  
  if(url_params.account_email) {

    let {dev_outlook_allow} = await Store.get_global(['dev_outlook_allow']);
    if(dev_outlook_allow === true) {
      $('.action_allow_outlook').prop('checked', true);
    }
  
    $('.email').text(url_params.account_email as string);
  
    $('.action_allow_outlook').change(function () {
      Store.set(null, {'dev_outlook_allow': $(this).prop('checked')}).then(() => window.location.reload());
    });
  
    $('.action_open_decrypt').click(function () {
      show_settings_page('/chrome/settings/modules/decrypt.htm');
    });

    $('.action_open_decrypt_ignore_mdc').click(function () {
      show_settings_page('/chrome/settings/modules/decrypt_ignore_mdc.htm');
    });
  
    $('.action_backup').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
      collect_info_and_download_backup_file(url_params.account_email as string);
    }));
  
    $('.action_fetch_aliases').click(tool.ui.event.prevent(tool.ui.event.parallel(), async self => {
      $(self).html(tool.ui.spinner('white'));
      let addresses = await fetch_account_aliases_from_gmail(url_params.account_email as string);
      let all = tool.arr.unique(addresses.concat(url_params.account_email as string));
      await Store.set(url_params.account_email as string, { addresses: all })
      alert('Updated to: ' + all.join(', '));
      window.location.reload();
    }));
  
    $('.action_exception').click(() => tool.catch.test());
  
    $('.action_reset_account').click(tool.ui.event.prevent(tool.ui.event.double(), async () => {
      if(confirm('This will remove all your FlowCrypt settings for ' + url_params.account_email + ' including your keys. It is not a recommended thing to do.\n\nMAKE SURE TO BACK UP YOUR PRIVATE KEY IN A SAFE PLACE FIRST OR YOU MAY LOSE IT')) {
        await collect_info_and_download_backup_file(url_params.account_email as string);
        if(confirm('Confirm? Don\'t come back telling me I didn\'t warn you.')) {
          reset_cryptup_account_storages(url_params.account_email as string, () => window.parent.location.reload());
        }
      }
    }));
  
    $('.action_attest_log').click(function () {
      show_settings_page('/chrome/dev/storage.htm', tool.env.url_create('', {filter: url_params.account_email, keys: 'attest_log', title: 'Attest Log - ' + url_params.account_email}).replace('?', '&'));
    });
  
    $('.action_email_client').click(function () {
      tool.browser.message.send(url_params.parent_tab_id as string, 'redirect', {location: tool.env.url_create('/chrome/settings/inbox/inbox.htm', {account_email: url_params.account_email})});
    });
  
    $('.action_flush_attest_info').click(async () => {
      await Store.remove(url_params.account_email as string, ['attests_requested', 'attests_processed', 'attest_log']);
      alert('Internal attest info flushed');
      window.location.reload();
    });
  
    $('.action_reset_managing_auth').click(async () => {
      await Store.remove(null, ['cryptup_account_email', 'cryptup_account_subscription', 'cryptup_account_uuid', 'cryptup_account_verified']);
      tool.browser.message.send(url_params.parent_tab_id as string, 'reload');
    });
  
    $('.action_make_google_auth_token_unusable').click(async () => {
      await Store.set(url_params.account_email as string, {google_token_access: 'flowcrypt_test_bad_access_token'});
      tool.browser.message.send(url_params.parent_tab_id as string, 'reload');
    });

    $('.action_make_google_refresh_token_unusable').click(async () => {
      await Store.set(url_params.account_email as string, {google_token_refresh: 'flowcrypt_test_bad_refresh_token'})
      tool.browser.message.send(url_params.parent_tab_id as string, 'reload');
    });

    async function collect_info_and_download_backup_file(account_email: string) {
      let name = 'FlowCrypt_BACKUP_FILE_' + account_email.replace('[^a-z0-9]+', '') + '.txt';
      let backup_text = await collect_info_for_account_backup(account_email);
      tool.file.save_to_downloads(name, 'text/plain', backup_text);
      await tool.ui.delay(1000);
    }
    
    async function collect_info_for_account_backup(account_email: string) {
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
      for(let keyinfo of keyinfos) {
        text.push('');
        text.push('key_longid: ' + keyinfo.longid);
        text.push('key_primary: ' + keyinfo.primary);
        text.push(keyinfo.private);
      }
      text.push('');
      return text.join('\n');
    }

  }

})();

