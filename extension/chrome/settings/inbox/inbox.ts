/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store, AccountStore } from '../../../js/common/platform/store.js';
import { Url } from '../../../js/common/core/common.js';
import { Ui, SelCache } from '../../../js/common/browser/ui.js';
import { Injector } from '../../../js/common/inject.js';
import { Settings } from '../../../js/common/settings.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Assert } from '../../../js/common/assert.js';
import { XssSafeFactory } from '../../../js/common/xss_safe_factory.js';
import { WebmailCommon } from "../../../js/common/webmail.js";
import { Gmail } from '../../../js/common/api/email_provider/gmail/gmail.js';
import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { View } from '../../../js/common/view.js';
import { InboxMenuModule } from './inbox_modules/inbox_menu_module.js';
import { InboxThreadsModule } from './inbox_modules/inbox_threads_module.js';
import { InboxNotificationModule } from './inbox_modules/inbox_notification_module.js';
import { InboxThreadModule } from './inbox_modules/inbox_thread_module.js';
import { InboxHelperModule } from './inbox_modules/inbox_helper_module.js';

export class InboxView extends View {
  private readonly inboxMenuModule: InboxMenuModule;
  private readonly inboxNotificationModule: InboxNotificationModule;
  private readonly inboxThreadModule: InboxThreadModule;
  private readonly inboxThreadsModule: InboxThreadsModule;
  private webmailCommon!: WebmailCommon;

  readonly acctEmail: string;
  readonly labelId: string;
  readonly threadId: string | undefined;
  readonly showOriginal: boolean;
  readonly S: SelCache;
  readonly gmail: Gmail;

  helper: InboxHelperModule;
  injector!: Injector;
  factory!: XssSafeFactory;
  storage!: AccountStore;
  tabId!: string;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'labelId', 'threadId', 'showOriginal']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.labelId = uncheckedUrlParams.labelId ? String(uncheckedUrlParams.labelId) : 'INBOX';
    this.threadId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'threadId');
    this.showOriginal = uncheckedUrlParams.showOriginal === true;
    this.S = Ui.buildJquerySels({ threads: '.threads', thread: '.thread', body: 'body' });
    this.gmail = new Gmail(this.acctEmail);
    this.helper = new InboxHelperModule(this);
    this.inboxMenuModule = new InboxMenuModule(this);
    this.inboxNotificationModule = new InboxNotificationModule(this);
    this.inboxThreadModule = new InboxThreadModule(this, this.inboxNotificationModule);
    this.inboxThreadsModule = new InboxThreadsModule(this, this.inboxMenuModule, this.inboxNotificationModule, this.inboxThreadModule);
  }

  async render() {
    this.tabId = await BrowserMsg.requiredTabId();
    this.factory = new XssSafeFactory(this.acctEmail, this.tabId);
    this.injector = new Injector('settings', undefined, this.factory);
    this.webmailCommon = new WebmailCommon(this.acctEmail, this.injector);
    this.storage = await Store.getAcct(this.acctEmail, ['email_provider', 'picture', 'sendAs']);
    this.inboxNotificationModule.render();
    const emailProvider = this.storage.email_provider || 'gmail';
    try {
      if (emailProvider !== 'gmail') {
        $('body').text('Not supported for ' + emailProvider);
      } else {
        await this.inboxMenuModule.render();
        if (this.threadId) {
          await this.inboxThreadModule.render(this.threadId);
        } else {
          await this.inboxThreadsModule.render(this.labelId);
        }
      }
      await Settings.populateAccountsMenu('inbox.htm');
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      await Ui.modal.error(`${ApiErr.eli5(e)}\n\n${String(e)}`);
    }
  }

  async setHandlers() {
    BrowserMsg.listen(this.tabId);
    Catch.setHandledInterval(this.webmailCommon.addOrRemoveEndSessionBtnIfNeeded, 30000);
  }
}

View.run(InboxView);
