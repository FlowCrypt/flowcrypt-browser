'use strict';

localStorage.settings_seen = true;
var spinning = undefined;

function refresh_account_list() {
  get_account_emails(function(account_emails) {
    account_storage_get(account_emails, ['setup_done'], function(account_storages) {
      var accounts_content = '';
      var has_connected_account = false;
      $.each(account_emails, function(i, account_email) {
        var email_text = '<b>' + account_email.split('@')[0] + '</b>' + '@' + account_email.split('@')[1];
        if(account_storages[account_email]['setup_done'] === true) {
          accounts_content += '<div class="line"><a class="button green has_email" href="account.htm?account_email=' + encodeURIComponent(account_email) + '">' + email_text + '</a></div>';
          has_connected_account = true;
        } else {
          if(spinning !== account_email) {
            accounts_content += '<div class="line"><a class="button red action_auth has_email" href="#">' + email_text + '</a></div>';
          } else {
            accounts_content += '<div class="line"><a class="button red action_auth has_email" href="#" style="text-align: center;">' + get_spinner() + '</a></div>';
          }
        }
      });
      if(!has_connected_account) {
        $('#notes').css('display', 'block');
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
        chrome_message_send(null, 'google_auth', {
          account_email: account_email,
        }, function(response) {
          if(response.success === true) {
            add_account_email_to_list_of_accounts(response.account_email, function() {
              window.location = 'setup.htm?account_email=' + encodeURIComponent(response.account_email);
            });
          } else if(response.success === false && response.result === 'denied' && response.error === 'access_denied') {
            alert('Why CryptUP needs this permission:\n\n - to compose messages safely\n - to retrieve and decrypt opened messages seamlessly\n - to send and open encrypted attachments\n\nNobody, CryptUP developers included, is able to access these permissions, they are stored privately in your browser.\n\n');
            window.location.reload();
          } else {
            console.log(response);
            alert('Something went wrong, please try again. If this happens again, please write me at tom@cryptup.org to fix it.');
            window.location.reload();
          }
        });
      });
    });
  });
}

refresh_account_list();
setInterval(refresh_account_list, 1000);
