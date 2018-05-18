/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

  // this is for debugging
  if((tool.value('mjkiaimhi').in(window.location.href) || tool.value('filter').in(['info@nvimp.com', 'human@flowcrypt.com', 'flowcrypt.compatibility@gmail.com']))) {
    $('.storage_link_container').append(' - <a href="' + tool.env.url_create('/chrome/dev/storage.htm', {controls: true, }) + '">Storage</a>');
  }
  
  function collect_info_and_download_backup_file(account_email: string, callback?: VoidCallback) {
    let name = 'FlowCrypt_BACKUP_FILE_' + account_email.replace('[^a-z0-9]+', '') + '.txt';
    collect_info_for_account_backup(account_email, function (backup_text: string) {
      tool.file.save_to_downloads(name, 'text/plain', backup_text);
      if(callback) {
        setTimeout(callback, 1000);
      }
    });
  }
  
  function collect_info_for_account_backup(account_email: string, callback: (backup_text: string) => void) {
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
    Store.get_global(['version']).then(function (global_storage) {
      Store.get_account(account_email, ['is_newly_created_key', 'setup_date', 'version', 'full_name']).then(function (account_storage) {
        text.push('global_storage: ' + JSON.stringify(global_storage));
        text.push('account_storage: ' + JSON.stringify(account_storage));
        text.push('');
        Store.keys_get(account_email).then(keyinfos => {
          for(let keyinfo of keyinfos) {
            text.push('');
            text.push('key_longid: ' + keyinfo.longid);
            text.push('key_primary: ' + keyinfo.primary);
            text.push(keyinfo.private);
          }
          text.push('');
          callback(text.join('\n'));
        });
      });
    });
  }
  
  
  if(url_params.account_email) {
    Store.get_global(['dev_outlook_allow']).then(storage => {
      if(storage.dev_outlook_allow === true) {
        $('.action_allow_outlook').prop('checked', true);
      }
    });
  
    $('.email').text(url_params.account_email as string);
  
    $('.action_allow_outlook').change(function () {
      Store.set(null, {'dev_outlook_allow': $(this).prop('checked')}).then(() => window.location.reload());
    });
  
    $('.action_open_decrypt').click(function () {
      show_settings_page('/chrome/settings/modules/decrypt.htm');
    });
  
    $('.action_backup').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
      collect_info_and_download_backup_file(url_params.account_email as string);
    }));
  
    $('.action_fetch_aliases').click(tool.ui.event.prevent(tool.ui.event.parallel(), function(self, id) {
      $(self).html(tool.ui.spinner('white'));
      fetch_account_aliases_from_gmail(url_params.account_email as string, function(addresses) {
        let all = tool.arr.unique(addresses.concat(url_params.account_email));
        Store.set(url_params.account_email as string, { addresses: all }).then(function () {
          alert('Updated to: ' + all.join(', '));
          window.location.reload();
        });
      });
    }));
  
    $('.action_exception').click(function() {
      catcher.test();
    });
  
    $('.action_reset_account').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
      if(confirm('This will remove all your FlowCrypt settings for ' + url_params.account_email + ' including your keys. It is not a recommended thing to do.\n\nMAKE SURE TO BACK UP YOUR PRIVATE KEY IN A SAFE PLACE FIRST OR YOU MAY LOSE IT')) {
        collect_info_and_download_backup_file(url_params.account_email as string, function () {
          if(confirm('Confirm? Don\'t come back telling me I didn\'t warn you.')) {
            reset_cryptup_account_storages(url_params.account_email as string, function () {
              window.parent.location.reload();
            });
          }
        });
      }
    }));
  
    $('.action_attest_log').click(function () {
      show_settings_page('/chrome/dev/storage.htm', tool.env.url_create('', {filter: url_params.account_email, keys: 'attest_log', title: 'Attest Log - ' + url_params.account_email}).replace('?', '&'));
    });
  
    $('.action_email_client').click(function () {
      tool.browser.message.send(url_params.parent_tab_id as string, 'redirect', {location: tool.env.url_create('/chrome/settings/inbox/inbox.htm', {account_email: url_params.account_email})});
    });
  
    $('.action_flush_attest_info').click(function () {
      Store.remove(url_params.account_email as string, ['attests_requested', 'attests_processed', 'attest_log']).then(function () {
        alert('Internal attest info flushed');
        window.location.reload();
      });
    });
  
    $('.action_reset_managing_auth').click(() => {
      Store.remove(null, ['cryptup_account_email', 'cryptup_account_subscription', 'cryptup_account_uuid', 'cryptup_account_verified']).then(() => {
        tool.browser.message.send(url_params.parent_tab_id as string, 'reload');
      });
    });
  
  }

})();

