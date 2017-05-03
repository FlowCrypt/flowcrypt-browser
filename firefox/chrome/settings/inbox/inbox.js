/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email']);
var q_encrypted_messages = 'is:inbox (' + tool.api.gmail.query.or(tool.arr.select(['message', 'signed_message', 'public_key'].map(tool.crypto.armor.headers), 'begin'), true) + ')';
var email_provider;
var factory;
var notifications = content_script_notifications();

var S = tool.ui.build_jquery_selectors({
  threads: '.threads',
  thread: '.thread',
  body: 'body',
});

tool.browser.message.tab_id(function(tab_id) {
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
        $('body').append(factory.dialog.passphrase(data.longids, data.type));
      }
    },
    subscribe_dialog: function (data) {
      if(!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog.subscribe(null, data ? data.source : null, data ? data.subscribe_result_tab_id : null));
      }
    },
    add_pubkey_dialog: function (data) {
      if(!$('#cryptup_dialog').length) {
        $('body').append(factory.dialog.add_pubkey(data.emails));
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

  account_storage_get(url_params.account_email, ['email_provider'], function (storage) {
    email_provider = storage.email_provider || 'gmail';
    factory = element_factory(url_params.account_email, tab_id);
    S.cached('body').prepend(factory.meta.notification_container());
    if(email_provider !== 'gmail') {
      $('body').text('Not supported for ' + email_provider);
    } else {
      display_block('inbox', 'CryptUp Email Inbox');
      tool.api.gmail.message_list(url_params.account_email, q_encrypted_messages, false, function(list_success, list_result) {
        if(!list_success || typeof list_result.messages === 'undefined') {
          $('body').text('Connection error trying to get list of messages');
        } else {
          var thread_ids = tool.arr.unique(tool.arr.select(list_result.messages, 'threadId'));
          $.each(thread_ids, function(i, thread_id) {
            thread_element_add(thread_id);
            tool.api.gmail.message_get(url_params.account_email, thread_id, 'metadata', function(item_success, item_result) {
              var thread_item = $('.threads #' + thread_list_item_id(thread_id));
              if(!item_success) {
                thread_item.find('.loading').text('Failed to load');
              } else {
                thread_item.find('.subject').text(tool.api.gmail.find_header(item_result, 'subject'));
                var from = tool.str.parse_email(tool.api.gmail.find_header(item_result, 'from'));
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
  var bodies = tool.api.gmail.find_bodies(message);
  var armored_message_from_bodies = tool.crypto.armor.clip(tool.str.base64url_decode(bodies['text/plain'])) || tool.crypto.armor.clip(tool.crypto.armor.strip(tool.str.base64url_decode(bodies['text/html'])));
  if(!armored_message_from_bodies) {
    var renderable_html = tool.str.html_escape(bodies['text/plain']).replace(/\n/g, '<br>\n');
  } else {
    var renderable_html = factory.embedded.message(armored_message_from_bodies, message.id);
  }
  S.cached('thread').append(tool.e('div', {id: thread_message_id(message.id), class: 'message line', html: renderable_html}));
}

function render_reply_box(thread_id, last_message_id) {
  S.cached('thread').append(tool.e('div', {class: 'reply line', html: factory.embedded.reply({thread_id: thread_id, thread_message_id: last_message_id})}));
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