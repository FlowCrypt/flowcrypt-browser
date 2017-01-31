/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['action']);

if(url_params.action === 'new_message') {
  $('#title').text('Choose account for new message')
} else if(url_params.action === 'settings') {
  $('#title').text('Select account to see settings')
} else {
  throw new Error('unknown action: ' + action);
}

get_account_emails(function (account_emails) {
  $.each(account_emails, function (i, email) {
    account_storage_get(account_emails, ['setup_done'], function (account_storages) {
      if(account_storages[email]['setup_done'] === true) {
        if(url_params.action === 'new_message') {
          $('ul.emails').prepend('<li><a target="cryptup" href="/chrome/settings/index.htm?account_email=' + encodeURIComponent(email) + '&page=' + encodeURIComponent('/chrome/gmail_elements/new_message.htm') + '">' + email + '</a></li>');
        } else {
          $('ul.emails').prepend('<li><a target="cryptup" href="/chrome/settings/index.htm?account_email=' + encodeURIComponent(email) + '">' + email + '</a></li>');
        }
        $('a').click(function () {
          window.close();
        });
      }
    });
  });
});
