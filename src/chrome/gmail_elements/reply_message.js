'use strict';

var url_params = get_url_params(['account_email', 'from', 'to', 'subject', 'frame_id', 'thread_id', 'parent_tab_id']);

var thread_message_id_last = '';
var thread_message_referrences_last = '';

$('div#reply_message_prompt').click(function() {
  $('div#reply_message_prompt').css('display', 'none');
  $('div#reply_message_table_container').css('display', 'block');
  reply_message_on_render();
  reply_message_determine_header_variables();
});

function reply_message_determine_header_variables() {
  gmail_api_get_thread(url_params['account_email'], url_params['thread_id'], 'full', function(success, thread) {
    if(success && thread.messages && thread.messages.length > 0) {
      thread_message_id_last = gmail_api_find_header(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
      thread_message_referrences_last = gmail_api_find_header(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
    }
  });
}

function reply_message_close() {
  chrome_message_send(url_params.parent_tab_id, 'close_reply_message', {
    frame_id: url_params['frame_id'],
    thread_id: url_params['thread_id']
  });
}

function reply_message_reinsert_reply_box() {
  chrome_message_send(url_params.parent_tab_id, 'reinsert_reply_box', {
    account_email: url_params['account_email'],
    last_message_frame_height: $('#reply_message_successful_container').height(),
    last_message_frame_id: url_params['frame_id'],
    my_email: url_params['from'],
    their_email: url_params['to'],
  });
}

function reply_message_render_success(has_attachments, message_id) {
  $('#reply_message_table_container').css('display', 'none');
  $('#reply_message_successful_container div.replied_from').text(url_params['from']);
  $('#reply_message_successful_container div.replied_to span').text(url_params['to']);
  $('#reply_message_successful_container div.replied_body').html($('#input_text').html());
  var t = new Date();
  var time = ((t.getHours() != 12) ? (t.getHours() % 12) : 12) + ':' + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
  $('#reply_message_successful_container div.replied_time').text(time);
  $('#reply_message_successful_container').css('display', 'block');
  if(has_attachments) {
    gmail_api_message_get(url_params.account_email, message_id, 'full', function(success, gmail_message_object) {
      if(success) {
        $('#attachments').css('display', 'block');
        var attachment_metas = gmail_api_find_attachments(gmail_message_object);
        $.each(attachment_metas, function(i, attachment_meta) {
          $('#attachments').append(pgp_attachment_iframe(url_params.account_email, attachment_meta, []));
        });
      } else {
        console.log('failed to re-show sent attachments'); //todo - handle !success
      }
    });
  }
}

function send_btn_click() {
  var recipients = [];
  $('.recipients span').each(function() {
    recipients.push($(this).text().trim());
  });
  var headers = {
    'To': recipients.join(', '),
    'From': url_params['from'],
    'Subject': url_params['subject'],
    'In-Reply-To': thread_message_id_last,
    'References': thread_message_referrences_last + ' ' + thread_message_id_last,
  };
  var plaintext = convert_html_tags_to_newlines($('#input_text').html());
  compose_encrypt_and_send(url_params['account_email'], recipients, headers['Subject'], plaintext, function(message_text_to_send, attachments) {
    gmail_api_message_send(url_params['account_email'], message_text_to_send, headers, attachments, url_params['thread_id'], function(success, response) {
      if(success) {
        reply_message_render_success((attachments || []).length > 0, response.id);
        reply_message_reinsert_reply_box();
      } else {
        handle_send_message_error(response);
      }
    });
  });
}

function resize_input_text_width() {
  $('div#input_text').css('max-width', ($('body').width() - 20) + 'px');
}

function reply_message_on_render() {
  $('.recipients').append('<span>' + url_params.to + '</span>');
  $("#input_to").focus(function() {
    compose_render_pubkey_result($(this).val(), undefined);
  });
  $('#input_to').keyup(render_receivers);
  $('#input_to').keyup(search_contacts);
  $("#input_to").blur(render_receivers);
  $("#input_to").focus();
  $('#send_btn').click(prevent(doubleclick(), send_btn_click));
  $('#input_text').focus();
  resize_input_to();
  compose_evaluate_receivers();
  document.getElementById("input_text").focus();
  initialize_attach_dialog();
  setTimeout(function() {
    $(window).resize(prevent(spree(), resize_input_text_width));
  }, 1000);
  resize_input_text_width();
}
