
var url_params = get_url_params(['from', 'to', 'frame_id']);

$('div#reply_message_prompt, p#reply_links, a#a_reply, a#a_reply_all, a#a_forward').click(function(){
  $('div#reply_message_prompt').css('display', 'none');
  $('div#reply_message_table_container').css('display', 'block');
  on_reply_message_render();
});


function new_message_close(){
	send_signal('close_new_message', 'new_message_frame', 'gmail_tab', {'gmail_tab_url': document.referrer});
}

function new_message_send_through_gmail_api(to, subject, text){
  gmail_api_message_send(account, to, subject, text, function(success, response){
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
  var keys = [];
  if($('#send_btn.button_secure').length > 0) {
    var key_to = pubkey_cache_get(to);
    if(key_to === null){
      alert('error: key is undefined although should exist');
      return;
    }
		keys.push(key_to);
  }
  if (to == ''){
    alert('Please add receiving email address.');
    return;
  } else if ((plaintext != '' || window.prompt('Send empty message?')) && (subject != '' || window.prompt('Send without a subject?'))) {
    try {
      if (keys.length > 0) {
				var my_key = pubkey_cache_get(account);
				if (my_key !== null) {
					keys.push(my_key);
				}
        encrypt(keys, plaintext, function(encrypted) {
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

function on_reply_message_render(){
	$("#input_to").blur(compose_render_email_secure_or_insecure);
	$("#input_to").focus(compose_render_email_neutral);
	$('#send_btn').click(new_message_encrypt_and_send);
  $("#input_to").focus();
  $("#input_to").val(url_params['to']);
  document.getElementById("input_text").focus();
}
