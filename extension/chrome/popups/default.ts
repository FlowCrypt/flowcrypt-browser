/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Catch } from '../../js/common/common.js';
import { Ui } from '../../js/common/browser.js';
import { BrowserMsg } from '../../js/common/extension.js';

Catch.try(async () => {

  let redirect_to_initial_setup = async (account_email:string|null=null) => {
    await BrowserMsg.sendAwait(null, 'settings', { account_email });
    window.close();
  };

  let choose_email_or_settings_popup = (active_account_email:string|null=null) => {
    $('#email_or_settings').css('display', 'block');
    $('.action_open_settings').click(Ui.event.handle(async () => {
      if (active_account_email) {
        await redirect_to_initial_setup(active_account_email);
      } else {
        window.location.href = 'select_account.htm?action=settings';
      }
    }));
    $('.action_open_encrypted_inbox').click(Ui.event.handle(async () => {
      if (active_account_email) {
        await BrowserMsg.sendAwait(null, 'inbox', { account_email: active_account_email });
        window.close();
      } else {
        window.location.href = 'select_account.htm?action=inbox';
      }
    }));
  };

  let set_up_accont_prompt_popup = (active_account_email: string) => {
    $('#set_up_account').css('display', 'block');
    $('.email').text(active_account_email);
    $('.action_set_up_account').click(Ui.event.prevent('double', () => redirect_to_initial_setup(active_account_email).catch(Catch.rejection)));
  };

  let active_tab = await BrowserMsg.sendAwait(null, 'get_active_tab_info', {});
  if (active_tab && active_tab.account_email !== null) {
    let {setup_done} = await Store.getAccount(active_tab.account_email, ['setup_done']);
    if (setup_done) {
      choose_email_or_settings_popup(active_tab.account_email);
    } else {
      set_up_accont_prompt_popup(active_tab.account_email);
    }
  } else if (active_tab && active_tab.provider !== null && active_tab.same_world === true) {
    set_up_accont_prompt_popup(active_tab.account_email);
  } else {
    let account_emails = await Store.accountEmailsGet();
    if (account_emails && account_emails.length) {
      let account_storages = await Store.get_accounts(account_emails, ['setup_done']);
      let functioning_accounts = 0;
      for (let email of Object.keys(account_storages)) {
        functioning_accounts += Number(account_storages[email].setup_done === true);
      }
      if (!functioning_accounts) {
        await redirect_to_initial_setup();
      } else {
        choose_email_or_settings_popup();
      }
    } else {
      await redirect_to_initial_setup();
    }
  }

})();
