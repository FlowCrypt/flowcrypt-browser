/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = Env.url_params(['action']);

  let page: string|null = null;
  if (url_params.action === 'new_message') {
    $('#title').text('Choose account for new message');
    page = '/chrome/elements/compose.htm';
  } else if (url_params.action === 'settings') {
    $('#title').text('Select an account to open settings');
  } else {
    throw new Error('unknown action: ' + url_params.action);
  }

  let account_storages = await Store.get_accounts(await Store.account_emails_get(), ['setup_done', 'picture']);
  let ul_emails = '';
  for (let email of Object.keys(account_storages)) {
    if (account_storages[email].setup_done === true) {
      let picture_escaped = tool.str.html_escape(account_storages[email].picture || '/img/svgs/profile-icon.svg');
      let email_escaped = tool.str.html_escape(email);
      ul_emails += `<li><a class="button gray2 long" href="#" email="${email_escaped}"><img class="picture" src="${picture_escaped}">${email_escaped}</a></li>`;
      Settings.update_profile_picture_if_missing(email).catch(tool.catch.handle_exception); // will show next time page is rendered
    }
  }
  tool.ui.sanitize_render('ul.emails', ul_emails).find('a').click(tool.ui.event.handle(async target => {
    await tool.browser.message.send_await(null, 'settings', { account_email: $(target).attr('email'), page });
    window.close();
  }));

  $(".picture").on('error', tool.ui.event.handle(self => {
    $(self).off().attr('src', '/img/svgs/profile-icon.svg');
  }));

  $('.action_add_account').click(tool.ui.event.handle(async self => {
    await tool.browser.message.send_await(null, 'settings', { add_new_account: true });
    window.close();
  }));

  $('html, body').css('height', $('.content').height()! + (Env.browser().name === 'firefox' ? 40 : 0)); // .content is in template

})();
