'use strict';

console.log('background_process.js starting');

chrome_message_background_listen({
  migrate: migrate,
  google_auth: google_auth,
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

account_storage_get(null, 'errors', function(storage) {
  if(storage.errors && storage.errors.length && storage.errors.length > 100) {
    account_storage_remove(null, 'errors');
  }
});

if(!localStorage.settings_seen) {
  open_settings_page('initial.htm'); // called after the very first installation of the plugin
  localStorage.settings_seen = true;
  inject_cryptup_into_gmail_if_needed('notification_only');
}

Try(check_keyserver_pubkey_fingerprints)();
TrySetInterval(check_keyserver_pubkey_fingerprints, 1000 * 60 * 60 * 6);

function open_settings_page_handler(message, sender, respond) {
  open_settings_page(message.path, message.account_email, message.page);
  respond();
}

function list_pgp_attachments(request, sender, respond) {
  gmail_api_message_get(request.account_email, request.message_id, 'full', function(success, message) {
    if(success) {
      var attachments = gmail_api_find_attachments(message);
      var pgp_attachments = [];
      var pgp_messages = [];
      $.each(attachments, function(i, attachment) {
        if(attachment.name.match('(\.pgp)|(\.gpg)$')) {
          pgp_attachments.push(attachment);
        } else if(attachment.name.match('(\.asc)$') || attachment.name === '') {
          pgp_messages.push(attachment);
        }
      });
      respond({
        success: true,
        attachments: pgp_attachments,
        messages: pgp_messages,
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

function update_uninstall_url(request, sender, respond) {
  get_account_emails(function(account_emails) {
    account_storage_get(null, ['metrics'], function(storage) {
      if(typeof chrome.runtime.setUninstallURL !== 'undefined') {
        chrome.runtime.setUninstallURL('https://cryptup.org/leaving.htm#' + encodeURIComponent(JSON.stringify({
          email: (account_emails && account_emails.length) ? account_emails[0] : null,
          metrics: storage.metrics || null,
        })));
      }
      if(respond) {
        respond();
      }
    });
  });
}
