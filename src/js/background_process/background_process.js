'use strict';

console.log('background_process.js starting');

chrome_message_background_listen({
  migrate: migrate,
  google_auth: google_auth,
  chrome_auth: chrome_auth,
  gmail_auth_code_result: google_auth_window_result_handler,
  list_pgp_attachments: list_pgp_attachments,
  settings: open_settings_page_handler,
  attest_requested: attest_requested_handler,
  attest_packet_received: attest_packet_received_handler,
  update_uninstall_url: update_uninstall_url,
  runtime: function(message, sender, respond) {
    respond({
      environment: get_environment(),
      version: chrome.runtime.getManifest().version,
    });
  },
  ping: function(message, sender, respond) {
    respond(true);
  },
  _tab_: function(request, sender, respond) {
    respond(sender.tab.id);
  },
});

update_uninstall_url();

if(!localStorage.settings_seen) {
  open_settings_page('initial.htm'); // called after the very first installation of the plugin
  localStorage.settings_seen = true;
}

function open_settings_page_handler(message, sender, respond) {
  open_settings_page(message.path, message.account_email, message.page);
  respond();
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

function update_uninstall_url() {
  get_account_emails(function(account_emails) {
    account_storage_get(null, ['metrics'], function(storage) {
      chrome.runtime.setUninstallURL('https://cryptup.org/leaving.htm#' + encodeURIComponent(JSON.stringify({
        email: (account_emails && account_emails.length) ? account_emails[0] : null,
        metrics: storage.metrics || null,
      })));
    });
  });
}
