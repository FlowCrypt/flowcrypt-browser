/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

Catch.try(async () => {

  const url_params = Env.url_params(['account_email', 'parent_tab_id', 'which']);
  const account_email = Env.url_param_require.string(url_params, 'account_email');
  const parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');
  const which = Env.url_param_require.oneof(url_params, 'which', ['google_account', 'flowcrypt_account', 'flowcrypt_subscription']);

  const render_call_result = (api: string, variables: Dict<any>, result: any, error: any=null) => {
    const r = `<b>${api} ${JSON.stringify(variables)}</b><pre>${JSON.stringify(result, undefined, 2)} (${JSON.stringify(error)})</pre>`;
    Xss.sanitize_append('#content', r);
  };

  if(which === 'google_account') {
    const variables = {account_email};
    try {
      const r = await Api.gmail.users_me_profile(account_email);
      render_call_result('gmail.users_me_profile', variables, r);
    } catch (e) {
      render_call_result('gmail.users_me_profile', variables, null, e);
    }
    try {
      const r = await Api.google.plus.people_me(account_email);
      render_call_result('google.plus.people_me', variables, r);
    } catch (e) {
      render_call_result('google.plus.people_me', variables, null, e);
    }
  } else if(which === 'flowcrypt_account') {
    Xss.sanitize_append('#content', `Unsupported which: ${Xss.html_escape(which)} (not implemented)`);
  } else if (which === 'flowcrypt_subscription') {
    Xss.sanitize_append('#content', `Unsupported which: ${Xss.html_escape(which)} (not implemented)`);
  } else {
    Xss.sanitize_append('#content', `Unknown which: ${Xss.html_escape(which)}`);
  }
})();
