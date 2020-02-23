/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../js/common/assert.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store/abstract-store.js';
import { Ui } from '../../js/common/browser/ui.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';

View.run(class SelectAcctPopupView extends View {

  private readonly action: 'inbox' | 'settings';

  constructor() {
    super();
    const uncheckedUrlParams = Url.parse(['action']);
    this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['inbox', 'settings']);
  }

  public render = async () => {
    $('#title').text(this.action === 'inbox' ? 'Choose inbox account' : 'Select an account to open settings');
    const acctStorages = await Store.getAccounts(await Store.acctEmailsGet(), ['setup_done', 'picture']);
    let emailsUlHtml = '';
    for (const email of Object.keys(acctStorages)) {
      if (acctStorages[email].setup_done === true) {
        const picEscaped = Xss.escape(acctStorages[email].picture || '/img/svgs/profile-icon.svg');
        const emailEscaped = Xss.escape(email);
        emailsUlHtml += `<li><a class="button gray2 long" href="#" email="${emailEscaped}"><img class="picture" src="${picEscaped}">${emailEscaped}</a></li>`;
      }
    }
    Xss.sanitizeRender('ul.emails', emailsUlHtml);
    $(".picture").on('error', this.setHandler(self => {
      $(self).off().attr('src', '/img/svgs/profile-icon.svg');
    }));
    $('html, body').css('height', $('.content').height()! + (Catch.browser().name === 'firefox' ? 40 : 0)); // .content is in template
  }

  public setHandlers = () => {
    $('ul.emails a').click(this.setHandler(el => this.actionChooseAcctHandler(el)));
    $('.action_add_account').click(this.setHandler(el => this.actionRedirectToAddAcctPageHandler()));
  }

  private actionChooseAcctHandler = async (clickedElement: HTMLElement) => {
    if (this.action === 'inbox') {
      BrowserMsg.send.bg.inbox({ acctEmail: $(clickedElement).attr('email') });
      await Ui.time.sleep(100);
      window.close();
    } else {
      BrowserMsg.send.bg.settings({ acctEmail: $(clickedElement).attr('email') });
      await Ui.time.sleep(100);
      window.close();
    }
  }

  private actionRedirectToAddAcctPageHandler = async () => {
    BrowserMsg.send.bg.settings({ addNewAcct: true });
    await Ui.time.sleep(100);
    window.close();
  }

});
