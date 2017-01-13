'use strict';

function init_elements_inject_js() {

  window.inject_meta = function(destroyable_class) {
    $('body').append('<link class="' + destroyable_class + '" rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
    $('body').append('<link class="' + destroyable_class + '" rel="stylesheet" href="' + chrome.extension.getURL('css/font-awesome.min.css') + '" />');
    $('body').append('<center class="' + destroyable_class + ' gmail_notifications"></center>');
  };

  window.inject_buttons = function(account_email, destroyable_class, tab_id) {
    if($('div.aic').length === 0) { // don't inject too early
      TrySetDestryableTimeout(function() {
        inject_buttons(account_email, destroyable_class, tab_id);
      }, 300);
    } else {
      if($('div.new_message_button').length === 0) {
        $('div.aic').prepend('<div class="' + destroyable_class + ' z0"><div class="new_message_button" role="button" tabindex="0">SECURE COMPOSE</div></div>');
        $('div.new_message_button').click(Try(function() {
          open_new_message(account_email, tab_id);
        }));
      }
    }
  };

}
