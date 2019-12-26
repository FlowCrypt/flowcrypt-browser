/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../platform/catch.js';
import { ContentScriptWindow } from '../browser/browser-window.js';
import { Env } from '../browser/env.js';
import { Store } from '../platform/store.js';
import { Ui } from '../browser/ui.js';
import { Url } from '../core/common.js';

export const handleFatalErr = (reason: 'storage_undefined', error: Error) => {
  try {
    if (Env.isBackgroundPage()) {
      throw error;
    } else if (Env.isContentScript()) {
      console.error('Incomplete extension environment in content script', error);
    } else if (!chrome.runtime) {
      console.error('Chrome.runtime missing, cannot continue', error);
    } else { // extension pages
      window.location.href = chrome.runtime.getURL(Url.create(`chrome/settings/fatal.htm`, { reason, stack: error.stack }));
    }
  } catch (e) {
    if (e && e instanceof Error && e.message === 'Extension context invalidated.') {
      console.info(`FlowCrypt cannot handle fatal error because: Extension context invalidated. Destroying.`, error);
      (window as any as ContentScriptWindow).destroy();
    } else {
      throw e;
    }
  }
};

export const tabsQuery = (q: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> => new Promise(resolve => chrome.tabs.query(q, resolve));

export const windowsCreate = (q: chrome.windows.CreateData): Promise<chrome.windows.Window | undefined> => new Promise(resolve => {
  if (typeof chrome.windows !== 'undefined') {
    chrome.windows.create(q, resolve);
  } else {
    Ui.modal.error('Your platform is not supported: browser does not support extension windows').catch(Catch.reportErr);
  }
});

export const storageLocalGet = (keys: string[]): Promise<Object> => new Promise((resolve, reject) => { // tslint:disable-line:ban-types
  if (typeof chrome.storage === 'undefined') {
    handleFatalErr('storage_undefined', new Error('storage is undefined'));
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

export const storageLocalGetAll = (): Promise<{ [key: string]: any }> => new Promise((resolve) => {
  if (typeof chrome.storage === 'undefined') {
    handleFatalErr('storage_undefined', new Error('storage is undefined'));
  } else {
    chrome.storage.local.get(resolve);
  }
});

export const storageLocalSet = (values: Object): Promise<void> => new Promise((resolve) => { // tslint:disable-line:ban-types
  if (typeof chrome.storage === 'undefined') {
    handleFatalErr('storage_undefined', new Error('storage is undefined'));
  } else {
    chrome.storage.local.set(values, resolve);
  }
});

export const storageLocalRemove = (keys: string[]): Promise<void> => new Promise((resolve) => { // tslint:disable-line:ban-types
  if (typeof chrome.storage === 'undefined') {
    handleFatalErr('storage_undefined', new Error('storage is undefined'));
  } else {
    chrome.storage.local.remove(keys, resolve);
  }
});
