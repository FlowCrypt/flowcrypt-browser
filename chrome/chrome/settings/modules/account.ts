/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');

  tool.ui.sanitize_render('.loading', tool.ui.spinner('green', 'large_spinner'));

  await tool.api.fc.account_check_sync();
  let auth_info = await Store.auth_info();
  let subscription = await Store.subscription();

  $('.email').text(auth_info.account_email || 'UNKNOWN!');
  $('.level').text('advanced');
  $('.expire').text(subscription.expire ? subscription.expire.split(' ')[0] : 'lifetime');
  if (subscription.method === 'stripe') {
    $('.line.cancel').css('display', 'block');
    $('.expire_label').text('Renews on');
    $('.price').text('$5 monthly');
    $('.method').text('Credit Card (processed by Stripe Payments)');
  } else if (subscription.method === 'group') {
    $('.price').text('Group billing');
    $('.hide_if_group_billing').css('display', 'none');
  } else {
    $('.expire_label').text('Until');
    $('.price').text('free');
    tool.ui.sanitize_render('.method', 'trial <a href="#" class="action_go_subscription">upgrade</a>');
    $('.action_go_subscription').click(tool.ui.event.handle(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/elements/subscribe.htm', '&placement=settings')));
  }
  if (subscription.method !== 'group') {
    $('.get_group_billing').css('display', 'block');
  }
  $('.loading').text(' ');
  $('.list_table').css('display', 'block');

})();
