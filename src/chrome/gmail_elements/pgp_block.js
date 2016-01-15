
var pgp_armored_message = decodeURIComponent(window.location.search.replace('?message=', ''));

if (typeof localStorage.master_private_key !== 'undefined') {
  var private_key = openpgp.key.readArmored(localStorage.master_private_key).keys[0];
  if (typeof localStorage.master_passphrase !== 'undefined' && sessionStorage.master_passphrase !== ''){
    private_key.decrypt(localStorage.master_passphrase);
  }
  var pgp_message = openpgp.message.readArmored(pgp_armored_message);
  openpgp.decryptMessage(private_key, pgp_message).then(function(plaintext) {
    $('#pgp_block').html(plaintext);
  }).catch(function(error) {
    $('#pgp_block').html('<div style="color:red">error decrypting message</div><br>');
  });
}
else {
  $('#pgp_block').html('<div style="color:red">no private key set yet to decrypt this message</div><br>');
}
