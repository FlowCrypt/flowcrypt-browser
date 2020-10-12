/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SelCache, Ui } from '../../../js/common/browser/ui.js';
import { Url, UrlParams } from '../../../js/common/core/common.js';
import { ApiErr } from '../../../js/common/api/shared/api-error.js';
import { Assert } from '../../../js/common/assert.js';
import { Browser } from '../../../js/common/browser/browser.js';
import { BrowserMsg, Bm } from '../../../js/common/browser/browser-msg.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Gmail } from '../../../js/common/api/email-provider/gmail/gmail.js';
import { InboxActiveThreadModule } from './inbox-modules/inbox-active-thread-module.js';
import { InboxListThreadsModule } from './inbox-modules/inbox-list-threads-module.js';
import { InboxMenuModule } from './inbox-modules/inbox-menu-module.js';
import { InboxNotificationModule } from './inbox-modules/inbox-notification-module.js';
import { Injector } from '../../../js/common/inject.js';
import { Settings } from '../../../js/common/settings.js';
import Swal from 'sweetalert2';
import { View } from '../../../js/common/view.js';
import { WebmailCommon } from "../../../js/common/webmail.js";
import { Xss } from '../../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../../js/common/xss-safe-factory.js';
import { AcctStore, AcctStoreDict } from '../../../js/common/platform/store/acct-store.js';

export class InboxView extends View {

  public readonly inboxMenuModule: InboxMenuModule;
  public readonly inboxNotificationModule: InboxNotificationModule;
  public readonly inboxActiveThreadModule: InboxActiveThreadModule;
  public readonly inboxListThreadsModule: InboxListThreadsModule;

  public readonly acctEmail: string;
  public readonly labelId: string;
  public readonly threadId: string | undefined;
  public readonly showOriginal: boolean;
  public readonly S: SelCache;
  public readonly gmail: Gmail;

  public injector!: Injector;
  public webmailCommon!: WebmailCommon;
  public factory!: XssSafeFactory;
  public storage!: AcctStoreDict;
  public tabId!: string;

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

  public render = async () => {
    this.tabId = await BrowserMsg.requiredTabId();
    this.factory = new XssSafeFactory(this.acctEmail, this.tabId);
    this.injector = new Injector('settings', undefined, this.factory);
    this.webmailCommon = new WebmailCommon(this.acctEmail, this.injector);
    this.storage = await AcctStore.get(this.acctEmail, ['email_provider', 'picture', 'sendAs']);
    this.inboxNotificationModule.render();
    const emailProvider = this.storage.email_provider || 'gmail';
    try {
      await Settings.populateAccountsMenu('inbox.htm');
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
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      if (ApiErr.isAuthErr(e) || ApiErr.isAuthPopupNeeded(e)) {
        await Ui.modal.warning(`FlowCrypt must be re-connected to your Google account.`);
        await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId, this.acctEmail);
      } else {
        await Ui.modal.error(`${ApiErr.eli5(e)}\n\n${String(e)}`);
      }
    }
  }

  public setHandlers = () => {
    // BrowserMsg.addPgpListeners(); // todo - re-allow when https://github.com/FlowCrypt/flowcrypt-browser/issues/2560 fixed
    BrowserMsg.listen(this.tabId);
    Catch.setHandledInterval(this.webmailCommon.addOrRemoveEndSessionBtnIfNeeded, 30000);
    $('.action_open_settings').click(this.setHandler(async () => await Browser.openSettingsPage('index.htm', this.acctEmail)));
    $(".action-toggle-accounts-menu").click(this.setHandler((target, event) => {
      event.stopPropagation();
      $("#alt-accounts").toggleClass("active");
    }));
    $('.action_add_account').click(this.setHandlerPrevent('double', async () => await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId)));
    this.addBrowserMsgListeners();
  }

  public redirectToUrl = (params: UrlParams) => {
    const newUrlSearch = Url.create('', params);
    if (newUrlSearch !== window.location.search) {
      window.location.search = newUrlSearch;
    } else {
      window.location.reload();
    }
  }

  public displayBlock = (name: string, title: string) => {
    this.S.cached('threads').css('display', name === 'thread' ? 'none' : 'block');
    this.S.cached('thread').css('display', name === 'thread' ? 'block' : 'none');
    Xss.sanitizeRender('h1', `${title}`);
  }

  private addBrowserMsgListeners = () => {
    BrowserMsg.addListener('add_end_session_btn', () => this.injector.insertEndSessionBtn(this.acctEmail));
    BrowserMsg.addListener('close_new_message', async () => {
      $('div.new_message').remove();
    });
    BrowserMsg.addListener('passphrase_dialog', async ({ longids, type }: Bm.PassphraseDialog) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(this.factory.dialogPassphrase(longids, type))  // xss-safe-factory;
          .click(this.setHandler(e => { // click on the area outside the iframe
            $('#cryptup_dialog').remove();
          }));
      }
    });
    BrowserMsg.addListener('subscribe_dialog', async ({ isAuthErr }: Bm.SubscribeDialog) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(this.factory.dialogSubscribe(isAuthErr)); // xss-safe-factory
      }
    });
    BrowserMsg.addListener('add_pubkey_dialog', async ({ emails }: Bm.AddPubkeyDialog) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(this.factory.dialogAddPubkey(emails)); // xss-safe-factory
      }
    });
    BrowserMsg.addListener('close_dialog', async () => {
      $('#cryptup_dialog').remove();
    });
    BrowserMsg.addListener('close_swal', async () => {
      Swal.close();
    });
    BrowserMsg.addListener('show_attachment_preview', async ({ iframeUrl }: Bm.ShowAttachmentPreview) => {
      await Ui.modal.attachmentPreview(iframeUrl);
    });
  }

}

View.run(InboxView);
