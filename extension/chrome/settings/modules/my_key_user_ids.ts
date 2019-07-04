/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch } from '../../../js/common/platform/catch.js';
import { Store } from '../../../js/common/platform/store.js';
import { Env } from '../../../js/common/browser.js';
import { Assert } from '../../../js/common/assert.js';
import { Xss } from '../../../js/common/platform/xss.js';

declare const openpgp: typeof OpenPGP;

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'longid', 'parentTabId']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const longid = Assert.urlParamRequire.optionalString(uncheckedUrlParams, 'longid') || 'primary';
  const myKeyUrl = Env.urlCreate('my_key.htm', uncheckedUrlParams);

  $('.action_show_public_key').attr('href', myKeyUrl);

  const [primaryKi] = await Store.keysGet(acctEmail, [longid]);
  Assert.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);

  const { keys: [prv] } = await openpgp.key.readArmored(primaryKi.private);

  const userIds = prv.users.map(u => u.userId).filter(Boolean).map(uid => uid!.userid); // todo - create a common function in settings.js for here and setup.js user_ids
  Xss.sanitizeRender('.user_ids', userIds.map((uid: string) => `<div>${Xss.escape(uid)}</div>`).join(''));

  $('.email').text(acctEmail);
  $('.key_words').text(primaryKi.keywords);

})();
