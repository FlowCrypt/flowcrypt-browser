/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'verification_email_text', 'parent_tab_id', 'subscribe_result_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');
  
  let flowcrypt_account = new FlowCryptAccount({}, true);
  let token = flowcrypt_account.parse_token_email_text(url_params.verification_email_text as string);
  
  if(!token) {
    render_status('This verification email seems to have wrong format. Please write me at human@flowcrypt.com to fix this.');
  } else {
    try {
      let {cryptup_subscription_attempt} = await Store.get_global(['cryptup_subscription_attempt']);
      let response = await flowcrypt_account.verify(account_email, [token]);
      if(cryptup_subscription_attempt) {
        let subscription = await flowcrypt_account.subscribe(account_email, cryptup_subscription_attempt, cryptup_subscription_attempt.source);
        if(subscription && subscription.level === 'pro') {
          render_status('Welcome to FlowCrypt Advanced.');
        } else {
          render_status('Email verified, but had trouble enabling FlowCrypt Advanced. Please write me at human@flowcrypt.com to fix this.');
        }
      } else {
        render_status('Email verified, no further action needed.');
      }
    } catch (error) {
      render_status('Could not complete: ' + error.message);
      tool.catch.log('problem in verification.js', error);
    }
  }
  
  function render_status(content: string, spinner=false) {
    $('body .status').html(content + (spinner ? ' ' + tool.ui.spinner('white') : ''));
  }
  
})();