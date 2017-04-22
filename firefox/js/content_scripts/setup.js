/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function content_script_setup_if_vacant(webmail_specific) {

  if(!window.injected) {

    window.injected = true; // background script will use this to test if scripts were already injected, and inject if not
    window.account_email_global = null; // used by background script
    window.same_world_global = true; // used by background_script

    window.destruction_event = tool.env.runtime_id() + '_destroy';
    window.destroyable_class = tool.env.runtime_id() + '_destroyable';
    window.reloadable_class = tool.env.runtime_id() + '_reloadable';
    window.destroyable_intervals = [];
    window.destroyable_timeouts = [];

    window.destroy = function () {
      catcher.try(function () {
        console.log('Updating CryptUp');
        document.removeEventListener(destruction_event, destroy);
        $.each(destroyable_intervals, function (i, id) {
          clearInterval(id);
        });
        $.each(destroyable_timeouts, function (i, id) {
          clearTimeout(id);
        });
        $('.' + destroyable_class).remove();
        $('.' + reloadable_class).each(function (i, reloadable_element) {
          $(reloadable_element).replaceWith($(reloadable_element)[0].outerHTML);
        });
      })();
    };

    window.vacant = function () {
      return !$('.' + destroyable_class).length;
    };

    window.TrySetDestroyableInterval = function (code, ms) {
      var id = setInterval(window.catcher.try(code), ms);
      destroyable_intervals.push(id);
      return id;
    };

    window.TrySetDestryableTimeout = function (code, ms) {
      var id = setTimeout(window.catcher.try(code), ms);
      destroyable_timeouts.push(id);
      return id;
    };

    document.dispatchEvent(new CustomEvent(destruction_event));
    document.addEventListener(destruction_event, destroy);

    if(window.vacant()) {
      wait_for_account_email_then_setup();
    }

  }

  var account_email_interval = 1000;
  var factory;
  var inject;
  var notifications = content_script_notifications();

  function wait_for_account_email_then_setup() {
    var account_email = webmail_specific.get_user_account_email();
    if(!window.account_email_global) {
      if(typeof account_email !== 'undefined' && catcher.version()) {
        console.log('Loading CryptUp ' + catcher.version());
        window.account_email_global = account_email;
        if(tool.value(webmail_specific.name).in(tool.env.webmails)) {
          setup(account_email);
        } else {
          console.log('CryptUp disabled: ' + webmail_specific.name + ' integration currently for development only');
        }
      } else {
        if(account_email_interval > 6000) {
          console.log('Cannot load CryptUp yet. Page: ' + window.location + ' (' + document.title + ')');
        }
        account_email_interval += 1000;
        TrySetDestryableTimeout(wait_for_account_email_then_setup, account_email_interval);
      }
    }
  }

  // called by wait_for_account_email_then_setup
  function setup(account_email) {
    tool.browser.message.tab_id(function (tab_id) {
      factory = element_factory(account_email, tab_id, chrome.runtime.getURL('').replace(/\/$/, ''), reloadable_class, destroyable_class);
      inject = content_script_element_injector(webmail_specific.name, factory);
      inject.meta();
      add_account_email_to_list_of_accounts(account_email);
      save_account_email_full_name_if_needed(account_email);
      var show_setup_needed_notification_if_setup_not_done = true;
      var wait_for_setup_interval = TrySetDestroyableInterval(function () {
        account_storage_get(account_email, ['setup_done', 'cryptup_enabled', 'notification_setup_needed_dismissed'], function (storage) {
          if(storage.setup_done === true && storage.cryptup_enabled !== false) { //"not false" is due to cryptup_enabled unfedined in previous versions, which means "true"
            notifications.clear();
            initialize(account_email, tab_id);
            clearInterval(wait_for_setup_interval);
          } else if(!$("div.webmail_notification").length && !storage.notification_setup_needed_dismissed && show_setup_needed_notification_if_setup_not_done && storage.cryptup_enabled !== false) {
            var set_up_notification = '<a href="#" class="action_open_settings">Set up CryptUp</a> to send and receive secure email on this account. <a href="#" class="notification_setup_needed_dismiss">dismiss</a> <a href="#" class="close">remind me later</a>';
            notifications.show(set_up_notification, {
              notification_setup_needed_dismiss: function () {
                account_storage_set(account_email, { notification_setup_needed_dismissed: true }, notifications.clear);
              },
              action_open_settings: function () {
                tool.browser.message.send(null, 'settings', { account_email: account_email });
              },
              close: function () {
                show_setup_needed_notification_if_setup_not_done = false;
              }
            });
          }
        });
      }, 1000);
    });
  }

  // called by setup
  function initialize(account_email, tab_id) {
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
        webmail_specific.get_replacer().reinsert_reply_box(data.subject, data.my_email, data.their_email, data.thread_id);
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
        notifications.show(data.notification, data.callbacks, account_email);
        $('body').one('click', catcher.try(notifications.clear));
      },
      close_dialog: function (data) {
        $('#cryptup_dialog').remove();
      },
    }, tab_id);

    tool.browser.message.send(null, 'migrate_account', { account_email: account_email }, function () {
      webmail_specific.start(account_email, inject, notifications, factory, notify_murdered);
    });
  }

  function save_account_email_full_name_if_needed(account_email) {
    account_storage_get(account_email, 'full_name', function (value) {
      if(typeof value === 'undefined') {
        save_account_email_full_name(account_email);
      }
    });
  }

  function save_account_email_full_name(account_email) {
    // will cycle until page loads and name is accessible
    // todo - create general event on_webmail_finished_loading for similar actions
    TrySetDestryableTimeout(function () {
      var full_name = webmail_specific.get_user_full_name();
      if(full_name) {
        account_storage_set(account_email, { full_name: full_name });
      } else {
        save_account_email_full_name(account_email);
      }
    }, 1000);
  }

  function notify_murdered() {
    document.getElementsByClassName('webmail_notifications')[0].innerHTML = '<div class="webmail_notification">CryptUp has updated, please reload the tab.<a href="#" onclick="parentNode.remove()">close</a></div>';
  }

}
