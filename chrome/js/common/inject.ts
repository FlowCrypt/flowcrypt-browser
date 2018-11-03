/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import {XssSafeFactory} from './factory.js';
import {Catch} from './common.js';
import * as t from '../../types/common';
import { ContentScriptWindow } from './extension.js';
import { Ui } from './browser.js';

export class Injector {

  private factory: XssSafeFactory;
  private webmail_name: t.WebMailName;
  private webmail_variant: t.WebmailVariantString;
  private S: t.SelectorCache;
  private compose_button_container_selector = {
    'gmail': 'div.aic',
    'inbox': 'div.jp',
    'outlook': 'div._fce_b',
    'settings': '#does_not_have',
  };

  constructor(webmail_name: t.WebMailName, webmail_variant: t.WebmailVariantString, factory: XssSafeFactory) {
    this.webmail_name = webmail_name;
    this.webmail_variant = webmail_variant;
    this.factory = factory;
    this.S = Ui.build_jquery_selectors({
      body: 'body',
      compose_button_container: this.compose_button_container_selector[this.webmail_name],
      compose_button: 'div.new_message_button',
      compose_button_label: '#cryptup_compose_button_label',
      compose_window: 'div.new_message',
    });
  }

  meta = () => {
    this.S.cached('body').addClass(`cryptup_${this.webmail_name} cryptup_${this.webmail_name}_${this.webmail_variant}`).append(this.factory.meta_stylesheet('webmail') + this.factory.meta_notification_container());  // xss-safe-factory
  }

  open_compose_window = () => {
    if (this.S.now('compose_window').length === 0) {
      this.S.cached('body').append(this.factory.embedded_compose()); // xss-safe-factory
    }
  }

  buttons = () => {
    if (this.S.now('compose_button_container').length === 0) { // don't inject too early
      (window as ContentScriptWindow).TrySetDestroyableTimeout(this.buttons, 300);
    } else {
      if (this.S.now('compose_button').length === 0) {
        let container;
        if (this.webmail_name === 'inbox') {
          container = this.S.now('compose_button_container').append(this.factory.button_compose(this.webmail_name)); // xss-safe-factory
          container.find(this.S.selector('compose_button')).hover(Catch.try(() => this.S.cached('compose_button_label').css('opacity', 1)), Catch.try(() => this.S.cached('compose_button_label').css('opacity', '')));
        } else {
          container = this.S.now('compose_button_container').prepend(this.factory.button_compose(this.webmail_name)); // xss-safe-factory
        }
        container.find(this.S.selector('compose_button')).click(Ui.event.handle(() => this.open_compose_window()));
      }
    }
  }

}
