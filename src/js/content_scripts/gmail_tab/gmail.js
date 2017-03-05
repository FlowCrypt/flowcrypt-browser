/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

catcher.try(function() {

  content_script_setup_if_vacant(function(chrome_runtime_id) {
    setup_gmail_content_script(chrome_runtime_id).wait_for_account_email_then_setup();
  });

  function setup_gmail_content_script(chrome_runtime_id) {

    var account_email_interval = 1000;
    var replace_pgp_elements_interval = 1000;
    window.account_email_global = null;
    window.same_world_global = true;

    var factory;
    var inject;
    var replace;
    var notifications = content_script_notifications();


    function wait_for_account_email_then_setup() {
      var account_email = get_account_email();
      if(typeof account_email !== 'undefined') {
        console.log('Loading CryptUp ' + catcher.version());
        window.account_email_global = account_email;
        setup(account_email);
      } else {
        console.log('Cannot load CryptUp yet. Page: ' + window.location + ' (' + document.title + ')');
        account_email_interval += 1000;
        TrySetDestryableTimeout(wait_for_account_email_then_setup, account_email_interval);
      }
    }

    // called by wait_for_account_email_then_setup
    function setup(account_email) {
      tool.browser.message.tab_id(function (tab_id) {
        catcher.try(function () {
          factory = element_factory(account_email, tab_id, chrome_runtime_id, reloadable_class, destroyable_class);
          inject = content_script_element_injector('gmail', factory);
          hijack_gmail_hotkeys(account_email, tab_id);
          inject.meta();
          add_account_email_to_list_of_accounts(account_email);
          save_account_email_full_name_if_needed(account_email);
          var show_setup_needed_notification_if_setup_not_done = true;
          var wait_for_setup_interval = TrySetDestryableInterval(function () {
            account_storage_get(account_email, ['setup_done', 'cryptup_enabled', 'notification_setup_needed_dismissed'], function (storage) {
              if(storage.setup_done === true && storage.cryptup_enabled !== false) { //"not false" is due to cryptup_enabled unfedined in previous versions, which means "true"
                notifications.clear();
                initialize(account_email, tab_id);
                clearInterval(wait_for_setup_interval);
              } else if(!$("div.gmail_notification").length && !storage.notification_setup_needed_dismissed && show_setup_needed_notification_if_setup_not_done && storage.cryptup_enabled !== false) {
                var set_up_link = tool.env.url_create('_PLUGIN/settings/index.htm', { account_email: account_email });
                var set_up_notification = '<a href="' + set_up_link + '" target="cryptup">Set up CryptUp</a> to send and receive secure email on this account. <a href="#" class="notification_setup_needed_dismiss">dismiss</a> <a href="#" class="close">remind me later</a>';
                notifications.show(set_up_notification, {
                  notification_setup_needed_dismiss: function () {
                    account_storage_set(account_email, { notification_setup_needed_dismissed: true }, notifications.clear);
                  },
                  close: function () {
                    show_setup_needed_notification_if_setup_not_done = false;
                  }
                });
              }
            });
          }, 1000);
        })();
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
          replace.reinsert_reply_box(data.subject, data.my_email, data.their_email, data.thread_id);
        },
        set_css: function (data) {
          $(data.selector).css(data.css);
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
        add_pubkey_dialog_gmail: function (data) {
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

      tool.browser.message.send(null, 'migrate_account', { account_email: account_email, }, catcher.try(function () {
        start(account_email, tab_id);
      }));
    }

    // called by initialize
    function start(account_email, tab_id) {
      account_storage_get(account_email, ['addresses', 'google_token_scopes'], function (storage) {
        var can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
        inject.buttons();
        replace = init_elements_replace_js(factory, account_email, storage.addresses || [account_email], can_read_emails);
        notifications.show_initial(account_email);
        replace.everything();
        TrySetDestryableInterval(function () {
          replace.everything();
        }, replace_pgp_elements_interval);
      });
    }

    function save_account_email_full_name(account_email) {
      // will cycle until page loads and name is accessible
      // todo - create general event on_gmail_finished_loading for similar actions
      TrySetDestryableTimeout(function () {
        var full_name = $("div.gb_hb div.gb_lb").text();
        if(full_name) {
          account_storage_set(account_email, { full_name: full_name, });
        } else {
          save_account_email_full_name(account_email);
        }
      }, 1000);
    }

    function save_account_email_full_name_if_needed(account_email) {
      account_storage_get(account_email, 'full_name', function (value) {
        if(typeof value === 'undefined') {
          save_account_email_full_name(account_email);
        }
      });
    }

    function hijack_gmail_hotkeys() {
      var keys = tool.env.key_codes();
      var unsecure_reply_key_shortcuts = [keys.a, keys.r, keys.A, keys.R, keys.f, keys.F];
      $(document).keypress(function (e) {
        catcher.try(function () {
          var causes_unsecure_reply = tool.value(e.which).in(unsecure_reply_key_shortcuts);
          if(causes_unsecure_reply && !$(document.activeElement).is('input, select, textarea, div[contenteditable="true"]') && $('iframe.reply_message').length) {
            e.stopImmediatePropagation();
            replace.set_reply_box_editable();
          }
        })();
      });
    }

    function get_account_email() {
      var account_email_loading_match = $("#loading div.msg").text().match(/[a-z0-9._]+@[^…< ]+/gi);
      if(account_email_loading_match !== null) {
        return account_email_loading_match[0].replace(/^[\s\.]+|[\s\.]+$/gm, '').toLowerCase();
      } else {
        return undefined;
      }
    }

    return {
      wait_for_account_email_then_setup: wait_for_account_email_then_setup,
    };

  }

})();