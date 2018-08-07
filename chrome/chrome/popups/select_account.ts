/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['action']);

  let page: string|null = null;
  if (url_params.action === 'new_message') {
    $('#title').text('Choose account for new message');
    page = '/chrome/elements/compose.htm';
  } else if (url_params.action === 'settings') {
    $('#title').text('Select account to open settings');
  } else {
    throw new Error('unknown action: ' + url_params.action);
  }

  let account_storages = await Store.get_accounts(await Store.account_emails_get(), ['setup_done']);
  let ul_emails = '';
  for (let email of Object.keys(account_storages)) {
    if (account_storages[email].setup_done === true) {
      ul_emails += `<li><a class="button gray2 long" href="#" email="${tool.str.html_escape(email)}">${tool.str.html_escape(email)}</a></li>`;
    }
  }
  $('ul.emails').html(ul_emails).find('a').click(tool.ui.event.handle(async target => {
    await tool.browser.message.send_await(null, 'settings', { account_email: $(target).attr('email'), page });
    window.close();
  }));
  $('html, body').css('height', $('.content').height()! + (tool.env.browser().name === 'firefox' ? 40 : 0)); // .content is in template

})();
