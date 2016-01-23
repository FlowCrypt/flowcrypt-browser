

function new_message_close(){
  send_signal('close_new_message', 'new_message_frame', 'gmail_tab', {'gmail_tab_url': document.referrer});
}

function new_message_send_through_gmail_api(to, subject, text){
  console.log('new_message_send_through_gmail_api inside');
  gmail_api_message_send(account, to, subject, null, text, function(success, response){
    console.log('gmail_api_message_send callback inside');
    if (success) {
      console.log('gmail_api_message_send callback success');
      new_message_close();
    }
    else {
      alert('error sending message, check log');
    }
  });
}

function new_message_encrypt_and_send(){
  var to = $('#input_to').val();
  var subject = $('#input_subject').val();
  var plaintext = $('#input_text').html();
  var keys = [];
  if($('#send_btn.button_secure').length > 0) {
    var key_to = pubkey_cache_get(to);
    if(key_to === null){
      alert('error: key is undefined although should exist');
      return;
    }
    keys.push(key_to.key);
  }
  if (to == ''){
    alert('Please add receiving email address.');
    return;
  } else if ((plaintext != '' || window.prompt('Send empty message?')) && (subject != '' || window.prompt('Send without a subject?'))) {
    try {
      if (keys.length > 0) {
        if (localStorage.master_public_key) {
          keys.push(localStorage.master_public_key);
        }
        encrypt(keys, plaintext, function(encrypted) {
          console.log('inside encrypt() callback');
          new_message_send_through_gmail_api(to, subject, encrypted);
        });
      } else {
        new_message_send_through_gmail_api(to, subject, plaintext);
      }
    } catch(err) {
      alert(err);
    }
  }
}

function on_new_message_render(){
  $("#input_to").blur(compose_render_email_secure_or_insecure);
  $("#input_to").focus(compose_render_email_neutral);
  $('#send_btn').click(new_message_encrypt_and_send);
  $('.close_new_message').click(new_message_close);
}
on_new_message_render();
