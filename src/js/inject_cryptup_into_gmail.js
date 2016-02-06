'use strict';

var account_email = $("div.msg:contains('Loading '):contains('…')").text().replace('Loading ', '').replace('…', '');

function inject_cryptup() {
  save_account_email_full_name_if_needed(account_email);
  inject_essential_elements();
  inject_setup_dialog_if_needed(account_email);
  discover_and_replace_pgp_blocks(account_email);

  set_signal_listener('gmail_tab', {
    close_new_message: function(data, sender) {
      $('div.new_message').remove();
    },
    close_reply_message: function(data, sender) {
      $('iframe#' + data.frame_id).remove();
    },
    reinsert_reply_box: function(data, sender) {
      reinsert_reply_box(data.account_email, data.last_message_frame_id, data.last_message_frame_height, data.my_email, data.their_email);
    },
    pgp_block_iframe_set_css: function(data, sender) {
      $('iframe#' + sender).css(data);
    },
    close_setup_dialog: function(data, sender) {
      $('div#cryptup_dialog').remove();
    },
    setup_dialog_set_css: function(data, sender) {
      $('div#cryptup_dialog').css(data);
    }
  });
}

function inject_essential_elements() {
  // $('body').append('<div class="cryptup_logo"></div>');
  $('body').append('<div class="T-I-KE T-I J-J5-Ji new_message_button"><i class="fa fa-lock"></i></div>');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/font-awesome.min.css') + '" />');
  $('div.new_message_button').click(function(){
    if($('div.new_message').length == 0) {
      var url = chrome.extension.getURL('chrome/gmail_elements/new_message.htm') + '?account_email=' + encodeURIComponent(account_email);
      $('body').append('<div class="new_message" id="new_message"><iframe scrolling="no" src="' + url + '"></iframe></div>');
    }
  });
}

function inject_setup_dialog_if_needed(account_email){
  account_storage_get(account_email, ['full_name', 'setup_done'], function(account_storage) {
    if(account_storage['setup_done'] !== true) {
      var url_base = chrome.extension.getURL('chrome/gmail_elements/setup_dialog.htm');
      var url_params = '?account_email=' + encodeURIComponent(account_email) + '&full_name=' + encodeURIComponent(account_storage['full_name']);
      $('body').append('<div id="cryptup_dialog"><iframe scrolling="no" src="' + url_base + url_params + '"></iframe></div>');
    }
  });
}

function save_account_email_full_name(account_email) {
  // will cycle until page loads and name is accessible
  // todo - create general event on_gmail_finished_loading for similar actions
  setTimeout(function() {
    var full_name = $("div.gb_hb div.gb_lb").text();
    if(full_name) {
      account_storage_set(account_email, 'full_name', full_name);
    }
    else {
      save_account_email_full_name(account_email);
    }
  }, 500);
}

function save_account_email_full_name_if_needed(account_email) {
  account_storage_get(account_email, 'full_name', function(value){
    if (typeof value === 'undefined') {
      save_account_email_full_name(account_email);
    }
  });
}

function discover_and_replace_pgp_blocks(account_email){
  find_and_replace_pgp_messages(account_email);
  setInterval(function(){
    find_and_replace_pgp_messages(account_email);
  }, 1000);
}

if (document.title.indexOf("Gmail") != -1 || document.title.indexOf("Mail") != -1) {
  inject_cryptup();
}
