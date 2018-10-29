/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

Catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'folder']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let folder = url_params.folder || 'all';

  let message_headers = ['message', 'signed_message', 'public_key'].map(t => Pgp.armor.headers(t as ReplaceableMessageBlockType).begin);
  let q_encrypted_messages_in_chosen_label = `label:${folder} is:inbox (${Api.gmail.query.or(message_headers, true)})`;
  let email_provider;
  let factory: XssSafeFactory;
  let injector: Injector;
  let notifications: Notifications;
  let all_labels: ApirGmailLabels$label[];

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

  let notification_show = (data: NotificationWithHandlers) => {
    notifications.show(data.notification, data.callbacks);
    $('body').one('click', Catch.try(notifications.clear));
  };

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
    passphrase_dialog: (data: {longids: string[], type: PassphraseDialogType}) => {
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
      // not implemented
    },
  }, tab_id);

  let display_block = (name: string, title: string) => {
    if (name === 'thread') {
      S.cached('threads').css('display', 'none');
      S.cached('thread').css('display', 'block');
      Ui.sanitize_render('h1', `${title}`);
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

  let renderable_labels = (label_ids: (ApirGmailMessage$labelId | string)[], placement: 'messages' | 'menu' | 'labels') => {
    return label_ids.map(id => renderable_label(id, placement)).join('');
  };

  let render_inbox_item = async (thread_id: string) => {
    thread_element_add(thread_id);
    let thread_item = $('.threads #' + thread_list_item_id(thread_id));
    try {
      let item_result = await Api.gmail.message_get(account_email, thread_id, 'metadata');
      thread_item.find('.subject').text(Api.gmail.find_header(item_result, 'subject') || '(no subject)');
      Ui.sanitize_append(thread_item.find('.subject'), renderable_labels(item_result.labelIds, 'messages'));
      let from_header_value = Api.gmail.find_header(item_result, 'from');
      if (from_header_value) {
        let from = Str.parse_email(from_header_value);
        thread_item.find('.from').text(from.name || from.email);
      }
      thread_item.find('.loading').text('');
      thread_item.find('.date').text(format_date(item_result.internalDate));
      thread_item.addClass('loaded').click(Ui.event.handle(() => render_thread(thread_id)));
      if(Value.is(LABEL.UNREAD).in(item_result.labelIds)) {
        thread_item.css({'font-weight': 'bold', 'background': 'white'});
      }
    } catch (e) {
      if(Api.error.is_network_error(e)) {
        Ui.sanitize_render(thread_item.find('.loading'), 'Failed to load (network) <a href="#">retry</a>').find('a').click(Ui.event.handle(() => render_inbox_item(thread_id)));
      } else if(Api.error.is_auth_popup_needed(e)) {
        render_and_handle_auth_popup_notification();
      } else {
        Catch.handle_exception(e);
        thread_item.find('.loading').text('Failed to load');
      }
    }
  };

  let add_label_styles = (labels: ApirGmailLabels$label[]) => {
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
      let id = (cls.match(/^label_([a-zA-Z0-9_]+)$/) || [])[1];
      if(id) {
        let label = all_labels.find(l => l.id === id);
        if(label) {
          if(folder === label.name) {
            window.location.reload();
          } else {
            window.location.search = Env.url_create('', {account_email, folder: label.name});
          }
          return;
        }
      }
    }
    if(folder === 'all') {
      window.location.reload();
    } else {
      window.location.search = Env.url_create('', {account_email, folder: 'all'});
    }
  };

  let render_menu_and_label_styles = (labels: ApirGmailLabels$label[]) => {
    all_labels = labels;
    add_label_styles(labels);
    Ui.sanitize_append('.menu', `<br><div class="button gray2 label">ALL ENCRYPTED MAIL</div><br>${renderable_labels(FOLDERS, 'menu')}`);
    Ui.sanitize_append('.menu', '<br>' + renderable_labels(labels.sort((a, b) => {
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

  let render_inbox = async () => {
    $('.action_open_secure_compose_window').click(Ui.event.handle(() => injector.open_compose_window()));
    display_block('inbox', `Encrypted messages in ${folder || 'all folders'}`);
    try {
      let {labels} = await Api.gmail.labels_get(account_email);
      render_menu_and_label_styles(labels);
      let {messages} = await Api.gmail.message_list(account_email, q_encrypted_messages_in_chosen_label, false);
      await Promise.all(Value.arr.unique((messages || []).map(m => m.threadId)).map(render_inbox_item));
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

  let render_thread = async (thread_id: string) => {
    display_block('thread', 'Loading..');
    try {
      let thread = await Api.gmail.thread_get(account_email, thread_id, 'metadata');
      display_block('thread', Api.gmail.find_header(thread.messages[0], 'subject') || '(no subject)');
      for(let m of thread.messages) {
        await render_message(m);
      }
      render_reply_box(thread_id, thread.messages[thread.messages.length - 1].id);
    } catch (e) {
      if(Api.error.is_network_error(e)) {
        Ui.sanitize_render('.thread', `<br>Failed to load thread - network error. ${Ui.retry_link()}`);
      } else if(Api.error.is_auth_popup_needed(e)) {
        render_and_handle_auth_popup_notification();
      } else {
        Catch.handle_exception(e);
        let printable = Xss.html_escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Ui.sanitize_render('.thread', `<br>Failed to load thread due to the following error: <pre>${printable}</pre>`);
      }
    }
  };

  let wrap_message = (id: string, html: string) => {
    return Ui.e('div', {id, class: 'message line', html});
  };

  let render_message = async (message: ApirGmailMessage) => {
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
        Ui.sanitize_append('.thread', wrap_message(html_id, `Failed to load a message (network error), skipping. ${Ui.retry_link()}`));
      } else if (Api.error.is_auth_popup_needed(e)) {
        render_and_handle_auth_popup_notification();
      } else {
        Catch.handle_exception(e);
        let printable = Xss.html_escape(e instanceof Error ? e.stack || e.message : JSON.stringify(e, undefined, 2));
        Ui.sanitize_append('.thread', wrap_message(html_id, `Failed to load a message due to the following error: <pre>${printable}</pre>`));
      }
    }
  };

  let render_reply_box = (thread_id: string, last_message_id: string) => {
    S.cached('thread').append(Ui.e('div', {class: 'reply line', html: factory.embedded_reply({thread_id, thread_message_id: last_message_id}, false, false)})); // xss-safe-factory
  };

  let thread_message_id = (message_id: string) => {
    return 'message_id_' + message_id;
  };

  let thread_list_item_id = (thread_id: string) => {
    return 'list_thread_id_' + thread_id;
  };

  let thread_element_add = (thread_id: string) => {
    Ui.sanitize_append(S.cached('threads'), Ui.e('div', {
      class: 'line',
      id: thread_list_item_id(thread_id),
      html: '<span class="loading">' + Ui.spinner('green') + 'loading..</span><span class="from"></span><span class="subject"></span><span class="date"></span>',
    }));
  };

  if (email_provider !== 'gmail') {
    $('body').text('Not supported for ' + email_provider);
  } else {
    await render_inbox();
  }

})();
