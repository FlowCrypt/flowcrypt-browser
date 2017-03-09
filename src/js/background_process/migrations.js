/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function migrate_account(data, sender, respond_done) {
  account_storage_get(data.account_email, ['version'], function (account_storage) {
    // if account_storage.version < ....
    account_storage_set(data.account_email, { version: catcher.version('int') }, respond_done);
    account_consistency_fixes(data.account_email);
    account_update_status_pks(data.account_email);
    account_update_status_keyserver(data.account_email);
  });
}

function migrate_global(callback) {
  account_storage_get(null, ['version'], function (global_storage) {
    if((!global_storage.version || global_storage.version < 300) && typeof localStorage.pubkey_cache !== 'undefined') {
      global_migrate_v_300(callback);
    } else {
      callback();
    }
  });
}

function global_migrate_v_300(callback) {
  console.log('global_migrate_v_300: contacts pubkey_cache to indexedDB');
  db_open(function (db) {
    var tx = db.transaction('contacts', 'readwrite');
    var contacts = tx.objectStore('contacts');
    $.each(JSON.parse(localStorage.pubkey_cache || '{}'), function (email, contact) {
      if(typeof email === 'string') {
        contacts.put(db_contact_object(email, null, contact.has_cryptup ? 'cryptup' : 'pgp', contact.pubkey, contact.attested, false, Date.now()));
      }
    });
    tx.oncomplete = function () {
      delete localStorage.pubkey_cache;
      callback();
    };
  });
}

function account_consistency_fixes(account_email) {
  account_storage_get(account_email, ['setup_done'], function (storage) {
    // re-submitting pubkey if failed
    if(storage.setup_done && private_storage_get('local', account_email, 'master_public_key_submit') && !private_storage_get('local', account_email, 'master_public_key_submitted')) {
      console.log('consistency_fixes: submitting pubkey');
      tool.api.attester.initial_legacy_submit(account_email, private_storage_get('local', account_email, 'master_public_key'), false, function (success, response) {
        if(success && response.saved) {
          private_storage_set('local', account_email, 'master_public_key_submitted', true);
        }
      });
    }
  });
}

function account_update_status_keyserver(account_email) { // checks which emails were registered on cryptup keyserver.
  var my_longids = tool.arr.select(private_keys_get(account_email), 'longid');
  account_storage_get(account_email, ['addresses', 'addresses_keyserver'], function (storage) {
    if(storage.addresses && storage.addresses.length) {
      tool.api.attester.lookup_email(storage.addresses, function (success, results) {
        if(success) {
          var addresses_keyserver = [];
          $.each(results.results, function (i, result) {
            if(result && result.pubkey && tool.value(tool.crypto.key.longid(result.pubkey)).in(my_longids)) {
              addresses_keyserver.push(result.email);
            }
          });
          account_storage_set(account_email, { addresses_keyserver: addresses_keyserver, });
        }
      });
    }
  });
}

function account_update_status_pks(account_email) { // checks if any new emails were registered on pks lately
  var my_longids = tool.arr.select(private_keys_get(account_email), 'longid');
  var hkp = new openpgp.HKP('http://keys.gnupg.net');
  account_storage_get(account_email, ['addresses', 'addresses_pks'], function (storage) {
    var addresses_pks = storage.addresses_pks || [];
    $.each(storage.addresses || [account_email], function (i, email) {
      if(!tool.value(email).in(addresses_pks)) {
        try {
          hkp.lookup({ query: email }).then(function (pubkey) {
            if(typeof pubkey !== 'undefined') {
              if(tool.value(tool.crypto.key.longid(pubkey)).in(my_longids)) {
                addresses_pks.push(email);
                console.log(email + ' newly found matching pubkey on PKS');
                account_storage_set(account_email, { addresses_pks: addresses_pks, });
              }
            }
          }).catch(function (error) {
            console.log('Error fetching keys from PKS: ' + error.message);
          });
        } catch(error) {
          console.log('Error2 fetching keys from PKS: ' + error.message);
        }
      }
    });
  });
}

function schedule_keyserver_fingerprint_check() {
  setTimeout(function() {
    if(get_background_process_start_reason() === 'update' || get_background_process_start_reason() === 'chrome_update') {
      // update may happen to many people at the same time -- server overload
      setInterval(catcher.try(tool.diagnose.keyserver_fingerprints), tool.time.hours(Math.random() * 3)); // random 0-3 hours
    } else {
      // the user just installed the plugin or started their browser, no risk of overloading servers
      catcher.try(tool.diagnose.keyserver_fingerprints)(); // now
    }
  }, 10 * 60 * 1000); // 10 minutes
  setInterval(catcher.try(tool.diagnose.keyserver_fingerprints), tool.time.hours(23 + Math.random())); // random 23-24 hours
}

function cryptup_subscription_level_update() {
  get_account_emails(function(emails) {
    tool.api.cryptup.account_check(emails, function(success, result) {
      if(success) {
        storage_cryptup_auth_info(function (cryptup_account_email, cryptup_account_uuid, cryptup_account_verified) {
          storage_cryptup_subscription(function(stored_level, stored_expire, stored_active) {
            var local_storage_update = {};
            if(result.email && result.subscription && result.subscription.level !== stored_level) {
              local_storage_update['cryptup_account_subscription'] = result.subscription;
            }
            if(result.email && !cryptup_account_email) { // this will of course fail on the server. The user will be prompted to verify this new device when that happens.
              local_storage_update['cryptup_account_email'] = result.email;
              local_storage_update['cryptup_account_uuid'] = tool.crypto.hash.sha1(tool.str.random(40));
              local_storage_update['cryptup_account_verified'] = 'true';
            }
            if(Object.keys(local_storage_update).length) {
              catcher.info('updating account subscription from ' + stored_level + ' to ' + result.subscription.level, result);
              account_storage_set(null, local_storage_update);
            }
          });
        });
      } else {
        catcher.info('could not check account subscription', result);
      }
    });
  });
}

function schedule_cryptup_subscription_level_check() {
  setTimeout(function() {
    if(get_background_process_start_reason() === 'update' || get_background_process_start_reason() === 'chrome_update') {
      // update may happen to too many people at the same time -- server overload
      setInterval(catcher.try(cryptup_subscription_level_update), tool.time.hours(Math.random() * 3)); // random 0-3 hours
    } else {
      // the user just installed the plugin or started their browser, no risk of overloading servers
      catcher.try(cryptup_subscription_level_update)(); // now
    }
  }, 10 * 60 * 1000); // 10 minutes
  setInterval(catcher.try(cryptup_subscription_level_update), tool.time.hours(23 + Math.random())); // random 23-24 hours
}