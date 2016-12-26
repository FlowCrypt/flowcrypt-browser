'use strict';

function init_elements_inject_js() {

  window.inject_meta = function() {
    $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
    $('body').append('<link rel="stylesheet" href="' + chrome.extension.getURL('css/font-awesome.min.css') + '" />');
    $('body').append('<center class="gmail_notifications"></center>');
  };

  window.inject_buttons = function(account_email, tab_id) {
    if($('div.aic').length === 0) { // don't inject too early
      TrySetTimeout(function() {
        inject_buttons(account_email, tab_id);
      }, 300);
    } else {
      if($('div.new_message_button').length === 0) {
        $('div.aic').prepend('<div class="z0"><div class="new_message_button" role="button" tabindex="0">SECURE COMPOSE</div></div>');
        $('div.new_message_button').click(Try(function() {
          if(!page_refresh_needed()) {
            open_new_message(account_email, tab_id);
          } else {
            show_page_refresh_notification();
          }
        }));
      }
    }
  };

}
