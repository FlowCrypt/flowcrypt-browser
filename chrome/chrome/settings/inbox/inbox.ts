/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/storage.js';
import { Catch, Env, Ui, Xss, Value, Str, Mime } from '../../../js/common/common.js';
import { XssSafeFactory } from '../../../js/common/factory.js';
import { Injector } from '../../../js/common/inject.js';
import { Notifications } from '../../../js/common/notifications.js';
import * as t from '../../../types/common';
import { Api, R } from '../../../js/common/api.js';
import { BrowserMsg } from '../../../js/common/extension.js';

Catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'label_id', 'thread_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let label_id = url_params.label_id ? String(url_params.label_id) : 'INBOX';
  let thread_id = url_params.thread_id || null;

  let email_provider;
  let factory: XssSafeFactory;
  let injector: Injector;
  let notifications: Notifications;
  let all_labels: R.GmailLabels$label[];

  let S = Ui.build_jquery_selectors({
    threads: '.threads',
    thread: '.thread',
    body: 'body',
  });

  let LABEL = {INBOX: 'INBOX', UNREAD: 'UNREAD', CATEGORY_PERSONAL: 'CATEGORY_PERSONAL', IMPORTANT: 'IMPORTANT', SENT: 'SENT', CATEGORY_UPDATES: 'CATEGORY_UPDATES'};
  let FOLDERS = ['INBOX','STARRED','SENT','DRAFT','TRASH']; // 'UNREAD', 'SPAM'

  let tab_id = await BrowserMsg.required_tab_id();
  notifications = new Notifications(tab_id);
  factory = new XssSafeFactory(account_email, tab_id);
  injector = new Injector('settings', null, factory);
  let storage = await Store.get_account(account_email, ['email_provider', 'picture', 'addresses']);
  email_provider = storage.email_provider || 'gmail';
  S.cached('body').prepend(factory.meta_notification_container()); // xss-safe-factory
  if(storage.picture) {
    $('img.main-profile-img').attr('src', storage.picture).on('error', Ui.event.handle(self => {
      $(self).off().attr('src', '/img/svgs/profile-icon.svg');
    }));
  }

  $('.action_open_settings').click(Ui.event.handle(self => BrowserMsg.send(null, 'settings', {account_email})));
  $('.action_choose_account').get(0).title = account_email;

  let notification_show = (data: t.NotificationWithHandlers) => {
    notifications.show(data.notification, data.callbacks);
    $('body').one('click', Catch.try(notifications.clear));
  };

  Catch.set_timeout(() => $('#banner a').css('color', 'red'), 500);
  Catch.set_timeout(() => $('#banner a').css('color', ''), 1000);
  Catch.set_timeout(() => $('#banner a').css('color', 'red'), 1500);
  Catch.set_timeout(() => $('#banner a').css('color', ''), 2000);

  BrowserMsg.listen({
    notification_show,
    close_new_message: (data) => {
      $('div.new_message').remove();
    },
    close_reply_message: (data: {frame_id: string}) => {
      $('iframe#' + data.frame_id).remove();
    },
    reinsert_reply_box: (data: {thread_id: string, thread_message_id: string}) => {
      render_reply_box(data.thread_id, data.thread_message_id);
    },
    passphrase_dialog: (data: {longids: string[], type: t.PassphraseDialogType}) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog_passphrase(data.longids, data.type)); // xss-safe-factory
      }
    },
    subscribe_dialog: (data) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog_subscribe(null, data ? data.source : null, data ? data.subscribe_result_tab_id : null)); // xss-safe-factory
      }
    },
    add_pubkey_dialog: (data: {emails: string[]}) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog_add_pubkey(data.emails)); // xss-safe-factory
      }
    },
    close_dialog: (data) => {
      $('#cryptup_dialog').remove();
    },
    scroll_to_bottom_of_conversation: () => {
      let scrollable_element = $('.thread').get(0);
      scrollable_element.scrollTop = scrollable_element.scrollHeight; // scroll to the bottom of conversation where the reply box is
    },
    render_public_keys: (data: {public_keys: string[], after_frame_id: string, traverse_up?: number}) => {
      let traverse_up_levels = data.traverse_up as number || 0;
      let append_after = $('iframe#' + data.after_frame_id);
      for (let i = 0; i < traverse_up_levels; i++) {
        append_after = append_after.parent();
      }
      for (let armored_pubkey of data.public_keys) {
        append_after.after(factory.embedded_pubkey(armored_pubkey, false));
      }
    },
    reply_pubkey_mismatch: () => {
      let reply_iframe = $('iframe.reply_message').get(0) as HTMLIFrameElement|undefined;
      if(reply_iframe) {
        reply_iframe.src = reply_iframe.src.replace('/compose.htm?', '/reply_pubkey_mismatch.htm?');
      }
    },
  }, tab_id);

  let update_url = (title: string, params: t.UrlParams) => {
    let new_url_search = Env.url_create('', params);
    if(new_url_search !== window.location.search) {
      window.history.pushState({}, title, new_url_search);
    }
  };

  let load_url = (params: t.UrlParams) => {
    let new_url_search = Env.url_create('', params);
    if(new_url_search !== window.location.search) {
      window.location.search = new_url_search;
    } else {
      window.location.reload();
    }
  };

  let display_block = (name: string, title: string) => {
    if (name === 'thread') {
      S.cached('threads').css('display', 'none');
      S.cached('thread').css('display', 'block');
      Xss.sanitize_render('h1', `${title}`);
    } else {
      S.cached('thread').css('display', 'none');
      S.cached('threads').css('display', 'block');
      $('h1').text(title);
    }
  };

  let render_and_handle_auth_popup_notification = () => {
    notification_show({notification: `Your Google Account needs to be re-connected to your browser <a href="#" class="action_auth_popup">Connect Account</a>`, callbacks: {
      action_auth_popup: async () => {
        await Api.google.auth_popup(account_email, tab_id);
        window.location.reload();
      }
    }});
  };

  let format_date = (date_from_api: string | number | undefined): string => {
    let date = new Date(Number(date_from_api));
    if(date.toLocaleDateString() === new Date().toLocaleDateString()) {
      return date.toLocaleTimeString();
    }
    return date.toLocaleDateString();
  };

  let renderable_label = (label_id: string, placement: 'messages' | 'menu' | 'labels') => {
    let label = all_labels.find(l => l.id === label_id);
    if(!label) {
      return '';
    }
    if(placement === 'messages' && label.messageListVisibility !== 'show') {
      return '';
    }
    if(placement === 'labels' && (label.labelListVisibility !== 'labelShow' || label.id === LABEL.INBOX)) {
      return '';
    }
    let id = Xss.html_escape(label_id);
    let name = Xss.html_escape(label.name);
    if(placement === 'menu') {
      let unread = Number(label.messagesUnread);
      return `<div class="button gray2 label label_${id}" ${unread ? 'style="font-weight: bold;"' : ''}>${name}${unread ? ` (${unread})` : ''}</div><br>`;
    } else if (placement === 'labels') {
      return `<span class="label label_${id}">${name}</span><br>`;
    } else {
      return `<span class="label label_${id}">${name}</span>`;
    }
  };

  let renderable_labels = (label_ids: (R.GmailMessage$labelId | string)[], placement: 'messages' | 'menu' | 'labels') => {
    return label_ids.map(id => renderable_label(id, placement)).join('');
  };

  let render_inbox_item = async (thread_id: string) => {
    inbox_thread_item_add(thread_id);
    let thread_item = $('.threads #' + thread_list_item_id(thread_id));
    try {
      let thread = await Api.gmail.thread_get(account_email, thread_id, 'metadata');
      let first_message = thread.messages[0];
      let last_message = thread.messages[thread.messages.length - 1];

      thread_item.find('.subject').text(Api.gmail.find_header(first_message, 'subject') || '(no subject)');
      Xss.sanitize_append(thread_item.find('.subject'), renderable_labels(first_message.labelIds, 'messages'));
      let from_header_value = Api.gmail.find_header(first_message, 'from');
      if (from_header_value) {
        let from = Str.parse_email(from_header_value);
        thread_item.find('.from').text(from.name || from.email);
      }
      thread_item.find('.loading').text('');
      thread_item.find('.date').text(format_date(last_message.internalDate));
      thread_item.addClass('loaded').click(Ui.event.handle(() => render_thread(thread.id, thread)));
      if(Value.is(LABEL.UNREAD).in(last_message.labelIds)) {
        thread_item.css({'font-weight': 'bold', 'background': 'white'});
      }
      if(thread.messages.length > 1) {
        thread_item.find('.msg_count').text(`(${thread.messages.length})`);
      }
    } catch (e) {
      if(Api.error.is_network_error(e)) {
        Xss.sanitize_render(thread_item.find('.loading'), 'Failed to load (network) <a href="#">retry</a>').find('a').click(Ui.event.handle(() => render_inbox_item(thread_id)));
      } else if(Api.error.is_auth_popup_needed(e)) {
        render_and_handle_auth_popup_notification();
      } else {
        Catch.handle_exception(e);
        thread_item.find('.loading').text('Failed to load');
      }
    }
  };

  let add_label_styles = (labels: R.GmailLabels$label[]) => {
    let style = '';
    for(let label of labels) {
      if(label.color) {
        let id = Xss.html_escape(label.id);
        let bg = Xss.html_escape(label.color.backgroundColor);
        let fg = Xss.html_escape(label.color.textColor);
        style += `.label.label_${id} {color: ${fg}; background-color: ${bg};} `;
      }
    }
    $('body').append(`<style>${style}</style>`); // xss-escaped
  };

  let render_folder = (label_element: HTMLSpanElement) => {
    for(let cls of label_element.classList) {
      let label_id = (cls.match(/^label_([a-zA-Z0-9_]+)$/) || [])[1];
      if(label_id) {
        load_url({account_email, label_id});
        return;
      }
    }
    load_url({account_email});
  };

  let get_label_name = (label_id: string) => {
    if(label_id === 'ALL') {
      return 'all folders';
    }
    let label = all_labels.find(l => l.id === label_id);
    if(label) {
      return label.name;
    }
    return 'UNKNOWN LABEL';
  };

  let render_menu_and_label_styles = (labels: R.GmailLabels$label[]) => {
    all_labels = labels;
    add_label_styles(labels);
    Xss.sanitize_append('.menu', `<br>${renderable_labels(FOLDERS, 'menu')}<div class="button gray2 label label_ALL">ALL MAIL</div><br>`);
    Xss.sanitize_append('.menu', '<br>' + renderable_labels(labels.sort((a, b) => {
      if(a.name > b.name) {
        return 1;
      } else if(a.name < b.name) {
        return -1;
      } else {
        return 0;
      }
    }).map(l => l.id), 'labels'));
    $('.menu > .label').click(Ui.event.handle(render_folder));
  };

  let render_menu = async () => {
    try {
      let {labels} = await Api.gmail.labels_get(account_email);
      render_menu_and_label_styles(labels);
    } catch(e) {
      if(Api.error.is_network_error(e)) {
        notification_show({notification: `Connection error trying to get list of messages ${Ui.retry_link()}`, callbacks: {}});
      } else if(Api.error.is_auth_popup_needed(e)) {
        render_and_handle_auth_popup_notification();
      } else {
        Catch.handle_exception(e);
        notification_show({notification: `Error trying to get list of messages ${Ui.retry_link()}`, callbacks: {}});
      }
    }
  };

  let render_inbox = async (label_id: string) => {
    $('.action_open_secure_compose_window').click(Ui.event.handle(() => injector.open_compose_window()));
    display_block('inbox', `Messages in ${get_label_name(label_id)}`);
    try {
      let {threads} = await Api.gmail.thread_list(account_email, label_id);
      if((threads || []).length) {
        await Promise.all(threads.map(t => render_inbox_item(t.id)));
      } else {
        Xss.sanitize_render('.threads', `<p>No encrypted messages in ${label_id} yet. ${Ui.retry_link()}</p>`);
      }
    } catch(e) {
      if(Api.error.is_network_error(e)) {
        notification_show({notification: `Connection error trying to get list of messages ${Ui.retry_link()}`, callbacks: {}});
      } else if(Api.error.is_auth_popup_needed(e)) {
        render_and_handle_auth_popup_notification();
      } else {
        Catch.handle_exception(e);
        notification_show({notification: `Error trying to get list of messages ${Ui.retry_link()}`, callbacks: {}});
      }
    }
  };

  let render_thread = async (thread_id: string, thread?: R.GmailThreadGet) => {
    display_block('thread', 'Loading..');
    try {
      thread = thread || await Api.gmail.thread_get(account_email, thread_id, 'metadata');
      let subject = Api.gmail.find_header(thread.messages[0], 'subject') || '(no subject)';
      update_url(`${subject} - FlowCrypt Inbox`, {account_email, thread_id});
      display_block('thread', subject);
      for(let m of thread.messages) {
        await render_message(m);
      }
      render_reply_box(thread_id, thread.messages[thread.messages.length - 1].id, thread.messages[thread.messages.length - 1]);
      // await Api.gmail.thread_modify(account_email, thread_id, [LABEL.UNREAD], []); // missing permission https://github.com/FlowCrypt/flowcrypt-browser/issues/1304
    } catch (e) {
      if(Api.error.is_network_error(e)) {
        Xss.sanitize_render('.thread', `<br>Failed to load thread - network error. ${Ui.retry_link()}`);
      } else if(Api.error.is_auth_popup_needed(e)) {
        render_and_handle_auth_popup_notification();
      } else {
        Catch.handle_exception(e);
        let printable = Xss.html_escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Xss.sanitize_render('.thread', `<br>Failed to load thread due to the following error: <pre>${printable}</pre>`);
      }
    }
  };

  let wrap_message = (id: string, html: string) => {
    return Ui.e('div', {id, class: 'message line', html});
  };

  let render_message = async (message: R.GmailMessage) => {
    let html_id = thread_message_id(message.id);
    let from = Api.gmail.find_header(message, 'from') || 'unknown';
    try {
      let m = await Api.gmail.message_get(account_email, message.id, 'raw');
      let {blocks, headers} = await Mime.process(Str.base64url_decode(m.raw!));
      let r = '';
      for (let block of blocks) {
        r += (r ? '\n\n' : '') + Ui.renderable_message_block(factory, block, message.id, from, Value.is(from).in(storage.addresses || []));
      }
      let {attachments} = await Mime.decode(Str.base64url_decode(m.raw!));
      if(attachments.length) {
        r += `<div class="attachments">${attachments.filter(a => a.treat_as() === 'encrypted').map(factory.embedded_attachment).join('')}</div>`;
      }
      r = `<p class="message_header">From: ${Xss.html_escape(from)} <span style="float:right;">${headers.date}</p>` + r;
      $('.thread').append(wrap_message(html_id, r)); // xss-safe-factory
    } catch (e) {
      if(Api.error.is_network_error(e)) {
        Xss.sanitize_append('.thread', wrap_message(html_id, `Failed to load a message (network error), skipping. ${Ui.retry_link()}`));
      } else if (Api.error.is_auth_popup_needed(e)) {
        render_and_handle_auth_popup_notification();
      } else {
        Catch.handle_exception(e);
        let printable = Xss.html_escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Xss.sanitize_append('.thread', wrap_message(html_id, `Failed to load a message due to the following error: <pre>${printable}</pre>`));
      }
    }
  };

  let render_reply_box = (thread_id: string, thread_message_id: string, last_message?: R.GmailMessage) => {
    let params: t.UrlParams;
    if(last_message) {
      let to = Api.gmail.find_header(last_message, 'to');
      let to_arr = to ? to.split(',').map(Str.parse_email).map(e => e.email).filter(e => e) : [];
      let headers = Api.common.reply_correspondents(account_email, storage.addresses || [], Api.gmail.find_header(last_message, 'from'), to_arr);
      let subject = Api.gmail.find_header(last_message, 'subject');
      params = {subject, reply_to: headers.to, addresses: storage.addresses || [], my_email: headers.from, thread_id, thread_message_id};
    } else {
      params = {thread_id, thread_message_id};
    }
    S.cached('thread').append(Ui.e('div', {class: 'reply line', html: factory.embedded_reply(params, false, false)})); // xss-safe-factory
  };

  let thread_message_id = (message_id: string) => {
    return 'message_id_' + message_id;
  };

  let thread_list_item_id = (thread_id: string) => {
    return 'list_thread_id_' + thread_id;
  };

  let inbox_thread_item_add = (thread_id: string) => {
    Xss.sanitize_append(S.cached('threads'), Ui.e('div', {
      class: 'line',
      id: thread_list_item_id(thread_id),
      html: '<span class="loading">' + Ui.spinner('green') + 'loading..</span><span class="from_container"><span class="from"></span><span class="msg_count"></span></span><span class="subject"></span><span class="date"></span>',
    }));
  };

  if (email_provider !== 'gmail') {
    $('body').text('Not supported for ' + email_provider);
  } else {
    await render_menu();
    if (thread_id) {
      await render_thread(thread_id as string);
    } else {
      await render_inbox(label_id);
    }
  }
})();
