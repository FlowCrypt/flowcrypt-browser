/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'verification_email_text', 'placement', 'source', 'parent_tab_id', 'subscribe_result_tab_id']);

var PRODUCTS = {
  trial: { id: 'free_quarter', method: 'trial', name: 'trial' },
  advanced_monthly: { id: 'cu-adv-month', method: 'stripe', name: 'advanced_monthly' },
};

var chosen_product;
var original_content;
var cryptup_verification_email_sender = 'verify@cryptup.org';
var can_read_emails;
var L = {
  welcome: 'Welcome to CryptUp Advanced.<br/><br/>You can now send larger attachments, to anyone.',
  credit_or_debit: 'Credit or debit card to use. You can cancel anytime.',
};
if(url_params.placement === 'embedded') {
  tool.env.increment('upgrade_verification_embedded_show');
  $('#content').html('One moment..').css({ 'width': '460px', 'padding': '30px 20px', 'height': '100px', 'margin-bottom': '0px' });
  $('body').css({'width': '460px', 'overflow': 'hidden'});
} else if(url_params.placement === 'settings') {
  $('#content').removeClass('dialog').css({ 'margin-top': 0, 'margin-bottom': 30 });
  if(url_params.source !== 'auth_error') {
    $('.list_benefits').css('display', 'block');
  }
  $('.line.button_padding').css('padding', 0);
  tool.env.increment('upgrade_dialog_show');
} else {
  if(url_params.source !== 'auth_error') {
    $('.list_benefits').css('display', 'block');
  }
  tool.env.increment('upgrade_dialog_show');
  $('body').css('overflow', 'hidden');
}
$('#content').css('display', 'block');

tool.browser.message.tab_id(function (tab_id) {
  var factory = element_factory(url_params.account_email, tab_id);
  tool.browser.message.listen({
    stripe_result: stripe_result_handler,
  }, tab_id);
  $('.stripe_checkout').html(L.credit_or_debit + '<br><br>' + factory.embedded.stripe_checkout());
});

if(url_params.source !== 'auth_error') {
  // $('.stripe_checkout').css('display', 'block');
}

function stripe_result_handler(data, sender, respond) {
  $('.stripe_checkout').html('').css('display', 'none');
  register_and_subscribe(PRODUCTS.advanced_monthly, data.token);
}

tool.api.cryptup.account_update(function() {
  account_storage_get(url_params.account_email, ['google_token_scopes'], function (storage) {
    can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
    storage_cryptup_subscription(function (level, expire, active, method) {
      if(url_params.placement !== 'embedded') {
        render_dialog(level, expire, active);
      } else {
        render_embedded(level, expire, active);
      }
    });
  });
});

function repair_auth_error_get_new_installation() {
  account_storage_set(null, { cryptup_account_uuid: undefined, cryptup_account_verified: false }, function () {
    render_status('checking..', true);
    tool.api.cryptup.account_login(url_params.account_email, null, handle_login_result);
  });
}

function render_embedded(level, expire, active) {
  $('#content').html('<div class="line status"></div>');
  if(active) {
    render_status(L.welcome);
  } else if(url_params.verification_email_text) {
    account_storage_get(null, ['cryptup_subscription_attempt'], function (storage) {
      chosen_product = storage.cryptup_subscription_attempt;
      tool.api.cryptup.account_login(url_params.account_email, parse_account_verification_text(url_params.verification_email_text), handle_login_result);
    });
  } else { // not really tested or expected
    catcher.log('embedded subscribe.htm but has no verification_email_text');
  }
}

function render_dialog(level, expire, active) {
  if(active) {
    if(url_params.source !== 'auth_error') {
      $('#content').html('<div class="line">You have already upgraded to CryptUp Advanced</div><div class="line"><div class="button green long action_close">close</div></div>');
    } else {
      $('h1').text('CryptUp Account');
      $('.status').text('Your account information seems outdated.');
      $('.action_ok').text('Update account info');
    }
  }

  $('.action_close').click(close_dialog);

  $('.action_ok').click(tool.ui.event.prevent(tool.ui.event.parallel(), function (self) {
    original_content = $(self).html();
    tool.env.increment('upgrade_dialog_register_click');
    if(active && url_params.source === 'auth_error') {
      repair_auth_error_get_new_installation();
    } else {
      register_and_subscribe(PRODUCTS.trial);
    }
  }));
}

function render_status(content, spinner) {
  $(url_params.placement === 'embedded' ? 'body .status' : '.action_ok').html(content + (spinner ? ' ' + tool.ui.spinner('white') : ''));
}

function register_and_subscribe(product, source_token) {
  render_status('registering..', true);
  chosen_product = product;
  chosen_product.source = source_token || null;
  account_storage_set(null, { 'cryptup_subscription_attempt': chosen_product }, function () {
    tool.api.cryptup.account_login(url_params.account_email, null, handle_login_result);
  });
}

