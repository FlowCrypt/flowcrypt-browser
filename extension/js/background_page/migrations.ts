/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, FlatTypes, KeyInfo } from '../common/store.js';
import { Catch, Value, Str, Dict } from '../common/common.js';

import { Api } from '../common/api.js';
import { Pgp } from '../common/pgp.js';
import { BrowserMsgHandler } from '../common/extension.js';

declare let openpgp: typeof OpenPGP;

export let migrateAcct: BrowserMsgHandler = async (data: { acctEmail: string }, sender, doneCb) => {
  if (data.acctEmail) {
    await Store.set(data.acctEmail, { version: Catch.version('int') });
    doneCb();
    await accountUpdateStatusKeyserver(data.acctEmail);
    await accountUpdateStatusPks(data.acctEmail);
  } else {
    Catch.report('not migrating account: no account_email provided');
  }
};

export let migrateGlobal = async () => {
  await migrateLocalStorageToExtensionStorage();
};

let migrateLocalStorageToExtensionStorage = () => new Promise(resolve => {
  // todo - deprecate and show error like dberror
  if (window.localStorage.length === 0) {
    resolve(); // nothing in localStorage
  } else {
    let values: Dict<FlatTypes> = {};
    for (let legacyStorageKey of Object.keys(localStorage)) {
      let value = legacyLocalStorageRead(localStorage.getItem(legacyStorageKey)!);
      if (legacyStorageKey === 'settings_seen') {
        values.cryptup_global_settings_seen = true;
      } else if (legacyStorageKey.match(/^cryptup_[a-z0-9]+_keys$/g)) {
        values[legacyStorageKey] = value;
      } else if (legacyStorageKey.match(/^cryptup_[a-z0-9]+_master_passphrase$/g)) {
        try {
          let primaryLongid = legacyLocalStorageRead(localStorage.getItem(legacyStorageKey.replace('master_passphrase', 'keys'))!).filter((ki: KeyInfo) => ki.primary)[0].longid;
          values[legacyStorageKey.replace('master_passphrase', 'passphrase_' + primaryLongid)] = value;
        } catch (e) { } // tslint:disable-line:no-empty - this would fail if user manually edited storage. Defensive coding in case that crashes migration. They'd need to enter their phrase again.
      } else if (legacyStorageKey.match(/^cryptup_[a-z0-9]+_passphrase_[0-9A-F]{16}$/g)) {
        values[legacyStorageKey] = value;
      }
    }
    chrome.storage.local.set(values, () => {
      localStorage.clear();
      resolve();
    });
  }
});

let legacyLocalStorageRead = (value: string) => {
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

let accountUpdateStatusKeyserver = async (acctEmail: string) => { // checks which emails were registered on Attester
  let keyinfos = await Store.keysGet(acctEmail);
  let myLongids = keyinfos.map(ki => ki.longid);
  let storage = await Store.getAcct(acctEmail, ['addresses', 'addresses_keyserver']);
  if (storage.addresses && storage.addresses.length) {
    let unique = Value.arr.unique(storage.addresses.map(a => a.toLowerCase().trim())).filter(a => a && Str.isEmailValid(a));
    if (unique.length < storage.addresses.length) {
      storage.addresses = unique;
      await Store.set(acctEmail, storage); // fix duplicate email addresses
    }
    try {
      let { results } = await Api.attester.lookupEmail(storage.addresses);
      let addressesKeyserver = [];
      for (let result of results) {
        if (result && result.pubkey && Value.is(Pgp.key.longid(result.pubkey)).in(myLongids)) {
          addressesKeyserver.push(result.email);
        }
      }
      await Store.set(acctEmail, { addressesKeyserver });
    } catch (e) {
      if (!Api.err.isNetErr(e)) {
        Catch.handleException(e);
      }
    }
  }
};

let accountUpdateStatusPks = async (acctEmail: string) => { // checks if any new emails were registered on pks lately
  // todo - deprecate in certain situations
  let keyinfos = await Store.keysGet(acctEmail);
  let myLongids = keyinfos.map(ki => ki.longid);
  let hkp = new openpgp.HKP('https://pgp.key-server.io');
  let storage = await Store.getAcct(acctEmail, ['addresses', 'addresses_pks']);
  let addressesPks = storage.addresses_pks || [];
  for (let email of storage.addresses || [acctEmail]) {
    if (!Value.is(email).in(addressesPks)) {
      try {
        let pubkey = await hkp.lookup({ query: email });
        if (typeof pubkey !== 'undefined') {
          if (Value.is(Pgp.key.longid(pubkey)).in(myLongids)) {
            addressesPks.push(email);
            console.info(email + ' newly found matching pubkey on PKS');
          }
        }
      } catch (e) {
        reportUsefulErrs(e);
      }
    }
  }
  await Store.set(acctEmail, { addressesPks });
};

let reportUsefulErrs = (e: any) => {
  if (!Api.err.isNetErr(e) && !Api.err.isServerErr(e)) {
    Catch.handleException(e);
  }
};

export let scheduleFcSubscriptionLevelCheck = (bgProcessStartReason: 'update' | 'chrome_update' | 'browser_start' | string) => {
  Catch.setHandledTimeout(() => {
    if (bgProcessStartReason === 'update' || bgProcessStartReason === 'chrome_update') {
      // update may happen to too many people at the same time -- server overload
      Catch.setHandledTimeout(() => Api.fc.accountCheckSync().catch(reportUsefulErrs), Value.int.hoursAsMiliseconds(Math.random() * 3)); // random 0-3 hours
    } else {
      // the user just installed the plugin or started their browser, no risk of overloading servers
      Api.fc.accountCheckSync().catch(reportUsefulErrs); // now
    }
  }, 10 * 60 * 1000); // 10 minutes
  Catch.setHandledInterval(() => Api.fc.accountCheckSync().catch(reportUsefulErrs), Value.int.hoursAsMiliseconds(23 + Math.random())); // random 23-24 hours
};
