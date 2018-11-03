/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Catch, Env, Dict } from '../../js/common/common.js';
import { Xss, Ui } from '../../js/common/browser.js';
import { Settings } from '../../js/common/settings.js';
import { BrowserMsg } from '../../js/common/extension.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['action']);
  let action = Env.urlParamRequire.oneof(urlParams, 'action', ['inbox', 'settings']);

  if (action === 'inbox') {
    $('#title').text('Choose inbox account');
  } else {
    $('#title').text('Select an account to open settings');
  }

  let account_storages = await Store.get_accounts(await Store.accountEmailsGet(), ['setup_done', 'picture']);
  let ul_emails = '';
  for (let email of Object.keys(account_storages)) {
    if (account_storages[email].setup_done === true) {
      let picture_escaped = Xss.htmlEscape(account_storages[email].picture || '/img/svgs/profile-icon.svg');
      let email_escaped = Xss.htmlEscape(email);
      ul_emails += `<li><a class="button gray2 long" href="#" email="${email_escaped}"><img class="picture" src="${picture_escaped}">${email_escaped}</a></li>`;
      Settings.update_profile_picture_if_missing(email).catch(Catch.handle_exception); // will show next time page is rendered
    }
  }
  Xss.sanitizeRender('ul.emails', ul_emails).find('a').click(Ui.event.handle(async target => {
    if (urlParams.action === 'inbox') {
      await BrowserMsg.sendAwait(null, 'inbox', { account_email: $(target).attr('email') });
      window.close();
    } else {
      await BrowserMsg.sendAwait(null, 'settings', { account_email: $(target).attr('email') });
      window.close();
    }
  }));

  $(".picture").on('error', Ui.event.handle(self => {
    $(self).off().attr('src', '/img/svgs/profile-icon.svg');
  }));

  $('.action_add_account').click(Ui.event.handle(async self => {
    await BrowserMsg.sendAwait(null, 'settings', { add_new_account: true });
    window.close();
  }));

  $('html, body').css('height', $('.content').height()! + (Env.browser().name === 'firefox' ? 40 : 0)); // .content is in template

})();
