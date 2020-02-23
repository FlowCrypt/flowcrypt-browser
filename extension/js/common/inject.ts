/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SelCache, Ui } from './browser/ui.js';
import { WebmailVariantString, XssSafeFactory } from './xss-safe-factory.js';

import { Catch } from './platform/catch.js';
import { ContentScriptWindow } from './browser/browser-window.js';
import { Dict } from './core/common.js';
import { WebMailName } from './browser/env.js';
import { AcctKeyStore } from './platform/store/acct-key-store.js';
import { PassphraseStore } from './platform/store/passphrase-store.js';

type Host = {
  gmail: string,
  outlook: string,
  settings: string
};

export class Injector {

  private factory: XssSafeFactory;
  private webmailName: WebMailName;
  private webmailVariant: WebmailVariantString;
  private S: SelCache;
  private container: { [key: string]: Host } = {
    composeBtnSel: {
      'gmail': 'div.aic',
      'outlook': 'div._fce_b',
      'settings': '#does_not_have',
    },
    finishSesionBtnSel: {
      gmail: 'div.gb_Xd',
      outlook: '#does_not_have',
      settings: '#settings > div.header'
    }
  };

  private missingElSelectorReported: Dict<boolean> = {};

  constructor(webmailName: WebMailName, webmailVariant: WebmailVariantString, factory: XssSafeFactory) {
    this.webmailName = webmailName;
    this.webmailVariant = webmailVariant;
    this.factory = factory;
    this.S = Ui.buildJquerySels({ // these are selectors that are not specific to any webmail variant
      body: 'body',
      compose_button_container: this.container.composeBtnSel[this.webmailName],
      compose_button: 'div.new_message_button',
      compose_button_label: '#cryptup_compose_button_label',
      compose_window: 'div.new_message',
    });
  }

  public meta = () => {
    this.S.cached('body').addClass(`cryptup_${this.webmailName} cryptup_${this.webmailName}_${this.webmailVariant} ${Catch.browser().name}`)
      .append(this.factory.metaStylesheet('webmail') + this.factory.metaNotificationContainer());  // xss-safe-factory
  }

  public openComposeWin = () => {
    if (this.S.now('compose_window').length === 0) {
      this.S.cached('body').append(this.factory.embeddedCompose()); // xss-safe-factory
    }
  }

  public btns = () => {
    if (this.S.now('compose_button_container').length === 0) { // don't inject too early
      (window as unknown as ContentScriptWindow).TrySetDestroyableTimeout(() => this.btns(), 300);
    } else {
      if (this.S.now('compose_button').length === 0) {
        const container = this.S.now('compose_button_container').prepend(this.factory.btnCompose(this.webmailName)); // xss-safe-factory
        container.find(this.S.sel('compose_button')).click(Ui.event.handle(() => this.openComposeWin()));
      }
    }
  }

  public insertEndSessionBtn = async (acctEmail: string) => {
    if ($('.action_finish_session').length) {
      return;
    }
    let prependToElem = $(this.container.finishSesionBtnSel[this.webmailName]).first();
    if (this.webmailName === 'gmail') {
      prependToElem = prependToElem.children().last(); // todo: ideally we would not have to have special logic here for Gmail
    }
    if (!prependToElem.length) {
      if (!this.missingElSelectorReported[this.container.finishSesionBtnSel[this.webmailName]]) {
        Catch.report(`Selector for locking session container not found: '${this.container.finishSesionBtnSel[this.webmailName]}' (add .children().last() if Gmail)`);
        this.missingElSelectorReported[this.container.finishSesionBtnSel[this.webmailName]] = true;
      }
    }
    prependToElem.append(this.factory.btnEndPPSession(this.webmailName)) // xss-safe-factory
      .find('.action_finish_session').click(Ui.event.prevent('double', async el => {
        const keysInSession = await AcctKeyStore.getKeysCurrentlyInSession(acctEmail);
        if (keysInSession.length) {
          await Promise.all(keysInSession.map(async k => await PassphraseStore.passphraseSave('session', acctEmail, k.longid, undefined)));
        }
        if (this.webmailName === 'gmail') {
          $('.' + (window as unknown as ContentScriptWindow).reloadable_class).each((i, reloadableEl) => {
            $(reloadableEl).replaceWith($(reloadableEl)[0].outerHTML); // xss-reinsert - inserting code that was already present should not be dangerous
          });
        } else {
          window.location.reload();
        }
        el.remove();
      }));
  }

}
