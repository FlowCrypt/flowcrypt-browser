/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function init_elements_inject_js() {

  var _factory;
  function factory() { //todo - this should be done through DI
    if(!_factory) {
      _factory = get_factory();
    }
    return _factory;
  }

  window.inject_meta = function (destroyable_class) {
    $('body').append('<link class="' + destroyable_class + '" rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
    $('body').append('<link class="' + destroyable_class + '" rel="stylesheet" href="' + chrome.extension.getURL('css/font-awesome.min.css') + '" />');
    $('body').append('<center class="' + destroyable_class + ' gmail_notifications"></center>');
  };

  window.open_new_message = function () {
    if($('div.new_message').length == 0) {
      $('body').append(factory().embedded.compose());
    }
  };

  window.inject_buttons = function (account_email, destroyable_class, tab_id) {
    if($('div.aic').length === 0) { // don't inject too early
      TrySetDestryableTimeout(function () {
        inject_buttons(account_email, destroyable_class, tab_id);
      }, 300);
    } else {
      if($('div.new_message_button').length === 0) {
        $('div.aic').prepend('<div class="' + destroyable_class + ' z0"><div class="new_message_button" role="button" tabindex="0">SECURE COMPOSE</div></div>');
        $('div.new_message_button').click(catcher.try(function () {
          open_new_message();
        }));
      }
    }
  };

}
