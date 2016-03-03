'use strict';

function migrate(signal_data) {
  migrate_040_050(signal_data.account_email, function() {
    migrate_060_070(signal_data.account_email, function() {
      migrate_070_080(signal_data.account_email, function() {
        account_storage_set(null, {
          version: Number(chrome.runtime.getManifest().version.replace('.', ''))
        }, function() {
          signal_send('gmail_tab', 'migrated', {}, signal_data.reply_to_signal_scope);
        });
      });
    });
  });
}

function migrate_040_050(account_email, then) {
  console.log('migrate_040_050');
  chrome.storage.local.get(['cryptup_setup_done'], function(storage) {
    if(storage['cryptup_setup_done'] === true) {
      console.log('migrating from 0.4 to 0.5: global to per_account settings');
      account_storage_set(account_email, {
        setup_done: true
      }, function() {
        chrome.storage.local.remove('cryptup_setup_done', then);
      });
    } else {
      then();
    }
  });
}

function migrate_060_070(account_email, then) {
  console.log('migrate_060_070');
  var legacy_master_private_key = localStorage.master_private_key;
  var legacy_master_public_key = localStorage.master_public_key;
  var legacy_master_passphrase = localStorage.master_passphrase;
  var legacy_master_public_key_submit = localStorage.master_public_key_submit;
  var legacy_master_public_key_submitted = localStorage.master_public_key_submitted;
  if(typeof legacy_master_private_key !== 'undefined' && legacy_master_private_key && legacy_master_private_key.indexOf('-----BEGIN PGP PRIVATE KEY BLOCK-----') !== -1) {
    account_storage_get(null, ['account_emails'], function(storage) {
      console.log('migrating from 0.6 to 0.7: global to per_account keys for accounts: ' + storage['account_emails']);
      var account_emails = JSON.parse(storage['account_emails']);
      for(var i = 0; i < account_emails.length; i++) {
        if(typeof restricted_account_storage_get(account_emails[i], 'master_private_key') === 'undefined') {
          restricted_account_storage_set(account_emails[i], 'master_private_key', legacy_master_private_key);
          restricted_account_storage_set(account_emails[i], 'master_public_key', legacy_master_public_key);
          restricted_account_storage_set(account_emails[i], 'master_passphrase', legacy_master_passphrase);
          restricted_account_storage_set(account_emails[i], 'master_public_key_submit', legacy_master_public_key_submit);
          restricted_account_storage_set(account_emails[i], 'master_public_key_submitted', legacy_master_public_key_submitted);
        }
      }
      localStorage.removeItem("master_private_key");
      localStorage.removeItem("master_public_key");
      localStorage.removeItem("master_passphrase");
      localStorage.removeItem("master_public_key_submit");
      localStorage.removeItem("master_public_key_submitted");
      then();
    });
  } else {
    then();
  }
}

function migrate_070_080(account_email, then) {
  console.log('migrate_070_080');
  account_storage_get(account_email, ['setup_done', 'setup_simple'], function(storage) {
    if(typeof storage.setup_simple === 'undefined' && storage.setup_done === true) {
      console.log('migrating from 0.70 to 0.80: setting setup_simple');
      account_storage_set(account_email, {
        notification_setup_done_seen: true,
        setup_simple: (restricted_account_storage_get('master_public_key_submit') === true && !restricted_account_storage_get('master_passphrase')),
      }, then);
    } else {
      then();
    }
  });
}
