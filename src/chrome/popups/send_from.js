'use strict';

get_account_emails(function(account_emails) {
  $.each(account_emails, function(i, email) {
    account_storage_get(account_emails, ['setup_done'], function(account_storages) {
      if(account_storages[email]['setup_done'] === true) {
        $('ul.emails').prepend('<li><a href="/chrome/gmail_elements/new_message.htm?placement=popup&account_email=' + encodeURIComponent(email) + '">' + email + '</a></li>');
      }
    });
  });
});
