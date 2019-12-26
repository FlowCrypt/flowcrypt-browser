/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../../js/common/browser/browser-msg.js';

import { Dict } from '../../../../js/common/core/common.js';
import { GoogleAuth } from '../../../../js/common/api/google-auth.js';
import { InboxView } from '../inbox.js';
import { Notifications } from '../../../../js/common/notifications.js';
import { ViewModule } from '../../../../js/common/view_module.js';

export class InboxNotificationModule extends ViewModule<InboxView> {

  private readonly notifications: Notifications;

  constructor(view: InboxView) {
    super(view);
    this.notifications = new Notifications(view.tabId);
  }

  public render = () => {
    this.view.S.cached('body').prepend(this.view.factory.metaNotificationContainer()); // xss-safe-factory
    this.setHandlers();
  }

  public renderAndHandleAuthPopupNotification = (insufficientPermission = false) => {
    let msg = `Your Google Account needs to be re-connected to your browser <a href="#" class="action_auth_popup">Connect Account</a>`;
    if (insufficientPermission) {
      msg = `Permission missing to load inbox <a href="#" class="action_add_permission">Revise Permissions</a>`;
    }
    const newAuthPopup = async () => {
      await GoogleAuth.newAuthPopup({ acctEmail: this.view.acctEmail });
      window.location.reload();
    };
    this.showNotification(msg, { action_auth_popup: newAuthPopup, action_add_permission: newAuthPopup });
  }

  public showNotification = (notification: string, callbacks?: Dict<() => void>) => {
    this.notifications.show(notification, callbacks);
    $('body').one('click', this.view.setHandler(this.notifications.clear));
  }

  private setHandlers = () => {
    BrowserMsg.addListener('notification_show', this.notificationShowHandler);
    BrowserMsg.addListener('notification_show_auth_popup_needed', async ({ acctEmail }: Bm.NotificationShowAuthPopupNeeded) => {
      this.notifications.showAuthPopupNeeded(acctEmail);
    });
  }

  private notificationShowHandler: Bm.AsyncResponselessHandler = async ({ notification, callbacks }: Bm.NotificationShow) => {
    this.showNotification(notification, callbacks);
  }

}
