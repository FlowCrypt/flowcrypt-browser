/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'placement', 'source', 'parent_tab_id', 'subscribe_result_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');
  
  let original_button_content: string;
  let original_button_selector: JQuery<HTMLElement>;

  await tool.api.cryptup.account_check_sync();
  let subscription = await Store.subscription();
  let {google_token_scopes} = await Store.get_account(account_email, ['google_token_scopes']);
  let can_read_email = tool.api.gmail.has_scope(google_token_scopes || [] , 'read');
  let flowcrypt_account = new FlowCryptAccount({render_status: render_status}, can_read_email);

  if(url_params.placement === 'settings') {
    $('#content').removeClass('dialog').css({ 'margin-top': 0, 'margin-bottom': 30 });
    $('.line.button_padding').css('padding', 0);
  } else {
    $('body').css('overflow', 'hidden');
  }
  if(url_params.source !== 'auth_error') {
    $('.list_table').css('display', 'block');
  } else {
    $('.action_get_trial').addClass('action_add_device').removeClass('action_get_trial').text('Add Device');
  }
  $('#content').css('display', 'block');
  
  $('.action_show_stripe').click(function() {
    $('.status').text('You are subscribing to a $5 monthly payment for FlowCrypt Advanced.');
    $('.hide_on_checkout').css('display', 'none');
    $('.stripe_checkout').css('display', 'block');
  });
  
  $('.action_contact_page').click(function () {
    tool.browser.message.send(null, 'settings', {page:'/chrome/settings/modules/contact_page.htm', account_email: url_params.account_email});
  });
  
  $('.action_close').click(close_dialog);
  
  $('.action_get_trial').click(tool.ui.event.prevent(tool.ui.event.parallel(), function (self) {
    button_spin(self);
    flowcrypt_account.subscribe(
      account_email,
      flowcrypt_account.PRODUCTS.trial,
      null,
    ).then(handle_successful_upgrade, handle_error_response);
  }));
  
  $('.action_add_device').click(tool.ui.event.prevent(tool.ui.event.parallel(), function (self) {
    button_spin(self);
    flowcrypt_account.register_new_device(account_email).then(close_dialog, handle_error_response);
  }));
  
  if(!subscription.active) {
    if(subscription.level && subscription.expire) {
      if(subscription.method === 'trial') {
        $('.status').text('Your trial has expired on ' + tool.time.expiration_format(subscription.expire) + '. Upgrade now to continue using FlowCrypt Advanced.');
      } else if(subscription.method === 'group') {
        $('.status').text('Your group licensing is due for renewal. Please check with company leadership.');
      } else {
        $('.status').text('Your subscription has ended on ' + subscription.expire + '. Renew now to continue using FlowCrypt Advanced.');
      }
      $('.action_get_trial').css('display', 'none');
      $('.action_show_stripe').removeClass('gray').addClass('green');
    } else {
      $('.status').text('After the trial, your account will automatically switch to Free Forever.');
    }
  } else if(subscription.active && subscription.method === 'trial') {
    $('.status').html('After the trial, your account will automatically switch to Free Forever.<br/><br/>You can subscribe now to stay on FlowCrypt Advanced. It\'s $5 a month.');
  } else {
    // todo - upgrade to business
  }
  if(subscription.active) {
    if(url_params.source !== 'auth_error') {
      if(subscription.method === 'trial') {
        $('.list_table').css('display', 'none');
        $('.action_get_trial').css('display', 'none');
        $('.action_show_stripe').removeClass('gray').addClass('green');
      } else {
        $('#content').html('<div class="line">You have already upgraded to FlowCrypt Advanced</div><div class="line"><div class="button green long action_close">close</div></div>');
        $('.action_close').click(() => {
          if(url_params.subscribe_result_tab_id) {
            tool.browser.message.send(url_params.subscribe_result_tab_id as string, 'subscribe_result', {active: true});
          }
          close_dialog();
        });
      }
    } else {
      $('h1').text('New Device');
      $('.action_show_stripe, .action_show_group').css('display', 'none');
      $('.status').text('This browser or device is not registered on your FlowCrypt Account.');
      $('.action_get_trial, .action_close').addClass('long');
    }
  }
  
  function handle_error_response(error: StandardError) {
    if(error.internal === 'email') {
      $('.action_get_trial').css('display', 'none');
      $('.action_close').text('ok');
      render_status(error.message);
      button_restore();
    } else {
      alert('Could not complete action: ' + error.message);
      tool.catch.report('problem during subscribe.js', error);
      window.location.reload()
    }
  }
  
  let tab_id = await tool.browser.message.required_tab_id();
  tool.browser.message.listen({
    stripe_result: stripe_credit_card_entered_handler,
  }, tab_id || undefined);
  let html = Lang.account.credit_or_debit + '<br><br>' + new Factory(account_email, tab_id).embedded_stripe_checkout() + '<br><a href="#">back</a>';
  $('.stripe_checkout').html(html).children('a').click(() => window.location.reload());
  
  function stripe_credit_card_entered_handler(data: {token: string}, sender: any, respond: Callback) {
    $('.stripe_checkout').html('').css('display', 'none');
    flowcrypt_account.subscribe(
      account_email, flowcrypt_account.PRODUCTS.advanced_monthly, data.token,
    ).then(handle_successful_upgrade, handle_error_response);
  }
  
  function render_status(content: string) {
    $('.status').html(content);
  }
  
  function button_spin(element: HTMLElement) {
    original_button_content = $(element).html();
    original_button_selector = $(element);
    $(element).html(tool.ui.spinner('white'));
  }
  
  function button_restore() {
    original_button_selector.html(original_button_content);
  }
  
  function handle_successful_upgrade() {
    tool.browser.message.send(parent_tab_id, 'notification_show', { notification: 'Successfully upgraded to FlowCrypt Advanced.' });
    if(url_params.subscribe_result_tab_id) {
      tool.browser.message.send(url_params.subscribe_result_tab_id as string, 'subscribe_result', {active: true});
    }
    close_dialog();
  }
  
  function close_dialog() {
    if(url_params.placement === 'settings_compose') {
      window.close();
    } else if (url_params.placement === 'settings'){
      tool.browser.message.send(parent_tab_id, 'reload');
    } else {
      tool.browser.message.send(parent_tab_id, 'close_dialog');
    }
  }  

})();