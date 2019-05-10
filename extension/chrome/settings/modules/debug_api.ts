/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Dict } from '../../../js/common/core/common.js';
import { Xss, Env } from '../../../js/common/browser.js';
import { Catch } from '../../../js/common/platform/catch.js';
import { Google } from '../../../js/common/api/google.js';
import { Store } from '../../../js/common/platform/store.js';
import { Assert } from '../../../js/common/assert.js';

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'parentTabId', 'which']);
  const acctEmail = Assert.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  const which = Assert.urlParamRequire.oneof(uncheckedUrlParams, 'which', ['google_account', 'flowcrypt_account', 'flowcrypt_subscription', 'local_store']);

  const renderCallRes = (api: string, variables: Dict<any>, result: any, error?: any) => {
    const r = `<b>${api} ${JSON.stringify(variables)}</b><pre>${JSON.stringify(result, undefined, 2)} (${error ? JSON.stringify(error) : 'no err'})</pre>`;
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
  } else if (which === 'local_store') {
    const storage = await Store.getAcct(acctEmail, [
      'notification_setup_needed_dismissed', 'email_provider', 'google_token_scopes', 'hide_message_password', 'addresses', 'outgoing_language',
      'email_footer', 'full_name', 'cryptup_enabled', 'setup_done', 'setup_simple', 'is_newly_created_key', 'key_backup_method',
      'key_backup_prompt', 'successfully_received_at_leat_one_message', 'notification_setup_done_seen', 'openid',
    ]);
    renderCallRes('Local account storage', { acctEmail }, storage);
  } else {
    Xss.sanitizeAppend('#content', `Unknown which: ${Xss.escape(which)}`);
  }
})();
