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
  global_migrate_v_422_check_and_resolve_naked_key_vulnerability_if_needed(function () {
    global_migrate_v_433_account_private_keys_array_if_needed(function () {
      if(typeof callback === 'function') {
        callback();
      }
    });
  });
}

let old_version_storage = {
  private_keys_get: function (account_email, longid) { // left here to be used for migration to new storage schema
    let keys = [];
    let private_keys = this.get('local', account_email, 'private_keys');
    let contains_primary = false;
    tool.each(private_keys || [], (i, keyinfo) => {
      if(keyinfo.primary === true) {
        contains_primary = true;
      }
      keys.push(keyinfo);
    });
    let primary_key_armored = this.get('local', account_email, 'master_private_key'); // legacy storage - to migrate
    if(!contains_primary && (primary_key_armored || '').trim()) {
      keys.push({ armored: primary_key_armored, primary: true, longid: tool.crypto.key.longid(primary_key_armored) });
    }
    if(typeof longid !== 'undefined') { // looking for a specific key(s)
      let found;
      if(typeof longid === 'object') { // looking for an array of keys
        found = [];
        tool.each(keys, (i, keyinfo) => {
          if(tool.value(keyinfo.longid).in(longid) || (tool.value('primary').in(longid) && keyinfo.primary)) {
            found.push(keyinfo);
          }
        });
      } else { // looking for a single key
        found = null;
        tool.each(keys, (i, keyinfo) => {
          if(keyinfo.longid === longid || (longid === 'primary' && keyinfo.primary)) {
            found = keyinfo;
          }
        });
      }
      return found;
    } else {
      return keys;
    }
  },
  private_keys_add: function(account_email, new_key_armored, replace_if_exists) { // left here to be used for migration to new storage schema
    let private_keys = this.private_keys_get(account_email);
    let is_first_key = (private_keys.length === 0);
    let do_add = true;
    let do_update = true;
    let new_key_longid = tool.crypto.key.longid(new_key_armored);
    if(new_key_longid) {
      tool.each(private_keys, (i, keyinfo) => {
        if(new_key_longid === keyinfo.longid) {
          do_add = false;
          if(replace_if_exists === true) {
            if(keyinfo.primary) {
              this.set('local', account_email, 'master_private_key', new_key_armored); // legacy storage location
            }
            private_keys[i] = { armored: new_key_armored, longid: new_key_longid, primary: keyinfo.primary };
          } else {
            do_update = false;
          }
        }
      });
    } else {
      do_add = do_update = false;
    }
    if(do_add) {
      private_keys.push({ armored: new_key_armored, longid: new_key_longid, primary: is_first_key });
    }
    if(do_update) {
      this.set('local', account_email, 'private_keys', private_keys);
    }
  },
  passphrase_get: function (account_email, longid) {
    if(longid) {
      let stored = this.get('local', account_email, 'passphrase_' + longid);
      if(stored) {
        return stored;
      } else {
        let temporary = this.get('session', account_email, 'passphrase_' + longid);
        if(temporary) {
          return temporary;
        } else {
          let primary_k = keys_get(account_email, 'primary');
          if(primary_k && primary_k.longid === longid) {
            this.passphrase_get(account_email, null, callback); //todo - do a storage migration so that we don't have to keep trying to query the "old way of storing"
          } else {
            return null;
          }
        }
      }
    } else { //todo - this whole part would also be unnecessary if we did a migration
      if(this.get('local', account_email, 'master_passphrase_needed') === false) {
        return '';
      } else {
        let stored = this.get('local', account_email, 'master_passphrase');
        if(stored) {
          return stored;
        } else {
          let from_session = this.get('session', account_email, 'master_passphrase');
          if(from_session) {
            return from_session;
          } else {
            return null;
          }
        }
      }
    }
  },
  set: function (storage_type, account_email, key, value) {
    let storage = this.get_storage(storage_type);
    let account_key = window.flowcrypt_storage.key(account_email, key);
    if(typeof value === 'undefined') {
      storage.removeItem(account_key);
    } else if(value === null) {
      storage[account_key] = 'null#null';
    } else if(value === true || value === false) {
      storage[account_key] = 'bool#' + value;
    } else if(value + 0 === value) {
      storage[account_key] = 'int#' + value;
    } else if(typeof value === 'object') {
      storage[account_key] = 'json#' + JSON.stringify(value);
    } else {
      storage[account_key] = 'str#' + value;
    }
  },
  get: function (storage_type, account_email, key, parent_tab_id) {
    let storage = this.get_storage(storage_type);
    let value = storage[window.flowcrypt_storage.key(account_email, key)];
    if(typeof value === 'undefined') {
      return value;
    } else if(value === 'null#null') {
      return null;
    } else if(value === 'bool#true') {
      return true;
    } else if(value === 'bool#false') {
      return false;
    } else if(value.indexOf('int#') === 0) {
      return Number(value.replace('int#', '', 1));
    } else if(value.indexOf('json#') === 0) {
      return JSON.parse(value.replace('json#', '', 1));
    } else {
      return value.replace('str#', '', 1);
    }
  },
  get_storage: function (storage_type) {
    try {
      if(storage_type === 'local') {
        return localStorage;
      } else if(storage_type === 'session') {
        return sessionStorage;
      } else {
        throw new Error('unknown type of storage: "' + storage_type + '", use either "local" or "session"');
      }
    } catch(error) {
      if(error.name === 'SecurityError') {
        return null;
      } else {
        throw error;
      }
    }
  },
};

