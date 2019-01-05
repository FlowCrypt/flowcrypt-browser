/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Value, Dict } from '../common/core/common.js';
import { Env, UrlParam } from '../common/browser.js';
import { Store, StoreCorruptedError, StoreDeniedError, StoreFailedError } from '../common/platform/store.js';
import { Catch, UnreportableError } from '../common/platform/catch.js';

export class BgUtils {

  public static openSettingsPage = async (path: string = 'index.htm', acctEmail?: string, page: string = '', rawPageUrlParams?: Dict<UrlParam>, addNewAcct = false) => {
    const basePath = chrome.extension.getURL(`chrome/settings/${path}`);
    const pageUrlParams = rawPageUrlParams ? JSON.stringify(rawPageUrlParams) : undefined;
    if (acctEmail) {
      await BgUtils.openExtensionTab(Env.urlCreate(basePath, { acctEmail, page, pageUrlParams }));
    } else if (addNewAcct) {
      await BgUtils.openExtensionTab(Env.urlCreate(basePath, { addNewAcct }));
    } else {
      const acctEmails = await Store.acctEmailsGet();
      await BgUtils.openExtensionTab(Env.urlCreate(basePath, { acctEmail: acctEmails[0], page, pageUrlParams }));
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

  public static getFcSettingsTabIdIfOpen = (): Promise<number | undefined> => new Promise(resolve => {
    chrome.tabs.query({ currentWindow: true }, tabs => {
      const extension = chrome.extension.getURL('/');
      for (const tab of tabs) {
        if (Value.is(extension).in(tab.url || '')) {
          resolve(tab.id);
          return;
        }
      }
      resolve(undefined);
    });
  })

  public static handleStoreErr = async (e: any) => {
    if (e instanceof StoreCorruptedError) {
      await BgUtils.openSettingsPage('fatal.htm?reason=db_corrupted');
    } else if (e instanceof StoreDeniedError) {
      await BgUtils.openSettingsPage('fatal.htm?reason=db_denied');
    } else if (e instanceof StoreFailedError) {
      await BgUtils.openSettingsPage('fatal.htm?reason=db_failed');
    } else {
      await BgUtils.openSettingsPage('fatal.htm?reason=db_failed');
      Catch.handleErr(e);
    }
    throw new UnreportableError();
  }

}
