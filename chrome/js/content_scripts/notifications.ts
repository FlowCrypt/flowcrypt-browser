/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

class Notifications {

  private tab_id: string;

  constructor(tab_id: string) {
    this.tab_id = tab_id;
  }

  show_initial = async (account_email: string) => {
    let account_storage = await Store.get_account(account_email, ['notification_setup_done_seen', 'key_backup_prompt', 'setup_simple']);
    if (!account_storage.notification_setup_done_seen) {
      await Store.set(account_email, { notification_setup_done_seen: true });
      this.show('FlowCrypt was successfully set up for this account. <a href="#" class="close" data-test="notification-successfully-setup-action-close">close</a>');
    } else if (account_storage.key_backup_prompt !== false && account_storage.setup_simple === true) {
      this.show('<a href="#" class="action_backup">Back up your FlowCrypt key</a> to keep access to your encrypted email at all times. <a href="#" class="close">not now</a>', {
        action_backup: () => tool.browser.message.send(null, 'settings', { account_email, page: '/chrome/settings/modules/backup.htm' }),
      });
    }
  }

  show_auth_popup_needed = (account_email: string) => {
    this.show(`Please reconnect FlowCrypt to your Gmail Account. This is typically needed after a long time of no use, a password change, or similar account changes. <a href="#" class="auth_popup">Re-connect Account</a>`, {
      auth_popup: () => {
        tool.api.google.auth_popup(account_email, this.tab_id).then(auth_result => {
          this.show(`${auth_result.success ? 'Connected successfully' : 'Failed to connect'}. <a href="#" class="close">Close</a>`);
        }, error => {
          console.info(error);
          this.show(`Error connecting account. <a href="#" class="close">Close</a>`);
        });
      },
    });
  }

  clear = () => {
    $('.webmail_notifications').text('');
  }

  show = (text: string, callbacks:Dict<Callback>={}) => {
    tool.ui.sanitize_render('.webmail_notifications', `<div class="webmail_notification" data-test="webmail-notification">${text}</div>`);
    if (typeof callbacks.close !== 'undefined') {
      let original_close_callback = callbacks.close;
      callbacks.close = tool.catch.try(() => {
        original_close_callback();
        this.clear();
      });
    } else {
      callbacks.close = tool.catch.try(this.clear);
    }
    if (typeof callbacks.reload === 'undefined') {
      callbacks.reload = tool.catch.try(() => window.location.reload());
    }
    if (typeof callbacks.subscribe === 'undefined') {
      callbacks.subscribe = tool.catch.try(() => tool.browser.message.send(this.tab_id, 'subscribe_dialog'));
    }
    for (let name of Object.keys(callbacks)) {
      $(`.webmail_notifications a.${name}`).click(tool.ui.event.prevent(tool.ui.event.double(), callbacks[name]));
    }
  }

}
