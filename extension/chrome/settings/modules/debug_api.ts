/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Catch, Env, Dict } from '../../../js/common/common.js';
import { Xss } from '../../../js/common/browser.js';

import { Api } from '../../../js/common/api.js';

Catch.try(async () => {

  const url_params = Env.urlParams(['account_email', 'parent_tab_id', 'which']);
  const account_email = Env.url_param_require.string(url_params, 'account_email');
  const parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');
  const which = Env.url_param_require.oneof(url_params, 'which', ['google_account', 'flowcrypt_account', 'flowcrypt_subscription']);

  const render_call_result = (api: string, variables: Dict<any>, result: any, error: any=null) => {
    const r = `<b>${api} ${JSON.stringify(variables)}</b><pre>${JSON.stringify(result, undefined, 2)} (${JSON.stringify(error)})</pre>`;
    Xss.sanitizeAppend('#content', r);
  };

  if(which === 'google_account') {
    const variables = {account_email};
    try {
      const r = await Api.gmail.usersMeProfile(account_email);
      render_call_result('gmail.users_me_profile', variables, r);
    } catch (e) {
      render_call_result('gmail.users_me_profile', variables, null, e);
    }
    try {
      const r = await Api.google.plus.peopleMe(account_email);
      render_call_result('google.plus.people_me', variables, r);
    } catch (e) {
      render_call_result('google.plus.people_me', variables, null, e);
    }
  } else if(which === 'flowcrypt_account') {
    Xss.sanitizeAppend('#content', `Unsupported which: ${Xss.htmlEscape(which)} (not implemented)`);
  } else if (which === 'flowcrypt_subscription') {
    Xss.sanitizeAppend('#content', `Unsupported which: ${Xss.htmlEscape(which)} (not implemented)`);
  } else {
    Xss.sanitizeAppend('#content', `Unknown which: ${Xss.htmlEscape(which)}`);
  }
})();
