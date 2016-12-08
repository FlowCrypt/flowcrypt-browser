'use strict';

var account_email = $("#loading div.msg").text().match(/[a-z0-9._]+@[a-z0-9._]+/gi)[0];
var tab_id_global = undefined;

hijack_gmail_hotkeys();
record_active_window();

function initialize() {
  chrome_message_listen({
    open_new_message: function(data) {
      open_new_message(account_email, tab_id_global);
    },
    close_new_message: function(data) {
      $('div.new_message').remove();
    },
    close_reply_message: function(data) {
      $('iframe#' + data.frame_id).remove();
    },
    reinsert_reply_box: function(data) {
      reinsert_reply_box(data.account_email, tab_id_global, data.subject, data.my_email, data.their_email);
    },
    set_css: function(data) {
      $(data.selector).css(data.css);
    },
    passphrase_dialog: function(data) {
      if(!$('#cryptup_dialog').length) {
        $('body').append(passphrase_dialog(account_email, data.type, tab_id_global));
      }
    },
    add_pubkey_dialog_gmail: function(data) {
      if(!$('#cryptup_dialog').length) {
        $('body').append(add_pubkey_dialog(account_email, data.emails, tab_id_global));
      }
    },
    notification_show: function(data) {
      gmail_notification_show(data.notification);
      $('body').one('click', gmail_notification_clear);
    },
    close_dialog: function(data) {
      $('#cryptup_dialog').remove();
    },
  });

  chrome_message_send(null, 'migrate', {
    account_email: account_email,
  }, start);
}

function hijack_gmail_hotkeys() {
  var keys = key_codes();
  $(document).keypress(function(e) {
    var causes_unsecure_reply = [keys.a, keys.r, keys.A, keys.R, keys.f, keys.F].indexOf(e.which) !== -1;
    if(causes_unsecure_reply && !$(document.activeElement).is('input, select, textarea, div[contenteditable="true"]') && $('iframe.reply_message').length) {
      e.stopImmediatePropagation();
      set_reply_box_editable(account_email, tab_id_global);
    }
  });
}

function record_active_window() {

  function record_set() {
    account_storage_set(null, {
      current_window_account_email: account_email
    });
  }

  function record_reset() {
    account_storage_remove(null, ['current_window_account_email']);
  }
  $(window).load(function() {
    if(document.hasFocus()) {
      record_set();
    }
  });
  $(window).focus(record_set);
  $(window).blur(record_reset);
  $(window).unload(record_reset);
}

function start() {
  account_storage_get(account_email, ['addresses', 'google_token_scopes'], function(storage) {
    var addresses = storage.addresses || [account_email];
    var can_read_emails = (typeof storage.google_token_scopes !== 'undefined' && storage.google_token_scopes.indexOf(GMAIL_READ_SCOPE) !== -1);
    chrome_message_get_tab_id(function(tab_id) {
      tab_id_global = tab_id;
      inject_buttons(account_email, tab_id);
      show_initial_notifications(account_email);
      replace_pgp_elements(account_email, addresses, can_read_emails, tab_id);
      setInterval(function() {
        replace_pgp_elements(account_email, addresses, can_read_emails, tab_id);
      }, 1000);
    });
  });
}

if(account_email) {
  inject_meta();
  add_account_email_to_list_of_accounts(account_email);
  save_account_email_full_name_if_needed(account_email);
  var show_setup_needed_notification_if_setup_not_done = true;
  var wait_for_setup_interval = setInterval(function() {
    account_storage_get(account_email, ['setup_done', 'cryptup_enabled', 'notification_setup_needed_dismissed'], function(storage) {
      if(storage.setup_done === true && storage.cryptup_enabled !== false) { //"not false" is due to cryptup_enabled unfedined in previous versions, which means "true"
        gmail_notification_clear();
        initialize();
        clearInterval(wait_for_setup_interval);
      } else if(!$("div.gmail_notification").length && !storage.notification_setup_needed_dismissed && show_setup_needed_notification_if_setup_not_done && storage.cryptup_enabled !== false) {
        var set_up_notification = '<a href="_PLUGIN/settings/index.htm?account_email=' + encodeURIComponent(account_email) + '" target="cryptup">Set up CryptUP</a> to send and receive secure email on this account. <a href="#" class="notification_setup_needed_dismiss">dismiss</a> <a href="#" class="close">remind me later</a>';
        gmail_notification_show(set_up_notification, {
          notification_setup_needed_dismiss: function() {
            account_storage_set(account_email, {
              notification_setup_needed_dismissed: true
            }, gmail_notification_clear);
          },
          close: function() {
            show_setup_needed_notification_if_setup_not_done = false;
          }
        });
      }
    });
  }, 1000);
}
