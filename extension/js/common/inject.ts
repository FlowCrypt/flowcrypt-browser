/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from './common.js';
import { ContentScriptWindow } from './extension.js';
import { Ui, XssSafeFactory, SelCache, WebMailName, WebmailVariantString } from './browser.js';

export class Injector {

  private factory: XssSafeFactory;
  private webmailName: WebMailName;
  private webmailVariant: WebmailVariantString;
  private S: SelCache;
  private composeBtnContainerSel = {
    'gmail': 'div.aic',
    'inbox': 'div.jp',
    'outlook': 'div._fce_b',
    'settings': '#does_not_have',
  };

  constructor(webmailName: WebMailName, webmailVariant: WebmailVariantString, factory: XssSafeFactory) {
    this.webmailName = webmailName;
    this.webmailVariant = webmailVariant;
    this.factory = factory;
    this.S = Ui.buildJquerySels({
      body: 'body',
      compose_button_container: this.composeBtnContainerSel[this.webmailName],
      compose_button: 'div.new_message_button',
      compose_button_label: '#cryptup_compose_button_label',
      compose_window: 'div.new_message',
    });
  }

  meta = () => {
    this.S.cached('body').addClass(`cryptup_${this.webmailName} cryptup_${this.webmailName}_${this.webmailVariant}`)
      .append(this.factory.metaStylesheet('webmail') + this.factory.metaNotificationContainer());  // xss-safe-factory
  }

  openComposeWin = () => {
    if (this.S.now('compose_window').length === 0) {
      this.S.cached('body').append(this.factory.embeddedCompose()); // xss-safe-factory
    }
  }

  btns = () => {
    if (this.S.now('compose_button_container').length === 0) { // don't inject too early
      (window as ContentScriptWindow).TrySetDestroyableTimeout(this.btns, 300);
    } else {
      if (this.S.now('compose_button').length === 0) {
        let container;
        if (this.webmailName === 'inbox') {
          container = this.S.now('compose_button_container').append(this.factory.btnCompose(this.webmailName)); // xss-safe-factory
          container.find(this.S.sel('compose_button')).hover(
            Catch.try(() => this.S.cached('compose_button_label').css('opacity', 1)),
            Catch.try(() => this.S.cached('compose_button_label').css('opacity', '')),
          );
        } else {
          container = this.S.now('compose_button_container').prepend(this.factory.btnCompose(this.webmailName)); // xss-safe-factory
        }
        container.find(this.S.sel('compose_button')).click(Ui.event.handle(() => this.openComposeWin()));
      }
    }
  }

}
