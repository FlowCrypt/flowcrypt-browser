/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env, Value, Str, UrlParams } from '../../../js/common/common.js';
import { Xss, Ui, XssSafeFactory, PassphraseDialogType } from '../../../js/common/browser.js';
import { Injector } from '../../../js/common/inject.js';
import { Notifications, NotificationWithHandlers } from '../../../js/common/notifications.js';
import { Api, R } from '../../../js/common/api.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Mime } from '../../../js/common/mime.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['acctEmail', 'labelId', 'threadId']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let labelId = urlParams.labelId ? String(urlParams.labelId) : 'INBOX';
  let threadId = urlParams.threadId || null;

  let emailProvider;
  let factory: XssSafeFactory;
  let injector: Injector;
  let notifications: Notifications;
  let allLabels: R.GmailLabels$label[];

  let S = Ui.buildJquerySels({
    threads: '.threads',
    thread: '.thread',
    body: 'body',
  });

  let LABEL = { INBOX: 'INBOX', UNREAD: 'UNREAD', CATEGORY_PERSONAL: 'CATEGORY_PERSONAL', IMPORTANT: 'IMPORTANT', SENT: 'SENT', CATEGORY_UPDATES: 'CATEGORY_UPDATES' };
  let FOLDERS = ['INBOX', 'STARRED', 'SENT', 'DRAFT', 'TRASH']; // 'UNREAD', 'SPAM'

  let tabId = await BrowserMsg.requiredTabId();
  notifications = new Notifications(tabId);
  factory = new XssSafeFactory(acctEmail, tabId);
  injector = new Injector('settings', null, factory);
  let storage = await Store.getAcct(acctEmail, ['email_provider', 'picture', 'addresses']);
  emailProvider = storage.email_provider || 'gmail';
  S.cached('body').prepend(factory.metaNotificationContainer()); // xss-safe-factory
  if (storage.picture) {
    $('img.main-profile-img').attr('src', storage.picture).on('error', Ui.event.handle(self => {
      $(self).off().attr('src', '/img/svgs/profile-icon.svg');
    }));
  }

  $('.action_open_settings').click(Ui.event.handle(self => BrowserMsg.send(null, 'settings', { acctEmail })));
  $('.action_choose_account').get(0).title = acctEmail;

  let notificationShow = (data: NotificationWithHandlers) => {
    notifications.show(data.notification, data.callbacks);
    $('body').one('click', Catch.try(notifications.clear));
  };

  Catch.setHandledTimeout(() => $('#banner a').css('color', 'red'), 500);
  Catch.setHandledTimeout(() => $('#banner a').css('color', ''), 1000);
  Catch.setHandledTimeout(() => $('#banner a').css('color', 'red'), 1500);
  Catch.setHandledTimeout(() => $('#banner a').css('color', ''), 2000);

  BrowserMsg.listen({
    notification_show: notificationShow,
    close_new_message: (data) => {
      $('div.new_message').remove();
    },
    close_reply_message: (data: { frameId: string }) => {
      $('iframe#' + data.frameId).remove();
    },
    reinsert_reply_box: (data: { threadId: string, threadMsgId: string }) => {
      renderReplyBox(data.threadId, data.threadMsgId);
    },
    passphrase_dialog: (data: { longids: string[], type: PassphraseDialogType }) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(factory.dialogPassphrase(data.longids, data.type)); // xss-safe-factory
      }
    },
    subscribe_dialog: (data) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(factory.dialogSubscribe(null, data ? data.source : null, data ? data.subscribeResultTabId : null)); // xss-safe-factory
      }
    },
    add_pubkey_dialog: (data: { emails: string[] }) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(factory.dialogAddPubkey(data.emails)); // xss-safe-factory
      }
    },
    close_dialog: (data) => {
      $('#cryptup_dialog').remove();
    },
    scroll_to_bottom_of_conversation: () => {
      let scrollableEl = $('.thread').get(0);
      scrollableEl.scrollTop = scrollableEl.scrollHeight; // scroll to the bottom of conversation where the reply box is
    },
    render_public_keys: (data: { publicKeys: string[], afterFrameFd: string, traverseUp?: number }) => {
      let traverseUpLevels = data.traverseUp as number || 0;
      let appendAfter = $('iframe#' + data.afterFrameFd);
      for (let i = 0; i < traverseUpLevels; i++) {
        appendAfter = appendAfter.parent();
      }
      for (let armoredPubkey of data.publicKeys) {
        appendAfter.after(factory.embeddedPubkey(armoredPubkey, false));
      }
    },
    reply_pubkey_mismatch: () => {
      let replyIframe = $('iframe.reply_message').get(0) as HTMLIFrameElement | undefined;
      if (replyIframe) {
        replyIframe.src = replyIframe.src.replace('/compose.htm?', '/reply_pubkey_mismatch.htm?');
      }
    },
  }, tabId);

  let updateUrl = (title: string, params: UrlParams) => {
    let newUrlSearch = Env.urlCreate('', params);
    if (newUrlSearch !== window.location.search) {
      window.history.pushState({}, title, newUrlSearch);
    }
  };

  let loadUrl = (params: UrlParams) => {
    let newUrlSearch = Env.urlCreate('', params);
    if (newUrlSearch !== window.location.search) {
      window.location.search = newUrlSearch;
    } else {
      window.location.reload();
    }
  };

  let displayBlock = (name: string, title: string) => {
    if (name === 'thread') {
      S.cached('threads').css('display', 'none');
      S.cached('thread').css('display', 'block');
      Xss.sanitizeRender('h1', `${title}`);
    } else {
      S.cached('thread').css('display', 'none');
      S.cached('threads').css('display', 'block');
      $('h1').text(title);
    }
  };

  let renderAndHandleAuthPopupNotification = () => {
    notificationShow({
      notification: `Your Google Account needs to be re-connected to your browser <a href="#" class="action_auth_popup">Connect Account</a>`, callbacks: {
        action_auth_popup: async () => {
          await Api.google.authPopup(acctEmail, tabId);
          window.location.reload();
        }
      }
    });
  };

  let formatDate = (dateFromApi: string | number | undefined): string => {
    let date = new Date(Number(dateFromApi));
    if (date.toLocaleDateString() === new Date().toLocaleDateString()) {
      return date.toLocaleTimeString();
    }
    return date.toLocaleDateString();
  };

  let renderableLabel = (labelId: string, placement: 'messages' | 'menu' | 'labels') => {
    let label = allLabels.find(l => l.id === labelId);
    if (!label) {
      return '';
    }
    if (placement === 'messages' && label.messageListVisibility !== 'show') {
      return '';
    }
    if (placement === 'labels' && (label.labelListVisibility !== 'labelShow' || label.id === LABEL.INBOX)) {
      return '';
    }
    let id = Xss.htmlEscape(labelId);
    let name = Xss.htmlEscape(label.name);
    if (placement === 'menu') {
      let unread = Number(label.messagesUnread);
      return `<div class="button gray2 label label_${id}" ${unread ? 'style="font-weight: bold;"' : ''}>${name}${unread ? ` (${unread})` : ''}</div><br>`;
    } else if (placement === 'labels') {
      return `<span class="label label_${id}">${name}</span><br>`;
    } else {
      return `<span class="label label_${id}">${name}</span>`;
    }
  };

  let renderableLabels = (labelIds: (R.GmailMsg$labelId | string)[], placement: 'messages' | 'menu' | 'labels') => {
    return labelIds.map(id => renderableLabel(id, placement)).join('');
  };

  let renderInboxItem = async (threadId: string) => {
    inboxThreadItemAdd(threadId);
    let threadItem = $('.threads #' + threadListItemId(threadId));
    try {
      let thread = await Api.gmail.threadGet(acctEmail, threadId, 'metadata');
      let firstMsg = thread.messages[0];
      let lastMsg = thread.messages[thread.messages.length - 1];

      threadItem.find('.subject').text(Api.gmail.findHeader(firstMsg, 'subject') || '(no subject)');
      Xss.sanitizeAppend(threadItem.find('.subject'), renderableLabels(firstMsg.labelIds, 'messages'));
      let fromHeaderVal = Api.gmail.findHeader(firstMsg, 'from');
      if (fromHeaderVal) {
        let from = Str.parseEmail(fromHeaderVal);
        threadItem.find('.from').text(from.name || from.email);
      }
      threadItem.find('.loading').text('');
      threadItem.find('.date').text(formatDate(lastMsg.internalDate));
      threadItem.addClass('loaded').click(Ui.event.handle(() => renderThread(thread.id, thread)));
      if (Value.is(LABEL.UNREAD).in(lastMsg.labelIds)) {
        threadItem.css({ 'font-weight': 'bold', 'background': 'white' });
      }
      if (thread.messages.length > 1) {
        threadItem.find('.msg_count').text(`(${thread.messages.length})`);
      }
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        Xss.sanitizeRender(threadItem.find('.loading'), 'Failed to load (network) <a href="#">retry</a>').find('a').click(Ui.event.handle(() => renderInboxItem(threadId)));
      } else if (Api.err.isAuthPopupNeeded(e)) {
        renderAndHandleAuthPopupNotification();
      } else {
        Catch.handleException(e);
        threadItem.find('.loading').text('Failed to load');
      }
    }
  };

  let addLabelStyles = (labels: R.GmailLabels$label[]) => {
    let style = '';
    for (let label of labels) {
      if (label.color) {
        let id = Xss.htmlEscape(label.id);
        let bg = Xss.htmlEscape(label.color.backgroundColor);
        let fg = Xss.htmlEscape(label.color.textColor);
        style += `.label.label_${id} {color: ${fg}; background-color: ${bg};} `;
      }
    }
    $('body').append(`<style>${style}</style>`); // xss-escaped
  };

  let renderFolder = (labelEl: HTMLSpanElement) => {
    for (let cls of labelEl.classList) {
      let labelId = (cls.match(/^label_([a-zA-Z0-9_]+)$/) || [])[1];
      if (labelId) {
        loadUrl({ acctEmail, labelId });
        return;
      }
    }
    loadUrl({ acctEmail });
  };

  let getLabelName = (labelId: string) => {
    if (labelId === 'ALL') {
      return 'all folders';
    }
    let label = allLabels.find(l => l.id === labelId);
    if (label) {
      return label.name;
    }
    return 'UNKNOWN LABEL';
  };

  let renderMenuAndLabelStyles = (labels: R.GmailLabels$label[]) => {
    allLabels = labels;
    addLabelStyles(labels);
    Xss.sanitizeAppend('.menu', `<br>${renderableLabels(FOLDERS, 'menu')}<div class="button gray2 label label_ALL">ALL MAIL</div><br>`);
    Xss.sanitizeAppend('.menu', '<br>' + renderableLabels(labels.sort((a, b) => {
      if (a.name > b.name) {
        return 1;
      } else if (a.name < b.name) {
        return -1;
      } else {
        return 0;
      }
    }).map(l => l.id), 'labels'));
    $('.menu > .label').click(Ui.event.handle(renderFolder));
  };

  let renderMenu = async () => {
    try {
      let { labels } = await Api.gmail.labelsGet(acctEmail);
      renderMenuAndLabelStyles(labels);
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        notificationShow({ notification: `Connection error trying to get list of messages ${Ui.retryLink()}`, callbacks: {} });
      } else if (Api.err.isAuthPopupNeeded(e)) {
        renderAndHandleAuthPopupNotification();
      } else {
        Catch.handleException(e);
        notificationShow({ notification: `Error trying to get list of messages ${Ui.retryLink()}`, callbacks: {} });
      }
    }
  };

  let renderInbox = async (labelId: string) => {
    $('.action_open_secure_compose_window').click(Ui.event.handle(() => injector.openComposeWin()));
    displayBlock('inbox', `Messages in ${getLabelName(labelId)}`);
    try {
      let { threads } = await Api.gmail.threadList(acctEmail, labelId);
      if ((threads || []).length) {
        await Promise.all(threads.map(t => renderInboxItem(t.id)));
      } else {
        Xss.sanitizeRender('.threads', `<p>No encrypted messages in ${labelId} yet. ${Ui.retryLink()}</p>`);
      }
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        notificationShow({ notification: `Connection error trying to get list of messages ${Ui.retryLink()}`, callbacks: {} });
      } else if (Api.err.isAuthPopupNeeded(e)) {
        renderAndHandleAuthPopupNotification();
      } else {
        Catch.handleException(e);
        notificationShow({ notification: `Error trying to get list of messages ${Ui.retryLink()}`, callbacks: {} });
      }
    }
  };

  let renderThread = async (threadId: string, thread?: R.GmailThreadGet) => {
    displayBlock('thread', 'Loading..');
    try {
      thread = thread || await Api.gmail.threadGet(acctEmail, threadId, 'metadata');
      let subject = Api.gmail.findHeader(thread.messages[0], 'subject') || '(no subject)';
      updateUrl(`${subject} - FlowCrypt Inbox`, { acctEmail, threadId });
      displayBlock('thread', subject);
      for (let m of thread.messages) {
        await renderMsg(m);
      }
      renderReplyBox(threadId, thread.messages[thread.messages.length - 1].id, thread.messages[thread.messages.length - 1]);
      // await Api.gmail.thread_modify(account_email, threadId, [LABEL.UNREAD], []); // missing permission https://github.com/FlowCrypt/flowcrypt-browser/issues/1304
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        Xss.sanitizeRender('.thread', `<br>Failed to load thread - network error. ${Ui.retryLink()}`);
      } else if (Api.err.isAuthPopupNeeded(e)) {
        renderAndHandleAuthPopupNotification();
      } else {
        Catch.handleException(e);
        let printable = Xss.htmlEscape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Xss.sanitizeRender('.thread', `<br>Failed to load thread due to the following error: <pre>${printable}</pre>`);
      }
    }
  };

  let wrapMsg = (id: string, html: string) => {
    return Ui.e('div', { id, class: 'message line', html });
  };

  let renderMsg = async (message: R.GmailMsg) => {
    let htmlId = threadMsgId(message.id);
    let from = Api.gmail.findHeader(message, 'from') || 'unknown';
    try {
      let m = await Api.gmail.msgGet(acctEmail, message.id, 'raw');
      let { blocks, headers } = await Mime.process(Str.base64urlDecode(m.raw!));
      let r = '';
      for (let block of blocks) {
        r += (r ? '\n\n' : '') + Ui.renderableMsgBlock(factory, block, message.id, from, Value.is(from).in(storage.addresses || []));
      }
      let { atts } = await Mime.decode(Str.base64urlDecode(m.raw!));
      if (atts.length) {
        r += `<div class="attachments">${atts.filter(a => a.treatAs() === 'encrypted').map(factory.embeddedAtta).join('')}</div>`;
      }
      r = `<p class="message_header">From: ${Xss.htmlEscape(from)} <span style="float:right;">${headers.date}</p>` + r;
      $('.thread').append(wrapMsg(htmlId, r)); // xss-safe-factory
    } catch (e) {
      if (Api.err.isNetErr(e)) {
        Xss.sanitizeAppend('.thread', wrapMsg(htmlId, `Failed to load a message (network error), skipping. ${Ui.retryLink()}`));
      } else if (Api.err.isAuthPopupNeeded(e)) {
        renderAndHandleAuthPopupNotification();
      } else {
        Catch.handleException(e);
        let printable = Xss.htmlEscape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Xss.sanitizeAppend('.thread', wrapMsg(htmlId, `Failed to load a message due to the following error: <pre>${printable}</pre>`));
      }
    }
  };

  let renderReplyBox = (threadId: string, threadMsgId: string, lastMsg?: R.GmailMsg) => {
    let params: UrlParams;
    if (lastMsg) {
      let to = Api.gmail.findHeader(lastMsg, 'to');
      let toArr = to ? to.split(',').map(Str.parseEmail).map(e => e.email).filter(e => e) : [];
      let headers = Api.common.replyCorrespondents(acctEmail, storage.addresses || [], Api.gmail.findHeader(lastMsg, 'from'), toArr);
      let subject = Api.gmail.findHeader(lastMsg, 'subject');
      params = { subject, reply_to: headers.to, addresses: storage.addresses || [], my_email: headers.from, threadId, threadMsgId };
    } else {
      params = { threadId, threadMsgId };
    }
    S.cached('thread').append(Ui.e('div', { class: 'reply line', html: factory.embeddedReply(params, false, false) })); // xss-safe-factory
  };

  let threadMsgId = (msgId: string) => {
    return 'message_id_' + msgId;
  };

  let threadListItemId = (threadId: string) => {
    return 'list_thread_id_' + threadId;
  };

  let inboxThreadItemAdd = (threadId: string) => {
    Xss.sanitizeAppend(S.cached('threads'), Ui.e('div', {
      class: 'line',
      id: threadListItemId(threadId),
      html: '<span class="loading">' + Ui.spinner('green') + 'loading..</span><span class="from_container"><span class="from"></span><span class="msg_count"></span></span><span class="subject"></span><span class="date"></span>',
    }));
  };

  if (emailProvider !== 'gmail') {
    $('body').text('Not supported for ' + emailProvider);
  } else {
    await renderMenu();
    if (threadId) {
      await renderThread(threadId as string);
    } else {
      await renderInbox(labelId);
    }
  }
})();
