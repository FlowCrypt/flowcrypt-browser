
// don't do url because of length limit

var url_data = get_url_params(['frame_id', 'message', 'width']);

function format_plaintext(text){
  // console.log(text);
  if(/<((br)|(div)|p) ?\/?>/.test(text)) {
    return text;
  }
  return text.replace(/\n/g, '<br>\n');
}

function set_frame_content_and_resize(content){
  $('#pgp_block').html(content);
  $('#pgp_block').css({width: url_data['width'], height: 'auto'});
  var new_css = {height: $('#pgp_block').height() + 10};
  send_signal('pgp_block_iframe_set_css', url_data['frame_id'], 'gmail_tab', new_css);
}

if (typeof localStorage.master_private_key !== 'undefined') {
  var private_key = openpgp.key.readArmored(localStorage.master_private_key).keys[0];
  if (typeof localStorage.master_passphrase !== 'undefined' && sessionStorage.master_passphrase !== '') {
    private_key.decrypt(localStorage.master_passphrase);
  }
  var pgp_message = openpgp.message.readArmored(url_data['message']);
  openpgp.decryptMessage(private_key, pgp_message).then(function(plaintext) {
    set_frame_content_and_resize(format_plaintext(plaintext));
  }).catch(function(error) {
    set_frame_content_and_resize('<div style="color:red">[error decrypting message]</div><br>' + url_data['message'].replace(/\r/g, '<br>'));
  });
}
else {
  set_frame_content_and_resize('<div style="color:red">[no private key set yet to decrypt this message]</div><br>' + url_data['message'].replace(/\r/g, '<br>'));
}
