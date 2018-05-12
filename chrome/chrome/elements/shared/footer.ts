/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  tool.ui.event.protect();

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']); // placement: compose||settings
  
  Store.subscription(function (level, expire, active) {
    if(active) {
      Store.get(url_params.account_email as string, ['email_footer'], storage => {
        $('.input_email_footer').val(storage.email_footer as string);
      });
      $('.user_subscribed').css('display', 'block');
    } else {
      $('.user_free').css('display', 'block');
      $('.action_upgrade').click(tool.ui.event.prevent(tool.ui.event.double(), function(self) {
        tool.browser.message.send(url_params.parent_tab_id as string, 'subscribe', {}, function (newly_active) {
          if(newly_active) {
            $('.user_subscribed').css('display', 'block');
            $('.user_free').css('display', 'none');
          }
        });
      }));
    }
    $('.action_add_footer').click(tool.ui.event.prevent(tool.ui.event.double(), function(self) {
      save_footer_if_has_subscription_and_requested($('.input_remember').prop('checked'), $('.input_email_footer').val() as string, function () { // is textarea
        tool.browser.message.send(url_params.parent_tab_id as string, 'set_footer', {footer: $('.input_email_footer').val()});
      });
    }));
    $('.action_cancel').click(tool.ui.event.prevent(tool.ui.event.double(), function(self) {
      tool.browser.message.send(url_params.parent_tab_id as string, 'close_dialog');
    }));
  });
  
  function save_footer_if_has_subscription_and_requested(requested: boolean, footer: string, cb: Callback) {
    Store.subscription(function (level, expire, active) {
      if(requested && active) {
        Store.set(url_params.account_email as string, { 'email_footer': footer }, cb);
      } else {
        cb();
      }
    });
  }

})();
