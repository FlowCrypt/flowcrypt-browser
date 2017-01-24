/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function migrate_account(data, sender, respond_done) {
  account_storage_get(data.account_email, ['version'], function(account_storage) {
    // if account_storage.version < ....
    account_storage_set(data.account_email, {
      version: cryptup_version_integer(),
    }, respond_done);
    account_consistency_fixes(data.account_email);
    account_update_status_pks(data.account_email);
    account_update_status_keyserver(data.account_email);
  });
}

function migrate_global(callback) {
  account_storage_get(null, ['version'], function(global_storage) {
    if((!global_storage.version || global_storage.version < 300) && typeof localStorage.pubkey_cache !== 'undefined') {
      global_migrate_v_300(callback);
    } else {
      callback();
    }
  });
}

function global_migrate_v_300(callback) {
  console.log('global_migrate_v_300: contacts pubkey_cache to indexedDB');
  db_open(function(db) {
    var tx = db.transaction('contacts', 'readwrite');
    var contacts = tx.objectStore('contacts');
    $.each(JSON.parse(localStorage.pubkey_cache || '{}'), function(email, contact) {
      contacts.put(db_contact_object(email, null, contact.has_cryptup ? 'cryptup' : 'pgp', contact.pubkey, contact.attested, false, Date.now()));
    });
    tx.oncomplete = function() {
      delete localStorage.pubkey_cache;
      callback();
    };
  });
}

function account_consistency_fixes(account_email) {
  account_storage_get(account_email, ['setup_done'], function(storage) {
    // re-submitting pubkey if failed
    if(storage.setup_done && private_storage_get('local', account_email, 'master_public_key_submit') && !private_storage_get('local', account_email, 'master_public_key_submitted')) {
      console.log('consistency_fixes: submitting pubkey');
      keyserver_keys_submit(account_email, private_storage_get('local', account_email, 'master_public_key'), false, function(success, response) {
        if(success && response.saved) {
          private_storage_set('local', account_email, 'master_public_key_submitted', true);
        }
      });
    }
  });
}

function account_update_status_keyserver(account_email) { // checks which emails were registered on cryptup keyserver.
  var my_longids = private_keys_get(account_email).map(map_select('longid'));
  account_storage_get(account_email, ['addresses', 'addresses_keyserver'], function(storage) {
    if(storage.addresses && storage.addresses.length) {
      keyserver_keys_find(storage.addresses, function(success, results) {
        if(success) {
          var addresses_keyserver = [];
          $.each(results.results, function(i, result) {
            if(result && result.pubkey && my_longids.indexOf(key_longid(result.pubkey)) !== -1) {
              addresses_keyserver.push(result.email);
            }
          });
          account_storage_set(account_email, {
            addresses_keyserver: addresses_keyserver,
          });
        }
      });
    }
  });
}

function account_update_status_pks(account_email) { // checks if any new emails were registered on pks lately
  var my_longids = private_keys_get(account_email).map(map_select('longid'));
  var hkp = new openpgp.HKP('http://keys.gnupg.net');
  account_storage_get(account_email, ['addresses', 'addresses_pks'], function(storage) {
    var addresses_pks = storage.addresses_pks || [];
    $.each(storage.addresses || [account_email], function(i, email) {
      if(addresses_pks.indexOf(email) === -1) {
        hkp.lookup({
          query: email
        }).then(function(pubkey) {
          if(typeof pubkey !== 'undefined') {
            if(my_longids.indexOf(key_longid(pubkey)) !== -1) {
              addresses_pks.push(email);
              console.log(email + ' newly found matching pubkey on PKS');
              account_storage_set(account_email, {
                addresses_pks: addresses_pks,
              });
            }
          }
        }).catch(function(error) {
          console.log('Error fetching keys from PKS: ' + error.message);
        });
      }
    });
  });
}
