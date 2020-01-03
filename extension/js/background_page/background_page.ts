/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../common/browser/browser-msg.js';
import { GlobalStore, Store } from '../common/platform/store.js';

import { BgHandlers } from './bg_handlers.js';
import { BgUtils } from './bgutils.js';
import { Buf } from '../common/core/buf.js';
import { Catch } from '../common/platform/catch.js';
import { GoogleAuth } from '../common/api/google-auth.js';
import { PgpHash } from '../common/core/pgp-hash.js';
import { PgpMsg } from '../common/core/pgp-msg.js';
import { VERSION } from '../common/core/const.js';
import { injectFcIntoWebmail } from './inject.js';
import { migrateGlobal } from './migrations.js';
import { openpgp } from '../common/core/pgp.js';

console.info('background_process.js starting');

openpgp.initWorker({ path: '/lib/openpgp.worker.js' });

(async () => {

  let db: IDBDatabase;
  let storage: GlobalStore;

  try {
    await migrateGlobal();
    await Store.setGlobal({ version: Number(VERSION.replace(/\./g, '')) });
    storage = await Store.getGlobal(['settings_seen']);
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
  BrowserMsg.bgAddListener('pgpHashChallengeAnswer', async (r: Bm.PgpHashChallengeAnswer) => ({ hashed: await PgpHash.challengeAnswer(r.answer) }));
  BrowserMsg.bgAddListener('pgpMsgDecrypt', PgpMsg.decrypt);
  BrowserMsg.bgAddListener('pgpMsgVerifyDetached', PgpMsg.verifyDetached);
  BrowserMsg.bgAddListener('pgpKeyDetails', BgHandlers.pgpKeyDetails);

  BrowserMsg.bgAddListener('ajax', BgHandlers.ajaxHandler);
  BrowserMsg.bgAddListener('ajaxGmailAttGetChunk', BgHandlers.ajaxGmailAttGetChunkHandler);
  BrowserMsg.bgAddListener('settings', BgHandlers.openSettingsPageHandler);
  BrowserMsg.bgAddListener('inbox', BgHandlers.openInboxPageHandler);
  BrowserMsg.bgAddListener('update_uninstall_url', BgHandlers.updateUninstallUrl);
  BrowserMsg.bgAddListener('get_active_tab_info', BgHandlers.getActiveTabInfo);
  BrowserMsg.bgAddListener('reconnect_acct_auth_popup', (r: Bm.ReconnectAcctAuthPopup) => GoogleAuth.newAuthPopup(r));
  BrowserMsg.bgAddListener('_tab_', BgHandlers.respondWithSenderTabId);
  BrowserMsg.bgListen();

  await BgHandlers.updateUninstallUrl({}, {});
  injectFcIntoWebmail();

})().catch(Catch.reportErr);
