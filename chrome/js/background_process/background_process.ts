/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />
/// <reference path="../../../node_modules/@types/openpgp/index.d.ts" />
/// <reference path="../common/common.d.ts" />

const MAX_MESSAGE_SIZE = 1024 * 1024;

console.log('background_process.js starting');

openpgp.initWorker({path: 'lib/openpgp.worker.js'});

let background_process_start_reason = 'browser_start';
chrome.runtime.onInstalled.addListener(event => { background_process_start_reason = event.reason });

(async() => {

  let db: IDBDatabase;

  await migrate_global();
  await Store.set(null, { version: catcher.version('int') as number|null });
  let storage = await Store.get_global(['settings_seen', 'errors']);
  if(!storage.settings_seen) {
    open_settings_page('initial.htm'); // called after the very first installation of the plugin
    await Store.set(null, {settings_seen: true});
  }
  
  try {
    db = await Store.db_open(); // takes 4-10 ms first time
  } catch (e) {
    if(e instanceof StoreDbCorruptedError) {
      open_settings_page('fatal.htm?reason=db_corrupted');
    } else if (e instanceof StoreDbDeniedError) {
      open_settings_page('fatal.htm?reason=db_denied');
    }
    return;
  }

  tool.browser.message.listen_background({
    bg_exec: execute_in_background_process_and_respond_when_done,
    db: (request, sender, respond) => db_operation(request as BrowserMessageRequestDb, sender, respond, db),
    session_set: (r: BrowserMessageRequestSessionSet, sender, respond) => Store.session_set(r.account_email, r.key, r.value).then(respond),
    session_get: (r: BrowserMessageRequestSessionGet, sender, respond) => Store.session_get(r.account_email, r.key).then(respond),
    close_popup: (r: chrome.tabs.QueryInfo, sender, respond) => chrome.tabs.query(r, tabs => chrome.tabs.remove(tabs.map(t => t.id!))),
    migrate_account: migrate_account,
    settings: open_settings_page_handler,
    attest_requested: attest_requested_handler,
    attest_packet_received: attest_packet_received_handler,
    update_uninstall_url: update_uninstall_url,
    get_active_tab_info: get_active_tab_info,
    runtime: (message, sender, respond) => respond({ environment: catcher.environment(), version: catcher.version() }),
    ping: (message, sender, respond) => respond(true),
    _tab_: (request, sender, respond) => {
      if(sender === 'background') {
        respond(null); // background script
      } else if(sender === null || sender === undefined) {
        respond(undefined); // not sure when or why this happens - maybe orphaned frames during update
      } else if(sender.tab) { 
        // firefox doesn't include frameId due to a bug: https://bugzilla.mozilla.org/show_bug.cgi?id=1354337
        // fixed in FF55, but currently we still support v52: https://flowcrypt.com/api/update/firefox
        respond(sender.tab.id + ':' + (typeof sender.frameId !== 'undefined' ? sender.frameId : ''));
      } else {
        tool.catch.report('sender.tab is undefined');
        respond(undefined);
      }
    },
  });
  
  update_uninstall_url(null, 'background', tool.noop);

  inject_cryptup_into_webmail_if_needed();
  
  schedule_cryptup_subscription_level_check();

  if(storage.errors && storage.errors.length && storage.errors.length > 100) { // todo - ideally we should be concating it to show the last 100
    await Store.remove(null, ['errors']);
  }
  
  function open_settings_page_handler(message: {path: string, account_email: string, page: string, page_url_params: Dict<FlatTypes>}, sender: chrome.runtime.MessageSender|'background', respond: Callback) {
    open_settings_page(message.path, message.account_email, message.page, message.page_url_params);
    respond();
  }
  
  function get_active_tab_info(message: Dict<any>|null, sender: chrome.runtime.MessageSender|'background', respond: Callback) {
    chrome.tabs.query({ active: true, currentWindow: true, url: ["*://mail.google.com/*", "*://inbox.google.com/*"] }, (tabs) => {
      if(tabs.length) {
        if(tabs[0].id !== undefined) {
          chrome.tabs.executeScript(tabs[0].id!, { code: 'var r = {account_email: window.account_email_global, same_world: window.same_world_global}; r' }, result => {
            respond({ provider: 'gmail', account_email: result[0].account_email || null, same_world: result[0].same_world === true });
          });  
        } else {
          tool.catch.report('tabs[0].id is undefined');
        }
      } else {
        respond({ provider: null, account_email: null, same_world: null });
      }
    });
  }
  
  function get_cryptup_settings_tab_id_if_open(callback: Callback) {
    chrome.tabs.query({ currentWindow: true }, tabs => {
      let extension = chrome.extension.getURL('/');
      for(let tab of tabs) {
        if(tool.value(extension).in(tab.url || '')) {
          callback(tab.id);
          return;
        }
      }
      callback(null);
    });
  }
  
  function update_uninstall_url(request: Dict<any>|null, sender: chrome.runtime.MessageSender|'background', respond: Callback) {
    Store.account_emails_get().then((account_emails) => {
      if(typeof chrome.runtime.setUninstallURL !== 'undefined') {
        catcher.try(function () {
          chrome.runtime.setUninstallURL('https://flowcrypt.com/leaving.htm#' + JSON.stringify({
            email: (account_emails && account_emails.length) ? account_emails[0] : null,
            metrics: null,
          }));
        })();
      }
      if(respond) {
        respond();
      }
    });
  }
  
  function open_settings_page(path:string='index.htm', account_email:string|null=null, page:string='', page_url_params:Dict<FlatTypes>|null=null) {
    let base_path = chrome.extension.getURL(`chrome/settings/${path}`);
    get_cryptup_settings_tab_id_if_open(function(opened_tab) {
      let open_tab = opened_tab ? (url: string) => { chrome.tabs.update(opened_tab, {url: url, active: true}); } : (url: string) => { chrome.tabs.create({url: url}); };
      if(account_email) {
        open_tab(tool.env.url_create(base_path, { account_email: account_email, page: page, page_url_params: page_url_params ? JSON.stringify(page_url_params) : null}));
      } else {
        Store.account_emails_get().then((account_emails) => {
          open_tab(tool.env.url_create(base_path, { account_email: account_emails[0], page: page, page_url_params: page_url_params ? JSON.stringify(page_url_params) : null }));
        });
      }
    });
  }
    
  function db_operation(request: BrowserMessageRequestDb, sender: chrome.runtime.MessageSender|'background', respond: Callback, db: IDBDatabase) {
    catcher.try(() => {
      if(db) {
        // @ts-ignore due to https://github.com/Microsoft/TypeScript/issues/6480
        Store[request.f].apply(null, [db].concat(request.args)).then(respond);
      } else {
        catcher.log('db corrupted, skipping: ' + request.f);
      }
    })();
  }
  
  function execute_in_background_process_and_respond_when_done(message: Dict<any>, sender: chrome.runtime.MessageSender|'background', respond: Callback) {
    function convert_large_data_to_object_urls_and_respond(result: DecryptSuccess|DecryptError|any) {
      if(message.path === 'tool.crypto.message.decrypt') {
        if(result && result.success && result.content && result.content.data && (result.content.data.length >= MAX_MESSAGE_SIZE || result.content.data instanceof Uint8Array)) {
          result.content.data = tool.file.object_url_create(result.content.data);
        }
      }
      respond(result);
    }
    let has_callback = false;
    let args = (message.args || []).map((arg: any) => {
      if(arg === tool.browser.message.cb) {
        has_callback = true;
        return convert_large_data_to_object_urls_and_respond;
      } else if(typeof arg === 'string' && arg.indexOf('blob:' + chrome.runtime.getURL('')) === 0) {
        return tool.file.object_url_consume(arg);
      } else {
        return arg;
      }
    });
    Promise.all(args).then(resolved_args => {
      let f:Function|object|null = null;
      for(let step of message.path.split('.')) {
        if(f === null && step === 'tool') {
          f = tool;
        } else if (f === null && step === 'window') {
          f = window;
        } else {
          // @ts-ignore - traversible / eventually callable object
          f = f[step];
        }
      }
      let returned = (f as Function).apply(null, resolved_args); // the actual operation
      if(!has_callback) {
        if(typeof returned === 'object' && typeof returned.then === 'function') { // got a promise
          returned.then(convert_large_data_to_object_urls_and_respond, catcher.handle_promise_error);
        } else { // direct value
          convert_large_data_to_object_urls_and_respond(returned);
        }
      }
    });
  }

})();