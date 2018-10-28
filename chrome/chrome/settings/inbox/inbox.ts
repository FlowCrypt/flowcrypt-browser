/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

Catch.try(async () => {

  let url_params = Env.url_params(['account_email']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');

  let message_headers = ['message', 'signed_message', 'public_key'].map(t => Pgp.armor.headers(t as ReplaceableMessageBlockType).begin);
  let q_encrypted_messages = 'is:inbox (' + Api.gmail.query.or(message_headers, true) + ')';
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

  let tab_id = await BrowserMsg.required_tab_id();
  notifications = new Notifications(tab_id);
  factory = new XssSafeFactory(account_email, tab_id);
  injector = new Injector('settings', null, factory);
  let storage = await Store.get_account(account_email, ['email_provider']);
  email_provider = storage.email_provider || 'gmail';
  S.cached('body').prepend(factory.meta_notification_container()); // xss-safe-factory

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
  }, tab_id);

  let display_block = (name: string, title: string) => {
    if (name === 'thread') {
      S.cached('threads').css('display', 'none');
      S.cached('thread').css('display', 'block');
      Ui.sanitize_render('h1', `<a href="#">&lt; back</a> ${title}`).find('a').click(() => window.location.reload());
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

  let renderable_label = (label_id: string, placement: 'messages' | 'labels') => {
    let label = all_labels.find(l => l.id === label_id);
    if(!label) {
      return '';
    }
    if(placement === 'messages' && label.messageListVisibility !== 'show') {
      return '';
    }
    if(placement === 'labels' && label.labelListVisibility !== 'labelShow') {
      return '';
    }
    let id = Xss.html_escape(label_id);
    let name = Xss.html_escape(label.name);
    return `<span class="label label_${id}">${name}</span>`;
  };

  let renderable_item_labels = (label_ids: ApirGmailMessage$labelId[], placement: 'messages' | 'labels') => {
    return label_ids.map(id => renderable_label(id, placement)).join('');
  };

  let render_inbox_item = async (thread_id: string) => {
    thread_element_add(thread_id);
    let thread_item = $('.threads #' + thread_list_item_id(thread_id));
    try {
      let item_result = await Api.gmail.message_get(account_email, thread_id, 'metadata');
      thread_item.find('.subject').text(Api.gmail.find_header(item_result, 'subject') || '(no subject)');
      Ui.sanitize_append(thread_item.find('.subject'), renderable_item_labels(item_result.labelIds, 'messages'));
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

  let render_inbox = async () => {
    Ui.sanitize_prepend('.header.line', `<div class="button green action_open_secure_compose_window" style="position: relative;top: -5;">Secure Compose</div>`);
    $('.action_open_secure_compose_window').click(Ui.event.handle(() => injector.open_compose_window()));
    display_block('inbox', 'FlowCrypt Email Inbox');
    try {
      let {labels} = await Api.gmail.labels_get(account_email);
      add_label_styles(labels);
      all_labels = labels;
      let {messages} = await Api.gmail.message_list(account_email, q_encrypted_messages, false);
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
      let thread = await Api.gmail.thread_get(account_email, thread_id, 'full');
      display_block('thread', Api.gmail.find_header(thread.messages[0], 'subject') || '(no subject)');
      thread.messages.map(render_message);
      render_reply_box(thread_id, thread.messages[thread.messages.length - 1].id);
    } catch (e) {
      $('.thread').text('Failed to load thread');
    }
  };

  let render_message = (message: ApirGmailMessage) => {
    let bodies = Api.gmail.find_bodies(message);
    let armored_message_from_bodies = Pgp.armor.clip(Str.base64url_decode(bodies['text/plain']!)) || Pgp.armor.clip(Pgp.armor.strip(Str.base64url_decode(bodies['text/html']!)));
    let renderable_html = !armored_message_from_bodies ? Xss.html_escape(bodies['text/plain']!).replace(/\n/g, '<br>') : factory.embedded_message(armored_message_from_bodies, message.id, false, '', false, null);
    S.cached('thread').append(Ui.e('div', {id: thread_message_id(message.id), class: 'message line', html: renderable_html})); // xss-safe-factory //xss-escaped
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
