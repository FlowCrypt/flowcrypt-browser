/* Business Source License 1.0 © 2016-2017 FlowCrypt Limited. Use limitations apply. Contact human@flowcrypt.com */

'use strict';

let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

$('.loading').html(tool.ui.spinner('green', 'large_spinner'));

tool.api.cryptup.account_check_sync(function () {
  window.flowcrypt_storage.auth_info(function (email, uuid, verified){
    window.flowcrypt_storage.subscription(function(level, expire, active, method) {
      $('.email').text(email);
      $('.level').text('advanced');
      $('.expire').text(expire ? expire.split(' ')[0] : 'lifetime');
      if(method === 'stripe') {
        $('.line.cancel').css('display', 'block');
        $('.expire_label').text('Renews on');
        $('.price').text('$5 monthly');
        $('.method').text('Credit Card (processed by Stripe Payments)');
      } else if(method === 'group') {
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
      if(method !== 'group') {
        $('.get_group_billing').css('display', 'block');
      }
      $('.loading').text(' ');
      $('.list_table').css('display', 'block');
    });
  });
});