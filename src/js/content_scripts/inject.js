/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function content_script_element_injector(webmail_name, factory) {

  var compose_button_container_selector = {
    'gmail': 'div.aic',
  };

  var S = tool.ui.build_jquery_selectors({
    body: 'body',
    compose_button_container: compose_button_container_selector[webmail_name],
    compose_button: 'div.new_message_button',
    compose_window: 'div.new_message',
  });

  function meta() {
    S.cached('body').append(factory.meta.stylesheet(webmail_name) + factory.meta.notification_container());
  }

  function open_compose_window() {
    if(S.now('compose_window').length == 0) {
      S.cached('body').append(factory.embedded.compose());
    }
  }

  function buttons() {
    if(S.now('compose_button_container').length === 0) { // don't inject too early
      TrySetDestryableTimeout(buttons, 300);
    } else {
      if(S.now('compose_button').length === 0) {
        S.now('compose_button_container').prepend(factory.button.compose()).find(S.selector('compose_button')).click(catcher.try(open_compose_window));
      }
    }
  }

  return {
    meta: meta,
    buttons: buttons,
    open_compose_window: open_compose_window,
  };

}
