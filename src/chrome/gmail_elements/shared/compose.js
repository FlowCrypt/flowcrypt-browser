/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function init_shared_compose_js(url_params, db, attach_js) {

  var SAVE_DRAFT_FREQUENCY = 3000;

  var PUBKEY_LOOKUP_RESULT_WRONG = 'wrong';
  var PUBKEY_LOOKUP_RESULT_FAIL = 'fail';

  var BTN_ENCRYPT_AND_SEND = 'encrypt and send';
  var BTN_WRONG_ENTRY = 're-enter recipient..';
  var BTN_WAIT = 'wait..';

  var last_draft = '';
  var draft_id;
  var can_save_drafts;
  var can_read_emails;
  var last_reply_box_table_height;
  var contact_search_in_progress = false;
  var added_pubkey_db_lookup_interval;
  var save_draft_interval = setInterval(draft_save, SAVE_DRAFT_FREQUENCY);
  var save_draft_in_process = false;
  var passphrase_interval;
  var include_pubkey_toggled_manually = false;
  var my_addresses_on_pks = [];
  var my_addresses_on_keyserver = [];
  var recipients_missing_my_key = [];
  var keyserver_lookup_results_by_email = {};
  var is_reply_box = Boolean($('body#reply_message').length);
  var original_btn_html;
  var l = {
    open_challenge_message: 'This message is encrypted. If you can\'t read it, visit the following link:',
    include_pubkey_icon_title: 'Include your Public Key with this message.\n\nThis allows people using non-CryptUp encryption to reply to you.',
    include_pubkey_icon_title_active: 'Your Public Key will be included with this message.\n\nThis allows people using non-CryptUp encryption to reply to you.',
  };

  init_elements_factory_js();

  tool.browser.message.tab_id(function (tab_id) {
    tool.browser.message.listen({
      close_dialog: function (data) {
        $('.featherlight.featherlight-iframe').remove();
      },
    }, tab_id);
  });

  $('.icon.pubkey').attr('title', l.include_pubkey_icon_title);

  // set can_save_drafts, addresses_pks
  account_storage_get(url_params.account_email, ['google_token_scopes', 'addresses_pks', 'addresses_keyserver'], function (storage) {
    my_addresses_on_pks = storage.addresses_pks || [];
    my_addresses_on_keyserver = storage.addresses_keyserver || [];
    can_save_drafts = tool.api.gmail.has_scope(storage.google_token_scopes, 'compose');
    can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
    if(!can_save_drafts) {
      $('#send_btn_note').html('<a href="#" class="auth_drafts hover_underline">Enable encrypted drafts</a>');
      $('#send_btn_note a.auth_drafts').click(auth_drafts);
    }
  });

  function draft_set_id(id) {
    draft_id = id;
  }

  function draft_meta_store(store_if_true, draft_id, thread_id, recipients, subject, then) {
    account_storage_get(url_params.account_email, ['drafts_reply', 'drafts_compose'], function (storage) {
      if(thread_id) { // it's a reply
        var drafts = storage.drafts_reply || {};
        if(store_if_true) {
          drafts[url_params.thread_id] = draft_id;
        } else {
          delete drafts[url_params.thread_id];
        }
        account_storage_set(url_params.account_email, {
          drafts_reply: drafts,
        }, then);
      } else { // it's a new message
        var drafts = storage.drafts_compose || {};
        if(store_if_true) {
          drafts[draft_id] = { recipients: recipients, subject: subject, date: new Date().getTime(), };
        } else {
          delete drafts[draft_id];
        }
        account_storage_set(url_params.account_email, { drafts_compose: drafts, }, then);
      }
    });
  }

  function draft_save(force_save) {
    function set_note(result) {
      if(result) {
        $('#send_btn_note').text('Saved');
      } else {
        $('#send_btn_note').text('Not saved');
      }
    }
    if(can_save_drafts && (should_save_draft($('#input_text').text()) || force_save === true)) {
      save_draft_in_process = true;
      $('#send_btn_note').text('Saving');
      var armored_pubkey = private_storage_get('local', url_params.account_email, 'master_public_key', url_params.parent_tab_id);
      tool.crypto.message.encrypt([armored_pubkey], null, null, $('#input_text')[0].innerText, true, function (encrypted) {
        if(url_params.thread_id) { // replied message
          var body = '[cryptup:link:draft_reply:' + url_params.thread_id + ']\n\n' + encrypted.data;
        } else if(draft_id) {
          var body = '[cryptup:link:draft_compose:' + draft_id + ']\n\n' + encrypted.data;
        } else {
          var body = encrypted.data;
        }
        tool.mime.encode(url_params.account_email, body, { To: get_recipients_from_dom(), From: get_sender_from_dom(), Subject: $('#input_subject').val() || url_params.subject || 'CryptUp draft', }, [], function (mime_message) {
          if(!draft_id) {
            tool.api.gmail.draft_create(url_params.account_email, mime_message, url_params.thread_id, function (success, response) {
              set_note(success);
              if(success) {
                draft_id = response.id;
                draft_meta_store(true, response.id, url_params.thread_id, get_recipients_from_dom(), $('#input_subject'));
                // recursing one more time, because we need the draft_id we get from this reply in the message itself
                // essentially everytime we save draft for the first time, we have to save it twice
                // save_draft_in_process will remain true because well.. it's still in process
                draft_save(true); // force_save = true
              } else {
                // it will only be set to false (done) if it's a failure (only in terms of the very first save)
                save_draft_in_process = false;
              }
            });
          } else {
            tool.api.gmail.draft_update(url_params.account_email, draft_id, mime_message, function (success, response) {
              set_note(success);
              save_draft_in_process = false;
            });
          }
        });
      });
    }
  }

  function draft_delete(account_email, callback) {
    clearInterval(save_draft_interval);
    tool.time.wait(function () {
      if(!save_draft_in_process) {
        return true;
      }
    }).then(function () {
      if(draft_id) {
        draft_meta_store(false, draft_id, url_params.thread_id, null, null, function () {
          tool.api.gmail.draft_delete(account_email, draft_id, callback);
        });
      } else {
        if(callback) {
          callback();
        }
      }
    });
  }

  function decrypt_and_render_draft(account_email, encrypted_draft, render_function, headers) {
    var my_passphrase = get_passphrase(account_email);
    if(my_passphrase !== null) {
      var private_key = openpgp.key.readArmored(private_storage_get('local', account_email, 'master_private_key', url_params.parent_tab_id)).keys[0];
      if(typeof my_passphrase !== 'undefined' && my_passphrase !== '') {
        tool.crypto.key.decrypt(private_key, my_passphrase);
      }
      // todo: should be using tool.crypto.message.decrypt() function
      openpgp.decrypt({ message: openpgp.message.readArmored(encrypted_draft), format: 'utf8', privateKey: private_key, }).then(function (plaintext) {
        $('#input_text').html(plaintext.data.replace(/(?:\r\n|\r|\n)/g, '<br />'));
        if(headers && headers.to && headers.to.length) {
          $('#input_to').focus();
          $('#input_to').val(headers.to.join(','));
          $('#input_text').focus();
        }
        if(headers && headers.from) {
          $('#input_from').val(headers.from);
        }
        if(render_function) {
          render_function();
        }
      }).catch(function (error) {
        console.log('openpgp.decrypt(options).catch(error)');
        console.log(error);
        if(render_function) {
          render_function();
        }
      });
    } else {
      if($('div#reply_message_prompt').length) { // todo - will only work for reply box, not compose box
        $('div#reply_message_prompt').html(tool.ui.spinner() + ' Waiting for pass phrase to open previous draft..');
        clearInterval(passphrase_interval);
        passphrase_interval = setInterval(function () {
          check_passphrase_entered(encrypted_draft);
        }, 1000);
      }
    }
  }

  function check_passphrase_entered(encrypted_draft) {
    if(get_passphrase(url_params.account_email) !== null) {
      clearInterval(passphrase_interval);
      compose.decrypt_and_render_draft(url_params.account_email, encrypted_draft, reply_message_render_table);
    }
  }

  function collect_all_available_public_keys(account_email, recipients, callback) {
    db_contact_get(db, recipients, function (contacts) {
      var armored_pubkeys = [private_storage_get('local', account_email, 'master_public_key', url_params.parent_tab_id)];
      var emails_without_pubkeys = [];
      $.each(contacts, function (i, contact) {
        if(contact && contact.has_pgp) {
          armored_pubkeys.push(contact.pubkey);
        } else if(contact && keyserver_lookup_results_by_email[contact.email] && keyserver_lookup_results_by_email[contact.email].has_pgp) {
          armored_pubkeys.push(keyserver_lookup_results_by_email[contact.email].pubkey);
        } else {
          emails_without_pubkeys.push(recipients[i]);
        }
      });
      callback(armored_pubkeys, emails_without_pubkeys);
    });
  }

  function is_compose_form_rendered_as_ready() {
    if($('#send_btn span').text().toLowerCase().trim() === BTN_ENCRYPT_AND_SEND) {
      return true;
    } else if($('#send_btn span').text().toLowerCase().trim() === BTN_WRONG_ENTRY) {
      alert('Please re-enter recipients marked in red color.');
      return false;
    } else {
      alert('Please wait, information about recipients is still loading.');
      return false;
    }
  }

  function are_compose_form_values_valid(recipients, emails_without_pubkeys, subject, plaintext, challenge, subscription_active) {
    if(!recipients.length) {
      alert('Please add receiving email address.');
      return false;
    } else if(emails_without_pubkeys.length && (!challenge.question || !challenge.answer)) {
      if(!challenge.answer) {
        alert('Some recipients don\'t have encryption set up. Please add a password.');
      } else {
        alert('Password hint is required when messaging recipients who don\'t have encryption set up.');
      }
      return false;
    } else if(attach_js.has_attachment() && emails_without_pubkeys.length && !subscription_active) {
      tool.env.increment('upgrade_notify_attach_nonpgp', function () {
        if(confirm('Sending password encrypted attachments is possible with CryptUp Pro.\n\nIt\'s free for one year if you register now.')) {
          tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog');
        }
      });
      return false;
    } else if((plaintext !== '' || window.confirm('Send empty message?')) && (subject !== '' || window.confirm('Send without a subject?'))) {
      return true; //todo - tailor for replying w/o subject
    } else {
      return false;
    }
  }

  function encrypt_and_send(account_email, recipients, subject, plaintext, send_email) {
    if(is_compose_form_rendered_as_ready()) {
      original_btn_html = $('#send_btn').html();
      $('#send_btn span').text('Loading');
      $('#send_btn i').replaceWith(tool.ui.spinner());
      storage_cryptup_subscription(function (subscription_level, subscription_expire, subscription_active) {
        collect_all_available_public_keys(account_email, recipients, function (armored_pubkeys, emails_without_pubkeys) {
          var challenge = { question: $('#input_question').val(), answer: $('#input_answer').val(), };
          if(are_compose_form_values_valid(recipients, emails_without_pubkeys, subject, plaintext, challenge, subscription_active)) {
            $('#send_btn span').text(attach_js.has_attachment() ? 'Encrypting attachments' : 'Encrypting');
            challenge = emails_without_pubkeys.length ? challenge : null;
            try {
              attach_js.collect_and_encrypt_attachments(armored_pubkeys, challenge, function (attachments) {
                if(attachments.length && challenge) { // these will be password encrypted attachments
                  $('#send_btn span').text('Uploading attachments');
                  upload_attachments_to_cryptup(attachments, function (all_good, upload_results) {
                    if(all_good === true) {
                      $('#send_btn span').text('Encrypting email');
                      plaintext = add_uploaded_file_links_to_message_body(plaintext, upload_results);
                      do_encrypt_message_body(armored_pubkeys, challenge, plaintext, attachments, recipients, false, send_email);
                    } else {
                      handle_upload_attachments_to_cryptup_error(all_good, upload_results);
                      $('#send_btn').html(original_btn_html);
                    }
                  });
                } else {
                  do_encrypt_message_body(armored_pubkeys, challenge, plaintext, attachments, recipients, true, send_email);
                }
              });
            } catch(err) {
              catcher.handle_exception(err);
              $('#send_btn').html(original_btn_html);
              alert(err);
            }
          } else {
            $('#send_btn').html(original_btn_html);
          }
        });
      });
    }
  }

  function handle_upload_attachments_to_cryptup_error(result_summary, upload_results) {
    if(result_summary === tool.api.cryptup.auth_error) {
      if(confirm('Your CryptUp account information is outdated, please review your account settings.')) {
        tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog', { source: 'auth_error' });
      }
    } else { // todo - offer to retry only failed attachments
      alert('Failed to upload attachments, please try again. Encountered errors:\n' + upload_results.map(function (result) {
        if(result && result.url) {
          return '\n' + (upload_results.indexOf(result) + 1) + ': no error';
        } else {
          return '\n' + (upload_results.indexOf(result) + 1) + ': ' + result.error;
        }
      }));
    }
  }

  function upload_attachments_to_cryptup(attachments, callback, _results, _i) {
    _i = _i || 0;
    _results = _results || [];
    if(attachments[_i]) {
      tool.api.cryptup.message_upload_attachment(attachments[_i], function (success, server_result) {
        if(success === true && server_result && server_result.url) {
          _results[_i] = { attachment: attachments[_i], url: server_result.url };
        } else if(success === tool.api.cryptup.auth_error) {
          _results[_i] = { attachment: attachments[_i], error: tool.api.cryptup.auth_error };
        } else {
          if(server_result && server_result.error) {
            if(typeof server_result.error === 'object' && (server_result.error.internal_msg || server_result.error.public_msg)) {
              var str_err = String(server_result.error.public_msg) + ' (' + server_result.error.internal_msg + ')';
            } else {
              var str_err = String(server_result.error);
            }
          } else {
            var str_err = success ? 'unknown' : 'internet connection dropped';
          }
          _results[_i] = { attachment: attachments[_i], error: str_err };
        }
        upload_attachments_to_cryptup(attachments, callback, _results, ++_i);
      });
    } else {
      var all_good = _results.reduce(function (reduced, result) {
        if(typeof result.error === 'function' && result.error === tool.api.cryptup.auth_error) {
          return tool.api.cryptup.auth_error;
        } else {
          return reduced && typeof result.error === 'undefined';
        }
      }, true);
      callback(all_good, _results);
    }
  }

  function add_uploaded_file_links_to_message_body(plaintext, upload_results) {
    plaintext += '\n\n';
    $.each(upload_results, function (i, result) {
      var size_mb = result.attachment.size / (1024 * 1024);
      var size_text = size_mb < 0.1 ? '' : ' ' + (Math.round(size_mb * 10) / 10) + 'MB';
      var link_text = 'Attachment: ' + result.attachment.name + ' (' + result.attachment.type + ')' + size_text;
      var cryptup_data = tool.str.html_attribute_encode({ size: result.attachment.size, type: result.attachment.type, name: result.attachment.name });
      plaintext += '<a href="' + result.url + '" class="cryptup_file" cryptup-data="' + cryptup_data + '">' + link_text + '</a>\n';
    });
    return plaintext;
  }

  function upload_encrypted_message_to_cryptup(encrypted_data, callback) {
    $('#send_btn span').text('Uploading');
    // this is used when sending encrypted messages to people without encryption plugin
    // used to send it as a parameter in URL, but the URLs are way too long and not all clients can deal with it
    // the encrypted data goes through CryptUp and recipients get a link. They also get the encrypted data in message body.
    tool.api.cryptup.message_upload(encrypted_data, function(success, response) {
      if (success && response && response.url) {
        callback(response.url);
      } else if(response && response.error) {
        try {
          var err = JSON.stringify(response.error);
        } catch(e) {
          var err = String(response.error);
        }
        callback(null, typeof response.error === 'object' && response.error.internal_msg ? response.error.internal_msg : err);
      } else {
        callback(null, 'internet dropped');
      }
    });
  }

  function do_encrypt_message_body(armored_pubkeys, challenge, plaintext, attachments, recipients, attach_files_to_email, send_email) {
    tool.crypto.message.encrypt(armored_pubkeys, null, challenge, plaintext, true, function (encrypted) {
      if($('.bottom .icon.pubkey').length && $('.bottom .icon.pubkey').is('.active')) {
        encrypted.data += '\n\n\n\n' + private_storage_get('local', url_params.account_email, 'master_public_key', url_params.parent_tab_id);
      }
      var body = { 'text/plain': encrypted.data, 'text/html': encrypted.data.replace(/(?:\r\n|\r|\n)/g, '<br>\n'), };
      $('#send_btn span').text(((attachments || []).length) && attach_files_to_email ? 'Uploading attachments' : 'Sending');
      db_contact_update(db, recipients, { last_use: Date.now(), }, function () {
        if(challenge) {
          upload_encrypted_message_to_cryptup(encrypted.data, function(encrypted_data_link, error) {
            if(encrypted_data_link) {
              body = format_challenge_question_email(challenge.question, encrypted_data_link, body);
              send_email(body, attachments, attach_files_to_email);
            } else {
              alert('Could not send message, probably due to internet connection. Please click the SEND button again to retry.\n\n(Error:' + error + ')');
              $('#send_btn').html(original_btn_html);
            }
          });
        } else {
          send_email(body, attachments, attach_files_to_email);
        }
      });
    });
  }

  function handle_send_message_error(response) {
    if(response && response.status === 413) {
      $('#send_btn span').text(BTN_ENCRYPT_AND_SEND);
      $('#send_btn i').attr('class', '');
      tool.env.increment('upgrade_notify_attach_size', function () {
        alert('Currently, total attachments size should be under 5MB. Larger files will be possible very soon.');
      });
    } else {
      catcher.log('tool.api.gmail.message_send error response from gmail', response);
      alert('Error sending message, try to re-open your Gmail window and send again. Write me at tom@cryptup.org if this happens repeatedly.');
    }
  }

  function lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed(email, callback) {
    db_contact_get(db, email, function (db_contact) {
      if(db_contact && db_contact.has_pgp && db_contact.pubkey) {
        callback(db_contact);
      } else {
        tool.api.attester.keys_find(email, function (success, result) {
          if(success && result.email) {
            var ks_contact = db_contact_object(result.email, db_contact && db_contact.name ? db_contact.name : null, result.has_cryptup ? 'cryptup' : 'pgp', result.pubkey, result.attested, false, Date.now());
            keyserver_lookup_results_by_email[result.email] = ks_contact;
            db_contact_save(db, ks_contact, function () {
              callback(ks_contact);
            });
          } else {
            callback(PUBKEY_LOOKUP_RESULT_FAIL);
          }
        });
      }
    });
  }

  function evaluate_receivers() {
    $('.recipients span').not('.working, .has_pgp, .no_pgp, .wrong, .attested, .failed, .expired').each(function () {
      var email_element = this;
      var email = tool.str.trim_lower($(email_element).text());
      if(tool.str.is_email_valid(email)) {
        $("#send_btn span").text(BTN_WAIT);
        $("#send_btn_note").text("Checking email addresses");
        lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed(email, function (pubkey_lookup_result) {
          render_pubkey_result(email_element, email, pubkey_lookup_result);
        });
      } else {
        render_pubkey_result(email_element, email, PUBKEY_LOOKUP_RESULT_WRONG);
      }
    });
  }

  function show_hide_missing_pubkey_container_and_color_send_button() {
    $("#send_btn span").text(BTN_ENCRYPT_AND_SEND);
    $("#send_btn_note").text('');
    $("#send_btn").attr('title', '');
    var was_previously_visible = $("#missing_pubkey_container").css('display') === 'table-row';
    if(!$('.recipients span').length) {
      $("#challenge_question_container").css('display', 'none');
      $("#missing_pubkey_container").css('display', 'none');
      $('#send_btn').removeClass('gray').addClass('green');
    } else {
      if($('.recipients span.no_pgp').length) {
        if($('#challenge_question_container').css('display') === 'none') {
          $("#missing_pubkey_container").css('display', 'table-row');
        }
        $('#send_btn').removeClass('green').addClass('gray');
      } else if($('.recipients span.failed, .recipients span.wrong').length) {
        $("#send_btn span").text(BTN_WRONG_ENTRY);
        $("#send_btn").attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
        $("#send_btn").removeClass('green').addClass('gray');
      } else {
        $("#challenge_question_container").css('display', 'none');
        $("#missing_pubkey_container").css('display', 'none');
        $('#send_btn').removeClass('gray').addClass('green');
      }
    }
    if(is_reply_box) {
      if(!was_previously_visible && $("#missing_pubkey_container").css('display') === 'table-row') {
        resize_reply_box($("#missing_pubkey_container").first().height() + 20);
      } else {
        resize_reply_box();
      }
    }
  }

  function respond_to_input_hotkeys(input_to_keydown_event) {
    var value = $('#input_to').val();
    var keys = tool.env.key_codes();
    if(!value && input_to_keydown_event.which === keys.backspace) {
      $('.recipients span').last().remove();
    } else if(value && (input_to_keydown_event.which === keys.enter || input_to_keydown_event.which === keys.tab)) {
      $('#input_to').blur();
      if($('#contacts').css('display') === 'block') {
        $('#input_to').blur();
        if($('#contacts .select_contact.hover').length) {
          $('#contacts .select_contact.hover').click();
        } else {
          $('#contacts .select_contact').first().click();
        }
      }
      $('#input_to').focus();
      return false;
    }
  }

  function resize_reply_box(add_extra) {
    if(is_reply_box) {
      if(isNaN(add_extra)) {
        add_extra = 0;
      }
      $('div#input_text').css('max-width', ($('body').width() - 20) + 'px');
      var current_height = $('table#compose').height();
      if(current_height !== last_reply_box_table_height) {
        last_reply_box_table_height = current_height;
        tool.browser.message.send(url_params.parent_tab_id, 'set_css', {
          selector: 'iframe#' + url_params.frame_id,
          css: { height: Math.max(260, current_height + 1) + add_extra, }
        });
      }
    }
  }

  function render_receivers() {
    if($('#contacts').css('display') !== 'none') {}
    var content = $('#input_to').val();
    var icon = '<i class="fa ion-load-c fa-spin"></i>';
    if(content.match(/[,]/) !== null) { // todo - make this work for tab key as well, and return focus back
      var emails = content.split(/[,]/g);
      for(var i = 0; i < emails.length - 1; i++) {
        $('#input_to').siblings('.recipients').append('<span>' + emails[i] + icon + '</span>');
      }
      $('.recipients span i').click(remove_receiver);
      $('#input_to').val(emails[emails.length - 1]);
      resize_input_to();
      evaluate_receivers();
    } else if(!$('#input_to').is(':focus') && content) {
      $('#input_to').siblings('.recipients').append('<span>' + content + icon + '</span>');
      $('.recipients span i').click(remove_receiver);
      $('#input_to').val('');
      resize_input_to();
      evaluate_receivers();
    }
  }

  function select_contact(email, from_query) {
    if($('.recipients span').last().text() === from_query.substring) {
      $('.recipients span').last().remove();
    }
    $('#input_to').focus();
    $('#input_to').val(tool.str.trim_lower(email));
    hide_contacts();
    $('#input_to').blur();
    $('#input_to').focus();
  }

  function resize_input_to() {
    var new_width = Math.max(150, $('#input_to').parent().width() - $('#input_to').siblings('.recipients').width() - 50);
    $('#input_to').css('width', new_width + 'px');
  }

  function remove_receiver() {
    recipients_missing_my_key = tool.arr.without_value(recipients_missing_my_key, $(this).parent().text());
    $(this).parent().remove();
    resize_input_to();
    show_hide_missing_pubkey_container_and_color_send_button();
    rerender_include_pubkey_icon();
  }

  function auth_drafts() {
    tool.browser.message.send(null, 'google_auth', { account_email: url_params.account_email, scopes: tool.api.gmail.scope(['compose']), }, function (google_auth_response) {
      if(google_auth_response.success === true) {
        $('#send_btn_note').text('');
        can_save_drafts = true;
        clearInterval(save_draft_interval);
        draft_save();
        setInterval(draft_save, SAVE_DRAFT_FREQUENCY);
      } else if(google_auth_response.success === false && google_auth_response.result === 'denied' && google_auth_response.error === 'access_denied') {
        alert('CryptUp needs this permission save your encrypted drafts automatically.');
      } else {
        console.log(google_auth_response);
        alert('Something went wrong, please try again. If this happens again, please write me at tom@cryptup.org to fix it.');
      }
    });
  }

  function auth_contacts(account_email) {
    $('#input_to').val($('.recipients span').last().text());
    $('.recipients span').last().remove();
    tool.browser.message.send(null, 'google_auth', { account_email: account_email, scopes: tool.api.gmail.scope(['read']), }, function (google_auth_response) {
      if(google_auth_response.success === true) {
        can_read_emails = true;
        search_contacts();
      } else if(google_auth_response.success === false && google_auth_response.result === 'denied' && google_auth_response.error === 'access_denied') {
        alert('CryptUp needs this permission to search your contacts on Gmail. Without it, CryptUp will keep a separate contact list.');
      } else {
        console.log(google_auth_response);
        alert('Something went wrong, please try again. If this happens again, please write me at tom@cryptup.org to fix it.');
      }
    });
  }

  function render_search_results_loading_done() {
    $('#contacts ul li.loading').remove();
    if(!$('#contacts ul li').length) {
      hide_contacts();
    }
  }

  function render_search_results(contacts, query) {
    var renderable_contacts = contacts.slice();
    renderable_contacts.sort(function (a, b) { // all that have pgp group on top. Without pgp bottom. Sort both groups by last used first.
      return(10 * (b.has_pgp - a.has_pgp)) + (b.last_use - a.last_use > 0 ? 1 : -1);
    });
    renderable_contacts.splice(8);
    if(renderable_contacts.length > 0 || contact_search_in_progress) {
      var ul_html = '';
      $.each(renderable_contacts, function (i, contact) {
        ul_html += '<li class="select_contact" email="' + contact.email.replace(/<\/?b>/g, '') + '">';
        if(contact.has_pgp) {
          ul_html += '<i class="fa fa-lock"></i>';
        } else {
          ul_html += '<i class="fa fa-lock" style="color: gray;"></i>';
        }
        if(contact.email.length < 40) {
          var display_email = contact.email;
        } else {
          var parts = contact.email.split('@');
          var display_email = parts[0].replace(/<\/?b>/g, '').substr(0, 10) + '...@' + parts[1];
        }
        if(contact.name) {
          ul_html += (contact.name + ' &lt;' + display_email + '&gt;');
        } else {
          ul_html += display_email;
        }
        ul_html += '</li>';
      });
      if(contact_search_in_progress) {
        ul_html += '<li class="loading">loading...</li>';
      }
      $('#contacts ul').html(ul_html);
      $('#contacts ul li.select_contact').click(function () {
        select_contact($(this).attr('email'), query);
      });
      $('#contacts ul li.select_contact').hover(function () {
        $(this).addClass('hover');
      }, function () {
        $(this).removeClass('hover');
      });
      $('#contacts ul li.auth_contacts').click(function () {
        auth_contacts(url_params.account_email);
      });
      $('#contacts').css('display', 'block');
    } else {
      hide_contacts();
    }
  }

  function search_contacts(db_only) {
    var query = { substring: tool.str.trim_lower($('#input_to').val()) };
    if(query.substring !== '') {
      db_contact_search(db, query, function (contacts) {
        if(db_only) {
          render_search_results(contacts, query);
        } else {
          contact_search_in_progress = true;
          render_search_results(contacts, query);
          tool.api.gmail.search_contacts(url_params.account_email, query.substring, contacts, function (gmail_contact_results) {
            var re_rendering_needed = false;
            if(gmail_contact_results.new.length) {
              $.each(gmail_contact_results.new, function (i, contact) {
                db_contact_get(db, contact.email, function (in_db) {
                  if(!in_db) {
                    db_contact_save(db, db_contact_object(contact.email, contact.name, null, null, null, true, new Date(contact.date).getTime() || null), function () {
                      search_contacts(true);
                    });
                  } else if(!in_db.name && contact.name) {
                    var to_update = { name: contact.name };
                    db_contact_update(db, contact.email, to_update, function () {
                      search_contacts(true);
                    });
                  }
                });
              });
            } else {
              render_search_results_loading_done();
              contact_search_in_progress = false;
            }
          });
        }
      });
    } else {
      hide_contacts(); //todo - show suggestions of most contacted ppl etc
    }
  }

  function hide_contacts() {
    $('#contacts').css('display', 'none');
  }

  function did_i_ever_send_pubkey_to_or_receive_encrypted_message_from(their_email, callback) {
    their_email = tool.str.trim_lower(their_email);
    account_storage_get(url_params.account_email, ['pubkey_sent_to'], function (storage) {
      if(tool.value(their_email).in(storage.pubkey_sent_to)) {
        callback(true);
      } else if(!can_read_emails) {
        callback(undefined);
      } else {
        var q_sent_pubkey = 'is:sent to:' + their_email + ' "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"';
        var q_received_message = 'from:' + their_email + ' "BEGIN PGP MESSAGE" "END PGP MESSAGE"';
        tool.api.gmail.message_list(url_params.account_email, '(' + q_sent_pubkey + ') OR (' + q_received_message + ')', true, function (success, response) {
          if(success && response.messages) {
            account_storage_set(url_params.account_email, { pubkey_sent_to: (storage.pubkey_sent_to || []).concat(their_email), }, function () {
              callback(true);
            });
          } else {
            callback(false);
          }
        });
      }
    });
  }

  function rerender_include_pubkey_icon(include) {
    if(include === null || typeof include === 'undefined') { // decide if pubkey should be included
      if(!include_pubkey_toggled_manually) { // leave it as is if toggled manually beforeconsole.log('a');
        rerender_include_pubkey_icon(recipients_missing_my_key.length && !tool.value(get_sender_from_dom()).in(my_addresses_on_pks));
      }
    } else { // set icon to specific state
      if(include) {
        $('.bottom .icon.pubkey').addClass('active').attr('title', l.include_pubkey_icon_title_active);
      } else {
        $('.bottom .icon.pubkey').removeClass('active').attr('title', l.include_pubkey_icon_title);
      }
    }
  }

  function recipient_key_id_text(contact) {
    if(contact.client === 'cryptup' && contact.keywords) {
      return '\n\n' + 'Public KeyWords:\n' + contact.keywords;
    } else if(contact.fingerprint) {
      return '\n\n' + 'Key fingerprint:\n' + contact.fingerprint;
    } else {
      return '';
    }
  }

  function render_pubkey_result(email_element, email, contact) {
    if($('body#new_message').length) {
      if(typeof contact === 'object' && contact.has_pgp) {
        var sending_address_on_pks = tool.value(get_sender_from_dom()).in(my_addresses_on_pks);
        var sending_address_on_keyserver = tool.value(get_sender_from_dom()).in(my_addresses_on_keyserver);
        if((contact.client === 'cryptup' && !sending_address_on_keyserver) || (contact.client !== 'cryptup' && !sending_address_on_pks)) {
          // new message, and my key is not uploaded where the recipient would look for it
          did_i_ever_send_pubkey_to_or_receive_encrypted_message_from(email, function (pubkey_sent) {
            if(!pubkey_sent) { // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
              recipients_missing_my_key.push(email);
            }
            rerender_include_pubkey_icon();
          });
        } else {
          rerender_include_pubkey_icon();
        }
      } else {
        rerender_include_pubkey_icon();
      }
    }
    $(email_element).children('i').removeClass('fa').removeClass('fa-spin').removeClass('ion-load-c').removeClass('fa-repeat').addClass('ion-android-close');
    if(contact === PUBKEY_LOOKUP_RESULT_FAIL) {
      $(email_element).attr('title', 'Loading contact information failed, please try to add their email again.');
      $(email_element).addClass("failed");
      $(email_element).children('i').removeClass('ion-android-close').addClass('fa').addClass('fa-repeat');
    } else if(contact === PUBKEY_LOOKUP_RESULT_WRONG) {
      $(email_element).attr('title', 'This email address looks misspelled. Please try again.');
      $(email_element).addClass("wrong");
    } else if(contact.has_pgp && tool.crypto.key.expired_for_encryption(openpgp.key.readArmored(contact.pubkey).keys[0])) {
      $(email_element).addClass("expired");
      $(email_element).prepend("<i class='fa fa-clock-o'></i>");
      $(email_element).attr('title', 'Does use encryption but their public key is expired. You should ask them to send you an updated public key.' + recipient_key_id_text(contact));
    } else if(contact.has_pgp && contact.attested) {
      $(email_element).addClass("attested");
      $(email_element).prepend("<i class='ion-locked'></i>");
      $(email_element).attr('title', 'Does use encryption, attested by CRYPTUP' + recipient_key_id_text(contact));
    } else if(contact.has_pgp) {
      $(email_element).addClass("has_pgp");
      $(email_element).prepend("<i class='ion-locked'></i>");
      $(email_element).attr('title', 'Does use encryption' + recipient_key_id_text(contact));
    } else {
      $(email_element).addClass("no_pgp");
      $(email_element).prepend("<i class='ion-locked'></i>");
      $(email_element).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
    }
    show_hide_missing_pubkey_container_and_color_send_button();
  }

  function get_recipients_from_dom(filter) {
    if(filter === 'no_pgp') {
      var selector = '.recipients span.no_pgp';
    } else {
      var selector = '.recipients span';
    }
    var recipients = [];
    $(selector).each(function () {
      recipients.push($(this).text().trim());
    });
    return recipients;
  }

  function get_sender_from_dom() {
    if($('#input_from').length) {
      return $('#input_from').val();
    } else {
      return url_params.account_email;
    }
  }

  function simulate_ctrl_v(to_paste) {
    var r = window.getSelection().getRangeAt(0);
    r.insertNode(r.createContextualFragment(to_paste));
  }

  function on_render() {
    $('#input_to').keydown(respond_to_input_hotkeys);
    $('#input_to').keyup(render_receivers);
    $('#input_to').keyup(tool.ui.event.prevent(tool.ui.event.spree('veryslow'), search_contacts));
    $('#input_to').blur(render_receivers);
    $('#input_text').keyup(function () {
      $('#send_btn_note').text('');
    });
    $('table#compose').click(hide_contacts);
    $('#input_addresses_container > div').click(function () {
      if(!$('#input_to').is(':focus')) {
        $('#input_to').focus();
      }
    }).children().click(function () {
      return false;
    });
    resize_input_to();
    attach_js.initialize_attach_dialog('fineuploader', 'fineuploader_button');
  }

  function should_save_draft(message_body) {
    if(message_body && message_body !== last_draft) {
      last_draft = message_body;
      return true;
    } else {
      return false;
    }
  }

  function format_challenge_question_email(question, encrypted_data_link, bodies) {
    var online_decrypt_url = tool.env.url_create('https://cryptup.org/decrypt.htm', { question: question, url: encrypted_data_link });
    return {
      'text/plain': [l.open_challenge_message, online_decrypt_url, '', bodies['text/plain']].join('\n'),
      'text/html': [l.open_challenge_message.replace(/ /g, '&nbsp;') + '&nbsp;<a href="' + online_decrypt_url + '">read&nbsp;message</a>', '', bodies['text/html']].join('<br>\n'),
    };
  }

  $('#input_question, #input_answer').keyup(tool.ui.event.prevent(tool.ui.event.spree(), function () {
    if($('#input_question').val() && $('#input_answer').val()) {
      $('#send_btn').removeClass('gray').addClass('green');
    } else {
      $('#send_btn').removeClass('green').addClass('gray');
    }
  }));

  $('.add_pubkey').click(function () {
    if(url_params.placement !== 'settings') {
      tool.browser.message.send(url_params.parent_tab_id, 'add_pubkey_dialog_gmail', {
        emails: get_recipients_from_dom('no_pgp'),
      });
    } else {
      tool.browser.message.tab_id(function (compose_window_tab_id) {
        $.featherlight({
          iframe: add_pubkey_dialog_src(url_params.account_email, get_recipients_from_dom('no_pgp'), compose_window_tab_id, 'settings'),
          iframeWidth: 515,
          iframeHeight: $('html').height() - 50,
        });
      });
    }
    clearInterval(added_pubkey_db_lookup_interval);
    added_pubkey_db_lookup_interval = setInterval(function () {
      $.each(get_recipients_from_dom('no_pgp'), function (i, email) {
        db_contact_get(db, email, function (contact) {
          if(contact && contact.has_pgp) {
            $("span.recipients span.no_pgp:contains('" + email + "') i").remove();
            $("span.recipients span.no_pgp:contains('" + email + "')").removeClass('no_pgp');
            clearInterval(added_pubkey_db_lookup_interval);
            evaluate_receivers();
          }
        });
      });
    }, 1000);
  });

  $('.use_question').click(function () {
    $('#missing_pubkey_container').css('display', 'none');
    $('#challenge_question_container').css('display', 'table-row');
    if(is_reply_box) {
      resize_reply_box();
    }
  });

  $('.action_feedback').click(function () {
    tool.browser.message.send(null, 'settings', {
      account_email: url_params.account_email,
      page: '/chrome/settings/modules/help.htm',
    });
  });

  $('#input_from').change(function () {
    // when I change input_from, I should completely re-evaluate: rerender_include_pubkey_icon() and render_pubkey_result()
    // because they might not have a pubkey for the alternative address, and might get confused
  });

  $('#input_text').get(0).onpaste = function (e) {
    if(e.clipboardData.getData('text/html')) {
      simulate_ctrl_v(tool.str.inner_text(e.clipboardData.getData('text/html')).replace(/\n/g, '<br>'));
      return false;
    }
  };

  $('.icon.action_include_pubkey').click(function () {
    include_pubkey_toggled_manually = true;
    rerender_include_pubkey_icon(!$(this).is('.active'));
  });

  return {
    draft_set_id: draft_set_id,
    draft_meta_store: draft_meta_store,
    draft_delete: draft_delete,
    decrypt_and_render_draft: decrypt_and_render_draft,
    encrypt_and_send: encrypt_and_send,
    handle_send_message_error: handle_send_message_error,
    evaluate_receivers: evaluate_receivers,
    resize_reply_box: resize_reply_box,
    rerender_include_pubkey_icon: rerender_include_pubkey_icon,
    get_recipients_from_dom: get_recipients_from_dom,
    get_sender_from_dom: get_sender_from_dom,
    on_render: on_render,
  };

}
