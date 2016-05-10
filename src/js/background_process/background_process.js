'use strict';

console.log('background_process.js starting');

chrome_message_background_listen({
  migrate: migrate,
  google_auth: google_auth,
  chrome_auth: chrome_auth,
  gmail_auth_code_result: google_auth_window_result_handler,
  list_pgp_attachments: list_pgp_attachments,
  settings: open_settings_page_handler,
});

if(!localStorage.settings_seen) {
  open_settings_page('initial.htm'); // called after the very first installation of the plugin
  localStorage.settings_seen = true;
}
chrome.browserAction.onClicked.addListener(function() {
  open_settings_page(); // Called when the user clicks on the browser action icon.
});

function open_settings_page_handler(message, sender, respond) {
  open_settings_page(message.page, message.account_email);
}

function chrome_auth(request, sender, respond) {
  if(request.action === 'set') {
    chrome.permissions.request({
      permissions: request.permissions,
      origins: request.origins,
    }, function(granted) {
      respond(granted);
    });
  } else {
    chrome.permissions.getAll(respond);
  }
}

function list_pgp_attachments(request, sender, respond) {
  gmail_api_message_get(request.account_email, request.message_id, 'full', function(success, message) {
    if(success) {
      var attachments = gmail_api_find_attachments(message);
      var pgp_attachments = [];
      $.each(attachments, function(i, attachment) {
        if(attachment.name.match('(\.pgp)|(\.gpg)$')) {
          pgp_attachments.push(attachment);
        }
      });
      respond({
        success: true,
        attachments: pgp_attachments,
        message_id: request.message_id,
      });
    } else {
      respond({
        success: false,
        message_id: request.message_id,
      });
    }
  });
}
