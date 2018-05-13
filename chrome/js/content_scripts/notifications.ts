/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

/// <reference path="../../../node_modules/@types/chrome/index.d.ts" />
/// <reference path="../../../node_modules/@types/jquery/index.d.ts" />
/// <reference path="common.d.ts" />

class Notifications {

  private tab_id: string;

  constructor(tab_id: string) {
    this.tab_id = tab_id;
  }

  show_initial = (account_email: string) => {
    Store.get(account_email, ['notification_setup_done_seen', 'key_backup_prompt', 'setup_simple']).then((account_storage: Dict<boolean>) => {
      if(!account_storage.notification_setup_done_seen) {
        Store.set(account_email, { notification_setup_done_seen: true }).then(() => {
          this.show('FlowCrypt was successfully set up for this account. <a href="#" class="close" data-test="notification-successfully-setup-action-close">close</a>');
        });
      } else if(account_storage.key_backup_prompt !== false && account_storage.setup_simple === true) {
        this.show('<a href="#" class="action_backup">Back up your FlowCrypt key</a> to keep access to your encrypted email at all times. <a href="#" class="close">not now</a>', {
          action_backup: () => tool.browser.message.send(null, 'settings', { account_email: account_email, page: '/chrome/settings/modules/backup.htm' }),
        });
      }
    });
  }

  clear = () => {
    $('.webmail_notifications').html('');
  }

  show = (text: string, callbacks:Dict<Callback>={}) => {
    $('.webmail_notifications').html(`<div class="webmail_notification" data-test="webmail-notification">${text}</div>`);
    if(typeof callbacks.close !== 'undefined') {
      let original_close_callback = callbacks.close;
      callbacks.close = catcher.try(() => {
        original_close_callback();
        this.clear();
      });
    } else {
      callbacks.close = catcher.try(this.clear);
    }
    if(typeof callbacks.reload === 'undefined') {
      callbacks.reload = catcher.try(() => window.location.reload());
    }
    if(typeof callbacks.subscribe === 'undefined') {
      callbacks.subscribe = catcher.try(() => tool.browser.message.send(this.tab_id, 'subscribe_dialog'));
    }
    tool.each(callbacks, (name, callback) => {
      $(`.webmail_notifications a.${name}`).click(catcher.try(tool.ui.event.prevent(tool.ui.event.double(), callback)));
    });
  }

}