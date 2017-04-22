/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function content_script_notifications() {

  function show_initial_notifications(account_email) {
    account_storage_get(account_email, ['notification_setup_done_seen', 'key_backup_prompt', 'setup_simple'], function (storage) {
      if(!storage.notification_setup_done_seen) {
        account_storage_set(account_email, { notification_setup_done_seen: true }, function () {
          content_script_notification_show('CryptUp was successfully set up for this account. <a href="#" class="close">close</a>');
        });
      } else if(storage.key_backup_prompt !== false && storage.setup_simple === true) {
        content_script_notification_show('<a href="#" class="action_backup">Back up your CryptUp key</a> to keep access to your encrypted email at all times. <a href="#" class="close">not now</a>', {
          action_backup: function() {
            tool.browser.message.send(null, 'settings', { account_email: account_email, page: '/chrome/settings/modules/backup.htm' });
          },
        });
      }
    });
  }

  function content_script_notification_clear() {
    $('.webmail_notifications').html('');
  }

  function content_script_notification_show(text, callbacks, account_email) {
    $('.webmail_notifications').html('<div class="webmail_notification">' + text + '</div>');
    if(!callbacks) {
      callbacks = {};
    }
    if(typeof callbacks.close !== 'undefined') {
      var original_close_callback = callbacks.close;
      callbacks.close = catcher.try(function () {
        original_close_callback();
        content_script_notification_clear();
      });
    } else {
      callbacks.close = catcher.try(content_script_notification_clear);
    }
    if(typeof callbacks.reload === 'undefined') {
      callbacks.reload = catcher.try(function () {
        window.location.reload();
      });
    }
    if(typeof callbacks.content_settings === 'undefined') {
      callbacks.content_settings = catcher.try(function () {
        tool.browser.message.send(null, 'settings', { account_email: account_email, page: '/chrome/texts/' + tool.env.browser().name + '_content_settings.htm' });
      });
    }
    $.each(callbacks, function (name, callback) {
      $('.webmail_notifications a.' + name).click(catcher.try(tool.ui.event.prevent(tool.ui.event.double(), callback)));
    });
  }

  return {
    show_initial: show_initial_notifications,
    clear: content_script_notification_clear,
    show: content_script_notification_show,
  };

}
