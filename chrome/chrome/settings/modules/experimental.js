/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

function collect_info_and_download_backup_file(account_email, callback) {
  let name = 'CryptUp_BACKUP_FILE_' + account_email.replace('[^a-z0-9]+', '') + '.txt';
  collect_info_for_account_backup(account_email, function (backup_text) {
    tool.file.save_to_downloads(name, 'text/plain', backup_text);
    if(callback) {
      setTimeout(callback, 1000);
    }
  });
}

function collect_info_for_account_backup(account_email, callback) {
  let text = [
    'This file contains sensitive information, please put it in a safe place.',
    '',
    'DO NOT DISPOSE OF THIS FILE UNLESS YOU KNOW WHAT YOU ARE DOING',
    '',
    'NOTE DOWN YOUR PASS PHRASE IN A SAFE PLACE THAT YOU CAN FIND LATER',
    '',
    'If this key was registered on a keyserver (typically they are), you will need this same key (and pass phrase!) to replace it.',
    'In other words, losing this key or pass phrase may cause people to have trouble writing you encrypted emails, even if you use another key (on CryptUp or elsewhere) later on!',
    '',
    'account_email: ' + account_email,
  ];
  window.flowcrypt_storage.get(null, ['version'], function (global_storage) {
    window.flowcrypt_storage.get(account_email, ['is_newly_created_key', 'setup_date', 'version', 'full_name'], function (account_storage) {
      text.push('global_storage: ' + JSON.stringify(global_storage));
      text.push('account_storage: ' + JSON.stringify(account_storage));
      text.push('');
      tool.each(window.flowcrypt_storage.keys_get(account_email), function (i, keyinfo) {
        text.push('');
        text.push('key_longid: ' + keyinfo.longid);
        text.push('key_primary: ' + keyinfo.primary);
        text.push(keyinfo.private);
      });
      text.push('');
      callback(text.join('\n'));
    });
  });
}


if(url_params.account_email) {
  window.flowcrypt_storage.get(null, ['dev_outlook_allow'], storage => {
    if(storage.dev_outlook_allow === true) {
      $('.action_allow_outlook').prop('checked', true);
    }
  });

  $('.email').text(url_params.account_email);

  $('.action_allow_outlook').change(function () {
    window.flowcrypt_storage.set(null, {'dev_outlook_allow': $(this).prop('checked')}, storage => {
      window.location.reload();
    });
  });

  $('.action_open_decrypt').click(function () {
    show_settings_page('/chrome/settings/modules/decrypt.htm');
  });

  $('.action_backup').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    collect_info_and_download_backup_file(url_params.account_email);
  }));

  $('.action_fetch_aliases').click(tool.ui.event.prevent(tool.ui.event.parallel(), function(self, id) {
    $(self).html(tool.ui.spinner('white'));
    fetch_account_aliases_from_gmail(url_params.account_email, function(addresses) {
      let all = tool.arr.unique(addresses.concat(url_params.account_email));
      window.flowcrypt_storage.set(url_params.account_email, { addresses: all }, function () {
        alert('Updated to: ' + all.join(', '));
        window.location.reload();
      });
    });
  }));

  $('.action_exception').click(function() {
    catcher.test();
  });

  $('.action_reset_account').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    if(confirm('This will remove all your CryptUp settings for ' + url_params.account_email + ' including your keys. It is not a recommended thing to do.\n\nMAKE SURE TO BACK UP YOUR PRIVATE KEY IN A SAFE PLACE FIRST OR YOU MAY LOSE IT')) {
      collect_info_and_download_backup_file(url_params.account_email, function () {
        if(confirm('Confirm? Don\'t come back telling me I didn\'t warn you.')) {
          reset_cryptup_account_storages(url_params.account_email, function () {
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
    tool.browser.message.send(url_params.parent_tab_id, 'redirect', {location: tool.env.url_create('/chrome/settings/inbox/inbox.htm', {account_email: url_params.account_email})});
  });

  $('.action_flush_attest_info').click(function () {
    window.flowcrypt_storage.remove(url_params.account_email, ['attests_requested', 'attests_processed', 'attest_log'], function () {
      alert('Internal attest info flushed');
      window.location.reload();
    });
  });

  $('.action_reset_managing_auth').click(() => {
    window.flowcrypt_storage.remove(null, ['cryptup_account_email', 'cryptup_account_subscription', 'cryptup_account_uuid', 'cryptup_account_verified'], () => {
      tool.browser.message.send(url_params.parent_tab_id, 'reload');
    });
  });

}