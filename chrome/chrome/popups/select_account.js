/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['action']);

var page = null;
if(url_params.action === 'new_message') {
  $('#title').text('Choose account for new message');
  page = '/chrome/elements/new_message.htm';
} else if(url_params.action === 'settings') {
  $('#title').text('Select account to see settings')
} else {
  throw new Error('unknown action: ' + action);
}

get_account_emails(function (account_emails) {
  account_storage_get(account_emails, ['setup_done'], function (account_storages) {
    var ul_emails = '';
    tool.each(account_storages, function(email, storage) {
      if(storage.setup_done === true) {
        ul_emails += '<li><a target="cryptup" class="button gray2 long" href="' + tool.env.url_create('/chrome/settings/index.htm', { account_email: email, page: page }) + '">' + email + '</a></li>';
      }
    });
    console.log(ul_emails);
    $('ul.emails').html(ul_emails).find('a').click(function () {
      setTimeout(function () {
        window.close();
      }, 0);
    });
    $('html, body').css('height', $('.content').height() + (tool.env.browser().name === 'firefox' ? 40 : 0));
  });
});
