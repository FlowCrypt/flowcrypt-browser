'use strict';

var do_load_libraries = null;

function inject_cryptup() {
  inject_essential_elements();
  inject_setup_dialog_if_needed();

  set_signal_listener('gmail_tab', {
    close_new_message: function(data, sender) {
      $('div.new_message').remove();
    },
    close_reply_message: function(data, sender) {
      $('iframe#' + data.frame_id).remove();
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
  $('body').append('<div class="cryptup_logo"></div>');
  $('body').append('<div class="T-I-KE T-I J-J5-Ji new_message_button">@</div>');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
  $('div.new_message_button').click(function(){
    if($('div.new_message').length == 0) {
      $('body').append('<div class="new_message" id="new_message"><iframe scrolling="no" src="' + chrome.extension.getURL('chrome/gmail_elements/new_message.htm') + '"></iframe></div>');
    }
  });
}

function inject_setup_dialog_if_needed(){
  chrome.storage.local.get(['cryptup_setup_done'], function(storage) {
    if(storage['cryptup_setup_done'] !== true){
      $('body').append('<div id="cryptup_dialog"><iframe scrolling="no" src="' + chrome.extension.getURL('chrome/gmail_elements/setup_dialog.htm') + '"></iframe></div>');
    }
  });
}

function save_primary_email_name() {
  // will cycle until page loads and name is accessible
  // todo - create general event on_gmail_finished_loading for similar actions
  setTimeout(function(){
    $("div.gb_hb div.gb_lb").css('border', '1px solid red');
    var primary_email_name = $("div.gb_hb div.gb_lb").text();
    if(primary_email_name){
      chrome.storage.local.set({primary_email_name: primary_email_name});
    }
    else{
      save_full_name_when_gmail_loads();
    }
  }, 500);
}

if (document.title.indexOf("Gmail") != -1 || document.title.indexOf("Mail") != -1) {
  var current_account = $("div.msg:contains('Loading '):contains('…')").text().replace('Loading ', '').replace('…', '');
  chrome.storage.local.get(['primary_email', 'primary_email_name'], function(storage) {
    if (typeof storage['primary_email'] === 'undefined') {
      save_primary_email_name();
      chrome.storage.local.set({primary_email: current_account}, function() {
        inject_cryptup();
        do_load_libraries = true;
      });
    }
    else if (storage['primary_email'] === current_account) {
      inject_cryptup();
      do_load_libraries = true;
    }
    else {
      do_load_libraries = false;
    }
  });
}
