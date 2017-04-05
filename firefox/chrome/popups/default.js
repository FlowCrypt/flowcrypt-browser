/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

tool.browser.message.send(null, 'get_active_tab_info', {}, function (active_tab) {
  if(active_tab.account_email !== null) {
    account_storage_get(active_tab.account_email, ['setup_done'], function (storage) {
      if(storage.setup_done) {
        choose_email_or_settings_popup(active_tab.account_email);
      } else {
        set_up_accont_prompt_popup(active_tab.account_email);
      }
    });
  } else if(active_tab.provider !== null && active_tab.same_world === true) {
    set_up_accont_prompt_popup(active_tab.account_email);
  } else {
    get_account_emails(function (account_emails) {
      if(account_emails && account_emails.length) {
        account_storage_get(account_emails, ['setup_done'], function (account_storages) {
          var functioning_accounts = 0;
          $.each(account_storages, function (email, storage) {
            functioning_accounts += storage.setup_done === true;
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

function redirect_to_initial_setup(account_email) {
  tool.browser.message.send(null, 'settings', { account_email: account_email }, function () {
    window.close();
  });
}

function set_up_accont_prompt_popup(active_account_email) {
  $('#set_up_account').css('display', 'block');
  $('.email').text(active_account_email);
  $('.action_set_up_account').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    redirect_to_initial_setup(active_account_email);
  }));
}

function choose_email_or_settings_popup(active_account_email) {
  $('#email_or_settings').css('display', 'block');
  $('.action_open_settings').click(function () {
    if(active_account_email) {
      redirect_to_initial_setup(active_account_email);
    } else {
      window.location = 'select_account.htm?action=settings';
    }
  });
  $('.action_send_email').click(function () {
    if(active_account_email) {
      tool.browser.message.send(null, 'settings', { account_email: active_account_email, page: '/chrome/elements/new_message.htm' }, function () {
        window.close();
      });
    } else {
      window.location = 'select_account.htm?action=new_message';
    }
  });
}
