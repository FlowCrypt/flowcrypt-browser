/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');

  let message_headers = ['message', 'signed_message', 'public_key'].map(t => tool.crypto.armor.headers(t as ReplaceableMessageBlockType).begin);
  let q_encrypted_messages = 'is:inbox (' + tool.api.gmail.query.or(message_headers, true) + ')';
  let email_provider;
  let factory: Factory;
  let injector: Injector;
  let notifications: Notifications;

  let S = tool.ui.build_jquery_selectors({
    threads: '.threads',
    thread: '.thread',
    body: 'body',
  });

  let tab_id = await tool.browser.message.required_tab_id();
  notifications = new Notifications(tab_id);
  factory = new Factory(account_email, tab_id);
  injector = new Injector('settings', null, factory);
  tool.browser.message.listen({
    open_new_message: (data) => {
      injector.open_compose_window();
    },
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
        $('body').append(factory.dialog_passphrase(data.longids, data.type));
      }
    },
    subscribe_dialog: (data) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog_subscribe(null, data ? data.source : null, data ? data.subscribe_result_tab_id : null));
      }
    },
    add_pubkey_dialog: (data: {emails: string[]}) => {
      if (!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog_add_pubkey(data.emails));
      }
    },
    notification_show: (data: NotificationWithHandlers) => {
      notifications.show(data.notification, data.callbacks);
      $('body').one('click', tool.catch.try(notifications.clear));
    },
    close_dialog: (data) => {
      $('#cryptup_dialog').remove();
    },
  }, tab_id);

  let display_block = (name: string, title: string) => {
    if (name === 'thread') {
      S.cached('threads').css('display', 'none');
      S.cached('thread').css('display', 'block');
      $('h1').text(title).prepend('<a href="#">&lt; back</a> ').find('a').click(() => window.location.reload()); // xss-direct
    } else {
      S.cached('thread').css('display', 'none');
      S.cached('threads').css('display', 'block');
      $('h1').text(title);
    }
  };

  let storage = await Store.get_account(account_email, ['email_provider']);
  email_provider = storage.email_provider || 'gmail';
  S.cached('body').prepend(factory.meta_notification_container());
  if (email_provider !== 'gmail') {
    $('body').text('Not supported for ' + email_provider);
  } else {
    display_block('inbox', 'FlowCrypt Email Inbox');
    tool.api.gmail.message_list(account_email, q_encrypted_messages, false).then(list_result => {
      let thread_ids = tool.arr.unique((list_result.messages || []).map((m: any) => m.threadId));
      for (let thread_id of thread_ids) {
        thread_element_add(thread_id);
        tool.api.gmail.message_get(account_email, thread_id, 'metadata').then(item_result => {
          let thread_item = $('.threads #' + thread_list_item_id(thread_id));
          thread_item.find('.subject').text(tool.api.gmail.find_header(item_result, 'subject') || '(no subject)');
          let from_header_value = tool.api.gmail.find_header(item_result, 'from');
          if (from_header_value) {
            let from = tool.str.parse_email(from_header_value);
            thread_item.find('.from').text(from.name || from.email);
          }
          thread_item.find('.loading').text('');
          thread_item.find('.date').text(String(new Date(Number(item_result.internalDate))));
          thread_item.addClass('loaded').click(tool.ui.event.handle(() => render_thread(thread_id).catch(tool.catch.handle_exception)));
        }, () => $('.threads #' + thread_list_item_id(thread_id)).find('.loading').text('Failed to load'));
      }
    }, () => $('body').text('Connection error trying to get list of messages'));
  }

  let render_thread = async (thread_id: string) => {
    display_block('thread', 'Loading..');
    try {
      let thread = await tool.api.gmail.thread_get(account_email, thread_id, 'full');
      display_block('thread', tool.api.gmail.find_header(thread.messages[0], 'subject') || '(no subject)');
      thread.messages.map(render_message);
      render_reply_box(thread_id, thread.messages[thread.messages.length - 1].id);
    } catch (e) {
      $('.thread').text('Failed to load thread');
    }
  };

  let render_message = (message: any) => {
    let bodies = tool.api.gmail.find_bodies(message);
    let armored_message_from_bodies = tool.crypto.armor.clip(tool.str.base64url_decode(bodies['text/plain']!)) || tool.crypto.armor.clip(tool.crypto.armor.strip(tool.str.base64url_decode(bodies['text/html']!)));
    let renderable_html = !armored_message_from_bodies ? tool.str.html_escape(bodies['text/plain']!).replace(/\n/g, '<br>\n') : factory.embedded_message(armored_message_from_bodies, message.id, false, '', false, null);
    S.cached('thread').append(tool.e('div', {id: thread_message_id(message.id), class: 'message line', html: renderable_html}));
  };

  let render_reply_box = (thread_id: string, last_message_id: string) => {
    S.cached('thread').append(tool.e('div', {class: 'reply line', html: factory.embedded_reply({thread_id, thread_message_id: last_message_id}, false, false)}));
  };

  let thread_message_id = (message_id: string) => {
    return 'message_id_' + message_id;
  };

  let thread_list_item_id = (thread_id: string) => {
    return 'list_thread_id_' + thread_id;
  };

  let thread_element_add = (thread_id: string) => {
    S.cached('threads').append(tool.e('div', { // xss-direct
      class: 'line',
      id: thread_list_item_id(thread_id),
      html: '<span class="loading">' + tool.ui.spinner('green') + 'loading..</span><span class="from"></span><span class="subject"></span><span class="date"></span>',
    }));
  };

})();
