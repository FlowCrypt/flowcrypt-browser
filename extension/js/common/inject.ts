/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { SelCache, Ui } from './browser/ui.js';
import { WebmailVariantString, XssSafeFactory } from './xss-safe-factory.js';

import { Catch } from './platform/catch.js';
import { ContentScriptWindow } from './browser/browser-window.js';
import { Dict } from './core/common.js';
import { Env, WebMailName } from './browser/env.js';
import { KeyStore } from './platform/store/key-store.js';
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
      'gmail': 'div.aeN',
      'outlook': 'div._fce_b',
      'settings': '#does_not_have',
    },
    finishSesionBtnSel: {
      gmail: 'body',
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
      compose_button: '#flowcrypt_new_message_button',
      secure_compose_window: '.secure_compose_window',
    });
  }

  public meta = () => {
    this.S.cached('body').addClass(`cryptup_${this.webmailName} cryptup_${this.webmailName}_${this.webmailVariant} ${Catch.browser().name}`)
      .append(this.factory.metaStylesheet('webmail') + this.factory.metaNotificationContainer());  // xss-safe-factory
  }

  public openComposeWin = (draftId?: string): boolean => {
    const alreadyOpenedCount = this.S.now('secure_compose_window').length;
    if (alreadyOpenedCount < 3) {
      const composeWin = $(this.factory.embeddedCompose(draftId));
      composeWin.attr('data-order', alreadyOpenedCount + 1);
      this.S.cached('body').append(composeWin); // xss-safe-factory
      return true;
    } else {
      Ui.toast('Only 3 composer windows can be opened at a time', 3, 'top', 'error');
      return false;
    }
  }

  public btns = () => {
    if (this.S.now('compose_button_container').length === 0) { // don't inject too early
      (window as unknown as ContentScriptWindow).TrySetDestroyableTimeout(() => this.btns(), 300);
    } else if (this.shouldInject()) {
      if (this.S.now('compose_button').length === 0) {
        const container = this.S.now('compose_button_container').first().prepend(this.factory.btnCompose(this.webmailName)); // xss-safe-factory
        container.find(this.S.sel('compose_button')).click(Ui.event.prevent('double', () => { this.openComposeWin(); }));
      }
    }
  }

  public insertEndSessionBtn = async (acctEmail: string) => {
    if ($('.action_finish_session').length) {
      return;
    }
    const prependToElem = $(this.container.finishSesionBtnSel[this.webmailName]).first();
    if (!prependToElem.length) {
      if (!this.missingElSelectorReported[this.container.finishSesionBtnSel[this.webmailName]]) {
        Catch.report(`Selector for locking session container not found: '${this.container.finishSesionBtnSel[this.webmailName]}' (add .children().last() if Gmail)`);
        this.missingElSelectorReported[this.container.finishSesionBtnSel[this.webmailName]] = true;
      }
    }
    prependToElem.prepend(this.factory.btnEndPPSession(this.webmailName)) // xss-safe-factory
      .find('.action_finish_session').click(Ui.event.prevent('double', async (el) => {
        for (const longid of await KeyStore.getLongidsThatCurrentlyHavePassPhraseInSession(acctEmail)) {
          await PassphraseStore.set('session', acctEmail, longid, undefined);
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

  private shouldInject = () => {
    if (this.webmailName === 'gmail') {
      if (Env.getUrlNoParams().startsWith('https://mail.google.com/chat/')) { // #3746
        return false;
      }
    }
    return true;
  }

}
