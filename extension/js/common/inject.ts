/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { ContentScriptWindow } from './extension.js';
import { Ui, SelCache, WebMailName } from './browser.js';
import { XssSafeFactory, WebmailVariantString } from './xss_safe_factory.js';
import { Catch } from './platform/catch.js';
import { Store } from './platform/store.js';

export class Injector {

  private factory: XssSafeFactory;
  private webmailName: WebMailName;
  private webmailVariant: WebmailVariantString;
  private S: SelCache;
  private composeBtnContainerSel = { // tslint:disable-line:oneliner-object-literal
    'gmail': 'div.aic',
    'outlook': 'div._fce_b',
    'settings': '#does_not_have',
  };

  constructor(webmailName: WebMailName, webmailVariant: WebmailVariantString, factory: XssSafeFactory) {
    this.webmailName = webmailName;
    this.webmailVariant = webmailVariant;
    this.factory = factory;
    this.S = Ui.buildJquerySels({ // these are selectors that are not specific to any webmail variant
      body: 'body',
      compose_button_container: this.composeBtnContainerSel[this.webmailName],
      compose_button: 'div.new_message_button',
      compose_button_label: '#cryptup_compose_button_label',
      compose_window: 'div.new_message',
    });
  }

  meta = () => {
    this.S.cached('body').addClass(`cryptup_${this.webmailName} cryptup_${this.webmailName}_${this.webmailVariant} ${Catch.browser().name}`)
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
        const container = this.S.now('compose_button_container').prepend(this.factory.btnCompose(this.webmailName)); // xss-safe-factory
        container.find(this.S.sel('compose_button')).click(Ui.event.handle(() => this.openComposeWin()));
      }
    }
  }

  insertEndSessionBtn = async (acctEmail: string) => {
    $(this.factory.btnEndPPSession())
    .insertBefore($('.gb_Zd').children().last())
    .click(Ui.event.prevent('double', async el => {
      for(const key of (await Store.keysGet(acctEmail))) {
        // Check if passpharse in the session
        if (!(await Store.passphraseGet(acctEmail, key.longid, true)) &&  
            (await Store.passphraseGet(acctEmail, key.longid, false))) {
          await Store.passphraseSave('session', acctEmail, key.longid, undefined);
        }
      }
      window.location.reload();
      el.remove();
    }));
  };

}
