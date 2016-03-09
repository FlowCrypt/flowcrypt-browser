'use strict';

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
  $.each(callbacks, function(name, callback) {
    $('.gmail_notifications a.' + name).click(prevent(doubleclick(), callback));
  });
}
