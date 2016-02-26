'use strict';

console.log('background_process.js starting');

signal_scope_set(signal_scope_default_value);

signal_listen('background_process', {
  gmail_auth_request: google_auth_request_handler,
  gmail_auth_code_result: google_auth_window_result_handler,
  migrate: migrate,
});


function open_settings_page() {
  window.open(chrome.extension.getURL('chrome/settings/index.htm'), 'cryptup');
  // chrome.tabs.create({url: chrome.extension.getURL('settings.htm')});
}

if (!localStorage.settings_seen) {
  open_settings_page();
}
// chrome.extension.onConnect.addListener(open_or_focus_plugin_page);

// Called when the user clicks on the browser action icon.
chrome.browserAction.onClicked.addListener(open_settings_page);
