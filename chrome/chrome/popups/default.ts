/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let redirect_to_initial_setup = async (account_email:string|null=null) => {
    await tool.browser.message.send_await(null, 'settings', { account_email });
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
    $('.action_send_email').click(Ui.event.handle(async () => {
      if (active_account_email) {
        await tool.browser.message.send_await(null, 'settings', { account_email: active_account_email, page: '/chrome/elements/compose.htm' });
        window.close();
      } else {
        window.location.href = 'select_account.htm?action=new_message';
      }
    }));
  };

  let set_up_accont_prompt_popup = (active_account_email: string) => {
    $('#set_up_account').css('display', 'block');
    $('.email').text(active_account_email);
    $('.action_set_up_account').click(Ui.event.prevent(Ui.event.double(), () => redirect_to_initial_setup(active_account_email).catch(tool.catch.rejection)));
  };

  let active_tab = await tool.browser.message.send_await(null, 'get_active_tab_info', {});
  if (active_tab && active_tab.account_email !== null) {
    let {setup_done} = await Store.get_account(active_tab.account_email, ['setup_done']);
    if (setup_done) {
      choose_email_or_settings_popup(active_tab.account_email);
    } else {
      set_up_accont_prompt_popup(active_tab.account_email);
    }
  } else if (active_tab && active_tab.provider !== null && active_tab.same_world === true) {
    set_up_accont_prompt_popup(active_tab.account_email);
  } else {
    let account_emails = await Store.account_emails_get();
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
