/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { AccountStore, Store } from '../../../js/common/platform/store.js';
import { SelCache, Ui } from '../../../js/common/browser/ui.js';
import { Url, UrlParams } from '../../../js/common/core/common.js';

import { ApiErr } from '../../../js/common/api/error/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Gmail } from '../../../js/common/api/email_provider/gmail/gmail.js';
import { InboxActiveThreadModule } from './inbox_modules/inbox_thread_module.js';
import { InboxListThreadsModule } from './inbox_modules/inbox_threads_module.js';
import { InboxMenuModule } from './inbox_modules/inbox_menu_module.js';
import { InboxNotificationModule } from './inbox_modules/inbox_notification_module.js';
import { Injector } from '../../../js/common/inject.js';
import { Settings } from '../../../js/common/settings.js';
import { View } from '../../../js/common/view.js';
import { WebmailCommon } from "../../../js/common/webmail.js";
import { Xss } from '../../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../../js/common/xss_safe_factory.js';

export class InboxView extends View {

  readonly inboxMenuModule: InboxMenuModule;
  readonly inboxNotificationModule: InboxNotificationModule;
  readonly inboxActiveThreadModule: InboxActiveThreadModule;
  readonly inboxListThreadsModule: InboxListThreadsModule;

  readonly acctEmail: string;
  readonly labelId: string;
  readonly threadId: string | undefined;
  readonly showOriginal: boolean;
  readonly S: SelCache;
  readonly gmail: Gmail;

  injector!: Injector;
  webmailCommon!: WebmailCommon;
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
    this.inboxMenuModule = new InboxMenuModule(this);
    this.inboxNotificationModule = new InboxNotificationModule(this);
    this.inboxActiveThreadModule = new InboxActiveThreadModule(this);
    this.inboxListThreadsModule = new InboxListThreadsModule(this);
  }

  render = async () => {
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
          await this.inboxActiveThreadModule.render(this.threadId);
        } else {
          await this.inboxListThreadsModule.render(this.labelId);
        }
      }
      await Settings.populateAccountsMenu('inbox.htm');
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      await Ui.modal.error(`${ApiErr.eli5(e)}\n\n${String(e)}`);
    }
  }

  setHandlers = async () => {
    BrowserMsg.listen(this.tabId);
    Catch.setHandledInterval(this.webmailCommon.addOrRemoveEndSessionBtnIfNeeded, 30000);
  }

  redirectToUrl = (params: UrlParams) => {
    const newUrlSearch = Url.create('', params);
    if (newUrlSearch !== window.location.search) {
      window.location.search = newUrlSearch;
    } else {
      window.location.reload();
    }
  }

  displayBlock = (name: string, title: string) => {
    this.S.cached('threads').css('display', name === 'thread' ? 'none' : 'block');
    this.S.cached('thread').css('display', name === 'thread' ? 'block' : 'none');
    Xss.sanitizeRender('h1', `${title}`);
  }

}

View.run(InboxView);
