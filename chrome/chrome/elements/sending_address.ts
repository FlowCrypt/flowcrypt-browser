/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from './../../js/common/storage.js';
import { Catch, Ui, Env, Xss, Value } from './../../js/common/common.js';
import { Settings } from '../settings/settings.js';
import { Pgp } from '../../js/common/pgp.js';
import { BrowserMsg } from '../../js/common/extension.js';

Catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'parent_tab_id', 'placement']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');
  let hash = Pgp.hash.sha1;
  let container = $('.emails');

  let storage = await Store.get_account(account_email, ['addresses']);
  let addresses = storage.addresses || [url_params.account_email];

  let address_to_html_radio = (a: string) => {
    a = Xss.html_escape(a);
    return `<input type="radio" name="a" value="${a}" id="${hash(a)}"> <label data-test="action-choose-address" for="${hash(a)}">${a}</label><br>`;
  };

  Xss.sanitize_render(container, addresses.map(address_to_html_radio).join(''));
  container.find('input').first().prop('checked', true);
  container.find('input').click(Ui.event.handle(async target => {
    let chosen_sending_address = $(target).val() as string;
    if (chosen_sending_address !== addresses[0]) {
      let ordered_addresses = Value.arr.unique([chosen_sending_address].concat(storage.addresses || []));
      await Store.set(account_email, {addresses: ordered_addresses});
      window.location.reload();
    }
  }));

  $('.action_fetch_aliases').click(Ui.event.prevent('parallel', async (target, done) => {
    Xss.sanitize_render(target, Ui.spinner('green'));
    let addresses = await Settings.fetch_account_aliases_from_gmail(account_email);
    await Store.set(account_email, { addresses: Value.arr.unique(addresses.concat(account_email)) });
    window.location.reload();
    done();
  }));

  $('.action_close').click(Ui.event.handle(() => BrowserMsg.send(parent_tab_id, 'close_dialog')));

})();
