/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from './store.js';
import { Dict } from './common.js';
import { Api } from './api.js';
import { BrowserMsg } from './extension.js';
import { Xss, Ui } from './browser.js';
import { Lang } from './lang.js';
import { Catch } from './catch.js';

export type NotificationWithHandlers = { notification: string, callbacks: Dict<() => void> };

export class Notifications {

  private tabId: string;

  constructor(tabId: string) {
    this.tabId = tabId;
  }

  showInitial = async (acctEmail: string) => {
    let acctStorage = await Store.getAcct(acctEmail, ['notification_setup_done_seen', 'key_backup_prompt', 'setup_simple']);
    if (!acctStorage.notification_setup_done_seen) {
      await Store.set(acctEmail, { notification_setup_done_seen: true });
      this.show('FlowCrypt was successfully set up for this account. <a href="#" class="close" data-test="notification-successfully-setup-action-close">close</a>');
    } else if (acctStorage.key_backup_prompt !== false && acctStorage.setup_simple === true) {
      this.show('<a href="#" class="action_backup">Back up your FlowCrypt key</a> to keep access to your encrypted email at all times. <a href="#" class="close">not now</a>', {
        action_backup: () => BrowserMsg.send(null, 'settings', { acctEmail, page: '/chrome/settings/modules/backup.htm' }),
      });
    }
  }

  showAuthPopupNeeded = (acctEmail: string) => {
    this.show(`${Lang.compose.pleaseReconnectAccount} <a href="#" class="auth_popup">Re-connect Account</a>`, {
      auth_popup: () => {
        Api.google.authPopup(acctEmail, this.tabId).then(authRes => {
          this.show(`${authRes.success ? 'Connected successfully' : 'Failed to connect'}. <a href="#" class="close">Close</a>`);
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

  show = (text: string, callbacks: Dict<() => void> = {}) => {
    Xss.sanitizeRender('.webmail_notifications', `<div class="webmail_notification" data-test="webmail-notification">${text}</div>`);
    if (typeof callbacks.close !== 'undefined') {
      let origCloseCb = callbacks.close;
      callbacks.close = Catch.try(() => {
        origCloseCb();
        this.clear();
      });
    } else {
      callbacks.close = Catch.try(this.clear);
    }
    if (typeof callbacks.reload === 'undefined') {
      callbacks.reload = Catch.try(() => window.location.reload());
    }
    if (typeof callbacks.subscribe === 'undefined') {
      callbacks.subscribe = Catch.try(() => BrowserMsg.send(this.tabId, 'subscribe_dialog'));
    }
    for (let name of Object.keys(callbacks)) {
      $(`.webmail_notifications a.${name}`).click(Ui.event.prevent('double', callbacks[name]));
    }
  }

}
