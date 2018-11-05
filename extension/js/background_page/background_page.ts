/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, StoreDbCorruptedError, StoreDbDeniedError, StoreDbFailedError, FlatTypes } from '../common/store.js';
import { Env, Catch, Value, Dict } from '../common/common.js';
import { BgExec, BrowserMsgHandler, BrowserMsgReqtDb, BrowserMsgReqSessionSet, BrowserMsgReqSessionGet, BrowserMsg } from '../common/extension.js';
import { BgAttests } from './attests.js';
import { injectFcIntoWebmailIfNeeded } from './inject.js';
import { migrateAcct, migrateGlobal, scheduleFcSubscriptionLevelCheck } from './migrations.js';

declare let openpgp: typeof OpenPGP;

type OpenSettingsBrowserMsg = { path: string, acctEmail: string, page: string, page_url_params: Dict<FlatTypes>, addNewAcct?: boolean };

console.info('background_process.js starting');

openpgp.initWorker({ path: '/lib/openpgp.worker.js' });

let backgroundProcessStartReason = 'browser_start';
chrome.runtime.onInstalled.addListener(event => {
  backgroundProcessStartReason = event.reason;
});

(async () => {

  let db: IDBDatabase;

  await migrateGlobal();
  await Store.set(null, { version: Catch.version('int') });
  let storage = await Store.getGlobal(['settings_seen', 'errors']);

  let openExtensionTab = async (url: string) => {
    let openedTab = await getFcSettingsTabIdIfOpen();
    if (openedTab === null) {
      chrome.tabs.create({ url });
    } else {
      chrome.tabs.update(openedTab, { url, active: true });
    }
  };

  let openSettingsPage = async (path: string = 'index.htm', acctEmail: string | null = null, page: string = '', rawPageUrlParams: Dict<FlatTypes> | null = null, addNewAcct = false) => {
    let basePath = chrome.extension.getURL(`chrome/settings/${path}`);
    let pageUrlParams = rawPageUrlParams ? JSON.stringify(rawPageUrlParams) : null;
    if (acctEmail) {
      await openExtensionTab(Env.urlCreate(basePath, { acctEmail, page, pageUrlParams }));
    } else if (addNewAcct) {
      await openExtensionTab(Env.urlCreate(basePath, { addNewAcct }));
    } else {
      let acctEmails = await Store.acctEmailsGet();
      await openExtensionTab(Env.urlCreate(basePath, { acctEmail: acctEmails[0], page, pageUrlParams }));
    }
  };

  let openSettingsPageHandler: BrowserMsgHandler = async (message: OpenSettingsBrowserMsg, sender, respond) => {
    await openSettingsPage(message.path, message.acctEmail, message.page, message.page_url_params, message.addNewAcct === true);
    respond();
  };

  let openInboxPageHandler: BrowserMsgHandler = async (message: { acctEmail: string, threadId?: string, folder?: string }, sender, respond) => {
    await openExtensionTab(Env.urlCreate(chrome.extension.getURL(`chrome/settings/inbox/inbox.htm`), message));
    respond();
  };

  let getActiveTabInfo: BrowserMsgHandler = (message: Dict<any> | null, sender, respond) => {
    chrome.tabs.query({ active: true, currentWindow: true, url: ["*://mail.google.com/*", "*://inbox.google.com/*"] }, (tabs) => {
      if (tabs.length) {
        if (tabs[0].id !== undefined) {
          chrome.tabs.executeScript(tabs[0].id!, { code: 'var r = {acctEmail: window.account_email_global, sameWorld: window.same_world_global}; r' }, result => {
            respond({ provider: 'gmail', acctEmail: result[0].acctEmail || null, sameWorld: result[0].sameWorld === true });
          });
        } else {
          Catch.report('tabs[0].id is undefined');
        }
      } else {
        respond({ provider: null, acctEmail: null, sameWorld: null });
      }
    });
  };

  let getFcSettingsTabIdIfOpen = (): Promise<number | null> => new Promise(resolve => {
    chrome.tabs.query({ currentWindow: true }, tabs => {
      let extension = chrome.extension.getURL('/');
      for (let tab of tabs) {
        if (Value.is(extension).in(tab.url || '')) {
          resolve(tab.id);
          return;
        }
      }
      resolve(null);
    });
  });

  let updateUninstallUrl: BrowserMsgHandler = async (request: Dict<any> | null, sender, respond) => {
    respond();
    let acctEmails = await Store.acctEmailsGet();
    if (typeof chrome.runtime.setUninstallURL !== 'undefined') {
      let email = (acctEmails && acctEmails.length) ? acctEmails[0] : null;
      chrome.runtime.setUninstallURL(`https://flowcrypt.com/leaving.htm#${JSON.stringify({ email, metrics: null })}`);
    }
  };

  let dbOperationHandler = (request: BrowserMsgReqtDb, sender: chrome.runtime.MessageSender | 'background', respond: Function, db: IDBDatabase) => { // tslint:disable-line:ban-types
    Catch.try(() => {
      if (db) {
        // @ts-ignore due to https://github.com/Microsoft/TypeScript/issues/6480
        Store[request.f].apply(null, [db].concat(request.args)).then(respond).catch(Catch.rejection);
      } else {
        Catch.log('db corrupted, skipping: ' + request.f);
      }
    })();
  };

  if (!storage.settings_seen) {
    await openSettingsPage('initial.htm'); // called after the very first installation of the plugin
    await Store.set(null, { settings_seen: true });
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

  BrowserMsg.listenBg({
    bg_exec: BgExec.bgReqHandler,
    db: (request, sender, respond) => dbOperationHandler(request as BrowserMsgReqtDb, sender, respond, db),
    session_set: (r: BrowserMsgReqSessionSet, sender, respond) => Store.sessionSet(r.acctEmail, r.key, r.value).then(respond).catch(Catch.rejection),
    session_get: (r: BrowserMsgReqSessionGet, sender, respond) => Store.sessionGet(r.acctEmail, r.key).then(respond).catch(Catch.rejection),
    close_popup: (r: chrome.tabs.QueryInfo, sender, respond) => chrome.tabs.query(r, tabs => chrome.tabs.remove(tabs.map(t => t.id!))),
    migrate_account: migrateAcct,
    settings: openSettingsPageHandler,
    inbox: openInboxPageHandler,
    attest_requested: BgAttests.attestRequestedHandler,
    attest_packet_received: BgAttests.attestPacketReceivedHandler,
    update_uninstall_url: updateUninstallUrl,
    get_active_tab_info: getActiveTabInfo,
    runtime: (r, sender, respond) => respond({ environment: Catch.environment(), version: Catch.version() }),
    ping: (r, sender, respond) => respond(true),
    _tab_: (r, sender, respond) => {
      if (sender === 'background') {
        respond({ tabId: null }); // background script - direct
      } else if (sender === null || sender === undefined) {
        respond({ tabId: undefined }); // not sure when or why this happens - maybe orphaned frames during update
      } else if (sender.tab) {
        // firefox doesn't include frameId due to a bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1354337
        // fixed in FF55, but currently we still support v52: https://flowcrypt.com/api/update/firefox
        respond({ tabId: `${sender.tab.id}:${(typeof sender.frameId !== 'undefined' ? sender.frameId : '')}` });
      } else {
        // sender.tab: "This property will only be present when the connection was opened from a tab (including content scripts)"
        // https://developers.chrome.com/extensions/runtime#type-MessageSender
        // MDN says the same - thus this is most likely a background script, through browser message passing
        respond({ tabId: null });
      }
    },
  });

  updateUninstallUrl(null, 'background', Value.noop);
  injectFcIntoWebmailIfNeeded();
  scheduleFcSubscriptionLevelCheck(backgroundProcessStartReason);
  BgAttests.watchForAttestEmailIfAppropriate().catch(Catch.rejection);

  if (storage.errors && storage.errors.length && storage.errors.length > 100) { // todo - ideally we should be concating it to show the last 100
    await Store.remove(null, ['errors']);
  }

})().catch(Catch.rejection);
