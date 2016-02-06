'use strict';

var url_params = get_url_params(['account_email', 'signal_scope']);

signal_scope_set(url_params['signal_scope']);

function new_message_close(){
  signal_send('gmail_tab', 'close_new_message', {'gmail_tab_url': document.referrer});
}

function new_message_send_through_gmail_api(account_email, to, subject, text){
  gmail_api_message_send(account_email, to, subject, null, text, function(success, response){
    if (success) {
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
  compose_encrypt_and_send(to, subject, plaintext, function(message_text_to_send) {
    new_message_send_through_gmail_api(url_params['account_email'], to, subject, message_text_to_send);
  });
}

function on_new_message_render(){
  $("#input_to").blur(compose_render_email_secure_or_insecure);
  $("#input_to").focus(compose_render_email_neutral);
  $('#send_btn').click(new_message_encrypt_and_send);
  $('.close_new_message').click(new_message_close);
}
on_new_message_render();
