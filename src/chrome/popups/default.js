'use strict';

get_active_window_account_email(function(active_account_email, setup_done) {
  if(active_account_email) {
    if(setup_done) {
      choose_email_or_settings_popup(active_account_email);
    } else {
      set_up_accont_prompt_popup(active_account_email);
    }
  } else {
    get_account_emails(function(account_emails) {
      if(account_emails && account_emails.length) {
        account_storage_get(account_emails, ['setup_done'], function(account_storages) {
          var functioning_accounts = 0;
          $.each(account_storages, function(email, storage) {
            functioning_accounts += storage.setup_done === true;
          });
          if(!functioning_accounts) {
            redirect_to_initial_setup('');
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
  chrome_message_send(null, 'settings', {
    account_email: account_email
  }, function() {
    window.close();
  });
}

function set_up_accont_prompt_popup(active_account_email) {
  $('#set_up_account').css('display', 'block');
  $('.email').text(active_account_email);
  $('.action_set_up_account').click(function() {
    redirect_to_initial_setup(active_account_email);
  })
}

function choose_email_or_settings_popup(active_account_email) {
  $('#email_or_settings').css('display', 'block');
  $('.action_open_settings').click(function() {
    if(typeof active_account_email !== 'undefined') {
      chrome_message_send(null, 'settings', {
        account_email: active_account_email
      }, function() {
        window.close();
      });
    } else {
      window.location = 'select_account.htm?action=settings';
    }
  });
  $('.action_send_email').click(function() {
    if(typeof active_account_email !== 'undefined') {
      chrome_message_send(null, 'settings', {
        path: 'index.htm',
        account_email: active_account_email,
        page: '/chrome/gmail_elements/new_message.htm',
      }, function() {
        window.close();
      });
    } else {
      window.location = 'select_account.htm?action=new_message';
    }
  });
}

function get_active_window_account_email(callback) {
  var account_email = undefined;
  account_storage_get(null, ['current_window_account_email'], function(storage) {
    account_email = storage.current_window_account_email;
    account_storage_get(account_email, ['setup_done'], function(storage_2) {
      callback(account_email, storage_2.setup_done);
    });
  });
}
