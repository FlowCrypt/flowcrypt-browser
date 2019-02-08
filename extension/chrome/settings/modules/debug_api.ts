/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict } from '../../../js/common/core/common.js';
import { Xss, Env } from '../../../js/common/browser.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Google } from '../../../js/common/api/google.js';
import { Store } from '../../../js/common/platform/store.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'which']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const which = Env.urlParamRequire.oneof(uncheckedUrlParams, 'which', ['google_account', 'flowcrypt_account', 'flowcrypt_subscription']);

  const renderCallRes = (api: string, variables: Dict<any>, result: any, error?: any) => {
    const r = `<b>${api} ${JSON.stringify(variables)}</b><pre>${JSON.stringify(result, undefined, 2)} (${JSON.stringify(error)})</pre>`;
    Xss.sanitizeAppend('#content', r);
  };

  if (which === 'google_account') {
    try {
      const r = await Google.gmail.usersMeProfile(acctEmail);
      renderCallRes('gmail.users_me_profile', { acctEmail }, r);
    } catch (e) {
      renderCallRes('gmail.users_me_profile', { acctEmail }, undefined, e);
    }
    renderCallRes('Store.getAcct.openid', { acctEmail }, await Store.getAcct(acctEmail, ['openid']));
  } else if (which === 'flowcrypt_account') {
    Xss.sanitizeAppend('#content', `Unsupported which: ${Xss.escape(which)} (not implemented)`);
  } else if (which === 'flowcrypt_subscription') {
    Xss.sanitizeAppend('#content', `Unsupported which: ${Xss.escape(which)} (not implemented)`);
  } else {
    Xss.sanitizeAppend('#content', `Unknown which: ${Xss.escape(which)}`);
  }
})();
