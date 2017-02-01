/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'verification_email_text', 'embedded', 'source', 'parent_tab_id']);
var original_content;
var product = 'free_year';
var cryptup_verification_email_sender = 'verify@cryptup.org';
var GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
var can_read_emails;
var l = {
  welcome: 'Welcome to CryptUP Pro.<br/><br/>You can now send encrypted attachments to anyone.',
};
if(url_params.embedded) {
  tool.env.increment('upgrade_verification_embedded_show');
  $('#content').html('One moment..').css({ 'width': '460px', 'padding': '30px 20px', 'height': '100px', 'margin-bottom': '0px', });
  $('body').css('width', '460px');
} else {
  tool.env.increment('upgrade_dialog_show');
}

$('#content').css('display', 'block');

// tool.ui.passphrase_toggle(['passphrase']);
// $('input.passphrase').keyup(render_normal);

account_storage_get(url_params.account_email, ['google_token_scopes'], function (storage) {
  can_read_emails = (typeof storage.google_token_scopes !== 'undefined' && storage.google_token_scopes.indexOf(GMAIL_READ_SCOPE) !== -1);
  cryptup_subscription(function (level, expire, active) {
    if(!url_params.embedded) {
      render_dialog(level, expire, active);
    } else {
      render_embedded(level, expire, active);
    }
  });
});

function repair_auth_error_get_new_installation() {
  account_storage_set(null, { cryptup_account_uuid: undefined, cryptup_account_verified: false, }, function () {
    render_status('checking..', true);
    tool.api.cryptup.account_login(url_params.account_email, null, handle_login_result);
  });
}

function render_embedded(level, expire, active) {
  $('#content').html('<div class="line status"></div>');
  if(active) {
    render_status(l.welcome);
  } else if(url_params.verification_email_text) {
    tool.api.cryptup.account_login(url_params.account_email, null, handle_login_result)
  } else { // not really tested or expected
    catcher.log('embedded subscribe.htm but has no verification_email_text');
  }
}

function render_dialog(level, expire, active) {
  if(active) {
    if(url_params.source !== 'auth_error') {
      $('#content').html('<div class="line">You have already upgraded to CryptUP Pro</div><div class="line"><div class="button green long action_close">close</div></div>');
    } else {
      $('h1').text('CryptUP Account');
      $('.status').text('Your account information seems outdated.');
      $('.action_ok').text('Update account info');
    }
  }

  $('.action_close').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    tool.browser.message.send(url_params.parent_tab_id, 'close_dialog');
  }));

  $('.action_ok').click(tool.ui.event.prevent(tool.ui.event.parallel(), function (self) {
    original_content = $(self).html();
    tool.env.increment('upgrade_dialog_register_click');
    if(active && url_params.source === 'auth_error') {
      repair_auth_error_get_new_installation();
    } else {
      register_and_subscribe();
    }
  }));
}

function render_status(content, spinner) {
  $(url_params.embedded ? 'body .status' : '.action_ok').html(content + (spinner ? ' ' + tool.ui.spinner() : ''));
}

function register_and_subscribe() {
  render_status('registering..', true);
  tool.api.cryptup.account_login(url_params.account_email, null, handle_login_result);
}

function wait_for_token_email(timeout, callback) {
  if(timeout < 20) {
    $('.status').text('Still working..');
  } else if(timeout < 10) {
    $('.status').text('A little while more..');
  }
  var end = Date.now() + timeout * 1000;
  cryptup_auth_info(function (account, uuid, verified) {
    fetch_token_emails_and_find_matching_token(account, uuid, function (success, token) {
      if(success && token) {
        callback(token);
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
  tool.api.gmail.message_list(account_email, 'from:' + cryptup_verification_email_sender + ' to:' + account_email + ' in:anywhere', true, function (list_success, response) {
    if(list_success) {
      if(response.messages) {
        tool.api.gmail.message_get(account_email, response.messages.map(function (m) { return m.id; }), 'full', function (get_success, messages) {
          if(get_success) {
            $.each(messages, function (id, gmail_message_object) {
              if(gmail_message_object.payload.mimeType === 'text/plain' && gmail_message_object.payload.body.size > 0) {
                var message_content = tool.str.base64url_decode(gmail_message_object.payload.body.data);
                var token_link_match = message_content.match(/account\/login?([^\s"<]+)/g);
                if(token_link_match !== null) {
                  var token_link_params = tool.env.url_params(['account', 'uuid', 'token'], token_link_match[0].split('?')[1]);
                  if(token_link_params.uuid === uuid && token_link_params.token) {
                    callback_once(true, token_link_params.token);
                    return false;
                  }
                }
              }
            });
            callback_once(true, null);
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

function render_open_verification_email_message() {
  $('.action_ok').css('display', 'none');
  $('.action_close').text('ok');
  $('.status').text('Please check your inbox for a verification email.');
}

function handle_login_result(registered, verified, subscription, error) {
  if(registered) {
    if(verified) {
      if(subscription && subscription.level !== null) { //todo - check expiration
        notify_upgraded_and_close();
      } else {
        render_status('upgrading cryptup..', true);
        tool.api.cryptup.account_subscribe(product, handle_subscribe_result);
      }
    } else {
      render_status('verifying..', true);
      if(can_read_emails) {
        $('.status').text('This may take a minute.. ');
        wait_for_token_email(30, function (token) {
          if(token) {
            tool.api.cryptup.account_login(url_params.account_email, token, handle_login_result);
          } else {
            render_open_verification_email_message();
          }
        });
      } else {
        render_open_verification_email_message();
      }
    }
  } else {
    if(!url_params.embedded) {
      alert('There was a problem registering (' + error + '). Write me at tom@cryptup.org if this persists.');
      window.location.reload();
    } else {
      render_status('There was a problem registering (' + error + '). Write me at tom@cryptup.org if this persists.');
    }
  }
}

function handle_subscribe_result(success, response) {
  if(success && response && response.subscription && response.subscription.level) {
    notify_upgraded_and_close();
  } else {
    alert('There was a problem upgrading CryptUP (' + ((response && response.error) ? response.error : 'unknown reason') + '). Please try again. Write me at tom@cryptup.org if this persists.');
    window.location.reload();
  }
}

function notify_upgraded_and_close() {
  tool.env.increment('upgrade_done');
  if(!url_params.embedded) {
    tool.browser.message.send(url_params.parent_tab_id, 'notification_show', {
      notification: 'Successfully upgraded to CryptUP Pro.',
    });
    tool.browser.message.send(url_params.parent_tab_id, 'close_dialog');
  } else {
    render_status(l.welcome);
  }
}