function global_migrate_v_433_account_private_keys_array_if_needed(callback) {
  if(!localStorage.uses_account_keys_array) {
    catcher.log('migrating:uses_account_keys_array');
    global_migrate_v_433_account_private_keys_array(function() {
      localStorage.uses_account_keys_array = true;
      callback();
    });
  } else {
    callback();
  }
}

function global_migrate_v_433_account_private_keys_array(callback) {
  window.flowcrypt_storage.account_emails_get(function (emails) {
    let processed_emails_to_log = [];
    tool.each(emails, function (i, account_email) {
      let legacy_keys = old_version_storage.private_keys_get(account_email);
      if(legacy_keys.length) {
        catcher.log('migrating:uses_account_keys_array: ' + account_email);
        let master_longid = old_version_storage.private_keys_get(account_email, 'primary').longid;
        let keys = legacy_keys.map(function (ki) { return window.flowcrypt_storage.keys_object(ki.armored || ki.private, ki.longid === master_longid);});
        old_version_storage.set('local', account_email, 'keys', keys);
        old_version_storage.set('local', account_email, 'private_keys', undefined);
        old_version_storage.set('local', account_email, 'master_private_key', undefined);
        old_version_storage.set('local', account_email, 'master_public_key', undefined);
      } else {
        catcher.log('migrating:uses_account_keys_array: ' + account_email + ' (no keys set yet)');
      }
      processed_emails_to_log.push(account_email);
    });
    catcher.log('migrating:uses_account_keys_array:done: ' + processed_emails_to_log.join(','));
    callback();
  });
}

function global_migrate_v_422_check_and_resolve_naked_key_vulnerability_if_needed(callback) {
  if(!localStorage.resolved_naked_key_vulnerability) {
    catcher.log('checking NKV');
    global_migrate_v_422_check_and_resolve_naked_key_vulnerability(function(resolved) {
      catcher.log('NKV result/resolved: ' + resolved);
      if(!resolved) {
        setTimeout(migrate_global, tool.time.hours(1)); // try again in an hour - maybe there was no internet just now, or pass phrase not present
      } else {
        localStorage.resolved_naked_key_vulnerability = true;
      }
      callback();
    });
  } else {
    callback();
  }
}

function global_migrate_v_422_check_and_resolve_naked_key_vulnerability(callback) {
  // for a short period, keys that were recovered from email backups would be stored without encryption. The code below fixes it retroactively
  // this only affected users on machines that were recovered from a backup email who choose to keep pass phrase in session only
  // the result was that although they specifically selected not to store their pass phrase, the key would not actually need it, defying the point
  // this vulnerability could only be exploited if the attacker first compromises their device (by physical access or otherwise)
  // the fix involves:
  //  - encrypting the naked keys with pass phrase if present/known, or
  //  - checking the backups (which are always protected by a pass phrase) and replacing the stored ones with them
  // until all keys are fixed
  window.flowcrypt_storage.account_emails_get(function(emails) {
    let promises = [];
    let fixable_count = 0;
    tool.each(emails, function(i, account_email) {
      let account_keys = old_version_storage.private_keys_get(account_email);
      let account_keys_to_fix = [];
      tool.each(account_keys, function(i, keyinfo) {
        let k  = openpgp.key.readArmored(keyinfo.armored || keyinfo.private).keys[0];
        if(k.primaryKey.isDecrypted) {
          let passphrase = old_version_storage.passphrase_get(account_email, keyinfo.longid) || old_version_storage.passphrase_get(account_email);
          if(typeof passphrase === 'string' && passphrase) {
            k.encrypt(passphrase);
            old_version_storage.private_keys_add(account_email, k.armor(), true);
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
                  old_version_storage.private_keys_add(account_email, backed_k.armor(), true);
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