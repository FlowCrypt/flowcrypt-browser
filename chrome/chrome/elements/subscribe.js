/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

tool.ui.event.protect();

var url_params = tool.env.url_params(['account_email', 'placement', 'source', 'parent_tab_id', 'subscribe_result_tab_id']);
var original_button_content;
var original_button_selector;

if(url_params.placement === 'settings') {
  $('#content').removeClass('dialog').css({ 'margin-top': 0, 'margin-bottom': 30 });
  $('.line.button_padding').css('padding', 0);
} else {
  $('body').css('overflow', 'hidden');
}
if(url_params.source !== 'auth_error') {
  $('.list_table').css('display', 'block');
  tool.env.increment('upgrade_dialog_show');
} else {
  $('.action_get_trial').addClass('action_add_device').removeClass('action_get_trial').text('Add Device');
}
$('#content').css('display', 'block');

$('.action_show_stripe').click(function() {
  $('.status').text('You are subscribing to a $5 monthly payment for CryptUp Advanced.');
  $('.hide_on_checkout').css('display', 'none');
  $('.stripe_checkout').css('display', 'block');
});

$('.action_show_group').click(function() {
  $('h1').text('CryptUp Group License');
  $('.status').html('Manage your users under a single billing interface.<br/><br/>Group discounts apply to 51st seat and up, starting at 5% depending on group size.<br/><br/>In addition to group discount, there is a flat 20% discount for customers billed yearly.<br/><br/>Write me at tom@cryptup.org');
  $('.hide_on_checkout').css('display', 'none');
});

$('.action_contact_page').click(function () {
  tool.browser.message.send(null, 'settings', {page:'/chrome/settings/modules/contact_page.htm', account_email: url_params.account_email});
});

$('.action_close').click(close_dialog);

$('.action_get_trial').click(tool.ui.event.prevent(tool.ui.event.parallel(), function (self) {
  button_spin(self);
  tool.env.increment('upgrade_dialog_register_click');
  window.flowcrypt_account.subscribe(url_params.account_email, window.flowcrypt_account.PRODUCTS.trial, null).then(handle_successful_upgrade, handle_error_response);
}));

$('.action_add_device').click(tool.ui.event.prevent(tool.ui.event.parallel(), function (self) {
  button_spin(self);
  tool.env.increment('upgrade_dialog_register_click');
  window.flowcrypt_account.register_new_device(url_params.account_email).then(close_dialog, handle_error_response);
}));

tool.api.cryptup.account_check_sync(function() {
  account_storage_get(url_params.account_email, ['google_token_scopes'], function (storage) {
    window.flowcrypt_account.config({
      render_status: render_status,
      CAN_READ_EMAIL: tool.api.gmail.has_scope(storage.google_token_scopes, 'read'),
    });
    storage_cryptup_subscription(function (level, expire, active, method) {
      if(!active) {
        if(level && expire) {
          if(method === 'trial') {
            $('.status').text('Your trial has expired on ' + tool.time.expiration_format(expire) + '. Upgrade now to continue using CryptUp Advanced.');
          } else {
            $('.status').text('Your subscription has ended on ' + expire + '. Renew now to continue using CryptUp Advanced.');
          }
          $('.action_get_trial').css('display', 'none');
          $('.action_show_stripe').removeClass('gray').addClass('green');
        } else {
          $('.status').text('After the trial period, your account will automatically switch back to Free Forever.');
        }
      } else if(active && method === 'trial') {
        $('.status').html('After the trial period, your account will automatically switch back to Free Forever.<br/><br/>You can subscribe now to stay on CryptUp Advanced. It\'s $5 a month.');
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
            $('#content').html('<div class="line">You have already upgraded to CryptUp Advanced</div><div class="line"><div class="button green long action_close">close</div></div>');
          }
        } else {
          $('h1').text('New Device');
          $('.action_show_stripe, .action_show_group').css('display', 'none');
          $('.status').text('This browser or device is not registered on your CryptUp Account.');
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
    catcher.info('problem during subscribe.js', error);
    window.location.reload()
  }
}

tool.browser.message.tab_id(function (tab_id) {
  tool.browser.message.listen({
    stripe_result: stripe_credit_card_entered_handler,
  }, tab_id);
  $('.stripe_checkout').html(window.flowcrypt_account.L.credit_or_debit + '<br><br>' + element_factory(url_params.account_email, tab_id).embedded.stripe_checkout());
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
  tool.env.increment('upgrade_done');
  tool.browser.message.send(url_params.parent_tab_id, 'notification_show', { notification: 'Successfully upgraded to CryptUp Advanced.' });
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
