'use strict';

var account_email = undefined;
account_storage_get(null, ['current_window_account_email'], function(storage) {
  account_email = storage.current_window_account_email;
});

$('.action_open_settings').click(function() {
  if(typeof account_email !== 'undefined') {
    chrome_message_send(null, 'settings', {
      account_email: account_email
    }, function() {
      window.close();
    });
  } else {
    window.location = 'select_account.htm?action=settings';
  }
});

$('.action_send_email').click(function() {
  console.log('1');
  if(typeof account_email !== 'undefined') {
    console.log('2');
    window.location = '/chrome/gmail_elements/new_message.htm?placement=popup&account_email=' + encodeURIComponent(account_email);
  } else {
    console.log('3');
    window.location = 'select_account.htm?action=new_message';
  }
});
