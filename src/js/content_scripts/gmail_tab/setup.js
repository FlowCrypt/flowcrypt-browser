/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function init_setup_js() {

  var GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

  var account_email_interval = 1000;
  var replace_pgp_elements_interval = 1000;
  window.account_email_global = null;
  window.same_world_global = true;

  window.save_account_email_full_name = function(account_email) {
    // will cycle until page loads and name is accessible
    // todo - create general event on_gmail_finished_loading for similar actions
    TrySetDestryableTimeout(function() {
      var full_name = $("div.gb_hb div.gb_lb").text();
      if(full_name) {
        account_storage_set(account_email, {
          full_name: full_name,
        });
      } else {
        save_account_email_full_name(account_email);
      }
    }, 1000);
  };

  window.save_account_email_full_name_if_needed = function(account_email) {
    account_storage_get(account_email, 'full_name', function(value) {
      if(typeof value === 'undefined') {
        save_account_email_full_name(account_email);
      }
    });
  };

  window.wait_for_account_email_then_setup = function() {
    var account_email = get_account_email();
    if(typeof account_email !== 'undefined') {
      console.log('Loading CryptUP ' + window.chrome.runtime.getManifest().version);
      account_email_global = account_email;
      setup(account_email);
    } else {
      console.log('Cannot load CryptUP yet. Page: ' + window.location + ' (' + document.title + ')');
      account_email_interval += 1000;
      TrySetDestryableTimeout(wait_for_account_email_then_setup, account_email_interval);
    }
  };

  // called by wait_for_account_email_then_setup
  window.setup = function(account_email) {
    chrome_message_get_tab_id(function(tab_id) {
      Try(function() {
        hijack_gmail_hotkeys(account_email, tab_id);
        inject_meta(destroyable_class);
        add_account_email_to_list_of_accounts(account_email);
        save_account_email_full_name_if_needed(account_email);
        var show_setup_needed_notification_if_setup_not_done = true;
        var wait_for_setup_interval = TrySetDestryableInterval(function() {
          account_storage_get(account_email, ['setup_done', 'cryptup_enabled', 'notification_setup_needed_dismissed'], function(storage) {
            if(storage.setup_done === true && storage.cryptup_enabled !== false) { //"not false" is due to cryptup_enabled unfedined in previous versions, which means "true"
              gmail_notification_clear();
              initialize(account_email, tab_id);
              clearInterval(wait_for_setup_interval);
            } else if(!$("div.gmail_notification").length && !storage.notification_setup_needed_dismissed && show_setup_needed_notification_if_setup_not_done && storage.cryptup_enabled !== false) {
              var set_up_notification = '<a href="_PLUGIN/settings/index.htm?account_email=' + encodeURIComponent(account_email) + '" target="cryptup">Set up CryptUP</a> to send and receive secure email on this account. <a href="#" class="notification_setup_needed_dismiss">dismiss</a> <a href="#" class="close">remind me later</a>';
              gmail_notification_show(set_up_notification, {
                notification_setup_needed_dismiss: function() {
                  account_storage_set(account_email, {
                    notification_setup_needed_dismissed: true
                  }, gmail_notification_clear);
                },
                close: function() {
                  show_setup_needed_notification_if_setup_not_done = false;
                }
              });
            }
          });
        }, 1000);
      })();
    });
  };

  // called by setup
  window.initialize = function(account_email, tab_id) {
    chrome_message_listen({
      open_new_message: function(data) {
        open_new_message(account_email, tab_id);
      },
      close_new_message: function(data) {
        $('div.new_message').remove();
      },
      close_reply_message: function(data) {
        $('iframe#' + data.frame_id).remove();
      },
      reinsert_reply_box: function(data) {
        reinsert_reply_box(data.account_email, tab_id, data.subject, data.my_email, data.their_email, data.thread_id);
      },
      set_css: function(data) {
        $(data.selector).css(data.css);
      },
      passphrase_dialog: function(data) {
        if(!$('#cryptup_dialog').length) {
          $('body').append(passphrase_dialog(account_email, data.type, data.longids, tab_id));
        }
      },
      subscribe_dialog: function(data) {
        if(!$('#cryptup_dialog').length) {
          $('body').append(subscribe_dialog(account_email, null, false, tab_id));
        }
      },
      add_pubkey_dialog_gmail: function(data) {
        if(!$('#cryptup_dialog').length) {
          $('body').append(add_pubkey_dialog(account_email, data.emails, tab_id));
        }
      },
      notification_show: function(data) {
        gmail_notification_show(data.notification, data.callbacks);
        $('body').one('click', Try(gmail_notification_clear));
      },
      close_dialog: function(data) {
        $('#cryptup_dialog').remove();
      },
    }, tab_id);

    chrome_message_send(null, 'migrate_account', {
      account_email: account_email,
    }, Try(function() {
      start(account_email, tab_id);
    }));
  };

  // called by initialize
  window.start = function(account_email, tab_id) {
    account_storage_get(account_email, ['addresses', 'google_token_scopes'], function(storage) {
      var addresses = storage.addresses || [account_email];
      var can_read_emails = (typeof storage.google_token_scopes !== 'undefined' && storage.google_token_scopes.indexOf(GMAIL_READ_SCOPE) !== -1);
      inject_buttons(account_email, destroyable_class, tab_id);
      show_initial_notifications(account_email);
      replace_pgp_elements(account_email, addresses, can_read_emails, tab_id);
      TrySetDestryableInterval(function() {
        replace_pgp_elements(account_email, addresses, can_read_emails, tab_id);
      }, replace_pgp_elements_interval);
    });
  };

  window.hijack_gmail_hotkeys = function(account_email, tab_id) {
    var keys = key_codes();
    $(document).keypress(function(e) {
      var causes_unsecure_reply = [keys.a, keys.r, keys.A, keys.R, keys.f, keys.F].indexOf(e.which) !== -1;
      if(causes_unsecure_reply && !$(document.activeElement).is('input, select, textarea, div[contenteditable="true"]') && $('iframe.reply_message').length) {
        e.stopImmediatePropagation();
        set_reply_box_editable(account_email, tab_id);
      }
    });
  };

  window.get_account_email = function() {
    var account_email_loading_match = $("#loading div.msg").text().match(/[a-z0-9._]+@[^…< ]+/gi);
    if(account_email_loading_match !== null) {
      return account_email_loading_match[0].replace(/^[\s\.]+|[\s\.]+$/gm, '').toLowerCase();
    } else {
      return undefined;
    }
  };

  /* ######################## MIMICKING STANDARD JS FUNCTIONS ######################### */

  window.TrySetDestryableInterval = function(code, ms) {
    var id = TrySetInterval(code, ms);
    destroyable_intervals.push(id);
    return id;
  }

  window.TrySetDestryableTimeout = function(code, ms) {
    var id = TrySetTimeout(code, ms);
    destroyable_timeouts.push(id);
    return id;
  }

}
