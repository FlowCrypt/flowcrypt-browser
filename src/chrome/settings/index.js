'use strict';

signal_scope_set(signal_scope_default_value);

signal_listen('settings', {
  gmail_auth_response: gmail_auth_response_handler,
});

localStorage.settings_seen = true;
var spinner = '&nbsp;<i class="fa fa-spinner fa-spin"></i>&nbsp;';
var spinning = undefined;

function refresh_account_list() {
  get_account_emails(function(account_emails) {
    account_storage_get(account_emails, ['setup_done'], function(account_storages) {
      var accounts_content = '';
      for(var i in account_emails) {
        var email_text = '<b>' + account_emails[i].split('@')[0] + '</b>' + '@' + account_emails[i].split('@')[1];
        if(account_storages[account_emails[i]]['setup_done'] === true) {
          accounts_content += '<div class="line"><a class="button green has_email" href="account.htm?account_email=' + encodeURIComponent(account_emails[i]) + '">' + email_text + '</a></div>';
        } else {
          if(spinning !== account_emails[i]){
            accounts_content += '<div class="line"><a class="button red action_auth has_email" href="#">' + email_text + '</a></div>';
          } else {
            accounts_content += '<div class="line"><a class="button red action_auth has_email" href="#" style="text-align: center;">' + spinner + '</a></div>';
          }
        }
      }
      if(accounts_content) {
        $('h1').text('Select Gmail Account');
        $('#accounts').html(accounts_content + '<div class="line"><a href="#" class="block action_auth">Add another account</a></div>');
      } else {
        $('h1').text('Set up CryptUP');
        $('#accounts').html('<div class="line"><a href="#" class="button long green action_auth">Connect to Gmail</a></div>');
      }
      $('a.action_auth').click(function() {
        if(/@/.test($(this).text())) {
          var account_email = $(this).text();
          spinning = account_email;
        } else {
          var account_email = '';
        }
        signal_send('background_process', 'gmail_auth_request', {
          message_id: null,
          account_email: account_email,
          signal_reply_to_listener: 'settings',
          signal_reply_to_scope: signal_scope_get(),
        });
      });
    });
  });
}

refresh_account_list();
setInterval(refresh_account_list, 1000);

function gmail_auth_response_handler(signal_data) {
  add_account_email_to_list_of_accounts(signal_data.account_email, function() {
    window.location = 'setup.htm?account_email=' + encodeURIComponent(signal_data.account_email);
  });
}
