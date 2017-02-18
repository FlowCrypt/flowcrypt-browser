/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function init_elements_notifications_js() {

  function show_initial_notifications(account_email) {
    account_storage_get(account_email, ['notification_setup_done_seen', 'key_backup_prompt', 'setup_simple'], function (storage) {
      if(!storage.notification_setup_done_seen) {
        account_storage_set(account_email, { notification_setup_done_seen: true }, function () {
          gmail_notification_show('CryptUp was successfully set up for this account. <a href="#" class="close">close</a>');
        });
      } else if(storage.key_backup_prompt !== false && storage.setup_simple === true) {
        var backup_url = tool.env.url_create('_PLUGIN/settings/modules/backup.htm', { account_email: account_email });
        gmail_notification_show('<a href="' + backup_url + '">Back up your CryptUp key</a> to keep access to your encrypted email at all times. <a href="#" class="close">not now</a>');
      }
    });
  }

  function gmail_notification_clear() {
    $('.gmail_notifications').html('');
  }

  function gmail_notification_show(text, callbacks) {
    $('.gmail_notifications').html('<div class="gmail_notification">' + text.replace(/_PLUGIN/g, chrome.extension.getURL('/chrome')) + '</div>');
    if(!callbacks) {
      callbacks = {};
    }
    if(typeof callbacks.close !== 'undefined') {
      var original_close_callback = callbacks.close;
      callbacks.close = function () {
        original_close_callback();
        gmail_notification_clear();
      };
    } else {
      callbacks.close = gmail_notification_clear;
    }
    if(typeof callbacks.reload === 'undefined') {
      callbacks.reload = function () {
        window.location.reload();
      };
    }
    $.each(callbacks, function (name, callback) {
      $('.gmail_notifications a.' + name).click(catcher.try(tool.ui.event.prevent(tool.ui.event.double(), callback)));
    });
  }

  return {
    show_initial: show_initial_notifications,
    clear: gmail_notification_clear,
    show: gmail_notification_show,
  };

}
