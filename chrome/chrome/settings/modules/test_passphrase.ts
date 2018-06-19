/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

  tool.ui.passphrase_toggle(['password']);

  let [primary_ki] = await Store.keys_get(url_params.account_email as string, ['primary']);
  abort_and_render_error_if_keyinfo_empty(primary_ki);

  let key = openpgp.key.readArmored(primary_ki.private).keys[0];

  $('.action_verify').click(function () {
    if(tool.crypto.key.decrypt(key, $('#password').val() as string).success) { // text input
      $('#content').html('<div class="line">Your pass phrase matches. Good job! You\'re all set.</div><div class="line"><div class="button green close" data-test="action-test-passphrase-successful-close">close</div></div>');
      $('.close').click(function () {
        tool.browser.message.send(url_params.parent_tab_id as string, 'close_page');
      });
    } else {
      alert('Pass phrase did not match. Please try again. If you are not able to recover your pass phrase, please change it, so that do don\'t get locked out of your encrypted messages.');
    }
  });

  $('.action_change_passphrase').click(function () {
    show_settings_page('/chrome/settings/modules/change_passphrase.htm');
  });

})();