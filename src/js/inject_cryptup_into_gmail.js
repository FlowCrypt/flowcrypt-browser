'use strict';

var account_email = $("div.msg:contains('Loading '):contains('…')").text().replace('Loading ', '').replace('…', '');

function inject_cryptup() {
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
      inject_visual_elements(account_email, application_signal_scope);
    },
  });

  signal_send('background_process', 'migrate', {
    account_email: account_email,
    reply_to_signal_scope: application_signal_scope
  }, signal_scope_default_value);
}

function inject_visual_elements(account_email, signal_scope) {
  inject_buttons(account_email, signal_scope);
  discover_and_replace_pgp_blocks(account_email, signal_scope);
  show_initial_notifications(account_email);
}

function show_initial_notifications(account_email) {
  account_storage_get(account_email, ['notification_setup_done_seen', 'key_backup_prompt', 'setup_simple'], function(storage) {
    if(!storage.notification_setup_done_seen) {
      account_storage_set(account_email, {
        notification_setup_done_seen: true
      }, function() {
        gmail_notification_show('CryptUP was successfully set up for this account. Click on green lock button on the left to send first secure message. <a href="#" class="close">got it</a>');
      });
    } else if(storage.key_backup_prompt !== false && storage.setup_simple === true) {
      gmail_notification_show('<a href="_PLUGIN/backup.htm?account_email=' + encodeURIComponent(account_email) + '">Back up your CryptUP key</a> to keep access to your encrypted email at all times. <a href="#" class="close">not now</a>');
    }
  });
}

function inject_meta() {
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/font-awesome.min.css') + '" />');
  $('body').append('<center class="gmail_notifications"></center>');
}

function inject_buttons(account_email, signal_scope) {
  $('body').append('<div class="T-I-KE T-I J-J5-Ji new_message_button"><i class="fa fa-lock"></i></div>');
  $('div.new_message_button').click(function() {
    if($('div.new_message').length == 0) {
      var url = chrome.extension.getURL('chrome/gmail_elements/new_message.htm') +
        '?account_email=' + encodeURIComponent(account_email) +
        '&signal_scope=' + encodeURIComponent(signal_scope);
      $('body').append('<div class="new_message" id="new_message"><iframe scrolling="no" src="' + url + '"></iframe></div>');
    }
  });
}

function save_account_email_full_name(account_email) {
  // will cycle until page loads and name is accessible
  // todo - create general event on_gmail_finished_loading for similar actions
  setTimeout(function() {
    var full_name = $("div.gb_hb div.gb_lb").text();
    if(full_name) {
      account_storage_set(account_email, {
        full_name: full_name
      });
    } else {
      save_account_email_full_name(account_email);
    }
  }, 1000);
}

function save_account_email_full_name_if_needed(account_email) {
  account_storage_get(account_email, 'full_name', function(value) {
    if(typeof value === 'undefined') {
      save_account_email_full_name(account_email);
    }
  });
}

function discover_and_replace_pgp_blocks(account_email, signal_scope) {
  find_and_replace_pgp_messages(account_email, signal_scope);
  setInterval(function() {
    find_and_replace_pgp_messages(account_email, signal_scope);
  }, 1000);
}

function gmail_notification_clear() {
  $('.gmail_notifications').html('');
}

function gmail_notification_show(text, callbacks) {
  $('.gmail_notifications').html('<div class="gmail_notification">' + text.replace(/_PLUGIN/g, chrome.extension.getURL('/chrome/settings')) + '</div>');
  if(!callbacks) {
    callbacks = {};
  }
  if('close' in callbacks) {
    var original_close_callback = callbacks.close;
    callbacks.close = function() {
      original_close_callback();
      gmail_notification_clear();
    }
  } else {
    callbacks.close = gmail_notification_clear;
  }
  for(var name in callbacks) {
    $('.gmail_notifications a.' + name).click(prevent(doubleclick(), callbacks[name]));
  }
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
        inject_cryptup();
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
