/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />
/// <reference path="../../../node_modules/@types/openpgp/index.d.ts" />
/// <reference path="../common/common.d.ts" />

let migrate_account: BrowserMessageHandler = async (data: {account_email: string}, sender, respond_done) => {
  if(data.account_email) {
    await Store.set(data.account_email, { version: tool.catch.version('int') as number|null });
    respond_done();
    await account_update_status_keyserver(data.account_email);
    await account_update_status_pks(data.account_email);
  } else {
    tool.catch.report('not migrating account: no account_email provided');
  }
};

let migrate_global = async () => {
  await migrate_local_storage_to_extension_storage();
};

let migrate_local_storage_to_extension_storage = () => new Promise(resolve => {
  if (window.localStorage.length === 0) {
    resolve(); // nothing in localStorage
  } else {
    let values: Dict<FlatTypes> = {};
    for (let legacy_storage_key of Object.keys(localStorage)) {
      let value = legacy_local_storage_read(localStorage.getItem(legacy_storage_key)!);
      if (legacy_storage_key === 'settings_seen') {
        values.cryptup_global_settings_seen = true;
      } else if (legacy_storage_key.match(/^cryptup_[a-z0-9]+_keys$/g)) {
        values[legacy_storage_key] = value;
      } else if (legacy_storage_key.match(/^cryptup_[a-z0-9]+_master_passphrase$/g)) {
        try {
          let primary_longid = legacy_local_storage_read(localStorage.getItem(legacy_storage_key.replace('master_passphrase', 'keys'))!).filter((ki: KeyInfo) => ki.primary)[0].longid;
          values[legacy_storage_key.replace('master_passphrase', 'passphrase_' + primary_longid)] = value;
        } catch (e) {} // tslint:disable-line:no-empty - this would fail if user manually edited storage. Defensive coding in case that crashes migration. They'd need to enter their phrase again.
      } else if (legacy_storage_key.match(/^cryptup_[a-z0-9]+_passphrase_[0-9A-F]{16}$/g)) {
        values[legacy_storage_key] = value;
      }
    }
    chrome.storage.local.set(values, () => {
      localStorage.clear();
      resolve();
    });
  }
});

let legacy_local_storage_read = (value: string) => {
  if (typeof value === 'undefined') {
    return value;
  } else if (value === 'null#null') {
    return null;
  } else if (value === 'bool#true') {
    return true;
  } else if (value === 'bool#false') {
    return false;
  } else if (value.indexOf('int#') === 0) {
    return Number(value.replace(/^int#/, ''));
  } else if (value.indexOf('json#') === 0) {
    return JSON.parse(value.replace(/^json#/, ''));
  } else {
    return value.replace(/^str#/, '');
  }
};

let account_update_status_keyserver = async (account_email: string) => { // checks which emails were registered on Attester
  let keyinfos = await Store.keys_get(account_email);
  let my_longids = keyinfos.map(ki => ki.longid);
  let storage = await Store.get_account(account_email, ['addresses', 'addresses_keyserver']);
  if (storage.addresses && storage.addresses.length) {
    let unique = tool.arr.unique(storage.addresses.map(a => a.toLowerCase().trim())).filter(a => a && tool.str.is_email_valid(a));
    if(unique.length < storage.addresses.length) {
      storage.addresses = unique;
      await Store.set(account_email, storage); // fix duplicate email addresses
    }
    try {
      let {results} = await Api.attester.lookup_email(storage.addresses);
      let addresses_keyserver = [];
      for (let result of results) {
        if (result && result.pubkey && tool.value(tool.crypto.key.longid(result.pubkey)).in(my_longids)) {
          addresses_keyserver.push(result.email);
        }
      }
      await Store.set(account_email, { addresses_keyserver });
    } catch(e) {
      if(!Api.error.is_network_error(e)) {
        tool.catch.handle_exception(e);
      }
    }
  }
};

let account_update_status_pks = async (account_email: string) => { // checks if any new emails were registered on pks lately
  let keyinfos = await Store.keys_get(account_email);
  let my_longids = keyinfos.map(ki => ki.longid);
  let hkp = new openpgp.HKP('https://pgp.key-server.io');
  let storage = await Store.get_account(account_email, ['addresses', 'addresses_pks']);
  let addresses_pks = storage.addresses_pks || [];
  for (let email of storage.addresses || [account_email]) {
    if (!tool.value(email).in(addresses_pks)) {
      try {
        let pubkey = await hkp.lookup({ query: email });
        if (typeof pubkey !== 'undefined') {
          if (tool.value(tool.crypto.key.longid(pubkey)).in(my_longids)) {
            addresses_pks.push(email);
            console.info(email + ' newly found matching pubkey on PKS');
          }
        }
      } catch (e) {
        report_useful_errors(e);
      }
    }
  }
  await Store.set(account_email, { addresses_pks });
};

let report_useful_errors = (e: any) => {
  if(!Api.error.is_network_error(e) && !Api.error.is_server_error(e)) {
    tool.catch.handle_exception(e);
  }
};

let schedule_cryptup_subscription_level_check = () => {
  setTimeout(() => {
    if (background_process_start_reason === 'update' || background_process_start_reason === 'chrome_update') {
      // update may happen to too many people at the same time -- server overload
      setTimeout(() => Api.fc.account_check_sync().catch(report_useful_errors), tool.time.hours(Math.random() * 3)); // random 0-3 hours
    } else {
      // the user just installed the plugin or started their browser, no risk of overloading servers
      Api.fc.account_check_sync().catch(report_useful_errors); // now
    }
  }, 10 * 60 * 1000); // 10 minutes
  setInterval(() => Api.fc.account_check_sync().catch(report_useful_errors), tool.time.hours(23 + Math.random())); // random 23-24 hours
};
