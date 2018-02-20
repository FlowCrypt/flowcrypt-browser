/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.ui.event.protect();

let url_params = tool.env.url_params(['account_email', 'placement', 'source', 'parent_tab_id', 'subscribe_result_tab_id']);
let original_button_content;
let original_button_selector;

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
  window.flowcrypt_account.subscribe(url_params.account_email, window.flowcrypt_account.PRODUCTS.trial, null).then(handle_successful_upgrade, handle_error_response);
}));

$('.action_add_device').click(tool.ui.event.prevent(tool.ui.event.parallel(), function (self) {
  button_spin(self);
  window.flowcrypt_account.register_new_device(url_params.account_email).then(close_dialog, handle_error_response);
}));

tool.api.cryptup.account_check_sync(function() {
  window.flowcrypt_storage.get(url_params.account_email, ['google_token_scopes'], storage => {
    window.flowcrypt_account.config({
      render_status: render_status,
      CAN_READ_EMAIL: tool.api.gmail.has_scope(storage.google_token_scopes, 'read'),
    });
    window.flowcrypt_storage.subscription(function (level, expire, active, method) {
      if(!active) {
        if(level && expire) {
          if(method === 'trial') {
            $('.status').text('Your trial has expired on ' + tool.time.expiration_format(expire) + '. Upgrade now to continue using FlowCrypt Advanced.');
          } else if(method === 'group') {
            $('.status').text('Your group licensing is due for renewal. Please check with company leadership.');
          } else {
            $('.status').text('Your subscription has ended on ' + expire + '. Renew now to continue using FlowCrypt Advanced.');
          }
          $('.action_get_trial').css('display', 'none');
          $('.action_show_stripe').removeClass('gray').addClass('green');
        } else {
          $('.status').text('After the trial period, your account will automatically switch back to Free Forever.');
        }
      } else if(active && method === 'trial') {
        $('.status').html('After the trial period, your account will automatically switch back to Free Forever.<br/><br/>You can subscribe now to stay on FlowCrypt Advanced. It\'s $5 a month.');
      } else {
        // todo - upgrade to business
      }
      if(active) {
        if(url_params.source !== 'auth_error') {
          if(method === 'trial') {
            $('.list_table').css('display', 'none');
            $('.action_get_trial').css('display', 'none');
            $('.action_show_stripe').removeClass('gray').addClass('green');
          } else {
            $('#content').html('<div class="line">You have already upgraded to FlowCrypt Advanced</div><div class="line"><div class="button green long action_close">close</div></div>');
            $('.action_close').click(() => {
              tool.browser.message.send(url_params.subscribe_result_tab_id, 'subscribe_result', {active: true});
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
    });
  });
});

function handle_error_response(error) {
  if(error.internal === 'email') {
    $('.action_get_trial').css('display', 'none');
    $('.action_close').text('ok');
    render_status(error.message);
    button_restore();
  } else {
    alert('Could not complete action: ' + error.message);
    catcher.report('problem during subscribe.js', error);
    window.location.reload()
  }
}

tool.browser.message.tab_id(function (tab_id) {
  tool.browser.message.listen({
    stripe_result: stripe_credit_card_entered_handler,
  }, tab_id);
  let html = window.lang.account.credit_or_debit + '<br><br>' + element_factory(url_params.account_email, tab_id).embedded.stripe_checkout() + '<br><a href="#">back</a>';
  $('.stripe_checkout').html(html).children('a').click(() => window.location.reload());
});

function stripe_credit_card_entered_handler(data, sender, respond) {
  $('.stripe_checkout').html('').css('display', 'none');
  window.flowcrypt_account.subscribe(url_params.account_email, window.flowcrypt_account.PRODUCTS.advanced_monthly, data.token).then(handle_successful_upgrade, handle_error_response);
}

function render_status(content) {
  $('.status').html(content);
}

function button_spin(selector) {
  original_button_content = $(selector).html();
  original_button_selector = $(selector);
  $(selector).html(tool.ui.spinner('white'));
}

function button_restore() {
  original_button_selector.html(original_button_content);
}

function handle_successful_upgrade() {
  tool.browser.message.send(url_params.parent_tab_id, 'notification_show', { notification: 'Successfully upgraded to FlowCrypt Advanced.' });
  if(url_params.subscribe_result_tab_id) {
    tool.browser.message.send(url_params.subscribe_result_tab_id, 'subscribe_result', {active: true});
  }
  close_dialog();
}

function close_dialog() {
  if(url_params.placement === 'settings_compose') {
    window.close();
  } else if (url_params.placement === 'settings'){
    tool.browser.message.send(url_params.parent_tab_id, 'reload');
  } else {
    tool.browser.message.send(url_params.parent_tab_id, 'close_dialog');
  }
}
