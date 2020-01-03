/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { BrowserMsg } from '../../js/common/browser/browser-msg.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Store } from '../../js/common/platform/store.js';
import { Ui } from '../../js/common/browser/ui.js';
import { View } from '../../js/common/view.js';

View.run(class DefaultPopupView extends View {

  constructor() {
    super();
  }

  public render = async () => {
    const activeTab = await BrowserMsg.send.bg.await.getActiveTabInfo();
    if (activeTab?.acctEmail) {
      const { setup_done } = await Store.getAcct(activeTab.acctEmail, ['setup_done']);
      if (setup_done) {
        this.renderChooseEmailOrSettingsPopup(activeTab.acctEmail);
      } else {
        this.renderSetupAcctPromptPopup(activeTab.acctEmail);
      }
    } else if (activeTab?.provider && activeTab.sameWorld === true && activeTab.acctEmail) {
      this.renderSetupAcctPromptPopup(activeTab.acctEmail);
    } else {
      const acctEmails = await Store.acctEmailsGet();
      if (acctEmails?.length) {
        const acctStorages = await Store.getAccounts(acctEmails, ['setup_done']);
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
  }

  public setHandlers = () => {
    // set below based on what renders
  }

  private redirectToInitSetup = async (acctEmail?: string) => {
    BrowserMsg.send.bg.settings({ acctEmail: acctEmail || undefined });
    await Ui.time.sleep(100);
    window.close();
  }

  private renderChooseEmailOrSettingsPopup = (activeAcctEmail?: string) => {
    $('#email_or_settings').css('display', 'block');
    $('.action_open_settings').click(this.setHandler(async () => {
      if (activeAcctEmail) {
        await this.redirectToInitSetup(activeAcctEmail);
      } else {
        window.location.href = 'select_account.htm?action=settings';
      }
    }));
    $('.action_open_encrypted_inbox').click(this.setHandler(async () => {
      if (activeAcctEmail) {
        BrowserMsg.send.bg.inbox({ acctEmail: activeAcctEmail });
        await Ui.time.sleep(100);
        window.close();
      } else {
        window.location.href = 'select_account.htm?action=inbox';
      }
    }));
  }

  private renderSetupAcctPromptPopup = (activeAcctEmail: string) => {
    $('#set_up_account').css('display', 'block');
    $('.email').text(activeAcctEmail);
    $('.action_set_up_account').click(this.setHandlerPrevent('double', () => this.redirectToInitSetup(activeAcctEmail).catch(Catch.reportErr)));
  }

});
