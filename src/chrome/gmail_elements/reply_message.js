'use strict';

var url_params = get_url_params(['account_email', 'from', 'to', 'subject', 'frame_id', 'thread_id', 'parent_tab_id', 'skip_click_prompt']);
var original_reply_message_prompt = undefined;
var thread_message_id_last = '';
var thread_message_referrences_last = '';
var passphrase_interval = undefined;
url_params.skip_click_prompt = Boolean(Number(url_params.skip_click_prompt || ''));

// show decrypted draft if available for this thread
account_storage_get(url_params.account_email, ['drafts_reply'], function(storage) {
  if(storage.drafts_reply && storage.drafts_reply[url_params.thread_id]) { // there is a draft
    original_reply_message_prompt = $('div#reply_message_prompt').html();
    $('div#reply_message_prompt').html(get_spinner() + ' Loading draft');
    gmail_api_draft_get(url_params.account_email, storage.drafts_reply[url_params.thread_id], 'raw', function(success, response) {
      if(success) {
        draft_set_id(storage.drafts_reply[url_params.thread_id]);
        parse_mime_message(base64url_decode(response.message.raw), function(mime_success, parsed_message) {
          if(success) {
            if((parsed_message.text || strip_pgp_armor(parsed_message.html) || '').indexOf('-----END PGP MESSAGE-----') !== -1) {
              var stripped_text = parsed_message.text || strip_pgp_armor(parsed_message.html);
              decrypt_and_render_draft(url_params.account_email, stripped_text.substr(stripped_text.indexOf('-----BEGIN PGP MESSAGE-----')), reply_message_render_table); // todo - regex is better than random clipping
            } else {
              console.log('gmail_api_draft_get parse_mime_message else {}');
              reply_message_render_table();
            }
          } else {
            console.log('gmail_api_draft_get parse_mime_message success===false');
            console.log(parsed_message);
            reply_message_render_table();
          }
        });
      } else {
        reply_message_render_table();
        console.log('gmail_api_draft_get success===false');
        console.log(response);
      }
    });
  } else { //no draft available
    if(!url_params.skip_click_prompt) {
      $('div#reply_message_prompt').click(reply_message_render_table);
    } else {
      reply_message_render_table();
    }
  }
});

function check_passphrase_entered(encrypted_draft) {
  if(get_passphrase(url_params.account_email) !== null) {
    clearInterval(passphrase_interval);
    decrypt_and_render_draft(url_params.account_email, encrypted_draft, reply_message_render_table);
  }
}


function reply_message_render_table() {
  $('div#reply_message_prompt').css('display', 'none');
  $('div#reply_message_table_container').css('display', 'block');
  reply_message_on_render();
  reply_message_determine_header_variables();
}

function reply_message_determine_header_variables() {
  gmail_api_get_thread(url_params.account_email, url_params.thread_id, 'full', function(success, thread) {
    if(success && thread.messages && thread.messages.length > 0) {
      thread_message_id_last = gmail_api_find_header(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
      thread_message_referrences_last = gmail_api_find_header(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
    }
  });
}

$('.delete_draft').click(function() {
  draft_delete(url_params.account_email, function() {
    chrome_message_send(url_params.parent_tab_id, 'close_reply_message', {
      frame_id: url_params.frame_id,
      thread_id: url_params.thread_id
    });
  });
});

function reply_message_reinsert_reply_box() {
  chrome_message_send(url_params.parent_tab_id, 'reinsert_reply_box', {
    account_email: url_params.account_email,
    last_message_frame_height: $('#reply_message_successful_container').height(),
    last_message_frame_id: url_params.frame_id,
    my_email: url_params.from,
    their_email: url_params.to,
  });
}

function reply_message_render_success(has_attachments, message_id) {
  draft_delete(url_params.account_email); // todo - handle errors + retry. Otherwise unwanted drafts might show at times after sending a msg
  $('#reply_message_table_container').css('display', 'none');
  $('#reply_message_successful_container div.replied_from').text(url_params.from);
  $('#reply_message_successful_container div.replied_to span').text(url_params.to);
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
  var recipients = get_recipients_from_dom();
  var headers = {
    'To': recipients.join(', '),
    'From': url_params.from,
    'Subject': url_params.subject,
    'In-Reply-To': thread_message_id_last,
    'References': thread_message_referrences_last + ' ' + thread_message_id_last,
  };
  var plaintext = convert_html_tags_to_newlines($('#input_text').html());
  compose_encrypt_and_send(url_params.account_email, recipients, headers.Subject, plaintext, function(encrypted_message_text_to_send, attachments) {
    to_mime(url_params.account_email, encrypted_message_text_to_send, headers, attachments, function(mime_message) {
      gmail_api_message_send(url_params.account_email, mime_message, url_params.thread_id, function(success, response) {
        if(success) {
          reply_message_render_success((attachments || []).length > 0, response.id);
          reply_message_reinsert_reply_box();
        } else {
          handle_send_message_error(response);
        }
      });
    });
  });
}

function resize_input_text_width() {
  $('div#input_text').css('max-width', ($('body').width() - 20) + 'px');
}

function reply_message_on_render() {
  $('#input_to').val(url_params.to + ','); // the space causes the last email to be also evaluated
  compose_on_render();
  $("#input_to").focus();
  $('#send_btn').click(prevent(doubleclick(), send_btn_click));
  $('#input_text').focus();
  document.getElementById("input_text").focus();
  compose_evaluate_receivers();
  setTimeout(function() {
    $(window).resize(prevent(spree(), resize_input_text_width));
  }, 1000);
  resize_input_text_width();
}
