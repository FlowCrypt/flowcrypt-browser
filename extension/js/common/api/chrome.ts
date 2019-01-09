/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../platform/store.js';
import { Env } from '../browser.js';

export const showFatalError = (reason: 'storage_undefined', error: Error) => {
  if (Env.isBackgroundPage()) {
    throw error;
  }
  window.location.href = chrome.extension.getURL(Env.urlCreate(`chrome/settings/fatal.htm`, { reason, stack: error.stack }));
};

export const tabsQuery = (q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => new Promise(resolve => chrome.tabs.query(q, resolve));

export const windowsCreate = (q: chrome.windows.CreateData): Promise<chrome.windows.Window | undefined> => new Promise(resolve => {
  if (typeof chrome.windows !== 'undefined') {
    chrome.windows.create(q, resolve);
  } else {
    alert('Your platform is not supported: browser does not support extension windows');
  }
});

export const storageLocalGet = (keys: string[]): Promise<Object> => new Promise((resolve, reject) => { // tslint:disable-line:ban-types
  if (typeof chrome.storage === 'undefined') {
    showFatalError('storage_undefined', new Error('storage is undefined'));
  } else {
    chrome.storage.local.get(keys, result => {
      if (typeof result !== 'undefined') {
        resolve(result);
      } else if (chrome.runtime.lastError) {
        reject(Store.errCategorize(chrome.runtime.lastError));
      } else {
        reject(new Error(`storageLocalGet(${keys.join(',')}) produced undefined result without an error`));
      }
    });
  }
});

export const storageLocalSet = (values: Object): Promise<void> => new Promise((resolve) => { // tslint:disable-line:ban-types
  if (typeof chrome.storage === 'undefined') {
    showFatalError('storage_undefined', new Error('storage is undefined'));
  } else {
    chrome.storage.local.set(values, resolve);
  }
});

export const storageLocalRemove = (keys: string[]): Promise<void> => new Promise((resolve) => { // tslint:disable-line:ban-types
  if (typeof chrome.storage === 'undefined') {
    showFatalError('storage_undefined', new Error('storage is undefined'));
  } else {
    chrome.storage.local.remove(keys, resolve);
  }
});
