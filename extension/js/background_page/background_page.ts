/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { VERSION } from '../common/core/const.js';
import { Catch } from '../common/platform/catch.js';
import { Store, GlobalStore } from '../common/platform/store.js';
import { BrowserMsg, Bm } from '../common/extension.js';
import { BgAttests } from './attests.js';
import { injectFcIntoWebmailIfNeeded } from './inject.js';
import { migrateGlobal, scheduleFcSubscriptionLevelCheck } from './migrations.js';
import { GoogleAuth } from '../common/api/google.js';
import { BgUtils } from './bgutils.js';
import { BgHandlers } from './bg_handlers.js';
import { PgpMsg, Pgp } from '../common/core/pgp.js';
import { Buf } from '../common/core/buf.js';

declare const openpgp: typeof OpenPGP;

console.info('background_process.js starting');

openpgp.initWorker({ path: '/lib/openpgp.worker.js' });

let backgroundProcessStartReason = 'browser_start';
chrome.runtime.onInstalled.addListener(event => {
  backgroundProcessStartReason = event.reason;
});

(async () => {

  let db: IDBDatabase;
  let storage: GlobalStore;

  try {
    await migrateGlobal();
    await Store.setGlobal({ version: Number(VERSION.replace(/\./g, '')) });
    storage = await Store.getGlobal(['settings_seen', 'errors']);
  } catch (e) {
    await BgUtils.handleStoreErr(Store.errCategorize(e));
    return;
  }

  if (!storage.settings_seen) {
    await BgUtils.openSettingsPage('initial.htm'); // called after the very first installation of the plugin
    await Store.setGlobal({ settings_seen: true });
  }

  try {
    db = await Store.dbOpen(); // takes 4-10 ms first time
  } catch (e) {
    await BgUtils.handleStoreErr(e);
    return;
  }

  // storage related handlers
  BrowserMsg.bgAddListener('db', (r: Bm.Db) => BgHandlers.dbOperationHandler(db, r));
  BrowserMsg.bgAddListener('session_set', (r: Bm.StoreSessionSet) => Store.sessionSet(r.acctEmail, r.key, r.value));
  BrowserMsg.bgAddListener('session_get', (r: Bm.StoreSessionGet) => Store.sessionGet(r.acctEmail, r.key));
  BrowserMsg.bgAddListener('storeGlobalGet', (r: Bm.StoreGlobalGet) => Store.getGlobal(r.keys));
  BrowserMsg.bgAddListener('storeGlobalSet', (r: Bm.StoreGlobalSet) => Store.setGlobal(r.values));
  BrowserMsg.bgAddListener('storeAcctGet', (r: Bm.StoreAcctGet) => Store.getAcct(r.acctEmail, r.keys));
  BrowserMsg.bgAddListener('storeAcctSet', (r: Bm.StoreAcctSet) => Store.setAcct(r.acctEmail, r.values));

  // openpgp related handlers
  BrowserMsg.bgAddListener('pgpMsgType', (r: Bm.PgpMsgType) => PgpMsg.type({ data: Buf.fromRawBytesStr(r.rawBytesStr) }));
  BrowserMsg.bgAddListener('pgpMsgDiagnosePubkeys', PgpMsg.diagnosePubkeys);
  BrowserMsg.bgAddListener('pgpHashChallengeAnswer', async (r: Bm.PgpHashChallengeAnswer) => ({ hashed: await Pgp.hash.challengeAnswer(r.answer) }));
  BrowserMsg.bgAddListener('pgpMsgDecrypt', PgpMsg.decrypt);
  BrowserMsg.bgAddListener('pgpMsgVerifyDetached', PgpMsg.verifyDetached);

  BrowserMsg.bgAddListener('ajax', BgHandlers.ajaxHandler);
  BrowserMsg.bgAddListener('ajaxGmailAttGetChunk', BgHandlers.ajaxGmailAttGetChunkHandler);
  BrowserMsg.bgAddListener('settings', BgHandlers.openSettingsPageHandler);
  BrowserMsg.bgAddListener('inbox', BgHandlers.openInboxPageHandler);
  BrowserMsg.bgAddListener('attest_requested', BgAttests.attestRequestedHandler);
  BrowserMsg.bgAddListener('attest_packet_received', BgAttests.attestPacketReceivedHandler);
  BrowserMsg.bgAddListener('update_uninstall_url', BgHandlers.updateUninstallUrl);
  BrowserMsg.bgAddListener('get_active_tab_info', BgHandlers.getActiveTabInfo);
  BrowserMsg.bgAddListener('reconnect_acct_auth_popup', (r: Bm.ReconnectAcctAuthPopup) => GoogleAuth.newAuthPopup(r));
  BrowserMsg.bgAddListener('_tab_', BgHandlers.respondWithSenderTabId);
  BrowserMsg.bgListen();

  await BgHandlers.updateUninstallUrl({}, {});
  injectFcIntoWebmailIfNeeded();
  scheduleFcSubscriptionLevelCheck(backgroundProcessStartReason);
  BgAttests.watchForAttestEmailIfAppropriate().catch(Catch.handleErr);

  if (storage.errors && storage.errors.length && storage.errors.length > 100) { // todo - ideally we should be trimming it to show the last 100
    await Store.removeGlobal(['errors']);
  }

})().catch(Catch.handleErr);
