/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

class Injector {

  private factory: Factory;
  private webmail_name: WebMailName;
  private webmail_variant: WebmailVariantString;
  private S: SelectorCache;
  private compose_button_container_selector = {
    'gmail': 'div.aic',
    'inbox': 'div.jp',
    'outlook': 'div._fce_b',
  };

  constructor(webmail_name: WebMailName, webmail_variant: WebmailVariantString, factory: Factory) {
    this.webmail_name = webmail_name;
    this.webmail_variant = webmail_variant;
    this.factory = factory;
    this.S = tool.ui.build_jquery_selectors({
      body: 'body',
      compose_button_container: this.compose_button_container_selector[this.webmail_name],
      compose_button: 'div.new_message_button',
      compose_button_label: '#cryptup_compose_button_label',
      compose_window: 'div.new_message',
    });
  }

  meta = () => {
    this.S.cached('body').addClass(`cryptup_${this.webmail_name} cryptup_${this.webmail_name}_${this.webmail_variant}`).append(this.factory.meta_stylesheet('webmail') + this.factory.meta_notification_container());
  }

  open_compose_window = () => {
    if(this.S.now('compose_window').length === 0) {
      this.S.cached('body').append(this.factory.embedded_compose());
    }
  }

  buttons = () => {
    if(this.S.now('compose_button_container').length === 0) { // don't inject too early
      (window as ContentScriptWindow).TrySetDestroyableTimeout(this.buttons, 300);
    } else {
      if(this.S.now('compose_button').length === 0) {
        let container;
        if(this.webmail_name === 'inbox') {
          container = this.S.now('compose_button_container').append(this.factory.button_compose(this.webmail_name));
          container.find(this.S.selector('compose_button')).hover(catcher.try(() => this.S.cached('compose_button_label').css('opacity', 1)), catcher.try(() => this.S.cached('compose_button_label').css('opacity', '')));
        } else {
          container = this.S.now('compose_button_container').prepend(this.factory.button_compose(this.webmail_name))
        }
        container.find(this.S.selector('compose_button')).click(catcher.try(() => this.open_compose_window()));
      }
    }
  }

}