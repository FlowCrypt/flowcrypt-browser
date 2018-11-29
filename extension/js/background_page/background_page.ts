/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, StoreDbCorruptedError, StoreDbDeniedError, StoreDbFailedError } from '../common/platform/store.js';
import { Value, Dict } from '../common/core/common.js';
import { BgExec, BrowserMsg, Bm } from '../common/extension.js';
import { BgAttests } from './attests.js';
import { injectFcIntoWebmailIfNeeded } from './inject.js';
import { migrateGlobal, scheduleFcSubscriptionLevelCheck } from './migrations.js';
import { Catch } from '../common/platform/catch.js';
import { Env, UrlParam } from '../common/browser.js';
import { GoogleAuth } from '../common/api/google.js';

declare const openpgp: typeof OpenPGP;

// type OpenSettingsBrowserMsg = { path: string, acctEmail: string, page: string, page_url_params: Dict<FlatTypes>, addNewAcct?: boolean };

console.info('background_process.js starting');

openpgp.initWorker({ path: '/lib/openpgp.worker.js' });

let backgroundProcessStartReason = 'browser_start';
chrome.runtime.onInstalled.addListener(event => {
  backgroundProcessStartReason = event.reason;
});

(async () => {

  let db: IDBDatabase;

  await migrateGlobal();
  await Store.setGlobal({ version: Number(Catch.version('int')) });
  const storage = await Store.getGlobal(['settings_seen', 'errors']);

  const openExtensionTab = async (url: string) => {
    const openedTab = await getFcSettingsTabIdIfOpen();
    if (!openedTab) {
      chrome.tabs.create({ url });
    } else {
      chrome.tabs.update(openedTab, { url, active: true });
    }
  };

  const openSettingsPage = async (path: string = 'index.htm', acctEmail?: string, page: string = '', rawPageUrlParams?: Dict<UrlParam>, addNewAcct = false) => {
    const basePath = chrome.extension.getURL(`chrome/settings/${path}`);
    const pageUrlParams = rawPageUrlParams ? JSON.stringify(rawPageUrlParams) : undefined;
    if (acctEmail) {
      await openExtensionTab(Env.urlCreate(basePath, { acctEmail, page, pageUrlParams }));
    } else if (addNewAcct) {
      await openExtensionTab(Env.urlCreate(basePath, { addNewAcct }));
    } else {
      const acctEmails = await Store.acctEmailsGet();
      await openExtensionTab(Env.urlCreate(basePath, { acctEmail: acctEmails[0], page, pageUrlParams }));
    }
  };

  const openSettingsPageHandler: Bm.ResponselessHandler = async ({ page, path, pageUrlParams, addNewAcct, acctEmail }: Bm.Settings) => {
    await openSettingsPage(path, acctEmail, page, pageUrlParams, addNewAcct === true);
  };

  const openInboxPageHandler: Bm.ResponselessHandler = async (message: { acctEmail: string, threadId?: string, folder?: string }) => {
    await openExtensionTab(Env.urlCreate(chrome.extension.getURL(`chrome/settings/inbox/inbox.htm`), message));
  };

  const getActiveTabInfo = (message: {}, sender: Bm.Sender, respond: (r: Bm.Res.GetActiveTabInfo) => void) => {
    chrome.tabs.query({ active: true, currentWindow: true, url: ["*://mail.google.com/*", "*://inbox.google.com/*"] }, (tabs) => {
      if (tabs.length) {
        if (tabs[0].id !== undefined) {
          type ScriptRes = { acctEmail: string | undefined, sameWorld: boolean | undefined }[];
          chrome.tabs.executeScript(tabs[0].id!, { code: 'var r = {acctEmail: window.account_email_global, sameWorld: window.same_world_global}; r' }, (result: ScriptRes) => {
            respond({ provider: 'gmail', acctEmail: result[0].acctEmail, sameWorld: result[0].sameWorld === true });
          });
        } else {
          Catch.report('tabs[0].id is undefined');
        }
      } else {
        respond({ provider: undefined, acctEmail: undefined, sameWorld: undefined });
      }
    });
  };

  const getFcSettingsTabIdIfOpen = (): Promise<number | undefined> => new Promise(resolve => {
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
  });

  const updateUninstallUrl: Bm.ResponselessHandler = async () => {
    const acctEmails = await Store.acctEmailsGet();
    if (typeof chrome.runtime.setUninstallURL !== 'undefined') {
      const email = (acctEmails && acctEmails.length) ? acctEmails[0] : undefined;
      chrome.runtime.setUninstallURL(`https://flowcrypt.com/leaving.htm#${JSON.stringify({ email, metrics: null })}`); // tslint:disable-line:no-null-keyword
    }
  };

  const dbOperationHandler = (request: Bm.Db, sender: Bm.Sender, respond: Function, db: IDBDatabase) => { // tslint:disable-line:ban-types
    Catch.try(() => {
      if (db) {
        // @ts-ignore due to https://github.com/Microsoft/TypeScript/issues/6480
        Store[request.f].apply(undefined, [db].concat(request.args)).then(respond).catch(Catch.handleErr); // tslint:disable-line:no-unsafe-any
      } else {
        Catch.log('db corrupted, skipping: ' + request.f);
      }
    })();
  };

  if (!storage.settings_seen) {
    await openSettingsPage('initial.htm'); // called after the very first installation of the plugin
    await Store.setGlobal({ settings_seen: true });
  }

  try {
    db = await Store.dbOpen(); // takes 4-10 ms first time
  } catch (e) {
    if (e instanceof StoreDbCorruptedError) {
      await openSettingsPage('fatal.htm?reason=db_corrupted');
    } else if (e instanceof StoreDbDeniedError) {
      await openSettingsPage('fatal.htm?reason=db_denied');
    } else if (e instanceof StoreDbFailedError) {
      await openSettingsPage('fatal.htm?reason=db_failed');
    }
    return;
  }

  BrowserMsg.bgAddListener('bg_exec', BgExec.bgReqHandler);
  BrowserMsg.bgAddListener('db', (r: Bm.Db, sender, respond) => dbOperationHandler(r, sender, respond, db));
  BrowserMsg.bgAddListener('session_set', (r: Bm.SessionSet, sender, respond) => Store.sessionSet(r.acctEmail, r.key, r.value).then(respond).catch(Catch.handleErr));
  BrowserMsg.bgAddListener('session_get', (r: Bm.SessionGet, sender, respond) => Store.sessionGet(r.acctEmail, r.key).then(respond).catch(Catch.handleErr));
  BrowserMsg.bgAddListener('settings', openSettingsPageHandler);
  BrowserMsg.bgAddListener('inbox', openInboxPageHandler);
  BrowserMsg.bgAddListener('attest_requested', BgAttests.attestRequestedHandler);
  BrowserMsg.bgAddListener('attest_packet_received', BgAttests.attestPacketReceivedHandler);
  BrowserMsg.bgAddListener('update_uninstall_url', updateUninstallUrl);
  BrowserMsg.bgAddListener('get_active_tab_info', getActiveTabInfo);
  BrowserMsg.bgAddListener('reconnect_acct_auth_popup', (r: Bm.ReconnectAcctAuthPopup, s, respond) => GoogleAuth.newAuthPopup(r).then(respond).catch(Catch.handleErr));
  BrowserMsg.bgAddListener('_tab_', (r: any, sender: Bm.Sender, respond: (r: Bm.Res._tab_) => void) => {
    if (sender === 'background') {
      respond({ tabId: null });  // tslint:disable-line:no-null-keyword
    } else if (sender.tab) {
      respond({ tabId: `${sender.tab.id}:${sender.frameId}` });
    } else {
      // sender.tab: "This property will only be present when the connection was opened from a tab (including content scripts)"
      // https://developers.chrome.com/extensions/runtime#type-MessageSender
      // MDN says the same - thus this is most likely a background script, through browser message passing
      respond({ tabId: null }); // tslint:disable-line:no-null-keyword
    }
  });
  BrowserMsg.bgListen();

  updateUninstallUrl({});
  injectFcIntoWebmailIfNeeded();
  scheduleFcSubscriptionLevelCheck(backgroundProcessStartReason);
  BgAttests.watchForAttestEmailIfAppropriate().catch(Catch.handleErr);

  if (storage.errors && storage.errors.length && storage.errors.length > 100) { // todo - ideally we should be concating it to show the last 100
    await Store.removeGlobal(['errors']);
  }

})().catch(Catch.handleErr);
