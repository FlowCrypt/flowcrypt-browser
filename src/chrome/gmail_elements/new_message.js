'use strict';

var url_params = get_url_params(['account_email', 'parent_tab_id', 'draft_id', 'placement']);

if(url_params.placement === 'popup') {
  $('body').addClass('popup');
}

function new_message_close() {
  if(url_params.placement === 'settings') {
    chrome_message_send(url_params.parent_tab_id, 'close_page');
  } else if(url_params.placement === 'popup') {
    window.close();
  } else {
    chrome_message_send(url_params.parent_tab_id, 'close_new_message');
  }
}

$('.delete_draft').click(function() {
  draft_delete(url_params.account_email, new_message_close);
});

if(url_params.draft_id) {
  // todo - this is mostly copy/pasted from reply_message, would deserve a common function
  gmail_api_draft_get(url_params.account_email, url_params.draft_id, 'raw', function(success, response) {
    if(success) {
      draft_set_id(url_params.draft_id);
      parse_mime_message(base64url_decode(response.message.raw), function(mime_success, parsed_message) {
        if(success) {
          var draft_headers = mime_headers_to_from(parsed_message);
          if((parsed_message.text || strip_pgp_armor(parsed_message.html) || '').indexOf('-----END PGP MESSAGE-----') !== -1) {
            var stripped_text = parsed_message.text || strip_pgp_armor(parsed_message.html);
            $('#input_subject').val(parsed_message.headers.subject || '');
            decrypt_and_render_draft(url_params.account_email, stripped_text.substr(stripped_text.indexOf('-----BEGIN PGP MESSAGE-----')), undefined, draft_headers);
          } else {
            console.log('gmail_api_draft_get parse_mime_message else {}');
          }
        } else {
          console.log('gmail_api_draft_get parse_mime_message success===false');
          console.log(parsed_message);
        }
      });
    } else {
      console.log('gmail_api_draft_get success===false');
      console.log(response);
    }
  });
}

function send_btn_click() {
  var recipients = get_recipients_from_dom();
  var headers = {
    To: recipients.join(', '),
    Subject: $('#input_subject').val(),
    From: get_sender_from_dom(),
  };
  var plaintext = convert_html_tags_to_newlines($('#input_text').html());
  compose_encrypt_and_send(url_params.account_email, recipients, headers.Subject, plaintext, function(encrypted_message_body, attachments) {
    to_mime(url_params.account_email, encrypted_message_body, headers, attachments, function(mime_message) {
      gmail_api_message_send(url_params.account_email, mime_message, null, function(success, response) {
        if(success) {
          chrome_message_send(url_params.parent_tab_id, 'notification_show', {
            notification: 'Your message has been sent.'
          });
          draft_delete(url_params.account_email, increment_metric('compose', new_message_close));
        } else {
          handle_send_message_error(response);
        }
      });
    });
  });
}

function order_addresses(account_email, addresses) {
  return [account_email].concat(array_without_value(addresses, account_email)); //places main account email as first
}

function on_new_message_render() {
  compose_on_render();
  $('#send_btn').click(prevent(doubleclick(), send_btn_click));
  $('.close_new_message').click(new_message_close);
  $('.do_not_include_pubkey').click(function() {
    $('#send_pubkey_container').css('display', 'none').css('visibility', 'hidden');
  });
  account_storage_get(url_params.account_email, ['addresses'], function(storage) { // add send-from addresses
    if(typeof storage.addresses !== 'undefined' && storage.addresses.length > 1) {
      var addresses = order_addresses(url_params.account_email, storage.addresses);
      $('#input_addresses_container').addClass('show_send_from').append('<select id="input_from" tabindex="-1"></select>');
      $('#input_from').change(compose_show_hide_send_pubkey_container);
      $.each(addresses, function(i, address) {
        $('#input_from').append('<option value="' + address + '">' + address + '</option>');
      });
    }
  });
}
on_new_message_render();
