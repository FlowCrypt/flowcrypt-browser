/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/storage.js';
import { Catch, Env } from '../../../js/common/common.js';
import { Xss } from '../../../js/common/browser.js';
import { Settings } from '../settings.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'longid', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  $('.action_show_public_key').attr('href', Env.url_create('my_key.htm', url_params));

  let [primary_ki] = await Store.keys_get(account_email, [url_params.longid as string || 'primary']);
  Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);

  let key = openpgp.key.readArmored(primary_ki.private).keys[0];

  let user_ids = key.users.map((u: any) => u.userId.userid); // todo - create a common function in settings.js for here and setup.js user_ids
  Xss.sanitize_render('.user_ids', user_ids.map((uid: string) => `<div>${Xss.html_escape(uid)}</div>`).join(''));

  $('.email').text(account_email);
  $('.key_words').text(primary_ki.keywords);

})();
