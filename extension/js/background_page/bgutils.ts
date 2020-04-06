/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, UnreportableError } from '../common/platform/catch.js';
import { Url } from '../common/core/common.js';
import { StoreCorruptedError, StoreDeniedError, StoreFailedError } from '../common/platform/store/abstract-store.js';
import { Browser } from '../common/browser/browser.js';

export class BgUtils {

  public static openExtensionTab = async (url: string) => {
    const openedTab = await BgUtils.getFcSettingsTabIdIfOpen();
    if (!openedTab) {
      chrome.tabs.create({ url });
    } else {
      chrome.tabs.update(openedTab, { url, active: true });
    }
  }

  public static getFcSettingsTabIdIfOpen = async (): Promise<number | undefined> => {
    return await new Promise(resolve => {
      chrome.tabs.query({ currentWindow: true }, tabs => {
        const extensionUrl = chrome.runtime.getURL('/');
        for (const tab of tabs) {
          if (tab.url && tab.url.includes(extensionUrl)) {
            resolve(tab.id);
            return;
          }
        }
        resolve(undefined);
      });
    });
  }

  public static handleStoreErr = async (e: any, reason?: 'storage_undefined' | 'db_corrupted' | 'db_denied' | 'db_failed') => {
    if (!reason) {
      if (e instanceof StoreCorruptedError) {
        reason = 'db_corrupted';
      } else if (e instanceof StoreDeniedError) {
        reason = 'db_denied';
      } else if (e instanceof StoreFailedError) {
        reason = 'db_failed';
      } else {
        Catch.reportErr(e);
        reason = 'db_failed';
      }
    }
    await Browser.openExtensionTab(Url.create('fatal.htm', { reason, stack: e instanceof Error ? e.stack : Catch.stackTrace() }));
    throw new UnreportableError();
  }

}
