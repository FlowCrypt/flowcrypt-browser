/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../js/common/assert.js';
import { Browser } from '../../js/common/browser/browser.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Time } from '../../js/common/browser/time.js';
import { Url } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { AcctStore } from '../../js/common/platform/store/acct-store.js';
import { GlobalStore } from '../../js/common/platform/store/global-store.js';

View.run(
  class SelectAcctPopupView extends View {
    private readonly action: 'inbox' | 'settings';

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['action']);
      this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['inbox', 'settings']);
    }

    public render = async () => {
      $('#title').text(this.action === 'inbox' ? 'Choose inbox account' : 'Select an account to open settings');
      const acctStorages = await AcctStore.getAccounts(await GlobalStore.acctEmailsGet(), ['setup_done', 'picture']);
      let emailsUlHtml = '';
      for (const email of Object.keys(acctStorages)) {
        if (acctStorages[email].setup_done === true) {
          const picEscaped = Xss.escape(acctStorages[email].picture || '/img/svgs/profile-icon.svg');
          const emailEscaped = Xss.escape(email);
          emailsUlHtml += `<li><a class="button gray2 long" href="#" email="${emailEscaped}"><img class="picture" src="${picEscaped}">${emailEscaped}</a></li>`;
        }
      }
      Xss.sanitizeRender('ul.emails', emailsUlHtml);
      $('.picture').on(
        'error',
        this.setHandler(self => {
          $(self).off().attr('src', '/img/svgs/profile-icon.svg');
        })
      );
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      $('html, body').css('height', $('.content').height()! + (Catch.isFirefox() ? 40 : 0)); // .content is in template
    };

    public setHandlers = () => {
      $('ul.emails a').on(
        'click',
        this.setHandler(el => this.actionChooseAcctHandler(el))
      );
      $('.action_add_account').on(
        'click',
        this.setHandler(() => this.actionRedirectToAddAcctPageHandler())
      );
    };

    private actionChooseAcctHandler = async (clickedElement: HTMLElement) => {
      if (this.action === 'inbox') {
        await Browser.openSettingsPage('inbox/inbox.htm', $(clickedElement).attr('email'));
      } else {
        await Browser.openSettingsPage('index.htm', $(clickedElement).attr('email'));
      }
      await Time.sleep(100);
      window.close();
    };

    private actionRedirectToAddAcctPageHandler = async () => {
      await Browser.openSettingsPage('index.htm', undefined, undefined, undefined, true);
      await Time.sleep(100);
      window.close();
    };
  }
);
