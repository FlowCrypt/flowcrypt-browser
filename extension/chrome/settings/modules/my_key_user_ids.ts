/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../../js/common/store.js';
import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Xss } from '../../../js/common/browser.js';
import { Settings } from '../../../js/common/settings.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  let urlParams = Env.urlParams(['acctEmail', 'longid', 'parentTabId']);
  let acctEmail = Env.urlParamRequire.string(urlParams, 'acctEmail');
  let parentTabId = Env.urlParamRequire.string(urlParams, 'parentTabId');

  $('.action_show_public_key').attr('href', Env.urlCreate('my_key.htm', urlParams));

  let [primaryKi] = await Store.keysGet(acctEmail, [urlParams.longid as string || 'primary']);
  Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  let key = openpgp.key.readArmored(primaryKi.private).keys[0];

  let userIds = key.users.map((u: any) => u.userId.userid); // todo - create a common function in settings.js for here and setup.js user_ids
  Xss.sanitizeRender('.user_ids', userIds.map((uid: string) => `<div>${Xss.htmlEscape(uid)}</div>`).join(''));

  $('.email').text(acctEmail);
  $('.key_words').text(primaryKi.keywords);

})();
