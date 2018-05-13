/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

  $('.loading').html(tool.ui.spinner('green', 'large_spinner'));
  
  tool.api.cryptup.account_check_sync(function () {
    Store.auth_info().then((auth_info: StoredAuthInfo) => {
      Store.subscription().then(subscription => {
        // @ts-ignore - todo - this should be tested & potentially fixed
        $('.email').text(auth_info.account_email);
        $('.level').text('advanced');
        $('.expire').text(subscription.expire ? subscription.expire.split(' ')[0] : 'lifetime');
        if(subscription.method === 'stripe') {
          $('.line.cancel').css('display', 'block');
          $('.expire_label').text('Renews on');
          $('.price').text('$5 monthly');
          $('.method').text('Credit Card (processed by Stripe Payments)');
        } else if(subscription.method === 'group') {
          $('.price').text('Group billing');
          $('.hide_if_group_billing').css('display', 'none');
        } else {
          $('.expire_label').text('Until');
          $('.price').text('free');
          $('.method').html('trial <a href="#" class="action_go_subscription">upgrade</a>');
          $('.action_go_subscription').click(function() {
            show_settings_page('/chrome/elements/subscribe.htm', '&placement=settings');
          })
        }
        if(subscription.method !== 'group') {
          $('.get_group_billing').css('display', 'block');
        }
        $('.loading').text(' ');
        $('.list_table').css('display', 'block');
      });
    });
  });

})();