/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

function content_script_element_injector(webmail_name, factory) {

  var compose_button_container_selector = {
    'gmail': 'div.aic',
    'inbox': 'div.jp',
    'outlook': 'div._fce_b',
  };

  var S = tool.ui.build_jquery_selectors({
    body: 'body',
    compose_button_container: compose_button_container_selector[webmail_name],
    compose_button: 'div.new_message_button',
    compose_window: 'div.new_message',
  });

  function meta() {
    S.cached('body').addClass('cryptup_' + webmail_name).append(factory.meta.stylesheet('webmail') + factory.meta.notification_container());
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
        if(webmail_name === 'inbox') {
          var container = S.now('compose_button_container').append(factory.button.compose(webmail_name));
          container.find(S.selector('compose_button')).hover(
            catcher.try(function() { $('#cryptup_compose_button_label').css('opacity', 1); }),
            catcher.try(function() { $('#cryptup_compose_button_label').css('opacity', ''); })
          );
        } else {
          var container = S.now('compose_button_container').prepend(factory.button.compose(webmail_name))
        }
        container.find(S.selector('compose_button')).click(catcher.try(open_compose_window));
      }
    }
  }

  return {
    meta: meta,
    buttons: buttons,
    open_compose_window: open_compose_window,
  };

}
