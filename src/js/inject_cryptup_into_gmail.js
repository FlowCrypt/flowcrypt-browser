'use strict';

var do_load_libraries = null;

if (document.title.indexOf("Gmail") != -1 || document.title.indexOf("Mail") != -1) {
  console.log(1);
  var current_account = $("div.msg:contains('Loading '):contains('…')").text().replace('Loading ', '').replace('…', '');
  console.log(current_account);;
  chrome.storage.local.get(['primary_email'], function(storage){
    if (typeof storage['primary_email'] === 'undefined'){
      chrome.storage.local.set({primary_email: current_account}, function(){
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

function inject_cryptup() {
  $('body').append('<div class="cryptup_logo"></div>');
  $('body').append('<div class="T-I-KE T-I J-J5-Ji new_message_button">@</div>');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');

  $('div.new_message_button').click(function(){
    if($('div.new_message').length == 0) {
      $('body').append('<div class="new_message" id="new_message"><iframe scrolling="no" src="' + chrome.extension.getURL('chrome/gmail_elements/new_message.htm') + '"></iframe></div>');
    }
  });

  set_signal_listener('gmail_tab', {
    close_new_message: function(data, sender) {
      $('div.new_message').remove();
    },
    close_reply_message: function(data, sender) {
      $('iframe#' + data.frame_id).remove();
    },
    pgp_block_iframe_set_css: function(data, sender) {
      $('iframe#' + sender).css(data);
    }
  });
}
