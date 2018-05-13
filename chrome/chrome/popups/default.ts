/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  tool.browser.message.send(null, 'get_active_tab_info', {}, function (active_tab) {
    if(active_tab && active_tab.account_email !== null) {
      Store.get(active_tab.account_email, ['setup_done']).then(storage => {
        if(storage.setup_done) {
          choose_email_or_settings_popup(active_tab.account_email);
        } else {
          set_up_accont_prompt_popup(active_tab.account_email);
        }
      });
    } else if(active_tab && active_tab.provider !== null && active_tab.same_world === true) {
      set_up_accont_prompt_popup(active_tab.account_email);
    } else {
      Store.account_emails_get().then((account_emails) => {
        if(account_emails && account_emails.length) {
          Store.get(account_emails, ['setup_done']).then((account_storages) => {
            let functioning_accounts = 0;
            tool.each(account_storages, function (email, storage) {
              functioning_accounts += Number(storage.setup_done === true);
            });
            if(!functioning_accounts) {
              redirect_to_initial_setup();
            } else {
              choose_email_or_settings_popup();
            }
          });
        } else {
          redirect_to_initial_setup();
        }
      });
    }
  });

  function redirect_to_initial_setup(account_email:string|null=null) {
    tool.browser.message.send(null, 'settings', { account_email: account_email }, function () {
      window.close();
    });
  }

  function set_up_accont_prompt_popup(active_account_email: string) {
    $('#set_up_account').css('display', 'block');
    $('.email').text(active_account_email);
    $('.action_set_up_account').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
      redirect_to_initial_setup(active_account_email);
    }));
  }

  function choose_email_or_settings_popup(active_account_email:string|null=null) {
    $('#email_or_settings').css('display', 'block');
    $('.action_open_settings').click(function () {
      if(active_account_email) {
        redirect_to_initial_setup(active_account_email);
      } else {
        window.location.href = 'select_account.htm?action=settings';
      }
    });
    $('.action_send_email').click(function () {
      if(active_account_email) {
        tool.browser.message.send(null, 'settings', { account_email: active_account_email, page: '/chrome/elements/compose.htm' }, function () {
          window.close();
        });
      } else {
        window.location.href = 'select_account.htm?action=new_message';
      }
    });
  }

})();