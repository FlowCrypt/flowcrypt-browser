/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

let url_params = tool.env.url_params(['account_email', 'longid']);

$('.action_show_public_key').attr('href', tool.env.url_create('my_key.htm', url_params));
let input_private_key = $('.input_private_key');
let prv_headers = tool.crypto.armor.headers('private_key');

window.flowcrypt_storage.keys_get(url_params.account_email, url_params.longid || 'primary').then(keyinfo => {

  if(keyinfo === null) {
    return $('body').text('Key not found. Is FlowCrypt well set up? Contact us at human@flowcrypt.com for help.');
  }

  $('.email').text(url_params.account_email);
  $('.key_words').text(keyinfo.keywords).attr('title', keyinfo.longid);
  input_private_key.attr('placeholder', input_private_key.attr('placeholder') + ' (' + keyinfo.longid + ')');

  $('.action_update_private_key').click(tool.ui.event.prevent(tool.ui.event.double(), () => {
    let updated_key = openpgp.key.readArmored(input_private_key.val()).keys[0];
    let updated_passphrase = $('.input_passphrase').val();
    if(typeof updated_key === 'undefined') {
      alert('Private key is not correctly formated. Please insert complete key, including "' + prv_headers.begin + '" and "' + prv_headers.end + '"\n\nEnter the private key you previously used. The corresponding public key is registered with your email, and the private key is needed to confirm this change.\n\nIf you chose to download your backup as a file, you should find it inside that file. If you backed up your key on Gmail, you will find there it by searching your inbox.');
    } else if(updated_key.isPublic()) {
      alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prv_headers.begin + '"');
    } else if(tool.crypto.key.fingerprint(updated_key) !== tool.crypto.key.fingerprint(keyinfo.public)) {
      alert('This key ' + tool.crypto.key.longid(updated_key) + ' does not match your current key ' + keyinfo.longid);
    } else if(!tool.crypto.key.decrypt(updated_key, updated_passphrase).success) {
      alert('The pass phrase does not match.\n\nPlease enter pass phrase of the newly updated key.');
    } else {
      window.flowcrypt_storage.passphrase_get(url_params.account_email, keyinfo.longid, true).then(stored_passphrase => {
        Promise.all([ // update key and pass phrase
          window.flowcrypt_storage.keys_add(url_params.account_email, openpgp.key.readArmored(input_private_key.val()).keys[0].armor()),
          window.flowcrypt_storage.passphrase_save('local', url_params.account_email, keyinfo.longid, stored_passphrase !== null ? updated_passphrase : undefined),
          window.flowcrypt_storage.passphrase_save('session', url_params.account_email, keyinfo.longid, stored_passphrase !== null ? undefined : updated_passphrase),
        ]).then(() => {
          alert('Public and private key updated.\n\nPlease send updated PUBLIC key to human@flowcrypt.com to update Attester records.');
          window.location = tool.env.url_create('my_key.htm', url_params);
        });
      });
    }
  }));

});