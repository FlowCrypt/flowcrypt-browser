/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Catch, Env, Dict } from './../../js/common/common.js';
import { Xss, Ui } from '../../js/common/browser.js';
import { FlowCryptAccount } from './../../js/common/account.js';

Catch.try(async () => {

  Ui.event.protect();

  let url_params = Env.url_params(['account_email', 'verification_email_text', 'parent_tab_id', 'subscribe_result_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  let flowcrypt_account = new FlowCryptAccount({}, true);
  let token = flowcrypt_account.parse_token_email_text(url_params.verification_email_text as string);

  let render_status = (content: string, spinner=false) => {
    Xss.sanitize_render('body .status', Xss.html_sanitize(content + (spinner ? ' ' + Ui.spinner('white') : '')));
  };

  if (!token) {
    render_status('This verification email seems to have wrong format. Email human@flowcrypt.com to get this resolved.');
  } else {
    try {
      let {cryptup_subscription_attempt} = await Store.get_global(['cryptup_subscription_attempt']);
      let response = await flowcrypt_account.verify(account_email, [token]);
      if (cryptup_subscription_attempt) {
        let subscription = await flowcrypt_account.subscribe(account_email, cryptup_subscription_attempt, cryptup_subscription_attempt.source);
        if (subscription && subscription.level === 'pro') {
          render_status('Welcome to FlowCrypt Advanced.');
        } else {
          render_status('Email verified, but had trouble enabling FlowCrypt Advanced. Email human@flowcrypt.com to get this resolved.');
        }
      } else {
        render_status('Email verified, no further action needed.');
      }
    } catch (error) {
      render_status('Could not complete: ' + error.message);
      Catch.log('problem in verification.js', error);
    }
  }

})();
