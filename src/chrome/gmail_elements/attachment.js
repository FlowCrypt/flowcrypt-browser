'use strict';

var url_params = get_url_params(['account_email', 'message_id', 'attachment_id', 'name', 'type', 'size']);

$('#type').text(url_params.type);
$('#name').text(url_params.name);

function download_file(filename, type, data) {
  var element = document.createElement('a');
  element.setAttribute('href', 'data:' + type + ';base64,' + btoa(data));
  element.setAttribute('download', filename);
  element.style.display = 'none';
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
}

$('#download').click(prevent(doubleclick(), function(self) {
  var original_content = $(self).html();
  $(self).html(get_spinner())
  gmail_api_message_attachment_get(url_params.account_email, url_params.message_id, url_params.attachment_id, function(success, attachment) {
    $(self).html(original_content);
    if(success) {
      var encrypted_data = base64url_decode(attachment.data);
      // todo - following lines pretty much copy/pasted from pgp_block.js. Would use a common function in gmail_elements.js
      var my_prvkey = restricted_account_storage_get(url_params.account_email, 'master_private_key');
      var my_passphrase = restricted_account_storage_get(url_params.account_email, 'master_passphrase');
      if(typeof my_prvkey !== 'undefined') {
        var private_key = openpgp.key.readArmored(my_prvkey).keys[0];
        if(typeof my_passphrase !== 'undefined' && my_passphrase !== '') {
          private_key.decrypt(my_passphrase);
        }
        try {
          if(encrypted_data.match(/-----BEGIN PGP MESSAGE-----/)) {
            var options = {
              message: openpgp.message.readArmored(encrypted_data),
              privateKey: private_key, // for decryption
              format: 'binary',
            };
          } else {
            var options = {
              message: openpgp.message.read(str_to_uint8(encrypted_data)),
              privateKey: private_key, // for decryption
              format: 'binary',
            };
          }
          openpgp.decrypt(options).then(function(decrypted) {
            download_file(url_params.name.replace(/(\.pgp)|(\.gpg)$/, ''), url_params.type, uint8_to_str(decrypted.data)); // plaintext.filename
          }).catch(function(error) {
            $('body.attachment').html('Error opening file<br>Downloading original..');
            download_file(url_params.name, url_params.type, encrypted_data);
          });
        } catch(err) {
          $('body.attachment').html('Badly formatted file<br>Downloading original..<br>' + err.message);
          download_file(url_params.name, url_params.type, encrypted_data);
        }
      } else {
        set_frame_content_and_resize('No private key<br>Downloading original..');
        download_file(url_params.name, url_params.type, encrypted_data);
      }
    }
  });
}));
