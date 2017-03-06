/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

console.log('background_process.js starting');

var background_process_start_reason = 'browser_start';
chrome.runtime.onInstalled.addListener(function(event){
  background_process_start_reason = event.reason;
});
function get_background_process_start_reason() {
  return background_process_start_reason;
}

migrate_global(function () {
  account_storage_set(null, { version: catcher.version('int') });
});

tool.browser.message.listen_background({
  migrate_account: migrate_account,
  google_auth: google_auth,
  gmail_auth_code_result: google_auth_window_result_handler,
  settings: open_settings_page_handler,
  attest_requested: attest_requested_handler,
  attest_packet_received: attest_packet_received_handler,
  update_uninstall_url: update_uninstall_url,
  get_active_tab_info: get_active_tab_info,
  runtime: function (message, sender, respond) {
    respond({ environment: catcher.environment(), version: catcher.version() });
  },
  ping: function (message, sender, respond) {
    respond(true);
  },
  _tab_: function (request, sender, respond) {
    respond(sender.tab.id + ':' + sender.frameId);
  },
});

update_uninstall_url();

account_storage_get(null, 'errors', function (storage) {
  if(storage.errors && storage.errors.length && storage.errors.length > 100) {
    account_storage_remove(null, 'errors');
  }
});

if(!localStorage.settings_seen) {
  open_settings_page('initial.htm'); // called after the very first installation of the plugin
  localStorage.settings_seen = true;
}

inject_cryptup_into_gmail_if_needed();

schedule_keyserver_fingerprint_check();

function open_settings_page_handler(message, sender, respond) {
  open_settings_page(message.path, message.account_email, message.page);
  respond();
}

function get_active_tab_info(request, sender, respond) {
  chrome.tabs.query({ active: true, currentWindow: true, url: "*://mail.google.com/*", }, function (tabs) {
    if(tabs.length) {
      chrome.tabs.executeScript(tabs[0].id, { code: 'var r = {account_email: window.account_email_global, same_world: window.same_world_global}; r' }, function (result) {
        respond({ provider: 'gmail', account_email: result[0].account_email || null, same_world: result[0].same_world === true, });
      });
    } else {
      respond({ provider: null, account_email: null, same_world: null, });
    }
  });
}

function update_uninstall_url(request, sender, respond) {
  get_account_emails(function (account_emails) {
    account_storage_get(null, ['metrics'], function (storage) {
      if(typeof chrome.runtime.setUninstallURL !== 'undefined') {
        catcher.try(function () {
          chrome.runtime.setUninstallURL('https://cryptup.org/leaving.htm#' + JSON.stringify({
            email: (account_emails && account_emails.length) ? account_emails[0] : null,
            metrics: storage.metrics || null,
          }));
        })();
      }
      if(respond) {
        respond();
      }
    });
  });
}

function open_settings_page(path, account_email, page) { // todo - put directly into open_settings_page_handler
  var base_path = chrome.extension.getURL('chrome/settings/' + (path || 'index.htm'));
  if(account_email) {
    window.open(tool.env.url_create(base_path, { account_email: account_email, page: page }), 'cryptup');
  } else {
    get_account_emails(function (account_emails) {
      window.open(tool.env.url_create(base_path, { account_email: account_emails[0], page: page }), 'cryptup');
    });
  }
}
