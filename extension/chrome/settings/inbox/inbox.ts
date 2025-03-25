/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { CommonHandlers, SelCache, Ui } from '../../../js/common/browser/ui.js';
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
import { WebmailCommon } from '../../../js/common/webmail.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { XssSafeFactory } from '../../../js/common/xss-safe-factory.js';
import { AcctStore } from '../../../js/common/platform/store/acct-store.js';
import { RelayManager } from '../../../js/common/relay-manager.js';
import { MessageRenderer } from '../../../js/common/message-renderer.js';

export class InboxView extends View {
  public readonly inboxMenuModule: InboxMenuModule;
  public readonly inboxNotificationModule: InboxNotificationModule;
  public readonly inboxActiveThreadModule: InboxActiveThreadModule;
  public readonly inboxListThreadsModule: InboxListThreadsModule;

  public readonly acctEmail: string;
  public readonly labelId: string;
  public readonly threadId: string | undefined;
  public readonly showOriginal: boolean;
  public readonly debug: boolean;
  public readonly useFullScreenSecureCompose: boolean;
  public readonly thunderbirdMsgId: number | undefined;
  public readonly composeMethod: 'reply' | 'forward' | undefined;
  public readonly S: SelCache;
  public readonly gmail: Gmail;

  public injector!: Injector;
  public webmailCommon!: WebmailCommon;
  public messageRenderer!: MessageRenderer;
  public factory!: XssSafeFactory;
  public picture?: string;
  public readonly tabId = BrowserMsg.generateTabId();
  public relayManager!: RelayManager;

