'use strict';

if (document.title.indexOf("Gmail") != -1 || document.title.indexOf("Mail") != -1) {

  // console.log(window.navigator.appVersion);
  // console.log(window.navigator.platform);

  var account = $("div.msg:contains('Loading '):contains('…')").text().replace('Loading ', '').replace('…', '');
  chrome.storage.local.set({primary_email: account});
  
  $('body').append('<div class="cryptup_logo"></div>');
  $('body').append('<div class="T-I-KE T-I J-J5-Ji new_message_button">@</div>');
  $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');

  $('div.new_message_button').click(function(){
    if($('div.new_message').length == 0) {
      $('body').append('<div class="new_message" id="new_message"><iframe scrolling="no" src="' + chrome.extension.getURL('chrome/gmail_elements/new_message.htm') + '"></iframe></div>');
    }
  });

  // $('div.reply').click(function(){
  //   if($('div.reply_message').length == 0) {
  //     $('body').append('<div class="reply_message" id="reply_message"><iframe src="' + chrome.extension.getURL('elements/reply_message.htm') + '"></iframe></div>');
  //   }
  // });

  set_signal_listener('gmail_tab', {
    close_new_message: function(data, sender) {
      $('div.new_message').remove();
    },
    pgp_block_iframe_set_css: function(data, sender) {
      $('iframe#' + sender).css(data);
    }
  });

}
