'use strict';

var account_email = $("div.msg:contains('Loading '):contains('…')").text().replace('Loading ', '').replace('…', '');

function inject_cryptup() {
  // chrome.storage.local.set({cryptup_setup_done: true});
  // account_storage_remove(account_email, 'setup_done');

  var application_signal_scope = random_string(4);
  signal_scope_set(application_signal_scope);

  add_account_email_to_list_of_accounts(account_email);
  save_account_email_full_name_if_needed(account_email);
  inject_essential_elements(account_email, application_signal_scope);
  inject_setup_dialog_if_needed(account_email, application_signal_scope);
  discover_and_replace_pgp_blocks(account_email, application_signal_scope);

  signal_listen('gmail_tab', {
    close_new_message: function(data) {
      $('div.new_message').remove();
    },
    close_reply_message: function(data) {
      $('iframe#' + data.frame_id).remove();
    },
    reinsert_reply_box: function(data) {
      reinsert_reply_box(data.account_email, application_signal_scope, data.last_message_frame_id, data.last_message_frame_height, data.my_email, data.their_email);
    },
    pgp_block_iframe_set_css: function(data) {
      $('iframe#' + data.frame_id).css(data.css);
    },
    close_setup_dialog: function(data) {
      $('div#cryptup_dialog').remove();
    },
    setup_dialog_set_css: function(data) {
      $('div#cryptup_dialog').css(data);
    },
  });
}

function inject_essential_elements(account_email, signal_scope) {
  // $('body').append('<div class="cryptup_logo"></div>');
  $('body').append('<div class="T-I-KE T-I J-J5-Ji new_message_button"><i class="fa fa-lock"></i></div>');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/font-awesome.min.css') + '" />');
  $('div.new_message_button').click(function() {
    if($('div.new_message').length == 0) {
      var url = chrome.extension.getURL('chrome/gmail_elements/new_message.htm') +
        '?account_email=' + encodeURIComponent(account_email) +
        '&signal_scope=' + encodeURIComponent(signal_scope);
      $('body').append('<div class="new_message" id="new_message"><iframe scrolling="no" src="' + url + '"></iframe></div>');
    }
  });
}

function migrate_from_earlier_versions(account_email, then) {
  // migrating from 0.4 to 0.5: global to per_account settings
  chrome.storage.local.get(['cryptup_setup_done'], function(storage) {
    if(storage['cryptup_setup_done'] === true) {
      account_storage_set(account_email, {setup_done: true}, function() {
        chrome.storage.local.remove('cryptup_setup_done', then);
      });
    }
    else {
      then();
    }
  });
}

function inject_setup_dialog_if_needed(account_email, signal_scope) {
  migrate_from_earlier_versions(account_email, function() {
    account_storage_get(account_email, ['full_name', 'setup_done'], function(account_storage) {
      if(account_storage['setup_done'] !== true) {
        var url = chrome.extension.getURL('chrome/gmail_elements/setup_dialog.htm') +
          '?account_email=' + encodeURIComponent(account_email) +
          '&full_name=' + encodeURIComponent(account_storage['full_name']) +
          '&signal_scope=' + encodeURIComponent(signal_scope);
        $('body').append('<div id="cryptup_dialog"><iframe scrolling="no" src="' + url + '"></iframe></div>');
      }
    });
  });
}

function save_account_email_full_name(account_email) {
  // will cycle until page loads and name is accessible
  // todo - create general event on_gmail_finished_loading for similar actions
  setTimeout(function() {
    var full_name = $("div.gb_hb div.gb_lb").text();
    if(full_name) {
      account_storage_set(account_email, {full_name: full_name});
    } else {
      save_account_email_full_name(account_email);
    }
  }, 1000);
}

function add_account_email_to_list_of_accounts(account_email) { //todo: concurrency issues with another tab loaded at the same time
  account_storage_get(null, 'account_emails', function(account_emails_string) {
    var account_emails = [];
    if(typeof account_emails_string !== 'undefined') {
      account_emails = JSON.parse(account_emails_string);
    }
    if(account_emails.indexOf(account_email) === -1) {
      account_emails.push(account_email);
      account_storage_set(null, {'account_emails': JSON.stringify(account_emails)});
    }
  });
}

function save_account_email_full_name_if_needed(account_email) {
  account_storage_get(account_email, 'full_name', function(value) {
    if(typeof value === 'undefined') {
      save_account_email_full_name(account_email);
    }
  });
}

function discover_and_replace_pgp_blocks(account_email, signal_scope) {
  find_and_replace_pgp_messages(account_email, signal_scope);
  setInterval(function() {
    find_and_replace_pgp_messages(account_email, signal_scope);
  }, 1000);
}

if(document.title.indexOf("Gmail") != -1 || document.title.indexOf("Mail") != -1) {
  inject_cryptup();
}
