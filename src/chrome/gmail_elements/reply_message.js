/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'from', 'to', 'subject', 'frame_id', 'thread_id', 'thread_message_id', 'parent_tab_id', 'skip_click_prompt', 'ignore_draft']);
url_params.from = url_params.from.toLowerCase();
url_params.to = url_params.to.toLowerCase();

db_open(function (db) {

  if(db === db_denied) {
    notify_about_storage_access_error(url_params.account_email, url_params.parent_tab_id);
    return;
  }

  var GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

  var original_reply_message_prompt = undefined;
  var thread_message_id_last = '';
  var thread_message_referrences_last = '';
  var passphrase_interval = undefined;
  var can_read_emails = undefined;
  url_params.skip_click_prompt = Boolean(Number(url_params.skip_click_prompt || ''));
  url_params.ignore_draft = Boolean(Number(url_params.ignore_draft || ''));

  var attach = init_shared_attach_js();
  var compose = init_shared_compose_js(url_params, db, attach);

  function recover_thread_id_if_missing(callback) {
    if(url_params.thread_id && url_params.thread_id !== url_params.thread_message_id) {
      callback();
    } else {
      gmail_api_message_get(url_params.account_email, url_params.thread_message_id, 'metadata', function (success, gmail_message_object) {
        if(success) {
          url_params.thread_id = gmail_message_object.threadId;
        } else {
          url_params.thread_id = url_params.thread_id || url_params.thread_message_id;
          console.log('CRYPTUP: Substituting thread_id: could cause issues. Value:' + String(url_params.thread_id));
        }
        callback();
      });
    }
  }

  function check_passphrase_entered(encrypted_draft) {
    if(get_passphrase(url_params.account_email) !== null) {
      clearInterval(passphrase_interval);
      compose.decrypt_and_render_draft(url_params.account_email, encrypted_draft, reply_message_render_table);
    }
  }

  function reply_message_render_table(method) {
    if(can_read_emails) {
      $('div#reply_message_prompt').css('display', 'none');
      $('div#reply_message_table_container').css('display', 'block');
      reply_message_on_render();
      reply_message_determine_header_variables(method === 'forward');
    } else {
      $('div#reply_message_prompt').html('CryptUP has limited functionality. Your browser needs to access this conversation to reply.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div><br/><br/>Alternatively, <a href="#" class="new_message_button">compose a new secure message</a> to respond.<br/><br/>');
      $('div#reply_message_prompt').attr('style', 'border:none !important');
      $('.auth_settings').click(function () {
        chrome_message_send(null, 'settings', {
          account_email: url_params.account_email,
          page: '/chrome/settings/modules/auth_denied.htm',
        });
      })
      $('.new_message_button').click(function () {
        chrome_message_send(url_params.parent_tab_id, 'open_new_message');
      });
    }
  }

  function reply_message_determine_header_variables(load_last_message_for_forward) {
    gmail_api_get_thread(url_params.account_email, url_params.thread_id, 'full', function (success, thread) {
      if(success && thread.messages && thread.messages.length > 0) {
        thread_message_id_last = gmail_api_find_header(thread.messages[thread.messages.length - 1], 'Message-ID') || '';
        thread_message_referrences_last = gmail_api_find_header(thread.messages[thread.messages.length - 1], 'In-Reply-To') || '';
        if(load_last_message_for_forward) {
          url_params.subject = 'Fwd: ' + url_params.subject;
          retrieve_decrypt_and_add_forwarded_message(thread.messages[thread.messages.length - 1].id);
        }
      }
    });
  }

  function append_forwarded_message(text) {
    $('#input_text').append('<br/><br/>Forwarded message:<br/><br/>> ' + text.replace(/(?:\r\n|\r|\n)/g, '\> '));
    compose.resize_reply_box();
  }

  function retrieve_decrypt_and_add_forwarded_message(message_id) {
    extract_armored_message_using_gmail_api(url_params.account_email, message_id, 'full', function (armored_message) {
      decrypt(db, url_params.account_email, armored_message, undefined, function (result) {
        if(result.success) {
          if(!could_be_mime_message(result.content.data)) {
            append_forwarded_message(format_mime_plaintext_to_display(result.content.data, armored_message));
          } else {
            parse_mime_message(result.content.data, function (success, mime_parse_result) {
              append_forwarded_message(format_mime_plaintext_to_display(mime_parse_result.text || mime_parse_result.html || result.content.data, armored_message));
            });
          }
        } else {
          $('#input_text').append('<br/>\n<br/>\n<br/>\n' + armored_message.replace(/\n/g, '<br/>\n'));
        }
      });
    }, function (error_type, url_formatted_data_block) {
      if(url_formatted_data_block) {
        $('#input_text').append('<br/>\n<br/>\n<br/>\n' + url_formatted_data_block);
      }
    });
  }

  $('.delete_draft').click(function () {
    compose.draft_delete(url_params.account_email, function () {
      chrome_message_send(url_params.parent_tab_id, 'close_reply_message', {
        frame_id: url_params.frame_id,
        thread_id: url_params.thread_id
      });
    });
  });

  function reply_message_reinsert_reply_box() {
    chrome_message_send(url_params.parent_tab_id, 'reinsert_reply_box', {
      account_email: url_params.account_email,
      my_email: url_params.from,
      subject: url_params.subject,
      their_email: compose.get_recipients_from_dom().join(','),
      thread_id: url_params.thread_id,
    });
  }

  function reply_message_render_success(to, has_attachments, message_id) {
    chrome_message_send(url_params.parent_tab_id, 'notification_show', {
      notification: 'Your message has been sent.'
    });
    $('#send_btn_note').text('Sent, deleting draft..');
    compose.draft_delete(url_params.account_email, function () {
      reply_message_reinsert_reply_box();
      $('.replied_body').css('width', $('table#compose').width() - 30);
      $('#reply_message_table_container').css('display', 'none');
      $('#reply_message_successful_container div.replied_from').text(url_params.from);
      $('#reply_message_successful_container div.replied_to span').text(to);
      $('#reply_message_successful_container div.replied_body').html($('#input_text').get(0).innerText.replace(/\n/g, '<br>'));
      var t = new Date();
      var time = ((t.getHours() != 12) ? (t.getHours() % 12) : 12) + ':' + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
      $('#reply_message_successful_container div.replied_time').text(time);
      $('#reply_message_successful_container').css('display', 'block');
      if(has_attachments) { // todo - will not work with cryptup uploaded attachments. Why extra request, anyway?
        gmail_api_message_get(url_params.account_email, message_id, 'full', function (success, gmail_message_object) {
          if(success) {
            $('#attachments').css('display', 'block');
            var attachment_metas = gmail_api_find_attachments(gmail_message_object);
            $.each(attachment_metas, function (i, attachment_meta) {
              $('#attachments').append(pgp_attachment_iframe(url_params.account_email, attachment_meta, []));
            });
          } else {
            console.log('failed to re-show sent attachments'); //todo - handle !success
          }
        });
      }
    });
  }

  function send_btn_click() {
    var recipients = compose.get_recipients_from_dom();
    var headers = {
      'To': recipients.join(', '),
      'From': url_params.from,
      'Subject': url_params.subject,
      'In-Reply-To': thread_message_id_last,
      'References': thread_message_referrences_last + ' ' + thread_message_id_last,
    };
    compose.encrypt_and_send(url_params.account_email, recipients, headers.Subject, $('#input_text').get(0).innerText, function (encrypted_message_text_to_send, attachments, attach_files) {
      to_mime(url_params.account_email, encrypted_message_text_to_send, headers, attach_files ? attachments : null, function (mime_message) {
        gmail_api_message_send(url_params.account_email, mime_message, url_params.thread_id, function (success, response) {
          if(success) {
            tool.env.increment('reply', function () {
              reply_message_render_success(headers.To, (attachments || []).length, response.id);
            });
          } else {
            compose.handle_send_message_error(response);
          }
        });
      });
    });
  }

  function reply_message_on_render() {
    if(url_params.to) {
      $('#input_to').val(url_params.to + ','); // the space causes the last email to be also evaluated
    } else {
      $('#input_to').val(url_params.to);
    }
    compose.on_render();
    $("#input_to").focus();
    $('#send_btn').click(prevent(doubleclick(), send_btn_click));
    if(url_params.to) {
      $('#input_text').focus();
      document.getElementById("input_text").focus();
      compose.evaluate_receivers();
    }
    setTimeout(function () { // delay automatic resizing until a second later
      $(window).resize(prevent(spree(), compose.resize_reply_box));
      $('#input_text').keyup(compose.resize_reply_box);
    }, 1000);
    compose.resize_reply_box();
  }

  recover_thread_id_if_missing(function () {
    // show decrypted draft if available for this thread. Also check if GMAIL_READ_SCOPE is available.
    account_storage_get(url_params.account_email, ['drafts_reply', 'google_token_scopes'], function (storage) {
      can_read_emails = (typeof storage.google_token_scopes !== 'undefined' && storage.google_token_scopes.indexOf(GMAIL_READ_SCOPE) !== -1);
      if(!url_params.ignore_draft && storage.drafts_reply && storage.drafts_reply[url_params.thread_id]) { // there is a draft
        original_reply_message_prompt = $('div#reply_message_prompt').html();
        $('div#reply_message_prompt').html(get_spinner() + ' Loading draft');
        gmail_api_draft_get(url_params.account_email, storage.drafts_reply[url_params.thread_id], 'raw', function (success, response) {
          if(success) {
            compose.draft_set_id(storage.drafts_reply[url_params.thread_id]);
            parse_mime_message(tool.str.base64url_decode(response.message.raw), function (mime_success, parsed_message) {
              if((parsed_message.text || strip_pgp_armor(parsed_message.html) || '').indexOf('-----END PGP MESSAGE-----') !== -1) {
                var stripped_text = parsed_message.text || strip_pgp_armor(parsed_message.html);
                compose.decrypt_and_render_draft(url_params.account_email, stripped_text.substr(stripped_text.indexOf('-----BEGIN PGP MESSAGE-----')), reply_message_render_table); // todo - regex is better than random clipping
              } else {
                console.log('gmail_api_draft_get parse_mime_message else {}');
                reply_message_render_table();
              }
            });
          } else {
            reply_message_render_table();
            if(response.status === 404) {
              compose.draft_meta_store(false, storage.drafts_reply[url_params.thread_id], url_params.thread_id, null, null, function () {
                console.log('Above red message means that there used to be a draft, but was since deleted. (not an error)');
                window.location.reload();
              });
            } else {
              console.log('gmail_api_draft_get success===false');
              console.log(response);
            }
          }
        });
      } else { //no draft available
        if(!url_params.skip_click_prompt) {
          $('#reply_click_area, #a_reply, #a_reply_all, #a_forward').click(function () {
            if($(this).attr('id') === 'a_reply') {
              url_params.to = url_params.to.split(',')[0];
            } else if($(this).attr('id') === 'a_forward') {
              url_params.to = '';
            }
            reply_message_render_table($(this).attr('id').replace('a_', ''));
          });
        } else {
          reply_message_render_table();
        }
      }
    });
  });

  $(document).ready(function () {
    compose.resize_reply_box();
  });

});