function wait_for_token_email(timeout, callback) {
  if(timeout < 20) {
    $('.status').text('Still working..');
  } else if(timeout < 10) {
    $('.status').text('A little while more..');
  }
  var end = Date.now() + timeout * 1000;
  storage_cryptup_auth_info(function (account, uuid, verified) {
    fetch_token_emails_and_find_matching_token(account, uuid, function (success, tokens) {
      if(success && tokens) {
        callback(tokens);
      } else if(Date.now() < end) {
        setTimeout(function () {
          wait_for_token_email((end - Date.now()) / 1000, callback);
        }, 5000);
      } else {
        callback(null);
      }
    });
  });
}

function fetch_token_emails_and_find_matching_token(account_email, uuid, callback) {
  var called_back = false;
  function callback_once(v1, v2) {
    if(!called_back) {
      called_back = true;
      callback(v1, v2);
    }
  }
  var tokens = [];
  tool.api.gmail.message_list(account_email, 'from:' + cryptup_verification_email_sender + ' to:' + account_email + ' in:anywhere', true, function (list_success, response) {
    if(list_success) {
      if(response.messages) {
        tool.api.gmail.message_get(account_email, response.messages.map(function (m) { return m.id; }), 'full', function (get_success, messages) {
          if(get_success) {
            $.each(messages, function (id, gmail_message_object) {
              if(gmail_message_object.payload.mimeType === 'text/plain' && gmail_message_object.payload.body.size > 0) {
                var token = parse_account_verification_text(tool.str.base64url_decode(gmail_message_object.payload.body.data), uuid);
                if(token) {
                  tokens.push(token);
                }
              }
            });
            tokens.reverse();
            callback_once(Boolean(tokens.length), tokens.length ? tokens : null);
          } else {
            callback_once(false, null);
          }
        });
      } else {
        callback_once(true, null);
      }
    } else {
      callback_once(false, null);
    }
  });
}

function parse_account_verification_text(verification_email_text, stored_uuid_to_cross_check) {
  var token_link_match = verification_email_text.match(/account\/login?([^\s"<]+)/g);
  if(token_link_match !== null) {
    var token_link_params = tool.env.url_params(['account', 'uuid', 'token'], token_link_match[0].split('?')[1]);
    if((!stored_uuid_to_cross_check || token_link_params.uuid === stored_uuid_to_cross_check) && token_link_params.token) {
      return token_link_params.token;
    }
  }
}

function render_open_verification_email_message() {
  $('.action_ok').css('display', 'none');
  $('.action_close').text('ok');
  $('.status').text('Please check your inbox for a verification email.');
}

function handle_login_result(registered, verified, subscription, error, cryptup_email_verification_tokens) {
  if(!registered && cryptup_email_verification_tokens && cryptup_email_verification_tokens.length) {
    tool.api.cryptup.account_login(url_params.account_email, cryptup_email_verification_tokens.pop(), function(r, v, s, e) {
      handle_login_result(r, v, s, e, cryptup_email_verification_tokens);
    });
  } else if(registered) {
    if(verified) {
      if(subscription && subscription.level !== null) { //todo - check expiration
        notify_upgraded_and_close();
      } else {
        render_status(chosen_product.method === 'trial' ? 'enabling trial..' : 'upgrading..', true);
        tool.api.cryptup.account_subscribe(chosen_product.id, chosen_product.method, chosen_product.source, handle_subscribe_result);
      }
    } else {
      render_status('verifying..', true);
      if(can_read_emails && !cryptup_email_verification_tokens) {
        $('.status').text('This may take a minute.. ');
        wait_for_token_email(30, function (tokens) {
          if(tokens) {
            tool.api.cryptup.account_login(url_params.account_email, tokens.pop(), function(r, v, s, e) {
              handle_login_result(r, v, s, e, tokens);
            });
          } else {
            render_open_verification_email_message();
          }
        });
      } else {
        render_open_verification_email_message();
      }
    }
  } else {
    if(url_params.placement !== 'embedded') {
      alert('There was a problem registering (' + error + '). Write me at tom@cryptup.org if this persists.');
      window.location.reload();
    } else {
      render_status('There was a problem registering (' + error + '). Write me at tom@cryptup.org if this persists.');
    }
  }
}

function handle_subscribe_result(success, response) {
  account_storage_remove(null, 'cryptup_subscription_attempt', function () {
    if(success && response && response.subscription && response.subscription.level) {
      notify_upgraded_and_close();
    } else if(success === tool.api.cryptup.auth_error) {
      alert('There was a problem logging in, please write me at tom@cryptup.org to fix this');
      window.location.reload();
    } else {
      alert('There was a problem upgrading CryptUp (' + ((response && response.error) ? response.error : 'unknown reason') + '). Please try again. Write me at tom@cryptup.org if this persists.');
      window.location.reload();
    }
  });
}

function notify_upgraded_and_close() {
  tool.env.increment('upgrade_done');
  if(url_params.placement !== 'embedded') {
    tool.browser.message.send(url_params.parent_tab_id, 'notification_show', { notification: 'Successfully upgraded to CryptUp Advanced.' });
    if(url_params.subscribe_result_tab_id) {
      tool.browser.message.send(url_params.subscribe_result_tab_id, 'subscribe_result', {active: true});
    }
    close_dialog();
  } else {
    render_status(L.welcome);
  }
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
