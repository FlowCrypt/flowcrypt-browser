/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

$('.loading').html(tool.ui.spinner('green', 'large_spinner'));

tool.api.cryptup.account_update(function () {
  storage_cryptup_auth_info(function (email, uuid, verified){
    storage_cryptup_subscription(function(level, expire, active, method) {
      $('.email').text(email);
      $('.level').text('advanced');
      $('.expire').text(expire ? expire.split(' ')[0] : 'lifetime');
      if(method === 'stripe') {
        $('.line.cancel').css('display', 'block');
        $('.expire_label').text('Renews on');
        $('.price').text('$5 monthly');
        $('.method').text('Credit Card (processed by Stripe Payments)');
      } else {
        $('.expire_label').text('Until');
        $('.price').text('free');
        $('.method').html('trial <a href="#" class="action_go_subscription">upgrade</a>');
        $('.action_go_subscription').click(function() {
          show_settings_page('/chrome/elements/subscribe.htm', '&placement=settings');
        })
      }
      $('.loading').text(' ');
      $('.list_table').css('display', 'block');
    });
  });
});