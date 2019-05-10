/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/platform/store.js';
import { Xss, Ui, Env } from '../../js/common/browser.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Catch } from '../../js/common/platform/catch.js';
import { Assert } from '../../js/common/assert.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['action']);
  const action = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['inbox', 'settings']);

  $('#title').text(action === 'inbox' ? 'Choose inbox account' : 'Select an account to open settings');

  const acctStorages = await Store.getAccounts(await Store.acctEmailsGet(), ['setup_done', 'picture']);
  let emailsUlHtml = '';
  for (const email of Object.keys(acctStorages)) {
    if (acctStorages[email].setup_done === true) {
      const picEscaped = Xss.escape(acctStorages[email].picture || '/img/svgs/profile-icon.svg');
      const emailEscaped = Xss.escape(email);
      emailsUlHtml += `<li><a class="button gray2 long" href="#" email="${emailEscaped}"><img class="picture" src="${picEscaped}">${emailEscaped}</a></li>`;
    }
  }
  Xss.sanitizeRender('ul.emails', emailsUlHtml).find('a').click(Ui.event.handle(async target => {
    if (action === 'inbox') {
      BrowserMsg.send.bg.inbox({ acctEmail: $(target).attr('email') });
      await Ui.time.sleep(100);
      window.close();
    } else {
      BrowserMsg.send.bg.settings({ acctEmail: $(target).attr('email') });
      await Ui.time.sleep(100);
      window.close();
    }
  }));

  $(".picture").on('error', Ui.event.handle(self => {
    $(self).off().attr('src', '/img/svgs/profile-icon.svg');
  }));

  $('.action_add_account').click(Ui.event.handle(async self => {
    BrowserMsg.send.bg.settings({ addNewAcct: true });
    await Ui.time.sleep(100);
    window.close();
  }));

  $('html, body').css('height', $('.content').height()! + (Catch.browser().name === 'firefox' ? 40 : 0)); // .content is in template

})();
