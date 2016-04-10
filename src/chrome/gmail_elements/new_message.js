'use strict';

var url_params = get_url_params(['account_email', 'parent_tab_id']);

function new_message_close() {
  chrome_message_send(url_params.parent_tab_id, 'close_new_message');
}

function send_btn_click() {
  var recipients = get_recipients_from_dom();
  var headers = {
    'To': recipients.join(', '),
    'Subject': $('#input_subject').val(),
  };
  if($('#input_from').length) {
    headers['From'] = $('#input_from').val();
  } else {
    headers['From'] = url_params['account_email'];
  }
  var plaintext = convert_html_tags_to_newlines($('#input_text').html());
  compose_encrypt_and_send(url_params['account_email'], recipients, headers['Subject'], plaintext, function(message_text_to_send, attachments) {
    gmail_api_message_send(url_params['account_email'], message_text_to_send, headers, attachments, null, function(success, response) {
      if(success) {
        new_message_close();
      } else {
        handle_send_message_error(response);
      }
    });
  });
}

function order_addresses(account_email, addresses) {
  return [account_email].concat(array_without_value(addresses, account_email)); //places main account email as first
}

function on_new_message_render() {
  $("#input_to").focus(function() {
    compose_render_pubkey_result($(this).val(), undefined);
  });
  $('#input_to').keyup(render_receivers);
  $('#input_to').keyup(search_contacts);
  $("#input_to").blur(render_receivers);
  $('#send_btn').click(prevent(doubleclick(), send_btn_click));
  $('.close_new_message').click(new_message_close);
  $('table#compose').click(hide_contacts);
  $('.bottom .icon.attach').click();
  initialize_attach_dialog();
  account_storage_get(url_params['account_email'], ['addresses'], function(storage) {
    if(typeof storage.addresses !== 'undefined' && storage.addresses.length > 1) {
      var addresses = order_addresses(url_params.account_email, storage.addresses);
      $('#input_addresses_container').addClass('show_send_from').append('<select id="input_from" tabindex="-1"></select>');
      $.each(addresses, function(i, address) {
        $('#input_from').append('<option value="' + address + '">' + address + '</option>');
      });
    }
  });
}
on_new_message_render();
