/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

let url_params = tool.env.url_params(['account_email']);
let q_encrypted_messages = 'is:inbox (' + tool.api.gmail.query.or(tool.arr.select(['message', 'signed_message', 'public_key'].map(tool.crypto.armor.headers), 'begin'), true) + ')';
let email_provider;
let factory;

let S = tool.ui.build_jquery_selectors({
  threads: '.threads',
  thread: '.thread',
  body: 'body',
});

tool.browser.message.tab_id(function(tab_id) {
  let notifications = content_script_notifications(tab_id);
  tool.browser.message.listen({
    open_new_message: function (data) {
      inject.open_compose_window();
    },
    close_new_message: function (data) {
      $('div.new_message').remove();
    },
    close_reply_message: function (data) {
      $('iframe#' + data.frame_id).remove();
    },
    reinsert_reply_box: function (data) {
      render_reply_box(data.thread_id, data.thread_message_id);
    },
    passphrase_dialog: function (data) {
      if(!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog_passphrase(data.longids, data.type));
      }
    },
    subscribe_dialog: function (data) {
      if(!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog_subscribe(null, data ? data.source : null, data ? data.subscribe_result_tab_id : null));
      }
    },
    add_pubkey_dialog: function (data) {
      if(!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog_add_pubkey(data.emails));
      }
    },
    notification_show: function (data) {
      notifications.show(data.notification, data.callbacks);
      $('body').one('click', catcher.try(notifications.clear));
    },
    close_dialog: function (data) {
      $('#cryptup_dialog').remove();
    },
  }, tab_id);

  window.flowcrypt_storage.get(url_params.account_email, ['email_provider'], storage => {
    email_provider = storage.email_provider || 'gmail';
    factory = new Factory(url_params.account_email, tab_id);
    S.cached('body').prepend(factory.meta_notification_container());
    if(email_provider !== 'gmail') {
      $('body').text('Not supported for ' + email_provider);
    } else {
      display_block('inbox', 'FlowCrypt Email Inbox');
      tool.api.gmail.message_list(url_params.account_email, q_encrypted_messages, false, function(list_success, list_result) {
        if(!list_success || typeof list_result.messages === 'undefined') {
          $('body').text('Connection error trying to get list of messages');
        } else {
          let thread_ids = tool.arr.unique(tool.arr.select(list_result.messages, 'threadId'));
          tool.each(thread_ids, function(i, thread_id) {
            thread_element_add(thread_id);
            tool.api.gmail.message_get(url_params.account_email, thread_id, 'metadata', function(item_success, item_result) {
              let thread_item = $('.threads #' + thread_list_item_id(thread_id));
              if(!item_success) {
                thread_item.find('.loading').text('Failed to load');
              } else {
                thread_item.find('.subject').text(tool.api.gmail.find_header(item_result, 'subject'));
                let from = tool.str.parse_email(tool.api.gmail.find_header(item_result, 'from'));
                thread_item.find('.from').text(from.name || from.email);
                thread_item.find('.loading').text('');
                thread_item.find('.date').text(new Date(Number(item_result.internalDate)));
                thread_item.addClass('loaded').click(function () {
                  render_thread(thread_id);
                });
              }
            });
          });
        }
      });

    }
  });
});


function display_block(name, title) {
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

function render_thread(thread_id) {
  display_block('thread', 'Loading..');
  tool.api.gmail.thread_get(url_params.account_email, thread_id, 'full', function (success, result) {
    if(!success) {
      $('.thread').text('Failed to load thread');
    } else {
      display_block('thread', tool.api.gmail.find_header(result.messages[0], 'subject'));
      result.messages.map(render_message);
      render_reply_box(thread_id, result.messages[result.messages.length - 1].id);
    }
  });
}

function render_message(message) {
  let bodies = tool.api.gmail.find_bodies(message);
  let armored_message_from_bodies = tool.crypto.armor.clip(tool.str.base64url_decode(bodies['text/plain'])) || tool.crypto.armor.clip(tool.crypto.armor.strip(tool.str.base64url_decode(bodies['text/html'])));
  let renderable_html = !armored_message_from_bodies ? tool.str.html_escape(bodies['text/plain']).replace(/\n/g, '<br>\n') : factory.embedded_message(armored_message_from_bodies, message.id);
  S.cached('thread').append(tool.e('div', {id: thread_message_id(message.id), class: 'message line', html: renderable_html}));
}

function render_reply_box(thread_id, last_message_id) {
  S.cached('thread').append(tool.e('div', {class: 'reply line', html: factory.embedded_reply({thread_id: thread_id, thread_message_id: last_message_id})}));
}


function thread_message_id(message_id) {
  return 'message_id_' + message_id;
}

function thread_list_item_id(thread_id) {
  return 'list_thread_id_' + thread_id;
}

function thread_element_add(thread_id) {
  S.cached('threads').append(tool.e('div', {
    class: 'line',
    id: thread_list_item_id(thread_id),
    html: '<span class="loading">' + tool.ui.spinner('green') + 'loading..</span><span class="from"></span><span class="subject"></span><span class="date"></span>',
  }));
}