'use strict';

var url_params = get_url_params(['account_email', 'signal_scope']);

signal_scope_set(url_params['signal_scope']);

function new_message_close() {
  signal_send('gmail_tab', 'close_new_message');
}

function new_message_send_through_gmail_api(account_email, to, subject, text) {
  gmail_api_message_send(account_email, to, subject, null, text, {}, function(success, response) {
    if(success) {
      new_message_close();
    } else {
      alert('error sending message, check log');
    }
  });
}

function new_message_encrypt_and_send() {
  var to = $('#input_to').val();
  var subject = $('#input_subject').val();
  var plaintext = $('#input_text').html();
  compose_encrypt_and_send(to, subject, plaintext, function(message_text_to_send) {
    new_message_send_through_gmail_api(url_params['account_email'], to, subject, message_text_to_send);
  });
}

function select_contact() {
  $('#input_to').focus();
  $('#input_to').val($(this).text().trim());
  hide_contacts();
  $('#input_subject').focus();
}

function search_contacts() {
  var query = $(this).val().trim();
  if(query !== '') {
    var found = pubkey_cache_search(query, 6, true);
    if(found.length > 0) {
      var ul_html = '';
      for(var i = 0; i < found.length; i++) {
        ul_html += '<li><i class="fa fa-lock"></i>' + found[i] + '</li>';
      }
      $('#contacts ul').html(ul_html);
      $('#contacts ul li').click(select_contact);
      $('#contacts').css('display', 'block');
    }
    else {
      hide_contacts();
    }
  } else {
    hide_contacts();
  }
}

function hide_contacts() {
  $('#contacts').css('display', 'none');
}

function on_new_message_render() {
  $("#input_to").focus(compose_render_email_neutral);
  $('#input_to').keyup(search_contacts);
  $("#input_to").blur(compose_render_email_secure_or_insecure);
  $('#send_btn').click(new_message_encrypt_and_send);
  $('.close_new_message').click(new_message_close);
  $('table#compose').click(hide_contacts);
}
on_new_message_render();
