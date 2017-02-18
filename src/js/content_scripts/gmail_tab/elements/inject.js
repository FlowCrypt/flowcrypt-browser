/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function init_elements_inject_js(factory, account_email, tab_id, destroyable_class) {

  var S = tool.ui.build_jquery_selectors({
    body: 'body',
    compose_button_container: 'div.aic',
    compose_button: 'div.new_message_button',
    compose_window: 'div.new_message',
  });

  function meta() {
    S.cached('body').append('<link class="' + destroyable_class + '" rel="stylesheet" href="' + chrome.extension.getURL('css/gmail.css') + '" />');
    S.cached('body').append('<link class="' + destroyable_class + '" rel="stylesheet" href="' + chrome.extension.getURL('css/font-awesome.min.css') + '" />');
    S.cached('body').append('<center class="' + destroyable_class + ' gmail_notifications"></center>');
  }

  function compose_window() {
    if(S.now('compose_window').length == 0) {
      S.cached('body').append(factory.embedded.compose());
    }
  }

  function buttons() {
    if(S.now('compose_button_container').length === 0) { // don't inject too early
      TrySetDestryableTimeout(function () {
        buttons(account_email, destroyable_class, tab_id);
      }, 300);
    } else {
      if(S.now('compose_button').length === 0) {
        S.now('compose_button_container').prepend('<div class="' + destroyable_class + ' z0"><div class="new_message_button" role="button" tabindex="0">SECURE COMPOSE</div></div>');
        S.now('compose_button').click(catcher.try(function () {
          compose_window();
        }));
      }
    }
  }

  return {
    meta: meta,
    buttons: buttons,
    compose_window: compose_window,
  };

}
