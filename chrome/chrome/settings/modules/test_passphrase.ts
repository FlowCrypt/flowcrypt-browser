/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);
  let account_email = tool.env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id = tool.env.url_param_require.string(url_params, 'parent_tab_id');

  await tool.ui.passphrase_toggle(['password']);

  let [primary_ki] = await Store.keys_get(account_email, ['primary']);
  Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);

  $('.action_verify').click(async () => {
    let key = openpgp.key.readArmored(primary_ki.private).keys[0];
    if (await tool.crypto.key.decrypt(key, [$('#password').val() as string]) === true) { // text input
      $('#content').html('<div class="line">Your pass phrase matches. Good job! You\'re all set.</div><div class="line"><div class="button green close" data-test="action-test-passphrase-successful-close">close</div></div>');
      $('.close').click(() => tool.browser.message.send(parent_tab_id, 'close_page'));
    } else {
      alert('Pass phrase did not match. Please try again. If you are not able to recover your pass phrase, please change it, so that do don\'t get locked out of your encrypted messages.');
    }
  });

  $('.action_change_passphrase').click(() => Settings.redirect_sub_page(account_email, parent_tab_id, '/chrome/settings/modules/change_passphrase.htm'));

})();
