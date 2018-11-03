/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Xss, Ui } from '../../../js/common/browser.js';
import { BrowserMsg } from '../../../js/common/extension.js';
import { Settings } from '../../../js/common/settings.js';
import { Pgp } from '../../../js/common/pgp.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  let url_params = Env.urlParams(['account_email', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  await Ui.passphrase_toggle(['password']);

  let [primary_ki] = await Store.keysGet(account_email, ['primary']);
  Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);

  $('.action_verify').click(Ui.event.handle(async () => {
    let key = openpgp.key.readArmored(primary_ki.private).keys[0];
    if (await Pgp.key.decrypt(key, [$('#password').val() as string]) === true) { // text input
      Xss.sanitize_render('#content', '<div class="line">Your pass phrase matches. Good job! You\'re all set.</div><div class="line"><div class="button green close" data-test="action-test-passphrase-successful-close">close</div></div>');
      $('.close').click(Ui.event.handle(() => BrowserMsg.send(parent_tab_id, 'close_page')));
    } else {
      alert('Pass phrase did not match. Please try again. If you are not able to recover your pass phrase, please change it, so that do don\'t get locked out of your encrypted messages.');
    }
  }));

  $('.action_change_passphrase').click(Ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/change_passphrase.htm')));

})();
