/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../platform/catch.js';
import { ContentScriptWindow } from './browser-window.js';
import { Env } from './env.js';
import { Ui } from './ui.js';
import { Url, Dict } from '../core/common.js';
import { AbstractStore } from '../platform/store/abstract-store.js';

type ChromeStorageType = 'local' | 'session';

const handleFatalErr = async (reason: 'storage_undefined', error: Error) => {
  try {
    if (await Env.isServiceWorker()) {
      throw error;
    } else if (Env.isContentScript()) {
      console.error('Incomplete extension environment in content script', error);
    } else if (!chrome.runtime) {
      console.error('Chrome.runtime missing, cannot continue', error);
    } else {
      // extension pages

      window.location.href = chrome.runtime.getURL(Url.create(`chrome/settings/fatal.htm`, { reason, stack: error.stack }));
    }
  } catch (e) {
    if (e && e instanceof Error && e.message === 'Extension context invalidated.') {
      console.info(`FlowCrypt cannot handle fatal error because: Extension context invalidated. Destroying.`, error);
      (window as unknown as ContentScriptWindow).destroy();
    } else {
      throw e;
    }
  }
};

export const windowsCreate = async (q: chrome.windows.CreateData): Promise<chrome.windows.Window | undefined> => {
  return await new Promise(resolve => {
    if (typeof chrome.windows !== 'undefined') {
      chrome.windows.create(q, resolve);
    } else {
      Ui.modal.error('Your platform is not supported: browser does not support extension windows').catch(Catch.reportErr);
    }
  });
};

const storageArea = (storageType: ChromeStorageType): chrome.storage.StorageArea => {
  const storage = chrome.storage?.[storageType];
  if (!storage) {
    const error = new Error('storage is undefined');
    handleFatalErr('storage_undefined', error).catch(Catch.reportErr);
    throw error;
  }
  return storage;
};

const storageRead = async (storageType: ChromeStorageType, keys?: string[]): Promise<Dict<unknown>> => {
  const storage = storageArea(storageType);
  return await new Promise((resolve, reject) => {
    const onResult = (result: Dict<unknown> | undefined) => {
      if (chrome.runtime.lastError) {
        reject(AbstractStore.errCategorize(chrome.runtime.lastError));
      } else if (typeof result === 'undefined') {
        reject(new Error(`storage read (${storageType}) produced undefined result without an error`));
      } else {
        resolve(result);
      }
    };
    if (keys) {
      storage.get(keys, onResult);
    } else {
      storage.get(onResult);
    }
  });
};

export const storageGet = async (storageType: ChromeStorageType, keys: string[]): Promise<Dict<unknown>> => await storageRead(storageType, keys);

export const storageGetAll = async (storageType: ChromeStorageType): Promise<Dict<unknown>> => await storageRead(storageType);

export const storageSet = async (storageType: ChromeStorageType, values: Dict<unknown>): Promise<void> => {
  const storage = storageArea(storageType);
  return await new Promise((resolve, reject) => {
    storage.set(values, () => {
      if (chrome.runtime.lastError) {
        reject(AbstractStore.errCategorize(chrome.runtime.lastError));
      } else {
        resolve();
      }
    });
  });
};

export const storageRemove = async (storageType: ChromeStorageType, keys: string[]): Promise<void> => {
  const storage = storageArea(storageType);
  return await new Promise((resolve, reject) => {
    storage.remove(keys, () => {
      if (chrome.runtime.lastError) {
        reject(AbstractStore.errCategorize(chrome.runtime.lastError));
      } else {
        resolve();
      }
    });
  });
};
