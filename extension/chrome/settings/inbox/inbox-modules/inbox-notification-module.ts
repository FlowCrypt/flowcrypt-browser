/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Bm, BrowserMsg } from '../../../../js/common/browser/browser-msg.js';

import { Dict } from '../../../../js/common/core/common.js';
import { GoogleOAuth } from '../../../../js/common/api/authentication/google/google-oauth.js';
import { InboxView } from '../inbox.js';
import { NotificationGroupType, Notifications } from '../../../../js/common/notifications.js';
import { ViewModule } from '../../../../js/common/view-module.js';

export class InboxNotificationModule extends ViewModule<InboxView> {
  private readonly notifications: Notifications;

  public constructor(view: InboxView) {
    super(view);
    this.notifications = new Notifications();
  }

  public render = () => {
    this.view.S.cached('body').prepend(this.view.factory.metaNotificationContainer()); // xss-safe-factory
    this.setHandlers();
  };

  public renderAndHandleAuthPopupNotification = (insufficientPermission = false) => {
    let msg = `Your Google Account needs to be re-connected to your browser <a href="#" class="action_auth_popup">Connect Account</a>`;
    if (insufficientPermission) {
      msg = `Permission missing to load inbox <a href="#" class="action_add_permission">Revise Permissions</a>`;
    }
    const newAuthPopup = async () => {
      await GoogleOAuth.newAuthPopup({ acctEmail: this.view.acctEmail });
      window.location.reload();
    };
    // eslint-disable-next-line @typescript-eslint/naming-convention
    this.showNotification(msg, 'setup', { action_auth_popup: newAuthPopup, action_add_permission: newAuthPopup });
  };

  public showNotification = (notification: string, group: NotificationGroupType, callbacks?: Dict<() => void>) => {
    this.notifications.show(notification, callbacks, group);
    $('body').one(
      'click',
      this.view.setHandler(() => this.notifications.clear(group))
    );
  };

  private setHandlers = () => {
    BrowserMsg.addListener('notification_show', this.notificationShowHandler);
    BrowserMsg.addListener('notification_show_auth_popup_needed', async ({ acctEmail }: Bm.NotificationShowAuthPopupNeeded) => {
      this.notifications.showAuthPopupNeeded(acctEmail);
    });
    BrowserMsg.addListener('notification_show_custom_idp_auth_popup_needed', async ({ acctEmail }: Bm.NotificationShowAuthPopupNeeded) => {
      this.notifications.showCustomIDPAuthPopupNeeded(acctEmail);
    });
  };

  private notificationShowHandler: Bm.AsyncResponselessHandler = async ({ notification, callbacks, group }: Bm.NotificationShow) => {
    this.showNotification(notification, group, callbacks);
  };
}
