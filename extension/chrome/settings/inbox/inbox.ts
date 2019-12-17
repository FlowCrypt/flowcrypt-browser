/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Url, UrlParams, Dict } from '../../../js/common/core/common.js';

import { BrowserMsg } from '../../../js/common/browser/browser-msg.js';
import { Assert } from '../../../js/common/assert.js';
import { Gmail } from '../../../js/common/api/email_provider/gmail/gmail.js';
import { InboxMenuView } from './inbox-menu.js';
import { Ui } from '../../../js/common/browser/ui.js';
import { Xss } from '../../../js/common/platform/xss.js';
import { GoogleAuth } from '../../../js/common/api/google-auth.js';
import { Notifications } from '../../../js/common/notifications.js';
import { XssSafeFactory } from '../../../js/common/xss_safe_factory.js';
import { InboxThreadView } from './inbox-thread.js';
import { View } from '../../../js/common/view.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Store, AccountStore } from '../../../js/common/platform/store.js';
import { Google } from '../../../js/common/api/google.js';
import { Settings } from '../../../js/common/settings.js';

export class InboxView extends View {
  private readonly threadId: string | undefined;
  private readonly labelId: string;

  public readonly S = Ui.buildJquerySels({ // tslint:disable-line:oneliner-object-literal
    threads: '.threads',
    thread: '.thread',
    body: 'body',
  });
  public readonly acctEmail: string;
  public readonly gmail: Gmail;
  public readonly inboxMenuView = new InboxMenuView(this);

  public tabId: string | undefined;
  public notifications: Notifications | undefined;
  public factory: XssSafeFactory | undefined;
  public storage: AccountStore | undefined;

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['acctEmail', 'labelId', 'threadId']);
    this.acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
    this.threadId = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'threadId');
    this.labelId = uncheckedUrlParams.labelId ? String(uncheckedUrlParams.labelId) : 'INBOX';
    this.gmail = new Gmail(this.acctEmail);
  }

  async init() {
    this.tabId = await BrowserMsg.requiredTabId();
    this.factory = new XssSafeFactory(this.acctEmail, this.tabId);
    this.notifications = new Notifications(this.tabId);
    this.storage = await Store.getAcct(this.acctEmail, ['email_provider', 'picture', 'sendAs']);
  }

  async render() {
    this.S.cached('body').prepend(this.factory!.metaNotificationContainer()); // xss-safe-factory
    if (this.storage?.picture) {
      $('img.main-profile-img').attr('src', this.storage.picture).on('error', this.setHandler(self => {
        $(self).off().attr('src', '/img/svgs/profile-icon.svg');
      }));
    }
    $('.action_open_webmail').attr('href', Google.webmailUrl(this.acctEmail));
    $('.action_choose_account').get(0).title = this.acctEmail;
    Catch.setHandledTimeout(() => { $('#banner a').css('color', 'red'); }, 500);
    Catch.setHandledTimeout(() => { $('#banner a').css('color', ''); }, 1000);
    Catch.setHandledTimeout(() => { $('#banner a').css('color', 'red'); }, 1500);
    Catch.setHandledTimeout(() => { $('#banner a').css('color', ''); }, 2000);
  }

  setHandlers() {
    $('.action_open_settings').click(this.setHandler(() => BrowserMsg.send.bg.settings({ acctEmail: this.acctEmail })));
    $(".action-toggle-accounts-menu").click(this.setHandler((target, event) => {
      event.stopPropagation();
      $("#alt-accounts").toggleClass("active");
    }));
    $('.action_add_account').click(this.setHandlerPrevent('double', async () => await Settings.newGoogleAcctAuthPromptThenAlertOrForward(this.tabId)));
  }

  getChildViews() {
    const initialView = this.threadId ? new InboxThreadView(this, this.threadId) : new InboxThreadView(this, this.labelId);
    return [this.inboxMenuView, initialView];
  }

  async whenRendered() {
    BrowserMsg.listen(this.tabId!);
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
    if (name === 'thread') {
      this.S.cached('threads').css('display', 'none');
      this.S.cached('thread').css('display', 'block');
      Xss.sanitizeRender('h1', `${title}`);
    } else {
      this.S.cached('thread').css('display', 'none');
      this.S.cached('threads').css('display', 'block');
      $('h1').text(title);
    }
  }

  renderAndHandleAuthPopupNotification = (insufficientPermission = false) => {
    let msg = `Your Google Account needs to be re-connected to your browser <a href="#" class="action_auth_popup">Connect Account</a>`;
    if (insufficientPermission) {
      msg = `Permission missing to load inbox <a href="#" class="action_add_permission">Revise Permissions</a>`;
    }
    this.showNotification(msg, {
      action_auth_popup: async () => {
        await GoogleAuth.newAuthPopup({ acctEmail: this.acctEmail });
        window.location.reload();
      },
      action_add_permission: async () => { // can just be unified with action_auth_popup
        await GoogleAuth.newAuthPopup({ acctEmail: this.acctEmail });
        window.location.reload();
      },
    });
  }

  showNotification = (notification: string, callbacks?: Dict<() => void>) => {
    this.notifications!.show(notification, callbacks);
    $('body').one('click', this.setHandler(this.notifications!.clear));
  }
}

