/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from './browser/browser-msg.js';
import { Ui } from './browser/ui.js';
import { Dict, Str } from './core/common.js';
import { Lang } from './lang.js';
import { Catch } from './platform/catch.js';
import { AcctStore } from './platform/store/acct-store.js';
import { Xss } from './platform/xss.js';

export class Notifications {

  public showInitial = async (acctEmail: string) => {
    const acctStorage = await AcctStore.get(acctEmail, ['notification_setup_done_seen']);
    if (!acctStorage.notification_setup_done_seen) {
      await AcctStore.set(acctEmail, { notification_setup_done_seen: true });
      this.show('FlowCrypt was successfully set up for this account. <a href="#" class="close" data-test="notification-successfully-setup-action-close">close</a>');
    }
  };

  public showAuthPopupNeeded = (acctEmail: string) => {
    this.clearAll();
    this.show(`${Lang.compose.pleaseReconnectAccount} <a href="#" class="auth_popup" data-test="action-reconnect-account">Re-connect Account</a>`, {
      auth_popup: async () => {
        await this.reconnectAcctAuthPopup(acctEmail);
      },
    });
  };

  public clearAll = () => {
    $('.webmail_notifications').text('');
  };

  public clear = (className: string) => {
    $(`.webmail_notifications .${className}`)?.remove();
  };

  public show = (text: string, callbacks: Dict<() => void> = {}) => {
    console.log(text);
    const className = `webmail_notification_${Str.sloppyRandom(6)}`;
    Xss.sanitizeAppend('.webmail_notifications', `<div class="webmail_notification ${className}" data-test="webmail-notification">${text}</div>`);
    if (typeof callbacks.close !== 'undefined') {
      const origCloseCb = callbacks.close;
      callbacks.close = Catch.try(() => {
        origCloseCb();
        this.clear(className);
      });
    } else {
      callbacks.close = Catch.try(() => this.clear(className));
    }
    if (typeof callbacks.reload === 'undefined') {
      callbacks.reload = Catch.try(() => window.location.reload());
    }
    for (const name of Object.keys(callbacks)) {
      $(`.${className} .${name}`).click(Ui.event.prevent('double', callbacks[name]));
    }
    return className;
  };

  private reconnectAcctAuthPopup = async (acctEmail: string) => {
    const authRes = await BrowserMsg.send.bg.await.reconnectAcctAuthPopup({ acctEmail });
    if (authRes.result === 'Success') {
      this.show(`Connected successfully. You may need to reload the tab. <a href="#" class="close">Close</a>`);
    } else if (authRes.result === 'Denied') {
      this.show(`Connection successful. Please also add missing permissions <a href="#" class="add_missing_permission", data-test="action-add-missing-permission">Add permission now</a>`, {
        add_missing_permission: async () => {
          await this.reconnectAcctAuthPopup(acctEmail);
        }
      });
    } else {
      this.show(`Failed to connect (${authRes.result}) ${authRes.error || ''}. <a href="#" class="close">Close</a>`);
    }
  };
}
