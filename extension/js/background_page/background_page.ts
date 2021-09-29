/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../common/browser/browser-msg.js';
import { BgHandlers } from './bg-handlers.js';
import { BgUtils } from './bgutils.js';
import { Catch } from '../common/platform/catch.js';
import { GoogleAuth } from '../common/api/email-provider/gmail/google-auth.js';
import { VERSION } from '../common/core/const.js';
import { injectFcIntoWebmail } from './inject.js';
import { migrateGlobal, moveContactsToEmailsAndPubkeys, updateOpgpRevocations, updateX509FingerprintsAndLongids } from './migrations.js';
import { opgp } from '../common/core/crypto/pgp/openpgpjs-custom.js';
import { GlobalStoreDict, GlobalStore } from '../common/platform/store/global-store.js';
import { ContactStore } from '../common/platform/store/contact-store.js';
import { AcctStore } from '../common/platform/store/acct-store.js';
import { ExpirationCache } from '../common/core/expiration-cache.js';
import { emailKeyIndex } from '../common/core/common.js';

console.info('background_process.js starting');

opgp.initWorker({ path: '/lib/openpgp.worker.js' });

(async () => {

  let db: IDBDatabase;
  let storage: GlobalStoreDict;
  const inMemoryStore = new ExpirationCache(4 * 60 * 60 * 1000); // 4 hours
  Catch.setHandledInterval(() => inMemoryStore.deleteExpired(), 60000); // each minute

  try {
    await migrateGlobal();
    await GlobalStore.set({ version: Number(VERSION.replace(/\./g, '')) });
    storage = await GlobalStore.get(['settings_seen']);
  } catch (e) {
    await BgUtils.handleStoreErr(GlobalStore.errCategorize(e));
    return;
  }

  if (!storage.settings_seen) {
    await BgUtils.openSettingsPage('initial.htm'); // called after the very first installation of the plugin
    await GlobalStore.set({ settings_seen: true });
  }

  try {
    db = await ContactStore.dbOpen(); // takes 4-10 ms first time
    await updateOpgpRevocations(db);
    await updateX509FingerprintsAndLongids(db);
    await moveContactsToEmailsAndPubkeys(db);
  } catch (e) {
    await BgUtils.handleStoreErr(e);
    return;
  }

  // storage related handlers
  BrowserMsg.bgAddListener('db', (r: Bm.Db) => BgHandlers.dbOperationHandler(db, r));
  BrowserMsg.bgAddListener('inMemoryStoreSet', async (r: Bm.InMemoryStoreSet) => inMemoryStore.set(emailKeyIndex(r.acctEmail, r.key), r.value));
  BrowserMsg.bgAddListener('inMemoryStoreGet', async (r: Bm.InMemoryStoreGet) => inMemoryStore.get(emailKeyIndex(r.acctEmail, r.key)));
  BrowserMsg.bgAddListener('storeGlobalGet', (r: Bm.StoreGlobalGet) => GlobalStore.get(r.keys));
  BrowserMsg.bgAddListener('storeGlobalSet', (r: Bm.StoreGlobalSet) => GlobalStore.set(r.values));
  BrowserMsg.bgAddListener('storeAcctGet', (r: Bm.StoreAcctGet) => AcctStore.get(r.acctEmail, r.keys));
  BrowserMsg.bgAddListener('storeAcctSet', (r: Bm.StoreAcctSet) => AcctStore.set(r.acctEmail, r.values));

  BrowserMsg.addPgpListeners(); // todo - remove https://github.com/FlowCrypt/flowcrypt-browser/issues/2560 fixed

  BrowserMsg.bgAddListener('ajax', BgHandlers.ajaxHandler);
  BrowserMsg.bgAddListener('ajaxGmailAttachmentGetChunk', BgHandlers.ajaxGmailAttachmentGetChunkHandler);
  BrowserMsg.bgAddListener('settings', BgHandlers.openSettingsPageHandler);
  BrowserMsg.bgAddListener('update_uninstall_url', BgHandlers.updateUninstallUrl);
  BrowserMsg.bgAddListener('get_active_tab_info', BgHandlers.getActiveTabInfo);
  BrowserMsg.bgAddListener('reconnect_acct_auth_popup', (r: Bm.ReconnectAcctAuthPopup) => GoogleAuth.newAuthPopup(r));
  BrowserMsg.bgAddListener('_tab_', BgHandlers.respondWithSenderTabId);
  BrowserMsg.bgListen();

  await BgHandlers.updateUninstallUrl({}, {});
  injectFcIntoWebmail();

})().catch(Catch.reportErr);