View.run(InboxView);

// Catch.try(async () => {
//   let threadHasPgpBlock = false;
//   let emailProvider;
//   let factory: XssSafeFactory;
//   let injector: Injector;
//   let notifications: Notifications;
//   let allLabels: GmailRes.GmailLabels$label[];
//   let webmailCommon: WebmailCommon;

//   const gmail = new Gmail(acctEmail);
//   const tabId = await BrowserMsg.requiredTabId();
//   factory = new XssSafeFactory(acctEmail, tabId);
//   injector = new Injector('settings', undefined, factory);
//   webmailCommon = new WebmailCommon(acctEmail, injector);
//   const storage = await Store.getAcct(acctEmail, ['email_provider', 'picture', 'sendAs']);
//   emailProvider = storage.email_provider || 'gmail';
//   S.cached('body').prepend(factory.metaNotificationContainer()); // xss-safe-factory
//   if (storage.picture) {
//     $('img.main-profile-img').attr('src', storage.picture).on('error', Ui.event.handle(self => {
//       $(self).off().attr('src', '/img/svgs/profile-icon.svg');
//     }));
//   }

//   $('.action_open_webmail').attr('href', Google.webmailUrl(acctEmail));
//   $('.action_open_settings').click(Ui.event.handle(self => BrowserMsg.send.bg.settings({ acctEmail })));
//   $('.action_choose_account').get(0).title = acctEmail;
//   $(".action-toggle-accounts-menu").click(Ui.event.handle((target, event) => {
//     event.stopPropagation();
//     $("#alt-accounts").toggleClass("active");
//   }));
//   $('.action_add_account').click(Ui.event.prevent('double', async () => await Settings.newGoogleAcctAuthPromptThenAlertOrForward(tabId)));

//   const notificationShowHandler: Bm.AsyncResponselessHandler = async ({ notification, callbacks }: Bm.NotificationShow) => {
//     showNotification(notification, callbacks);
//   };

//   const showNotification = (notification: string, callbacks?: Dict<() => void>) => {
//     notifications.show(notification, callbacks);
//     $('body').one('click', Ui.event.handle(notifications.clear));
//   };

//   const every30Sec = async () => {
//     await webmailCommon.addOrRemoveEndSessionBtnIfNeeded();
//   };

