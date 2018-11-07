/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Ui } from '../../js/common/browser.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Catch } from '../../js/common/catch.js';

Catch.try(async () => {

  const redirectToInitSetup = async (acctEmail: string | null = null) => {
    BrowserMsg.send.bg.settings({ acctEmail: acctEmail || undefined });
    await Ui.time.sleep(100);
    window.close();
  };

  const chooseEmailOrSettingsPopup = (activeAcctEmail: string | null = null) => {
    $('#email_or_settings').css('display', 'block');
    $('.action_open_settings').click(Ui.event.handle(async () => {
      if (activeAcctEmail) {
        await redirectToInitSetup(activeAcctEmail);
      } else {
        window.location.href = 'select_account.htm?action=settings';
      }
    }));
    $('.action_open_encrypted_inbox').click(Ui.event.handle(async () => {
      if (activeAcctEmail) {
        BrowserMsg.send.bg.inbox({ acctEmail: activeAcctEmail });
        await Ui.time.sleep(100);
        window.close();
      } else {
        window.location.href = 'select_account.htm?action=inbox';
      }
    }));
  };

  const setupAcctPromptPopup = (activeAcctEmail: string) => {
    $('#set_up_account').css('display', 'block');
    $('.email').text(activeAcctEmail);
    $('.action_set_up_account').click(Ui.event.prevent('double', () => redirectToInitSetup(activeAcctEmail).catch(Catch.rejection)));
  };

  const activeTab = await BrowserMsg.send.await.bg.getActiveTabInfo();
  if (activeTab && activeTab.acctEmail !== null) {
    const { setup_done } = await Store.getAcct(activeTab.acctEmail, ['setup_done']);
    if (setup_done) {
      chooseEmailOrSettingsPopup(activeTab.acctEmail);
    } else {
      setupAcctPromptPopup(activeTab.acctEmail);
    }
  } else if (activeTab && activeTab.provider !== null && activeTab.sameWorld === true && activeTab.acctEmail) {
    setupAcctPromptPopup(activeTab.acctEmail);
  } else {
    const acctEmails = await Store.acctEmailsGet();
    if (acctEmails && acctEmails.length) {
      const acctStorages = await Store.getAccounts(acctEmails, ['setup_done']);
      let functioningAccts = 0;
      for (const email of Object.keys(acctStorages)) {
        functioningAccts += Number(acctStorages[email].setup_done === true);
      }
      if (!functioningAccts) {
        await redirectToInitSetup();
      } else {
        chooseEmailOrSettingsPopup();
      }
    } else {
      await redirectToInitSetup();
    }
  }

})();
