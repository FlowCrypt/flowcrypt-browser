/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

tool.ui.passphrase_toggle(['password']);

var key;
tool.each(private_keys_get(url_params.account_email), function (i, keyinfo) {
  if(keyinfo.primary) {
    key = openpgp.key.readArmored(keyinfo.armored).keys[0];
  }
});

$('.action_verify').click(function () {
  if(tool.crypto.key.decrypt(key, $('#password').val()).success) {
    $('#content').html('<div class="line">Your pass phrase matches. Good job! You\'re all set.</div><div class="line"><div class="button green close">close</div></div>');
    $('.close').click(function () {
      tool.browser.message.send(url_params.parent_tab_id, 'close_page');
    });
  } else {
    alert('Pass phrase did not match. Please try again. If you are not able to recover your pass phrase, please change it, so that do don\'t get locked out of your encrypted messages.');
  }
});

$('.action_change_passphrase').click(function () {
  show_settings_page('/chrome/settings/modules/change_passphrase.htm');
});
