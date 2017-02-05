/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'parent_tab_id']);

tool.ui.passphrase_toggle(['input_passphrase']);

var private_keys = private_keys_get(url_params.account_email);
var private_keys_long_ids = [];
$.each(private_keys, function (i, keyinfo) {
  private_keys_long_ids.push(keyinfo.longid);
});

$('.action_add_private_key').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
  var new_key = openpgp.key.readArmored($('#step_2b_manual_enter .input_private_key').val()).keys[0];
  var passphrase = $('#step_2b_manual_enter .input_passphrase').val();
  var prv_headers = tool.crypto.armor.headers('private_key');
  if(typeof new_key === 'undefined') {
    alert('Private key is not correctly formated. Please insert complete key, including "' + prv_headers.begin + '" and "' + prv_headers.end + '"');
  } else {
    var new_key_longid = tool.crypto.key.longid(new_key);
    if(new_key.isPublic()) {
      alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prv_headers.begin + '"');
    } else if(!new_key_longid) {
      alert('This key may not be compatible. Please write me at tom@cryptup.org and let me know which software created this key, so that I can fix it.\n\n(error: cannot get long_id)');
    } else if(tool.value(new_key_longid).in(private_keys_long_ids)) {
      alert('This is one of your current keys.');
    } else {
      var decrypt_result = tool.crypto.key.decrypt(new_key, passphrase);
      if(decrypt_result === false) {
        alert('The pass phrase does not match. Please try a different pass phrase.');
      } else if(decrypt_result === true) {
        private_keys_add(url_params.account_email, $('#step_2b_manual_enter .input_private_key').val());
        if($('#step_2b_manual_enter .input_passphrase_save').prop('checked')) {
          save_passphrase('local', url_params.account_email, new_key_longid, passphrase);
        } else {
          save_passphrase('session', url_params.account_email, new_key_longid, passphrase);
        }
        tool.browser.message.send(url_params.parent_tab_id, 'reload', {
          advanced: true,
        });
      } else {
        alert('This key type may not be supported by CryptUp. Please write me at tom@cryptup.org to let me know which software created this key, so that I can add support soon. (subkey decrypt error: ' + decrypt_result.message + ')');
      }
    }
  }
}));
