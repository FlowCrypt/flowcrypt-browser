/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GoogleOAuth } from '../common/api/authentication/google/google-oauth.js';
import { Bm, BrowserMsg } from '../common/browser/browser-msg.js';
import { storageGet, storageSet } from '../common/browser/chrome.js';
import { emailKeyIndex } from '../common/core/common.js';
import { ExpirationCache } from '../common/core/expiration-cache.js';
import { BgHandlers } from './bg-handlers.js';
import { Catch } from '../common/platform/catch.js';
import { ContactStore } from '../common/platform/store/contact-store.js';
import { BgUtils } from './bgutils.js';
import {
  migrateGlobal,
  moveContactsToEmailsAndPubkeys,
  revalidateStoredRevocations,
  updateOpgpRevocations,
  updateSearchables,
  updateX509FingerprintsAndLongids,
} from './migrations.js';
import { GlobalStore, GlobalStoreDict } from '../common/platform/store/global-store.js';
import { VERSION } from '../common/core/const.js';
import { injectFcIntoWebmail } from './inject.js';
import { ConfiguredIdpOAuth } from '../common/api/authentication/configured-idp-oauth.js';

console.info('background.js service worker starting');

let db: IDBDatabase;
const inMemoryStore = new ExpirationCache<string>('in_memory_store', 4 * 60 * 60 * 1000); // 4 hours

// Start initialization after all event listeners below have been registered synchronously.
const ready = Promise.resolve().then(async () => {
  let storage: GlobalStoreDict;
  await BrowserMsg.createIntervalAlarm('delete_expired', 1); // each minute

  try {
    await migrateGlobal();
    storage = await GlobalStore.get(['settings_seen']);
  } catch (e) {
    await BgUtils.handleStoreErr(GlobalStore.errCategorize(e));
    return;
  }
  if (!storage.settings_seen) {
    await BgUtils.openSettingsPage('initial.htm'); // called after the very first installation of the plugin
    // eslint-disable-next-line @typescript-eslint/naming-convention
    await GlobalStore.set({ settings_seen: true });
  }
  try {
    db = await ContactStore.dbOpen(); // takes 4-10 ms first time
    await updateOpgpRevocations(db);
    await revalidateStoredRevocations(db);
    await updateX509FingerprintsAndLongids(db);
    await updateSearchables(db);
    await moveContactsToEmailsAndPubkeys(db);
  } catch (e) {
    await BgUtils.handleStoreErr(e);
    return;
  }
});

BrowserMsg.bgAddListener('db', (r: Bm.Db) => BgHandlers.dbOperationHandler(db, r));
BrowserMsg.bgAddListener('inMemoryStoreSet', async (r: Bm.InMemoryStoreSet) => inMemoryStore.set(emailKeyIndex(r.acctEmail, r.key), r.value, r.expiration));
BrowserMsg.bgAddListener('inMemoryStoreGet', async (r: Bm.InMemoryStoreGet) => inMemoryStore.get(emailKeyIndex(r.acctEmail, r.key)));

BrowserMsg.bgAddListener('ajax', BgHandlers.ajaxHandler);
BrowserMsg.bgAddListener('ajaxGmailAttachmentGetChunk', BgHandlers.ajaxGmailAttachmentGetChunkHandler);
BrowserMsg.bgAddListener('expirationCacheGet', BgHandlers.expirationCacheGetHandler);
BrowserMsg.bgAddListener('expirationCacheSet', BgHandlers.expirationCacheSetHandler);
BrowserMsg.bgAddListener('expirationCacheDeleteExpired', BgHandlers.expirationCacheDeleteExpiredHandler);
BrowserMsg.bgAddListener('getApiAuthorization', BgHandlers.getApiAuthorization);
BrowserMsg.bgAddListener('settings', BgHandlers.openSettingsPageHandler);
BrowserMsg.bgAddListener('update_uninstall_url', BgHandlers.updateUninstallUrl);
BrowserMsg.bgAddListener('get_active_tab_info', BgHandlers.getActiveTabInfo);
BrowserMsg.bgAddListener('reconnect_acct_auth_popup', (r: Bm.ReconnectAcctAuthPopup) => GoogleOAuth.newAuthPopup(r));
BrowserMsg.bgAddListener('reconnect_custom_idp_acct_auth_popup', (r: Bm.ReconnectCustomIDPAcctAuthPopup) => ConfiguredIdpOAuth.newAuthPopup(r.acctEmail));
BrowserMsg.intervalAddListener('delete_expired', async () => {
  await ready;
  return inMemoryStore.deleteExpired();
});

if (Catch.isThunderbirdMail()) {
  BgHandlers.thunderbirdSecureComposeHandler(ready);
  BrowserMsg.bgAddListener('thunderbirdGetCurrentUser', BgHandlers.thunderbirdGetCurrentUserHandler);
  BrowserMsg.bgAddListener('thunderbirdMsgGet', BgHandlers.thunderbirdMsgGetHandler);
  BrowserMsg.bgAddListener('thunderbirdOpenPassphraseDialog', BgHandlers.thunderbirdOpenPassphraseDialog);
}

BrowserMsg.bgListen(ready);
BrowserMsg.alarmListen();

chrome.runtime.onInstalled.addListener(() => {
  void ready
    .then(async () => {
      await GlobalStore.set({ version: Number(VERSION.replace(/\./g, '')) });
      await BgHandlers.updateUninstallUrl({});
    })
    .catch(Catch.reportErr);
});

chrome.runtime.onStartup.addListener(() => {
  // Wake the worker on browser startup so the per-session initialization below runs.
});

void ready
  .then(async () => {
    // Session storage survives worker restarts, but is cleared on disable, reload, update, and browser restart.
    const session = await storageGet('session', ['webmailInjectionStarted']);
    if (!session.webmailInjectionStarted) {
      injectFcIntoWebmail();
      await storageSet('session', { webmailInjectionStarted: true });
    }
    if (Catch.isThunderbirdMail()) {
      await BgHandlers.thunderbirdContentScriptRegistration();
    }
  })
  .catch(Catch.reportErr);