//   Catch.setHandledTimeout(() => { $('#banner a').css('color', 'red'); }, 500);
//   Catch.setHandledTimeout(() => { $('#banner a').css('color', ''); }, 1000);
//   Catch.setHandledTimeout(() => { $('#banner a').css('color', 'red'); }, 1500);
//   Catch.setHandledTimeout(() => { $('#banner a').css('color', ''); }, 2000);
//   BrowserMsg.addListener('notification_show', notificationShowHandler);
//   BrowserMsg.addListener('close_new_message', async () => {
//     $('div.new_message').remove();
//   });
//   BrowserMsg.addListener('close_reply_message', async ({ frameId }: Bm.CloseReplyMessage) => {
//     $(`iframe#${frameId}`).remove();
//   });
//   BrowserMsg.addListener('reinsert_reply_box', async ({ replyMsgId }: Bm.ReinsertReplyBox) => {
//     renderReplyBox(replyMsgId);
//   });
//   BrowserMsg.addListener('passphrase_dialog', async ({ longids, type }: Bm.PassphraseDialog) => {
//     if (!$('#cryptup_dialog').length) {
//       $('body').append(factory.dialogPassphrase(longids, type))  // xss-safe-factory;
//         .click(Ui.event.handle(e => { // click on the area outside the iframe
//           $('#cryptup_dialog').remove();
//         }));
//     }
//   });
//   BrowserMsg.addListener('subscribe_dialog', async ({ isAuthErr }: Bm.SubscribeDialog) => {
//     if (!$('#cryptup_dialog').length) {
//       $('body').append(factory.dialogSubscribe(isAuthErr)); // xss-safe-factory
//     }
//   });
//   BrowserMsg.addListener('add_pubkey_dialog', async ({ emails }: Bm.AddPubkeyDialog) => {
//     if (!$('#cryptup_dialog').length) {
//       $('body').append(factory.dialogAddPubkey(emails)); // xss-safe-factory
//     }
//   });
//   BrowserMsg.addListener('close_dialog', async () => {
//     $('#cryptup_dialog').remove();
//   });
//   BrowserMsg.addListener('scroll_to_bottom_of_conversation', async () => {
//     const scrollableEl = $('.thread').get(0);
//     scrollableEl.scrollTop = scrollableEl.scrollHeight; // scroll to the bottom of conversation where the reply box is
//   });
//   BrowserMsg.addListener('render_public_keys', async ({ traverseUp, afterFrameId, publicKeys }: Bm.RenderPublicKeys) => {
//     const traverseUpLevels = traverseUp || 0;
//     let appendAfter = $(`iframe#${afterFrameId}`);
//     for (let i = 0; i < traverseUpLevels; i++) {
//       appendAfter = appendAfter.parent();
//     }
//     for (const armoredPubkey of publicKeys) {
//       appendAfter.after(factory.embeddedPubkey(armoredPubkey, false));
//     }
//   });
//   BrowserMsg.addListener('reply_pubkey_mismatch', BrowserMsgCommonHandlers.replyPubkeyMismatch);
//   BrowserMsg.addListener('notification_show_auth_popup_needed', async ({ acctEmail }: Bm.NotificationShowAuthPopupNeeded) => {
//     notifications.showAuthPopupNeeded(acctEmail);
//   });
//   BrowserMsg.addListener('add_end_session_btn', () => injector.insertEndSessionBtn(acctEmail));
//   BrowserMsg.listen(tabId);

// const updateUrlWithoutRedirecting = (title: string, params: UrlParams) => {
//   const newUrlSearch = Url.create('', params);
//   if (newUrlSearch !== window.location.search) {
//     window.history.pushState({}, title, newUrlSearch);
//   }
// };

//   const displayBlock = (name: string, title: string) => {
//     if (name === 'thread') {
//       S.cached('threads').css('display', 'none');
//       S.cached('thread').css('display', 'block');
//       Xss.sanitizeRender('h1', `${title}`);
//     } else {
//       S.cached('thread').css('display', 'none');
//       S.cached('threads').css('display', 'block');
//       $('h1').text(title);
//     }
//   };

//   const renderAndHandleAuthPopupNotification = (insufficientPermission = false) => {
//     let msg = `Your Google Account needs to be re-connected to your browser <a href="#" class="action_auth_popup">Connect Account</a>`;
//     if (insufficientPermission) {
//       msg = `Permission missing to load inbox <a href="#" class="action_add_permission">Revise Permissions</a>`;
//     }
//     showNotification(msg, {
//       action_auth_popup: async () => {
//         await GoogleAuth.newAuthPopup({ acctEmail });
//         window.location.reload();
//       },
//       action_add_permission: async () => { // can just be unified with action_auth_popup
//         await GoogleAuth.newAuthPopup({ acctEmail });
//         window.location.reload();
//       },
//     });
//   };

//   const formatDate = (dateFromApi: string | number | undefined): string => {
//     const date = new Date(Number(dateFromApi));
//     if (date.toLocaleDateString() === new Date().toLocaleDateString()) {
//       return date.toLocaleTimeString();
//     }
//     return date.toLocaleDateString();
//   };

//   const renderInboxItem = async (threadId: string) => {
//     inboxThreadItemAdd(threadId);
//     const threadItem = $('.threads #' + threadListItemId(threadId));
//     try {
//       const thread = await gmail.threadGet(threadId, 'metadata');
//       const firstMsg = thread.messages[0];
//       const lastMsg = thread.messages[thread.messages.length - 1];
//       threadItem.find('.subject').text(GmailParser.findHeader(firstMsg, 'subject') || '(no subject)');
//       Xss.sanitizeAppend(threadItem.find('.subject'), renderableLabels(firstMsg.labelIds || [], 'messages'));
//       const fromHeaderVal = GmailParser.findHeader(firstMsg, 'from');
//       if (fromHeaderVal) {
//         const from = Str.parseEmail(fromHeaderVal);
//         threadItem.find('.from').text(from.name || from.email || from.full);
//       }
//       threadItem.find('.loading').text('');
//       threadItem.find('.date').text(formatDate(lastMsg.internalDate));
//       threadItem.addClass('loaded').click(Ui.event.handle(() => renderThread(thread.id, thread)));
//       if (lastMsg.labelIds?.includes(LABEL.UNREAD)) {
//         threadItem.css({ 'font-weight': 'bold', 'background': 'white' });
//       }
//       if (thread.messages.length > 1) {
//         threadItem.find('.msg_count').text(`(${thread.messages.length})`);
//       }
//     } catch (e) {
//       if (ApiErr.isNetErr(e)) {
//         Xss.sanitizeRender(threadItem.find('.loading'), 'Failed to load (network) <a href="#">retry</a>').find('a').click(Ui.event.handle(() => renderInboxItem(threadId)));
//       } else if (ApiErr.isAuthPopupNeeded(e)) {
//         renderAndHandleAuthPopupNotification();
//       } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
//         showNotification(Lang.account.googleAcctDisabledOrPolicy);
//       } else {
//         Catch.reportErr(e);
//         threadItem.find('.loading').text('Failed to load');
//       }
//     }
//   };

