/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

tool.ui.event.protect();

var url_params = tool.env.url_params(['account_email', 'parent_tab_id', 'placement']); // placement: compose||settings

storage_cryptup_subscription(function (level, expire, active) {
  if(active) {
    account_storage_get(url_params.account_email, ['email_footer'], function (storage) {
      $('.input_email_footer').val(storage.email_footer);
    });
    $('.user_subscribed').css('display', 'block');
  } else {
    $('.user_free').css('display', 'block');
    $('.action_upgrade').click(tool.ui.event.prevent(tool.ui.event.double(), function(self) {
      tool.browser.message.send(url_params.parent_tab_id, 'subscribe', {}, function (newly_active) {
        if(newly_active) {
          $('.user_subscribed').css('display', 'block');
          $('.user_free').css('display', 'none');
        }
      });
    }));
  }
  $('.action_add_footer').click(tool.ui.event.prevent(tool.ui.event.double(), function(self) {
    save_footer_if_has_subscription_and_requested($('.input_remember').prop('checked'), $('.input_email_footer').val(), function () {
      tool.browser.message.send(url_params.parent_tab_id, 'set_footer', {footer: $('.input_email_footer').val()});
    });
  }));
  $('.action_cancel').click(tool.ui.event.prevent(tool.ui.event.double(), function(self) {
    tool.browser.message.send(url_params.parent_tab_id, 'close_dialog');
  }));
});

function save_footer_if_has_subscription_and_requested(requested, footer, cb) {
  storage_cryptup_subscription(function (level, expire, active) {
    if(requested && active) {
      account_storage_set(url_params.account_email, { 'email_footer': footer }, cb);
    } else {
      cb();
    }
  });
}