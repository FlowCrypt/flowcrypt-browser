/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'longid', 'parent_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  $('.action_show_public_key').attr('href', tool.env.url_create('my_key.htm', url_params));

  let [primary_ki] = await Store.keys_get(account_email, [url_params.longid as string || 'primary']);
  Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);

  let key = openpgp.key.readArmored(primary_ki.private).keys[0];

  let user_ids = key.users.map((u: any) => u.userId.userid); // todo - create a common function in settings.js for here and setup.js user_ids
  tool.ui.sanitize_render('.user_ids', user_ids.map((uid: string) => `<div>${tool.str.html_escape(uid)}</div>`).join(''));

  $('.email').text(account_email);
  $('.key_words').text(primary_ki.keywords);

})();
