/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';
import { Settings } from '../../js/common/settings.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Catch } from '../../js/common/catch.js';

Catch.try(async () => {

  let urlParams = Env.urlParams(['action']);
  let action = Env.urlParamRequire.oneof(urlParams, 'action', ['inbox', 'settings']);

  if (action === 'inbox') {
    $('#title').text('Choose inbox account');
  } else {
    $('#title').text('Select an account to open settings');
  }

  let acctStorages = await Store.getAccounts(await Store.acctEmailsGet(), ['setup_done', 'picture']);
  let emailsUlHtml = '';
  for (let email of Object.keys(acctStorages)) {
    if (acctStorages[email].setup_done === true) {
      let picEscaped = Xss.escape(acctStorages[email].picture || '/img/svgs/profile-icon.svg');
      let emailEscaped = Xss.escape(email);
      emailsUlHtml += `<li><a class="button gray2 long" href="#" email="${emailEscaped}"><img class="picture" src="${picEscaped}">${emailEscaped}</a></li>`;
      Settings.updateProfilePicIfMissing(email).catch(Catch.handleException); // will show next time page is rendered
    }
  }
  Xss.sanitizeRender('ul.emails', emailsUlHtml).find('a').click(Ui.event.handle(async target => {
    if (urlParams.action === 'inbox') {
      await BrowserMsg.sendAwait(null, 'inbox', { acctEmail: $(target).attr('email') });
      window.close();
    } else {
      await BrowserMsg.sendAwait(null, 'settings', { acctEmail: $(target).attr('email') });
      window.close();
    }
  }));

  $(".picture").on('error', Ui.event.handle(self => {
    $(self).off().attr('src', '/img/svgs/profile-icon.svg');
  }));

  $('.action_add_account').click(Ui.event.handle(async self => {
    await BrowserMsg.sendAwait(null, 'settings', { addNewAcct: true });
    window.close();
  }));

  $('html, body').css('height', $('.content').height()! + (Catch.browser().name === 'firefox' ? 40 : 0)); // .content is in template

})();