//   const renderMenu = async () => {
//     try {
//       const { labels } = await gmail.labelsGet();
//       renderMenuAndLabelStyles(labels);
//     } catch (e) {
//       if (ApiErr.isNetErr(e)) {
//         showNotification(`Connection error trying to get list of folders ${Ui.retryLink()}`);
//       } else if (ApiErr.isAuthPopupNeeded(e)) {
//         renderAndHandleAuthPopupNotification();
//       } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
//         showNotification(Lang.account.googleAcctDisabledOrPolicy);
//       } else if (ApiErr.isInsufficientPermission(e)) {
//         renderAndHandleAuthPopupNotification(true);
//       } else {
//         Catch.reportErr(e);
//         await Ui.modal.error(`Error trying to get list of folders: ${ApiErr.eli5(e)}\n\n${String(e)}`);
//         window.location.reload();
//       }
//     }
//   };

//   const renderInbox = async (labelId: string) => {
//     displayBlock('inbox', `Messages in ${getLabelName(labelId)}`);
//     try {
//       const { threads } = await gmail.threadList(labelId);
//       if ((threads || []).length) {
//         await Promise.all(threads.map(t => renderInboxItem(t.id)));
//       } else {
//         Xss.sanitizeRender('.threads', `<p>No encrypted messages in ${labelId} yet. ${Ui.retryLink()}</p>`);
//       }
//     } catch (e) {
//       if (ApiErr.isNetErr(e)) {
//         showNotification(`Connection error trying to get list of messages ${Ui.retryLink()}`);
//       } else if (ApiErr.isAuthPopupNeeded(e)) {
//         renderAndHandleAuthPopupNotification();
//       } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
//         showNotification(Lang.account.googleAcctDisabledOrPolicy);
//       } else if (ApiErr.isInsufficientPermission(e)) {
//         renderAndHandleAuthPopupNotification(true);
//       } else {
//         Catch.reportErr(e);
//         await Ui.modal.error(`Error trying to get list of folders: ${ApiErr.eli5(e)}\n\n${String(e)}`);
//         window.location.reload();
//       }
//     }
//   };

// const renderThread = async (threadId: string, thread?: GmailRes.GmailThread) => {
//   displayBlock('thread', 'Loading..');
//   try {
//     thread = thread || await gmail.threadGet(threadId, 'metadata');
//     const subject = GmailParser.findHeader(thread.messages[0], 'subject') || '(no subject)';
//     updateUrlWithoutRedirecting(`${subject} - FlowCrypt Inbox`, { acctEmail, threadId });
//     displayBlock('thread', subject);
//     for (const m of thread.messages) {
//       await renderMsg(m);
//     }
//     if (threadHasPgpBlock) {
//       $(".action_see_original_message").css('display', 'inline-block');
//       $(".action_see_original_message").click(Ui.event.handle(() => redirectToUrl({ acctEmail, threadId, showOriginal: !showOriginal })));
//       if (showOriginal) {
//         $(".action_see_original_message").text('See Decrypted');
//       }
//     }
//     const lastMsg = thread.messages[thread.messages.length - 1];
//     if (lastMsg) {
//       renderReplyBox(lastMsg.id);
//     }
//     // await gmail.threadModify(acctEmail, threadId, [LABEL.UNREAD], []); // missing permission https://github.com/FlowCrypt/flowcrypt-browser/issues/1304
//   } catch (e) {
//     if (ApiErr.isNetErr(e)) {
//       Xss.sanitizeRender('.thread', `<br>Failed to load thread - network error. ${Ui.retryLink()}`);
//     } else if (ApiErr.isAuthPopupNeeded(e)) {
//       renderAndHandleAuthPopupNotification();
//     } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
//       showNotification(Lang.account.googleAcctDisabledOrPolicy);
//     } else {
//       Catch.reportErr(e);
//       const printable = Xss.escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
//       Xss.sanitizeRender('.thread', `<br>Failed to load thread due to the following error: <pre>${printable}</pre>`);
//     }
//   }
// };

