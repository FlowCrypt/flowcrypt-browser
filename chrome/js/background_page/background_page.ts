/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store, StoreDbCorruptedError, StoreDbDeniedError, StoreDbFailedError, FlatTypes } from '../common/store.js';
import { Env, Catch, Value, Dict } from '../common/common.js';
import { BgExec, BrowserMessageHandler, BrowserMessageRequestDb, BrowserMessageRequestSessionSet, BrowserMessageRequestSessionGet, BrowserMsg } from '../common/extension.js';
import { BgAttests } from './attests.js';
import { inject_cryptup_into_webmail_if_needed } from './inject.js';
import { migrate_account, migrate_global, schedule_cryptup_subscription_level_check } from './migrations.js';

declare let openpgp: typeof OpenPGP;

console.info('background_process.js starting');

openpgp.initWorker({path: '/lib/openpgp.worker.js'});

let background_process_start_reason = 'browser_start';
chrome.runtime.onInstalled.addListener(event => {
  background_process_start_reason = event.reason;
});

(async () => {

  let db: IDBDatabase;

  await migrate_global();
  await Store.set(null, { version: Catch.version('int') as number|null });
  let storage = await Store.get_global(['settings_seen', 'errors']);

  let open_flowcrypt_tab = async (url: string) => {
    let opened_tab = await get_cryptup_settings_tab_id_if_open();
    if(opened_tab === null) {
      chrome.tabs.create({url});
    } else {
      chrome.tabs.update(opened_tab, {url, active: true});
    }
  };

  let open_settings_page = async (path:string='index.htm', account_email:string|null=null, page:string='', _page_url_params:Dict<FlatTypes>|null=null, add_new_account=false) => {
    let base_path = chrome.extension.getURL(`chrome/settings/${path}`);
    let page_url_params = _page_url_params ? JSON.stringify(_page_url_params) : null;
    if (account_email) {
      await open_flowcrypt_tab(Env.url_create(base_path, { account_email, page, page_url_params}));
    } else if(add_new_account) {
      await open_flowcrypt_tab(Env.url_create(base_path, { add_new_account }));
    } else {
      let account_emails = await Store.account_emails_get();
      await open_flowcrypt_tab(Env.url_create(base_path, { account_email: account_emails[0], page, page_url_params}));
    }
  };

  let open_settings_page_handler: BrowserMessageHandler = async (message: {path: string, account_email: string, page: string, page_url_params: Dict<FlatTypes>, add_new_account?: boolean}, sender, respond) => {
    await open_settings_page(message.path, message.account_email, message.page, message.page_url_params, message.add_new_account === true);
    respond();
  };

  let open_inbox_page_handler: BrowserMessageHandler = async (message: {account_email: string, thread_id?: string, folder?: string}, sender, respond) => {
    await open_flowcrypt_tab(Env.url_create(chrome.extension.getURL(`chrome/settings/inbox/inbox.htm`), message));
    respond();
  };

  let get_active_tab_info: BrowserMessageHandler = (message: Dict<any>|null, sender, respond) => {
    chrome.tabs.query({ active: true, currentWindow: true, url: ["*://mail.google.com/*", "*://inbox.google.com/*"] }, (tabs) => {
      if (tabs.length) {
        if (tabs[0].id !== undefined) {
          chrome.tabs.executeScript(tabs[0].id!, { code: 'var r = {account_email: window.account_email_global, same_world: window.same_world_global}; r' }, result => {
            respond({ provider: 'gmail', account_email: result[0].account_email || null, same_world: result[0].same_world === true });
          });
        } else {
          Catch.report('tabs[0].id is undefined');
        }
      } else {
        respond({ provider: null, account_email: null, same_world: null });
      }
    });
  };

  let get_cryptup_settings_tab_id_if_open = (): Promise<number|null> => new Promise(resolve => {
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

  let update_uninstall_url: BrowserMessageHandler = async (request: Dict<any>|null, sender, respond) => {
    respond();
    let account_emails = await Store.account_emails_get();
    if (typeof chrome.runtime.setUninstallURL !== 'undefined') {
      let email = (account_emails && account_emails.length) ? account_emails[0] : null;
      chrome.runtime.setUninstallURL(`https://flowcrypt.com/leaving.htm#${JSON.stringify({email, metrics: null})}`);
    }
  };

  let db_operation = (request: BrowserMessageRequestDb, sender: chrome.runtime.MessageSender|'background', respond: Function, db: IDBDatabase) => { // tslint:disable-line:ban-types
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
    await open_settings_page('initial.htm'); // called after the very first installation of the plugin
    await Store.set(null, {settings_seen: true});
  }

  try {
    db = await Store.db_open(); // takes 4-10 ms first time
  } catch (e) {
    if (e instanceof StoreDbCorruptedError) {
      await open_settings_page('fatal.htm?reason=db_corrupted');
    } else if (e instanceof StoreDbDeniedError) {
      await open_settings_page('fatal.htm?reason=db_denied');
    } else if (e instanceof StoreDbFailedError) {
      await open_settings_page('fatal.htm?reason=db_failed');
    }
    return;
  }

  BrowserMsg.listen_background({
    bg_exec: BgExec.background_request_handler,
    db: (request, sender, respond) => db_operation(request as BrowserMessageRequestDb, sender, respond, db),
    session_set: (r: BrowserMessageRequestSessionSet, sender, respond) => Store.session_set(r.account_email, r.key, r.value).then(respond).catch(Catch.rejection),
    session_get: (r: BrowserMessageRequestSessionGet, sender, respond) => Store.session_get(r.account_email, r.key).then(respond).catch(Catch.rejection),
    close_popup: (r: chrome.tabs.QueryInfo, sender, respond) => chrome.tabs.query(r, tabs => chrome.tabs.remove(tabs.map(t => t.id!))),
    migrate_account,
    settings: open_settings_page_handler,
    inbox: open_inbox_page_handler,
    attest_requested: BgAttests.attest_requested_handler,
    attest_packet_received: BgAttests.attest_packet_received_handler,
    update_uninstall_url,
    get_active_tab_info,
    runtime: (message, sender, respond) => respond({ environment: Catch.environment(), version: Catch.version() }),
    ping: (message, sender, respond) => respond(true),
    _tab_: (request, sender, respond) => {
      if (sender === 'background') {
        respond({tab_id: null}); // background script - direct
      } else if (sender === null || sender === undefined) {
        respond({tab_id: undefined}); // not sure when or why this happens - maybe orphaned frames during update
      } else if (sender.tab) {
        // firefox doesn't include frameId due to a bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1354337
        // fixed in FF55, but currently we still support v52: https://flowcrypt.com/api/update/firefox
        respond({tab_id: `${sender.tab.id}:${(typeof sender.frameId !== 'undefined' ? sender.frameId : '')}`});
      } else {
        // sender.tab: "This property will only be present when the connection was opened from a tab (including content scripts)"
        // https://developers.chrome.com/extensions/runtime#type-MessageSender
        // MDN says the same - thus this is most likely a background script, through browser message passing
        respond({tab_id: null});
      }
    },
  });

  update_uninstall_url(null, 'background', Value.noop);
  inject_cryptup_into_webmail_if_needed();
  schedule_cryptup_subscription_level_check(background_process_start_reason);
  BgAttests.watch_for_attest_email_if_appropriate().catch(Catch.rejection);

  if (storage.errors && storage.errors.length && storage.errors.length > 100) { // todo - ideally we should be concating it to show the last 100
    await Store.remove(null, ['errors']);
  }

})().catch(Catch.rejection);