  public constructor() {
    super();
    const uncheckedUrlParams = Url.parse([
      'acctEmail',
      'labelId',
      'threadId',
      'showOriginal',
      'debug',
      'useFullScreenSecureCompose',
      'composeMethod',
      'thunderbirdMsgId',
    ]);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.labelId = uncheckedUrlParams.labelId ? String(uncheckedUrlParams.labelId) : 'INBOX';
    this.threadId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'threadId');
    this.showOriginal = uncheckedUrlParams.showOriginal === true;
    this.debug = uncheckedUrlParams.debug === true;
    this.useFullScreenSecureCompose = uncheckedUrlParams.useFullScreenSecureCompose === true;
    this.composeMethod = (Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'composeMethod') as 'reply') || 'forward';
    this.thunderbirdMsgId = Number(Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'thunderbirdMsgId'));
    this.S = Ui.buildJquerySels({ threads: '.threads', thread: '.thread', body: 'body' });
    this.gmail = new Gmail(this.acctEmail);
    this.inboxMenuModule = new InboxMenuModule(this);
    this.inboxNotificationModule = new InboxNotificationModule(this);
    this.inboxActiveThreadModule = new InboxActiveThreadModule(this);
    this.inboxListThreadsModule = new InboxListThreadsModule(this);
  }

  public render = async () => {
    this.relayManager = new RelayManager(this.debug);
    this.factory = new XssSafeFactory(this.acctEmail, this.tabId);
    this.injector = new Injector('settings', undefined, this.factory);
    this.webmailCommon = new WebmailCommon(this.acctEmail, this.injector);
    let emailProvider: 'gmail' | undefined;
    ({ email_provider: emailProvider, picture: this.picture } = await AcctStore.get(this.acctEmail, ['email_provider', 'picture']));
    this.messageRenderer = await MessageRenderer.newInstance(this.acctEmail, this.gmail, this.relayManager, this.factory, this.debug);
    this.inboxNotificationModule.render();
    const parsedThreadId = await this.parseThreadIdFromHeaderMessageId();
    this.preRenderSecureComposeInFullScreen(parsedThreadId);
    if (Catch.isThunderbirdMail()) {
      $('#container-gmail-banner').hide();
    }
    try {
      await Settings.populateAccountsMenu('inbox.htm');
      if (emailProvider && emailProvider !== 'gmail') {
        $('body').text('Not supported for ' + emailProvider);
      } else {
        await this.inboxMenuModule.render();
        if (this.threadId) {
          await this.inboxActiveThreadModule.render(this.threadId);
        } else {
          if (parsedThreadId && !this.useFullScreenSecureCompose) {
            await this.inboxActiveThreadModule.render(parsedThreadId);
          } else {
            await this.inboxListThreadsModule.render(this.labelId);
          }
        }
      }
    } catch (e) {
      ApiErr.reportIfSignificant(e);
      if (ApiErr.isAuthErr(e)) {
        await Ui.modal.warning(`FlowCrypt must be re-connected to your Google account.`);
        await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId, this.acctEmail);
      } else {
        await Ui.modal.error(`${ApiErr.eli5(e)}\n\n${String(e)}`);
      }
    }
    Ui.setTestState('ready');
  };

  public setHandlers = () => {
    this.addBrowserMsgListeners();
    BrowserMsg.listen(this.tabId);
    BrowserMsg.send.setHandlerReadyForPGPBlock('broadcast');
    Catch.setHandledInterval(this.webmailCommon.addOrRemoveEndSessionBtnIfNeeded, 30000);
    $('.action_open_settings').on(
      'click',
      this.setHandler(async () => await Browser.openSettingsPage('index.htm', this.acctEmail))
    );
    $('.action-toggle-accounts-menu').on(
      'click',
      this.setHandler((target, event) => {
        event.stopPropagation();
        $('#alt-accounts').toggleClass('active');
      })
    );
    $('.action_add_account').on(
      'click',
      this.setHandlerPrevent('double', async () => await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId))
    );
  };

  public redirectToUrl = (params: UrlParams) => {
    const newUrlSearch = Url.create('', params);
    if (newUrlSearch !== window.location.search) {
      window.location.search = newUrlSearch;
    } else {
      window.location.reload();
    }
  };

  public displayBlock = (name: string, title: string) => {
    this.S.cached('threads').css('display', name === 'thread' ? 'none' : 'block');
    this.S.cached('thread').css('display', name === 'thread' ? 'block' : 'none');
    Xss.sanitizeRender('h1', title);
  };

  private preRenderSecureComposeInFullScreen = (replyMsgId?: string) => {
    if (this.useFullScreenSecureCompose && this.composeMethod) {
      const replyOption = this.composeMethod === 'reply' ? 'a_reply' : 'a_forward';
      this.injector.openComposeWin(undefined, true, this.thunderbirdMsgId, replyOption, replyMsgId);
    }
  };

  private parseThreadIdFromHeaderMessageId = async () => {
    let threadId;
    if (Catch.isThunderbirdMail() && this.thunderbirdMsgId) {
      const { headers } = await messenger.messages.getFull(this.thunderbirdMsgId);
      if (headers) {
        const messageId = headers['message-id'][0];
        if (messageId) {
          const query = `rfc822msgid:${messageId}`;
          const gmailRes = await this.gmail.msgList(query);
          if (gmailRes.messages) {
            threadId = gmailRes.messages[0].threadId;
          }
        }
      }
    }
    return threadId;
  };

  private addBrowserMsgListeners = () => {
    BrowserMsg.addListener('add_end_session_btn', () => this.injector.insertEndSessionBtn(this.acctEmail));
    BrowserMsg.addListener('set_active_window', async ({ frameId }: Bm.ComposeWindow) => {
      if ($(`.secure_compose_window.active[data-frame-id="${frameId}"]`).length) {
        return; // already active
      }
      $(`.secure_compose_window`).removeClass('previous_active');
      $(`.secure_compose_window.active`).addClass('previous_active').removeClass('active');
      $(`.secure_compose_window[data-frame-id="${frameId}"]`).addClass('active');
    });
    BrowserMsg.addListener('close_compose_window', async ({ frameId }: Bm.ComposeWindow) => {
      $(`.secure_compose_window[data-frame-id="${frameId}"]`).remove();
      if ($('.secure_compose_window.previous_active:not(.minimized)').length) {
        BrowserMsg.send.focusPreviousActiveWindow(this.tabId, {
          frameId: $('.secure_compose_window.previous_active:not(.minimized)').data('frame-id') as string,
        });
      } else if ($('.secure_compose_window:not(.minimized)').length) {
        BrowserMsg.send.focusPreviousActiveWindow(this.tabId, {
          frameId: $('.secure_compose_window:not(.minimized)').data('frame-id') as string,
        });
      }
      // reposition the rest of the compose windows
      if (!$(`.secure_compose_window[data-order="1"]`).length) {
        $(`.secure_compose_window[data-order="2"]`).attr('data-order', 1);
      }
      if (!$(`.secure_compose_window[data-order="2"]`).length) {
        $(`.secure_compose_window[data-order="3"]`).attr('data-order', 2);
      }
    });
    BrowserMsg.addListener('passphrase_dialog', async ({ longids, type, initiatorFrameId }: Bm.PassphraseDialog) => {
      await this.factory.showPassphraseDialog(longids, type, initiatorFrameId);
    });
    BrowserMsg.addListener('add_pubkey_dialog', async ({ emails }: Bm.AddPubkeyDialog) => {
      await this.factory.showAddPubkeyDialog(emails);
    });
    BrowserMsg.addListener('close_dialog', async () => {
      Swal.close();
    });
    BrowserMsg.addListener('show_attachment_preview', async ({ iframeUrl }: Bm.ShowAttachmentPreview) => {
      await Ui.modal.attachmentPreview(iframeUrl);
    });
    BrowserMsg.addListener('confirmation_show', CommonHandlers.showConfirmationHandler);
    BrowserMsg.addListener('pgp_block_ready', async ({ frameId, messageSender }: Bm.PgpBlockReady) => {
      this.relayManager.associate(frameId, messageSender);
    });
    BrowserMsg.addListener('pgp_block_retry', async ({ frameId, messageSender }: Bm.PgpBlockRetry) => {
      this.relayManager.retry(frameId, messageSender);
    });
    if (this.debug) {
      BrowserMsg.addListener('open_compose_window', async ({ draftId }: Bm.ComposeWindowOpenDraft) => {
        console.log('received open_compose_window');
        this.injector.openComposeWin(draftId);
      });
    }
  };
}

View.run(InboxView);