//   const wrapMsg = (id: string, html: string) => {
//     return Ui.e('div', { id, class: 'message line', html });
//   };

// const renderMsg = async (message: GmailRes.GmailMsg) => {
//   const htmlId = replyMsgId(message.id);
//   const from = GmailParser.findHeader(message, 'from') || 'unknown';
//   try {
//     const { raw } = await gmail.msgGet(message.id, 'raw');
//     const mimeMsg = Buf.fromBase64UrlStr(raw!);
//     const { blocks, headers } = await Mime.process(mimeMsg);
//     let r = '';
//     let renderedAtts = '';
//     for (const block of blocks) {
//       if (block.type === 'encryptedMsg' || block.type === 'publicKey' || block.type === 'privateKey' || block.type === 'signedMsg' || block.type === 'encryptedMsgLink') {
//         threadHasPgpBlock = true;
//       }
//       if (r) {
//         r += '<br><br>';
//       }
//       if (block.type === 'encryptedAtt') {
//         renderedAtts += XssSafeFactory.renderableMsgBlock(factory, block, message.id, from, storage.sendAs && !!storage.sendAs[from]);
//       } else if (showOriginal) {
//         r += Xss.escape(block.content.toString()).replace(/\n/g, '<br>');
//       } else {
//         r += XssSafeFactory.renderableMsgBlock(factory, block, message.id, from, storage.sendAs && !!storage.sendAs[from]);
//       }
//     }
//     if (renderedAtts) {
//       r += `<div class="attachments">${renderedAtts}</div>`;
//     }
//     r = `<p class="message_header" data-test="container-msg-header">From: ${Xss.escape(from)} <span style="float:right;">${headers.date}</p>` + r;
//     $('.thread').append(wrapMsg(htmlId, r)); // xss-safe-factory
//   } catch (e) {
//     if (ApiErr.isNetErr(e)) {
//       Xss.sanitizeAppend('.thread', wrapMsg(htmlId, `Failed to load a message (network error), skipping. ${Ui.retryLink()}`));
//     } else if (ApiErr.isAuthPopupNeeded(e)) {
//       renderAndHandleAuthPopupNotification();
//     } else if (ApiErr.isMailOrAcctDisabledOrPolicy(e)) {
//       showNotification(Lang.account.googleAcctDisabledOrPolicy);
//     } else {
//       Catch.reportErr(e);
//       const printable = Xss.escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
//       Xss.sanitizeAppend('.thread', wrapMsg(htmlId, `Failed to load a message due to the following error: <pre>${printable}</pre>`));
//     }
//   }
// };

// const renderReplyBox = (replyMsgId: string) => {
//   const params: FactoryReplyParams = { replyMsgId };
//   S.cached('thread').append(Ui.e('div', { class: 'reply line', html: factory.embeddedReply(params, false, false) })); // xss-safe-factory
// };

//   const replyMsgId = (msgId: string) => {
//     return 'message_id_' + msgId;
//   };

//   const threadListItemId = (threadId: string) => {
//     return 'list_thread_id_' + threadId;
//   };

//   const inboxThreadItemAdd = (threadId: string) => {
//     const content = `
//       <span class="from_container">
//         <span class="from"></span>
//         <span class="msg_count"></span></span>
//       <span class="subject" data-test="container-subject"></span>
//       <span class="date"></span>
//     `;
//     Xss.sanitizeAppend(S.cached('threads'), Ui.e('div', {
//       class: 'line',
//       id: threadListItemId(threadId),
//       html: `<span class="loading">${Ui.spinner('green')}loading..</span>${content}`,
//     }));
//   };

//   try { -------------------- TODO: Handle thy try catch using View framework. -------------------
//     if (emailProvider !== 'gmail') {
//       $('body').text('Not supported for ' + emailProvider);
//     } else {
//       await renderMenu();
//       if (threadId) {
//         await renderThread(threadId);
//       } else {
//         await renderInbox(labelId);
//       }
//     }
//     await Settings.populateAccountsMenu('inbox.htm');
//     await every30Sec();
//     Catch.setHandledInterval(every30Sec, 30000);
//   } catch (e) {
//     ApiErr.reportIfSignificant(e);
//     await Ui.modal.error(`${ApiErr.eli5(e)}\n\n${String(e)}`);
//   }

// })();
