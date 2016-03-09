'use strict';

var account_email = $("div.msg:contains('Loading '):contains('…')").text().replace('Loading ', '').replace('…', '');

function initialize() {
  var application_signal_scope = random_string(4);
  signal_scope_set(application_signal_scope);

  signal_listen('gmail_tab', {
    close_new_message: function(data) {
      $('div.new_message').remove();
    },
    close_reply_message: function(data) {
      $('iframe#' + data.frame_id).remove();
    },
    reinsert_reply_box: function(data) {
      reinsert_reply_box(data.account_email, application_signal_scope, data.last_message_frame_id, data.last_message_frame_height, data.my_email, data.their_email);
    },
    pgp_block_iframe_set_css: function(data) {
      $('iframe#' + data.frame_id).css(data.css);
    },
    migrated: function(data) {
      start(account_email, application_signal_scope);
    },
    list_pgp_attachments_response: function(data) {
      list_pgp_attachments_response_handler(data);
    },
  });

  signal_send('background_process', 'migrate', {
    account_email: account_email,
    reply_to_signal_scope: application_signal_scope
  }, signal_scope_default_value);
}

function start(account_email, signal_scope) {
  inject_buttons(account_email, signal_scope);
  show_initial_notifications(account_email);
  replace_pgp_elements(account_email, signal_scope);
  setInterval(function() {
    replace_pgp_elements(account_email, signal_scope);
  }, 1000);
}

if((document.title.indexOf("Gmail") != -1 || document.title.indexOf("Mail") != -1) && account_email) {
  inject_meta();
  add_account_email_to_list_of_accounts(account_email);
  save_account_email_full_name_if_needed(account_email);
  var show_setup_needed_notification_if_setup_not_done = true;
  var wait_for_setup_interval = setInterval(function() {
    account_storage_get(account_email, ['setup_done', 'notification_setup_needed_dismissed'], function(storage) {
      if(storage['setup_done'] === true) {
        gmail_notification_clear();
        initialize();
        clearInterval(wait_for_setup_interval);
      } else if(!$("div.gmail_notification").length && !storage['notification_setup_needed_dismissed'] && show_setup_needed_notification_if_setup_not_done) {
        gmail_notification_show('<a href="_PLUGIN/index.htm" target="_blank">Set up CryptUP</a> to send and receive secure email on this account. <a href="#" class="notification_setup_needed_dismiss">dismiss</a> <a href="#" class="close">remind me later</a>', {
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
