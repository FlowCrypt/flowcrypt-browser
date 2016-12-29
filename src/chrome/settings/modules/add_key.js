'use strict';

var url_params = get_url_params(['account_email', 'parent_tab_id']);

var private_keys = private_keys_get(url_params.account_email);
var private_keys_long_ids = [];
$.each(private_keys, function(i, keyinfo) {
  private_keys_long_ids.push(keyinfo.longid);
});

$('.action_add_private_key').click(prevent(doubleclick(), function() {
  var new_key = openpgp.key.readArmored($('#step_2b_manual_enter .input_private_key').val()).keys[0];
  if(typeof new_key === 'undefined') {
    alert('Private key is not properly formatted. Please insert complete key, including "-----BEGIN PGP PRIVATE KEY BLOCK-----" and "-----END PGP PRIVATE KEY BLOCK-----"');
  } else {
    var new_key_longid = key_longid(new_key);
    if(new_key.isPublic()) {
      alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "-----BEGIN PGP PRIVATE KEY BLOCK-----"');
    } else if(!new_key_longid) {
      alert('This key may not be compatible. Please write me at tom@cryptup.org and let me know which software created this key, so that I can fix it.\n\n(error: cannot get long_id)');
    } else if(private_keys_long_ids.indexOf(new_key_longid) !== -1) {
      alert('This is one of your current keys.');
    } else if(new_key.decrypt($('.input_passphrase').val()) === false) {
      alert('The pass phrase does not match. Please try a different pass phrase.');
    } else {
      private_keys_add(url_params.account_email, $('#step_2b_manual_enter .input_private_key').val());
      if($('#step_2b_manual_enter .input_passphrase_save').prop('checked')) {
        save_passphrase('local', url_params.account_email, new_key_longid, $('.input_passphrase').val());
      } else {
        save_passphrase('session', url_params.account_email, new_key_longid, $('.input_passphrase').val());
      }
      chrome_message_send(url_params.parent_tab_id, 'reload', {
        advanced: true,
      });
    }
  }
}));
