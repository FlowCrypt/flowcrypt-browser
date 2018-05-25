/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email']);
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
  
  tool.browser.message.tab_id(function(tab_id) {
    notifications = new Notifications(tab_id);
    factory = new Factory(url_params.account_email as string, tab_id);
    injector = new Injector('settings', null, factory);
    tool.browser.message.listen({
      open_new_message: function (data) {
        injector.open_compose_window();
      },
      close_new_message: function (data) {
        $('div.new_message').remove();
      },
      close_reply_message: function (data: {frame_id: string}) {
        $('iframe#' + data.frame_id).remove();
      },
      reinsert_reply_box: function (data: {thread_id: string, thread_message_id: string}) {
        render_reply_box(data.thread_id, data.thread_message_id);
      },
      passphrase_dialog: function (data: {longids: string[], type: PassphraseDialogType}) {
        if(!$('#cryptup_dialog').length) {
          $('body').append(factory.dialog_passphrase(data.longids, data.type));
        }
      },
      subscribe_dialog: function (data) {
        if(!$('#cryptup_dialog').length) {
          $('body').append(factory.dialog_subscribe(null, data ? data.source : null, data ? data.subscribe_result_tab_id : null));
        }
      },
      add_pubkey_dialog: function (data: {emails: string[]}) {
        if(!$('#cryptup_dialog').length) {
          $('body').append(factory.dialog_add_pubkey(data.emails));
        }
      },
      notification_show: function (data: NotificationWithCallbacks) {
        notifications.show(data.notification, data.callbacks);
        $('body').one('click', tool.catch.try(notifications.clear));
      },
      close_dialog: function (data) {
        $('#cryptup_dialog').remove();
      },
    }, tab_id);
  
    Store.get_account(url_params.account_email as string, ['email_provider']).then(storage => {
      email_provider = storage.email_provider || 'gmail';
      S.cached('body').prepend(factory.meta_notification_container());
      if(email_provider !== 'gmail') {
        $('body').text('Not supported for ' + email_provider);
      } else {
        display_block('inbox', 'FlowCrypt Email Inbox');
        tool.api.gmail.message_list(url_params.account_email as string, q_encrypted_messages, false).then(list_result => {
          let thread_ids = tool.arr.unique((list_result.messages || []).map((m: any) => m.threadId));
          for(let thread_id of thread_ids) {
            thread_element_add(thread_id);
            tool.api.gmail.message_get(url_params.account_email as string, thread_id, 'metadata').then(item_result => {
              let thread_item = $('.threads #' + thread_list_item_id(thread_id));
              thread_item.find('.subject').text(tool.api.gmail.find_header(item_result, 'subject') || '(no subject)');
              let from_header_value = tool.api.gmail.find_header(item_result, 'from');
              if(from_header_value) {
                let from = tool.str.parse_email(from_header_value);
                thread_item.find('.from').text(from.name || from.email);  
              }
              thread_item.find('.loading').text('');
              thread_item.find('.date').text(String(new Date(Number(item_result.internalDate))));
              thread_item.addClass('loaded').click(function () {
                render_thread(thread_id);
              });

            }, () => $('.threads #' + thread_list_item_id(thread_id)).find('.loading').text('Failed to load'));
          }
        }, () => $('body').text('Connection error trying to get list of messages'));
  
      }
    });
  });
  
  
  function display_block(name: string, title: string) {
    if(name === 'thread') {
      S.cached('threads').css('display', 'none');
      S.cached('thread').css('display', 'block');
      $('h1').text(title).prepend('<a href="#">< back</a> ').find('a').click(function () {
        window.location.reload();
      });
    } else {
      S.cached('thread').css('display', 'none');
      S.cached('threads').css('display', 'block');
      $('h1').text(title);
    }
  }
  
  function render_thread(thread_id: string) {
    display_block('thread', 'Loading..');
    tool.api.gmail.thread_get(url_params.account_email as string, thread_id, 'full', function (success, result: any) {
      if(!success) {
        $('.thread').text('Failed to load thread');
      } else {
        display_block('thread', tool.api.gmail.find_header(result.messages[0], 'subject') || '(no subject)');
        result.messages.map(render_message);
        render_reply_box(thread_id, result.messages[result.messages.length - 1].id);
      }
    });
  }
  
  function render_message(message: any) {
    let bodies = tool.api.gmail.find_bodies(message);
    let armored_message_from_bodies = tool.crypto.armor.clip(tool.str.base64url_decode(bodies['text/plain']!)) || tool.crypto.armor.clip(tool.crypto.armor.strip(tool.str.base64url_decode(bodies['text/html']!)));
    let renderable_html = !armored_message_from_bodies ? tool.str.html_escape(bodies['text/plain']!).replace(/\n/g, '<br>\n') : factory.embedded_message(armored_message_from_bodies, message.id, false, '', false, null);
    S.cached('thread').append(tool.e('div', {id: thread_message_id(message.id), class: 'message line', html: renderable_html}));
  }
  
  function render_reply_box(thread_id: string, last_message_id: string) {
    S.cached('thread').append(tool.e('div', {class: 'reply line', html: factory.embedded_reply({thread_id: thread_id, thread_message_id: last_message_id}, false, false)}));
  }
  
  
  function thread_message_id(message_id: string) {
    return 'message_id_' + message_id;
  }
  
  function thread_list_item_id(thread_id: string) {
    return 'list_thread_id_' + thread_id;
  }
  
  function thread_element_add(thread_id: string) {
    S.cached('threads').append(tool.e('div', {
      class: 'line',
      id: thread_list_item_id(thread_id),
      html: '<span class="loading">' + tool.ui.spinner('green') + 'loading..</span><span class="from"></span><span class="subject"></span><span class="date"></span>',
    }));
  }

})();