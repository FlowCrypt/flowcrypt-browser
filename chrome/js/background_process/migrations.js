/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

function migrate_account(data, sender, respond_done) {
  account_storage_get(data.account_email, ['version'], function(account_storage) {
    // if account_storage.version < ....
    account_storage_set(data.account_email, { version: catcher.version('int') }, respond_done);
    account_consistency_fixes(data.account_email);
    account_update_status_pks(data.account_email);
    account_update_status_keyserver(data.account_email);
  });
}

function migrate_global(callback) {
  account_storage_get(null, ['version'], function(global_storage) {
    if(!localStorage.resolved_naked_key_vulnerability) {
      catcher.log('checking NKV');
      global_migrate_v_422(function(resolved) {
        catcher.log('NKV result/resolved: ' + resolved);
        if(!resolved) {
          setTimeout(migrate_global, tool.time.hours(1)); // try again in an hour - maybe there was no internet just now, or pass phrase not present
        } else {
          localStorage.resolved_naked_key_vulnerability = true;
        }
        if(typeof callback === 'function') {
          callback();
        }
      });
    } else {
      if(typeof callback === 'function') {
        callback();
      }
    }
  });
}

function global_migrate_v_422(callback) {
  // for a short period, keys that were recovered from email backups would be stored without encryption. The code below fixes it retroactively
  // this only affected users on machines that were recovered from a backup email who choose to keep pass phrase in session only
  // the result was that although they specifically selected not to store their pass phrase, the key would not actually need it, defying the point
  // this vulnerability could only be exploited if the attacker first compromises their device (by physical access or otherwise)
  // the fix involves:
  //  - encrypting the naked keys with pass phrase if present/known, or
  //  - checking the backups (which are always protected by a pass phrase) and replacing the stored ones with them
  // until all keys are fixed
  get_account_emails(function(emails) {
    let promises = [];
    let fixable_count = 0;
    tool.each(emails, function(i, account_email) {
      let account_keys = private_keys_get(account_email);
      let account_keys_to_fix = [];
      tool.each(account_keys, function(i, keyinfo) {
        let k  = openpgp.key.readArmored(keyinfo.armored).keys[0];
        if(k.primaryKey.isDecrypted) {
          let passphrase = get_passphrase(account_email, keyinfo.longid) || get_passphrase(account_email);
          if(typeof passphrase === 'string' && passphrase) {
            k.encrypt(passphrase);
            private_keys_add(account_email, k.armor(), true);
            catcher.log('fixed naked key ' + keyinfo.longid + ' on account ' + account_email);
          } else {
            account_keys_to_fix.push(keyinfo);
            fixable_count++;
          }
        }
      });
      console.log('NKV ' + account_email + ': ' + account_keys_to_fix.map(x => x.longid).join(','));
      if(account_keys_to_fix.length) {
        promises.push(global_migrate_v_422_do_fix_account_keys(account_email, account_keys_to_fix));
      }
    });
    if(fixable_count) {
      Promise.all(promises).then(function (all) {
        callback(fixable_count === all.reduce((sum, x) => sum + x, 0))
      }, function (error) {
        callback(false)
      });
    } else {
      callback(true);
    }
  });
}

function global_migrate_v_422_do_fix_account_keys(account_email, fixable_keyinfos) {
  let count_resolved = 0;
  return catcher.Promise(function(resolve, reject) {
    catcher.try(function() {
      tool.api.gmail.fetch_key_backups(account_email, function(success, backed_keys) {
        if(success) {
          if(backed_keys) {
            $.each(fixable_keyinfos, function(i, fixable_keyinfo) {
              $.each(backed_keys, function(i, backed_k) {
                if(tool.crypto.key.longid(backed_keys) === fixable_keyinfos.longid) {
                  private_keys_add(account_email, backed_k.armor(), true);
                  catcher.log('fixed naked key ' + fixable_keyinfos.longid + ' on account ' + account_email);
                  count_resolved++;
                  return false; // next fixable key
                }
              });
            });
            resolve(count_resolved);
          } else {
            reject(); // no keys found on backup - does not resolve the issue
          }
        } else {
          reject(); // eg connection is down - cannot check backups
        }
      });
    })();
  });
}

function account_consistency_fixes(account_email) {
  account_storage_get(account_email, ['setup_done'], function(storage) {
    // re-submitting pubkey if failed
    if(storage.setup_done && private_storage_get('local', account_email, 'master_public_key_submit') && !private_storage_get('local', account_email, 'master_public_key_submitted')) {
      console.log('consistency_fixes: submitting pubkey');
      tool.api.attester.initial_legacy_submit(account_email, private_storage_get('local', account_email, 'master_public_key'), false).validate(r => r.saved).done(function(success, result) {
        if(success && result) { // todo - do not handle the error using .done, but try to not handle it. This produces weird errors in logs - fix that, then put it back.
          private_storage_set('local', account_email, 'master_public_key_submitted', true);
        }
      });
    }
  });
}

function account_update_status_keyserver(account_email) { // checks which emails were registered on cryptup keyserver.
  let my_longids = tool.arr.select(private_keys_get(account_email), 'longid');
  account_storage_get(account_email, ['addresses', 'addresses_keyserver'], function(storage) {
    if(storage.addresses && storage.addresses.length) {
      tool.api.attester.lookup_email(storage.addresses).then(function(results) {
        let addresses_keyserver = [];
        tool.each(results.results, function(i, result) {
          if(result && result.pubkey && tool.value(tool.crypto.key.longid(result.pubkey)).in(my_longids)) {
            addresses_keyserver.push(result.email);
          }
        });
        account_storage_set(account_email, { addresses_keyserver: addresses_keyserver, });
      }, function(error) {});
    }
  });
}

function account_update_status_pks(account_email) { // checks if any new emails were registered on pks lately
  let my_longids = tool.arr.select(private_keys_get(account_email), 'longid');
  let hkp = new openpgp.HKP('http://keys.gnupg.net');
  account_storage_get(account_email, ['addresses', 'addresses_pks'], function(storage) {
    let addresses_pks = storage.addresses_pks || [];
    tool.each(storage.addresses || [account_email], function(i, email) {
      if(!tool.value(email).in(addresses_pks)) {
        try {
          hkp.lookup({ query: email }).then(function(pubkey) {
            if(typeof pubkey !== 'undefined') {
              if(tool.value(tool.crypto.key.longid(pubkey)).in(my_longids)) {
                addresses_pks.push(email);
                console.log(email + ' newly found matching pubkey on PKS');
                account_storage_set(account_email, { addresses_pks: addresses_pks, });
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