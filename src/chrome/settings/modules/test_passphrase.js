'use strict';

var url_params = get_url_params(['account_email', 'parent_tab_id']);

var original_passphrase = get_passphrase(url_params.account_email);

$('.action_verify').click(function() {
  if($('#password').val() === original_passphrase) {
    $('#content').html('<div class="line">Your pass phrase matches. Good job! You\'re all set.</div><div class="line"><div class="button green close">close</div></div>');
    $('.close').click(function() {
      chrome_message_send(url_params.parent_tab_id, 'close_page');
    });
  } else {
    alert('Pass phrase did not match. Please try again. If you are not able to recover your pass phrase, please change it, so that do don\'t get locked out of your encrypted messages.');
  }

});

$('.action_change_passphrase').click(function() {
  show_settings_page('/chrome/settings/modules/change_passphrase.htm');
});
