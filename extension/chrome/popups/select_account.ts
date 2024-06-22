/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Assert } from '../../js/common/assert.js';
import { Browser } from '../../js/common/browser/browser.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Time } from '../../js/common/browser/time.js';
import { Url, UrlParams } from '../../js/common/core/common.js';
import { View } from '../../js/common/view.js';
import { Xss } from '../../js/common/platform/xss.js';
import { AcctStore } from '../../js/common/platform/store/acct-store.js';
import { GlobalStore } from '../../js/common/platform/store/global-store.js';
import { ThunderbirdMessageDetails } from '../elements/compose-modules/compose-types.js';
import { Gmail } from '../../js/common/api/email-provider/gmail/gmail.js';

View.run(
  class SelectAcctPopupView extends View {
    public readonly tabId: number;
    public readonly pageUrlParams?:
      | {
          useFullScreenSecureCompose?: boolean;
          messageDetails?: ThunderbirdMessageDetails;
        }
      | undefined;
    private readonly action: 'inbox' | 'settings';

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['action', 'tabId', 'pageUrlParams']);
      this.action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['inbox', 'settings']);
      this.tabId = Number(Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'tabId'));
      this.pageUrlParams = typeof uncheckedUrlParams.pageUrlParams === 'string' ? (JSON.parse(uncheckedUrlParams.pageUrlParams) as UrlParams) : undefined;
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
      const acctEmail = $(clickedElement).attr('email') || '';
      let threadId: string | undefined;
      if (this.pageUrlParams?.messageDetails) {
        const gmail = new Gmail(acctEmail);
        const headerMessageId = this.pageUrlParams.messageDetails?.headerMessageId || '';
        const gmailRes = await gmail.threadIdGet(headerMessageId);
        const missingThreadIdMsg =
          "The email you're attempting to reply to is not accessible for the chosen account. Please ensure that you select the appropriate account to continue.";
        if (!gmailRes?.messages) {
          return alert(missingThreadIdMsg);
        }
        threadId = gmailRes.messages[0].threadId;
      }
      if (this.action === 'inbox') {
        await Browser.openExtensionTab(Url.create('/chrome/settings/inbox/inbox.htm', { acctEmail, threadId }));
      } else {
        await Browser.openSettingsPage('index.htm', acctEmail);
      }
      await Time.sleep(100);
      if (this.tabId) {
        await browser.tabs.remove(this.tabId);
      } else {
        window.close();
      }
    };

    private actionRedirectToAddAcctPageHandler = async () => {
      await Browser.openSettingsPage('index.htm', undefined, undefined, undefined, true);
      await Time.sleep(100);
      window.close();
    };
  }
);
