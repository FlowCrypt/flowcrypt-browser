'use strict';

var url_params = get_url_params(['account_email', 'signal_scope', 'from', 'to', 'subject', 'frame_id', 'thread_id']);
// todo: use account_email as opposed to from - differentiate the two

signal_scope_set(url_params['signal_scope']);

$('div#reply_message_prompt, p#reply_links, a#a_reply, a#a_reply_all, a#a_forward').click(function(){
  $('div#reply_message_prompt').css('display', 'none');
  $('div#reply_message_table_container').css('display', 'block');
  on_reply_message_render();
});

function reply_message_close() {
  signal_send('gmail_tab', 'close_reply_message', {frame_id: url_params['frame_id'], thread_id: url_params['thread_id']});
}

function reply_message_reinsert_reply_box() {
  var signal_data = {
    account_email: url_params['account_email'],
    last_message_frame_height: $('#reply_message_successful_container').height(),
    last_message_frame_id: url_params['frame_id'],
    my_email: url_params['from'],
    their_email: url_params['to'],
  };
  signal_send('gmail_tab', 'reinsert_reply_box', signal_data);
}

function reply_message_render_success() {
  $('#reply_message_table_container').css('display', 'none');
  $('#reply_message_successful_container div.replied_from').text(url_params['from']);
  $('#reply_message_successful_container div.replied_to span').text(url_params['to']);
  $('#reply_message_successful_container div.replied_body').html($('#input_text').html());
  var t = new Date();
  var time = ((t.getHours() != 12) ? (t.getHours() % 12) : 12) + ':' + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
  $('#reply_message_successful_container div.replied_time').text(time);
  $('#reply_message_successful_container').css('display', 'block');
}

function reply_message_send_through_gmail_api(account_email, to, subject, text, thread_id) {
  gmail_api_message_send(account_email, to, subject, thread_id, text, function(success, response){
    if (success) {
      reply_message_render_success();
      reply_message_reinsert_reply_box();
    }
    else {
      alert('error sending message, check log');
    }
  });
}

function new_message_encrypt_and_send(){
  var to = $('#input_to').val();
  var subject = url_params['subject'];
  var plaintext = $('#input_text').html();
  compose_encrypt_and_send(to, subject, plaintext, function(message_text_to_send) {
    reply_message_send_through_gmail_api(url_params['account_email'], to, subject, message_text_to_send, url_params['thread_id']);
  });
}

function on_reply_message_render(){
  $("#input_to").blur(compose_render_email_secure_or_insecure);
  $("#input_to").focus(compose_render_email_neutral);
  $('#send_btn').click(new_message_encrypt_and_send);
  $("#input_to").focus();
  $("#input_to").val(url_params['to']);
  document.getElementById ("input_text").focus();
}
