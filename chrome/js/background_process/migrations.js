/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

function migrate_account(data, sender, respond_done) {
  window.flowcrypt_storage.get(data.account_email, ['version'], function(account_storage) {
    window.flowcrypt_storage.set(data.account_email, { version: catcher.version('int') }, respond_done);
    account_update_status_pks(data.account_email);
    account_update_status_keyserver(data.account_email);
  });
}

function migrate_global(callback) {
  if(typeof callback === 'function') {
    callback();
  }
}

function account_update_status_keyserver(account_email) { // checks which emails were registered on Attester
  window.flowcrypt_storage.keys_get(account_email).then(keyinfos => {
    let my_longids = keyinfos.map(ki => ki.longid);
    window.flowcrypt_storage.get(account_email, ['addresses', 'addresses_keyserver'], function(storage) {
      if(storage.addresses && storage.addresses.length) {
        tool.api.attester.lookup_email(storage.addresses).then(function(results) {
          let addresses_keyserver = [];
          tool.each(results.results, function(i, result) {
            if(result && result.pubkey && tool.value(tool.crypto.key.longid(result.pubkey)).in(my_longids)) {
              addresses_keyserver.push(result.email);
            }
          });
          window.flowcrypt_storage.set(account_email, { addresses_keyserver: addresses_keyserver, });
        }, function(error) {});
      }
    });
  });
}

function account_update_status_pks(account_email) { // checks if any new emails were registered on pks lately
  window.flowcrypt_storage.keys_get(account_email).then(keyinfos => {
    let my_longids = keyinfos.map(ki => ki.longid);
    let hkp = new openpgp.HKP('http://keys.gnupg.net');
    window.flowcrypt_storage.get(account_email, ['addresses', 'addresses_pks'], function(storage) {
      let addresses_pks = storage.addresses_pks || [];
      tool.each(storage.addresses || [account_email], function(i, email) {
        if(!tool.value(email).in(addresses_pks)) {
          try {
            hkp.lookup({ query: email }).then(function(pubkey) {
              if(typeof pubkey !== 'undefined') {
                if(tool.value(tool.crypto.key.longid(pubkey)).in(my_longids)) {
                  addresses_pks.push(email);
                  console.log(email + ' newly found matching pubkey on PKS');
                  window.flowcrypt_storage.set(account_email, { addresses_pks: addresses_pks, });
                }
              }
            }).catch(function(error) {
              console.log('Error fetching keys from PKS: ' + error.message);
            });
          } catch(error) {
            console.log('Error2 fetching keys from PKS: ' + error.message);
          }
        }
      });
    });
  });
}

function schedule_cryptup_subscription_level_check() {
  setTimeout(function() {
    if(get_background_process_start_reason() === 'update' || get_background_process_start_reason() === 'chrome_update') {
      // update may happen to too many people at the same time -- server overload
      setTimeout(catcher.try(tool.api.cryptup.account_check_sync), tool.time.hours(Math.random() * 3)); // random 0-3 hours
    } else {
      // the user just installed the plugin or started their browser, no risk of overloading servers
      catcher.try(tool.api.cryptup.account_check_sync)(); // now
    }
  }, 10 * 60 * 1000); // 10 minutes
  setInterval(catcher.try(tool.api.cryptup.account_check_sync), tool.time.hours(23 + Math.random())); // random 23-24 hours
}