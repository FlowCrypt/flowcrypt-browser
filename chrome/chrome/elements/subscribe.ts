/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'placement', 'source', 'parent_tab_id', 'subscribe_result_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  let auth_info = await Store.auth_info();
  if (auth_info.account_email) {
    account_email = auth_info.account_email; // todo - allow user to select and confirm email address
  }
  let original_button_content: string;
  let original_button_selector: JQuery<HTMLElement>;

  let handle_error_response = (error: StandardError) => {
    if (error.internal === 'email') {
      $('.action_get_trial, .action_add_device').css('display', 'none');
      $('.action_close').text('ok');
      render_status_text(error.message);
      button_restore();
    } else {
      alert('Could not complete action: ' + error.message);
      tool.catch.report('problem during subscribe.js', error);
      window.location.reload();
    }
  };

  let stripe_credit_card_entered_handler: BrowserMessageHandler = (data: {token: string}, sender, respond) => {
    $('.stripe_checkout').text('').css('display', 'none');
    flowcrypt_account.subscribe(account_email, flowcrypt_account.PRODUCTS.advanced_monthly, data.token).then(handle_successful_upgrade, handle_error_response);
  };

  let render_status_text = (content: string) => {
    $('.status').text(content);
  };

  let button_spin = (element: HTMLElement) => {
    original_button_content = $(element).html();
    original_button_selector = $(element);
    tool.ui.sanitize_render(element, tool.ui.spinner('white'));
  };

  let button_restore = () => {
    tool.ui.sanitize_render(original_button_selector, original_button_content);
  };

  let handle_successful_upgrade = () => {
    tool.browser.message.send(parent_tab_id, 'notification_show', { notification: 'Successfully upgraded to FlowCrypt Advanced.' });
    if (url_params.subscribe_result_tab_id) {
      tool.browser.message.send(url_params.subscribe_result_tab_id as string, 'subscribe_result', {active: true});
    }
    close_dialog();
  };

  let close_dialog = () => {
    if (url_params.placement === 'settings_compose') {
      window.close();
    } else if (url_params.placement === 'settings') {
      tool.browser.message.send(parent_tab_id, 'reload');
    } else {
      tool.browser.message.send(parent_tab_id, 'close_dialog');
    }
  };

  try {
    await tool.api.cryptup.account_check_sync();
  } catch (e) {
    if (tool.api.error.is_auth_error(e)) {
      // todo - handle auth error - add device
      tool.ui.sanitize_render('#content', `Failed to load - unknown device. ${tool.ui.retry_link()}`);
    } else if (tool.api.error.is_network_error(e)) {
      tool.ui.sanitize_render('#content', `Failed to load due to internet connection. ${tool.ui.retry_link()}`);
    } else {
      tool.catch.handle_exception(e);
      tool.ui.sanitize_render('#content', `Unknown error happened when fetching account info. ${tool.ui.retry_link()}`);
    }
  }

  let subscription = await Store.subscription();
  let {google_token_scopes} = await Store.get_account(account_email, ['google_token_scopes']);
  let can_read_email = tool.api.gmail.has_scope(google_token_scopes || [] , 'read');
  let flowcrypt_account = new FlowCryptAccount({render_status_text}, can_read_email);

  if (url_params.placement === 'settings') {
    $('#content').removeClass('dialog').css({ 'margin-top': 0, 'margin-bottom': 30 });
    $('.line.button_padding').css('padding', 0);
  } else {
    $('body').css('overflow', 'hidden');
  }
  if (url_params.source !== 'auth_error') {
    $('.list_table').css('display', 'block');
  } else {
    $('.action_get_trial').addClass('action_add_device').removeClass('action_get_trial').text('Add Device');
  }
  $('#content').css('display', 'block');

  $('.action_show_stripe').click(tool.ui.event.handle(() => {
    $('.status').text('You are subscribing to a $5 monthly payment for FlowCrypt Advanced.');
    $('.hide_on_checkout').css('display', 'none');
    $('.stripe_checkout').css('display', 'block');
  }));

  $('.action_contact_page').click(tool.ui.event.handle(() => tool.browser.message.send(null, 'settings', {page:'/chrome/settings/modules/contact_page.htm', account_email: url_params.account_email})));

  $('.action_close').click(tool.ui.event.handle(close_dialog));

  $('.action_get_trial').click(tool.ui.event.prevent(tool.ui.event.parallel(), target => {
    button_spin(target);
    flowcrypt_account.subscribe(account_email, flowcrypt_account.PRODUCTS.trial, null).then(handle_successful_upgrade, handle_error_response);
  }));

  $('.action_add_device').click(tool.ui.event.prevent(tool.ui.event.parallel(), target => {
    button_spin(target);
    flowcrypt_account.register_new_device(account_email).then(close_dialog, handle_error_response);
  }));

  if (!subscription.active) {
    if (subscription.level && subscription.expire) {
      if (subscription.method === 'trial') {
        $('.status').text('Your trial has expired on ' + tool.time.expiration_format(subscription.expire) + '. Upgrade now to continue using FlowCrypt Advanced.');
      } else if (subscription.method === 'group') {
        $('.status').text('Your group licensing is due for renewal. Please check with company leadership.');
      } else {
        $('.status').text('Your subscription has ended on ' + subscription.expire + '. Renew now to continue using FlowCrypt Advanced.');
      }
      $('.action_get_trial').css('display', 'none');
      $('.action_show_stripe').removeClass('gray').addClass('green');
    } else {
      $('.status').text('After the trial, your account will automatically switch to Free Forever.');
    }
  } else if (subscription.active && subscription.method === 'trial') {
    tool.ui.sanitize_render('.status', 'After the trial, your account will automatically switch to Free Forever.<br/><br/>You can subscribe now to stay on FlowCrypt Advanced. It\'s $5 a month.');
  } else {
    // todo - upgrade to business
  }
  if (subscription.active) {
    if (url_params.source !== 'auth_error') {
      if (subscription.method === 'trial') {
        $('.list_table').css('display', 'none');
        $('.action_get_trial').css('display', 'none');
        $('.action_show_stripe').removeClass('gray').addClass('green');
      } else {
        tool.ui.sanitize_render('#content', '<div class="line">You have already upgraded to FlowCrypt Advanced</div><div class="line"><div class="button green long action_close">close</div></div>');
        $('.action_close').click(tool.ui.event.handle(() => {
          if (url_params.subscribe_result_tab_id) {
            tool.browser.message.send(url_params.subscribe_result_tab_id as string, 'subscribe_result', {active: true});
          }
          close_dialog();
        }));
      }
    } else {
      $('h1').text('New Device');
      $('.action_show_stripe, .action_show_group').css('display', 'none');
      $('.status').text(`This browser or device is not registered on your FlowCrypt Account (${account_email}).`);
      $('.action_add_device, .action_close').addClass('long');
      // try API call auth in case it got fixed meanwhile
      try {
        await tool.api.cryptup.account_update();
        $('.status').text(`Successfully verified your new device for your FlowCrypt Account (${account_email}).`);
        $('.action_add_device').css('display', 'none');
        $('.action_close').removeClass('gray').addClass('green').text('ok');
      } catch(e) {
        if(!tool.api.error.is_auth_error(e) && !tool.api.error.is_network_error(e)) {
          tool.catch.handle_exception(e);
        }
      }
    }
  }

  let tab_id = await tool.browser.message.required_tab_id();
  tool.browser.message.listen({
    stripe_result: stripe_credit_card_entered_handler,
  }, tab_id || undefined);
  $('.stripe_checkout').html(`${Lang.account.credit_or_debit}<br><br>${new XssSafeFactory(account_email, tab_id).embedded_stripe_checkout()}<br>${tool.ui.retry_link('back')}`); // xss-safe-factory

})();
