/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

function collect_info_and_download_backup_file(account_email, callback) {
  var name = 'CryptUp_BACKUP_FILE_' + account_email.replace('[^a-z0-9]+', '') + '.txt';
  collect_info_for_account_backup(account_email, function (backup_text) {
    tool.file.save_to_downloads(name, 'text/plain', backup_text);
    if(callback) {
      setTimeout(callback, 1000);
    }
  });
}

function collect_info_for_account_backup(account_email, callback) {
  var text = [
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
  account_storage_get(null, ['version'], function (global_storage) {
    account_storage_get(account_email, ['is_newly_created_key', 'setup_date', 'version', 'full_name'], function (account_storage) {
      text.push('global_storage: ' + JSON.stringify(global_storage));
      text.push('account_storage: ' + JSON.stringify(account_storage));
      text.push('');
      $.each(private_keys_get(account_email), function (i, keyinfo) {
        text.push('');
        text.push('key_longid: ' + keyinfo.longid);
        text.push('key_primary: ' + keyinfo.primary);
        text.push(keyinfo.armored);
      });
      text.push('');
      callback(text.join('\n'));
    });
  });
}


if(url_params.account_email) {

  $('.email').text(url_params.account_email);

  $('.action_open_decrypt').click(function () {
    show_settings_page('/chrome/settings/modules/decrypt.htm');
  });

  $('.action_backup').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    collect_info_and_download_backup_file(url_params.account_email);
  }));

  $('.action_fetch_aliases').click(tool.ui.event.prevent(tool.ui.event.parallel(), function(self, id) {
    $(self).html(tool.ui.spinner('white'));
    fetch_account_aliases(url_params.account_email, function(addresses) {
      var all = tool.arr.unique(addresses.concat(url_params.account_email));
      account_storage_set(url_params.account_email, { addresses: all }, function () {
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

}