/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, UnreportableError } from '../common/platform/catch.js';
import { Dict, Url, UrlParam } from '../common/core/common.js';
import { Store, StoreCorruptedError, StoreDeniedError, StoreFailedError } from '../common/platform/store/abstract-store.js';

export class BgUtils {

  public static openSettingsPage = async (path: string = 'index.htm', acctEmail?: string, page: string = '', rawPageUrlParams?: Dict<UrlParam>, addNewAcct = false) => {
    const basePath = chrome.runtime.getURL(`chrome/settings/${path}`);
    const pageUrlParams = rawPageUrlParams ? JSON.stringify(rawPageUrlParams) : undefined;
    if (acctEmail || path === 'fatal.htm') {
      await BgUtils.openExtensionTab(Url.create(basePath, { acctEmail, page, pageUrlParams }));
    } else if (addNewAcct) {
      await BgUtils.openExtensionTab(Url.create(basePath, { addNewAcct }));
    } else {
      const acctEmails = await Store.acctEmailsGet();
      await BgUtils.openExtensionTab(Url.create(basePath, { acctEmail: acctEmails[0], page, pageUrlParams }));
    }
  }

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
    await BgUtils.openSettingsPage(Url.create('fatal.htm', { reason, stack: e instanceof Error ? e.stack : Catch.stackTrace() }));
    throw new UnreportableError();
  }

}
