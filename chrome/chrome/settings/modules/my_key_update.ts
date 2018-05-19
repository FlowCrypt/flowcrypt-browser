/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'longid']);

  let url_my_key_page = tool.env.url_create('my_key.htm', url_params);
  $('.action_show_public_key').attr('href', url_my_key_page);
  let input_private_key = $('.input_private_key');
  let prv_headers = tool.crypto.armor.headers('private_key');
  
  Store.keys_get(url_params.account_email as string, [url_params.longid as string || 'primary']).then(([primary_ki]) => {
  
    abort_and_render_error_if_keyinfo_empty(primary_ki);
  
    $('.email').text(url_params.account_email as string);
    $('.key_words').text(primary_ki.keywords).attr('title', primary_ki.longid);
    input_private_key.attr('placeholder', input_private_key.attr('placeholder') + ' (' + primary_ki.longid + ')');
  
    $('.action_update_private_key').click(tool.ui.event.prevent(tool.ui.event.double(), () => {
      let updated_key = openpgp.key.readArmored(input_private_key.val()).keys[0];
      let updated_key_encrypted = openpgp.key.readArmored(input_private_key.val()).keys[0];
      let updated_key_passphrase = $('.input_passphrase').val() as string;
      if(typeof updated_key === 'undefined') {
        alert('Private key is not correctly formated. Please insert complete key, including "' + prv_headers.begin + '" and "' + prv_headers.end + '"\n\nEnter the private key you previously used. The corresponding public key is registered with your email, and the private key is needed to confirm this change.\n\nIf you chose to download your backup as a file, you should find it inside that file. If you backed up your key on Gmail, you will find there it by searching your inbox.');
      } else if(updated_key.isPublic()) {
        alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prv_headers.begin + '"');
      } else if(tool.crypto.key.fingerprint(updated_key) !== tool.crypto.key.fingerprint(primary_ki.public)) {
        alert('This key ' + tool.crypto.key.longid(updated_key) + ' does not match your current key ' + primary_ki.longid);
      } else if(!tool.crypto.key.decrypt(updated_key, updated_key_passphrase).success) {
        alert('The pass phrase does not match.\n\nPlease enter pass phrase of the newly updated key.');
      } else {
        if(updated_key.getEncryptionKeyPacket() !== null) {
          store_updated_key_and_passphrase(updated_key_encrypted, updated_key_passphrase);
        } else { // cannot get a valid encryption key packet
          if((updated_key.verifyPrimaryKey() === openpgp.enums.keyStatus.no_self_cert) || tool.crypto.key.expired_for_encryption(updated_key)) { // known issues - key can be fixed
            render_prv_compatibility_fix_ui('.compatibility_fix_container', updated_key_encrypted, updated_key_passphrase, url_my_key_page, (fixed_encrypted_prv) => {
              store_updated_key_and_passphrase(fixed_encrypted_prv, updated_key_passphrase);
            });
          } else {
            alert('Key update: This looks like a valid key but it cannot be used for encryption. Please write me at human@flowcrypt.com to see why is that. I\'m VERY prompt to respond.');
            window.location.href = url_my_key_page;
          }
        }
      }
    }));
  
    function store_updated_key_and_passphrase(updated_prv: OpenpgpKey, updated_prv_passphrase: string) {
      Store.passphrase_get(url_params.account_email as string, primary_ki.longid, true).then((stored_passphrase: string) => {
        Promise.all([ // update key and pass phrase
          Store.keys_add(url_params.account_email as string, updated_prv.armor()),
          Store.passphrase_save('local', url_params.account_email as string, primary_ki.longid, stored_passphrase !== null ? updated_prv_passphrase : undefined),
          Store.passphrase_save('session', url_params.account_email as string, primary_ki.longid, stored_passphrase !== null ? undefined : updated_prv_passphrase),
        ]).then(() => {
          alert('Public and private key updated.\n\nPlease send updated PUBLIC key to human@flowcrypt.com to update Attester records.');
          window.location.href = url_my_key_page;
        });
      });
  
    }
  
  });

})();