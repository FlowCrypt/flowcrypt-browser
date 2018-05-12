/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['action']);

  let page: string|null = null;
  if(url_params.action === 'new_message') {
    $('#title').text('Choose account for new message');
    page = '/chrome/elements/compose.htm';
  } else if(url_params.action === 'settings') {
    $('#title').text('Select account to open settings')
  } else {
    throw new Error('unknown action: ' + url_params.action);
  }
  
  Store.account_emails_get((account_emails) => {
    Store.get(account_emails, ['setup_done'], (account_storages) => {
      let ul_emails = '';
      tool.each(account_storages, (email: string, storage) => {
        if(storage.setup_done === true) {
          ul_emails += `<li><a class="button gray2 long" href="#" email="${tool.str.html_escape(email)}">${tool.str.html_escape(email)}</a></li>`;
        }
      });
      $('ul.emails').html(ul_emails).find('a').click(function () {
        tool.browser.message.send(null, 'settings', { account_email: $(this).attr('email'), page: page }, () => window.close());
      });
      $('html, body').css('height', $('.content').height()! + (tool.env.browser().name === 'firefox' ? 40 : 0)); // .content is in template
    });
  });  

})();