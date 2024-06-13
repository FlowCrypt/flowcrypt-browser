/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Browser } from '../../js/common/browser/browser.js';
import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Time } from '../../js/common/browser/time.js';
import { View } from '../../js/common/view.js';
import { AcctStore } from '../../js/common/platform/store/acct-store.js';
import { GlobalStore } from '../../js/common/platform/store/global-store.js';
import { Url } from '../../js/common/core/common.js';
import { Assert } from '../../js/common/assert.js';

View.run(
  class DefaultPopupView extends View {
    private readonly tabId?: number;

    public constructor() {
      super();
      const uncheckedUrlParams = Url.parse(['tabId']);
      this.tabId = Number(Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'tabId'));
    }

    public render = async () => {
      const activeTab = await BrowserMsg.send.bg.await.getActiveTabInfo();
      if (Browser.isThunderbirdMail()) {
        const windowInfo = await browser.windows.getCurrent();
        if (windowInfo.type === 'messageCompose') {
          $('.action_open_settings').hide();
          $('.action_open_encrypted_inbox').parent().css('margin-right', '0');
          $('.action_open_encrypted_inbox').text('Secure Compose');
        }
      }
      if (activeTab?.acctEmail) {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { setup_done } = await AcctStore.get(activeTab.acctEmail, ['setup_done']);
        if (setup_done) {
          this.renderChooseEmailOrSettingsPopup(activeTab.acctEmail);
        } else {
          this.renderSetupAcctPromptPopup(activeTab.acctEmail);
        }
      } else if (activeTab?.provider && activeTab.sameWorld === true && activeTab.acctEmail) {
        this.renderSetupAcctPromptPopup(activeTab.acctEmail);
      } else {
        const acctEmails = await GlobalStore.acctEmailsGet();
        if (acctEmails?.length) {
          const acctStorages = await AcctStore.getAccounts(acctEmails, ['setup_done']);
          let functioningAccts = 0;
          for (const email of Object.keys(acctStorages)) {
            functioningAccts += Number(acctStorages[email].setup_done === true);
          }
          if (!functioningAccts) {
            await this.redirectToInitSetup();
          } else {
            this.renderChooseEmailOrSettingsPopup();
          }
        } else {
          await this.redirectToInitSetup();
        }
      }
    };

    public setHandlers = () => {
      // set below based on what renders
    };

    private redirectToInitSetup = async (acctEmail?: string) => {
      BrowserMsg.send.bg.settings({ acctEmail: acctEmail || undefined });
      await Time.sleep(100);
      window.close();
    };

    private renderChooseEmailOrSettingsPopup = (activeAcctEmail?: string) => {
      $('#email_or_settings').css('display', 'block');
      $('.action_open_settings').on(
        'click',
        this.setHandler(async () => {
          if (activeAcctEmail) {
            await this.redirectToInitSetup(activeAcctEmail);
          } else {
            window.location.href = Url.create('select_account.htm', { action: 'settings' });
          }
        })
      );
      $('.action_open_encrypted_inbox').on(
        'click',
        this.setHandler(async () => {
          if (activeAcctEmail) {
            await Browser.openSettingsPage('inbox/inbox.htm', activeAcctEmail);
            await Time.sleep(100);
            window.close();
          } else {
            window.location.href = Url.create('select_account.htm', { action: 'inbox', tabId: this.tabId });
          }
        })
      );
    };

    private renderSetupAcctPromptPopup = (activeAcctEmail: string) => {
      $('#set_up_account').css('display', 'block');
      $('.email').text(activeAcctEmail);
      $('.action_set_up_account').on(
        'click',
        this.setHandlerPrevent('double', () => {
          this.redirectToInitSetup(activeAcctEmail).catch(Catch.reportErr);
        })
      );
    };
  }
);
