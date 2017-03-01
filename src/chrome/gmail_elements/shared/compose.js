/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

function init_shared_compose_js(url_params, db) {

  var SAVE_DRAFT_FREQUENCY = 3000;
  var PUBKEY_LOOKUP_RESULT_WRONG = 'wrong';
  var PUBKEY_LOOKUP_RESULT_FAIL = 'fail';
  var BTN_ENCRYPT_AND_SEND = 'encrypt and send';
  var BTN_WRONG_ENTRY = 're-enter recipient..';
  var BTN_WAIT = 'wait..';

  var factory;
  var attach = init_shared_attach_js(5, 10);

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
  var email_footer;
  var tab_id;
  var l = {
    open_password_protected_message: 'This message is encrypted. If you can\'t read it, visit the following link:',
    include_pubkey_icon_title: 'Include your Public Key with this message.\n\nThis allows people using non-CryptUp encryption to reply to you.',
    include_pubkey_icon_title_active: 'Your Public Key will be included with this message.\n\nThis allows people using non-CryptUp encryption to reply to you.',
  };

  tool.browser.message.tab_id(function (id) {
    tab_id = id;
    factory = init_elements_factory_js(url_params.account_email, tab_id);
    var subscribe_result_listener;
    tool.browser.message.listen({
      close_dialog: function (data) {
        $('.featherlight.featherlight-iframe').remove();
      },
      set_footer: function (data) {
        email_footer = data.footer;
        update_footer_icon();
        $('.featherlight.featherlight-iframe').remove();
      },
      subscribe: function(data, sender, respond) {
        subscribe_result_listener = respond;
        tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog', {'subscribe_result_tab_id': tab_id});
      },
      subscribe_result: function(data) {
        if(typeof subscribe_result_listener === 'function') {
          subscribe_result_listener(data.active);
          subscribe_result_listener = undefined;
        }
      },
    }, tab_id);
  });

  $('.icon.action_include_pubkey').attr('title', l.include_pubkey_icon_title);

  // set can_save_drafts, addresses_pks
  account_storage_get(url_params.account_email, ['google_token_scopes', 'addresses_pks', 'addresses_keyserver', 'email_footer'], function (storage) {
    my_addresses_on_pks = storage.addresses_pks || [];
    my_addresses_on_keyserver = storage.addresses_keyserver || [];
    can_save_drafts = tool.api.gmail.has_scope(storage.google_token_scopes, 'compose');
    can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
    storage_cryptup_subscription(function(level, expire, active) {
      if(active) {
        email_footer = storage.email_footer;
        update_footer_icon();
      }
    });
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
        $('div#reply_message_prompt').html(tool.ui.spinner('green') + ' Waiting for pass phrase to open previous draft..');
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

  function is_compose_form_rendered_as_ready(recipients) {
    if($('#send_btn span').text().toLowerCase().trim() === BTN_ENCRYPT_AND_SEND && recipients && recipients.length) {
      return true;
    } else {
      if($('#send_btn span').text().toLowerCase().trim() === BTN_WRONG_ENTRY) {
        alert('Please re-enter recipients marked in red color.');
      } else if(!recipients || !recipients.length) {
        alert('Please add a recipient first');
      } else {
        alert('Please wait, information about recipients is still loading.');
      }
      return false;
    }
  }

  function are_compose_form_values_valid(recipients, emails_without_pubkeys, subject, plaintext, challenge, subscription_active) {
    if(!recipients.length) {
      alert('Please add receiving email address.');
      return false;
    } else if(emails_without_pubkeys.length && !challenge.answer) {
      alert('Some recipients don\'t have encryption set up. Please add a password.');
      $('#input_password').focus();
      return false;
    } else if(attach.has_attachment() && emails_without_pubkeys.length && !subscription_active) {
      tool.env.increment('upgrade_notify_attach_nonpgp', function () {
        if(confirm('Sending password encrypted attachments is possible with CryptUp Advanced.\n\nIt\'s free for one year if you sign up now.')) {
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
    if(is_compose_form_rendered_as_ready(recipients)) {
      original_btn_html = $('#send_btn').html();
      $('#send_btn span').text('Loading');
      $('#send_btn i').replaceWith(tool.ui.spinner('white'));
      $('#send_btn_note').text('');
      storage_cryptup_subscription(function (subscription_level, subscription_expire, subscription_active) {
        collect_all_available_public_keys(account_email, recipients, function (armored_pubkeys, emails_without_pubkeys) {
          var challenge = { question: $('#input_password_hint').val() || '', answer: $('#input_password').val(), };
          if(are_compose_form_values_valid(recipients, emails_without_pubkeys, subject, plaintext, challenge, subscription_active)) {
            $('#send_btn span').text(attach.has_attachment() ? 'Encrypting attachments' : 'Encrypting');
            challenge = emails_without_pubkeys.length ? challenge : null;
            add_reply_token_to_message_body_if_needed(recipients, subject, plaintext, challenge, subscription_active, function(plaintext) {
              try {
                attach.collect_and_encrypt_attachments(armored_pubkeys, challenge, function (attachments) {
                  if(attachments.length && challenge) { // these will be password encrypted attachments
                    $('#send_btn span').text('Uploading attachments');
                    upload_attachments_to_cryptup(attachments, function (all_good, upload_results, upload_error_message) {
                      if(all_good === true) {
                        $('#send_btn span').text('Encrypting email');
                        plaintext = add_uploaded_file_links_to_message_body(plaintext, upload_results);
                        do_encrypt_message_body_and_format(armored_pubkeys, challenge, plaintext, attachments, recipients, false, send_email);
                      } else if(all_good === tool.api.cryptup.auth_error) {
                        if(confirm('Your CryptUp account information is outdated, please review your account settings.')) {
                          tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog', { source: 'auth_error' });
                        }
                        setTimeout(function() {
                          $('#send_btn').html(original_btn_html); // otherwise render_upload_progress will hijack this
                        }, 100);
                      } else {
                        alert('There was an error uploading attachments. Please try it again. Write me at tom@cryptup.org if it happens repeatedly.\n\n' + upload_error_message);
                        setTimeout(function() {
                          $('#send_btn').html(original_btn_html); // otherwise render_upload_progress will hijack this
                        }, 100);
                      }
                    });
                  } else {
                    do_encrypt_message_body_and_format(armored_pubkeys, challenge, plaintext, attachments, recipients, true, send_email);
                  }
                });
              } catch(err) {
                catcher.handle_exception(err);
                $('#send_btn').html(original_btn_html);
                alert(String(err));
              }
            });
          } else {
            $('#send_btn').html(original_btn_html);
          }
        });
      });
    }
  }

  function upload_attachments_to_cryptup(attachments, callback) {
    tool.api.cryptup.message_presign_files(attachments, function (pf_success, pf_result) {
      if(pf_success === true && pf_result && pf_result.approvals && pf_result.approvals.length === attachments.length) {
        var items = [];
        $.each(pf_result.approvals, function (i, approval) {
          items.push({base_url: approval.base_url, fields: approval.fields, attachment: attachments[i]});
        });
        tool.api.aws.s3_upload(items, function (all_uploaded, s3_results) {
          if(all_uploaded) {
            tool.api.cryptup.message_confirm_files(items.map(function(item) {return item.fields.key;}), function(cf_success, cf_result) {
              if(cf_success && cf_result && cf_result.confirmed && cf_result.confirmed.length === items.length) {
                $.each(attachments, function(i) {
                  attachments[i].url = pf_result.approvals[i].base_url + pf_result.approvals[i].fields.key;
                });
                callback(true, attachments);
              } else if(cf_success && cf_result && cf_result.confirmed) { // todo - retry confirming one more time, it may have been a timeout
                callback(false, null, 'Could not verify that all files were uploaded properly, please try again.');
              } else {
                callback(false, null, tool.api.cryptup.error_text(cf_result));
              }
            });
          } else { // todo - retry just the failed problematic files
            callback(false, null, 'Some files failed to upload, please try again');
          }
        }, render_upload_progress);
      } else if (pf_success === tool.api.cryptup.auth_error) {
        callback(tool.api.cryptup.auth_error);
      } else {
        callback(false, null, tool.api.cryptup.error_text(pf_result));
      }
    });
  }

  function render_upload_progress(progress) {
    if(attach.has_attachment()) {
      progress = Math.floor(progress);
      $('#send_btn > span').text(progress < 100 ? 'uploading attachments.. ' + progress + '%' : 'sending');
    }
  }

  function add_uploaded_file_links_to_message_body(plaintext, attachments) {
    plaintext += '\n\n';
    $.each(attachments, function (i, attachment) {
      var size_mb = attachment.size / (1024 * 1024);
      var size_text = size_mb < 0.1 ? '' : ' ' + (Math.round(size_mb * 10) / 10) + 'MB';
      var link_text = 'Attachment: ' + attachment.name + ' (' + attachment.type + ')' + size_text;
      var cryptup_data = tool.str.html_attribute_encode({ size: attachment.size, type: attachment.type, name: attachment.name });
      plaintext += '<a href="' + attachment.url + '" class="cryptup_file" cryptup-data="' + cryptup_data + '">' + link_text + '</a>\n';
    });
    return plaintext;
  }

  function add_reply_token_to_message_body_if_needed(recipients, subject, plaintext, challenge, subscription_active, callback) {
    if(challenge && subscription_active) {
      tool.api.cryptup.message_token(function(success, result) {
        if(success === tool.api.cryptup.auth_error) {
          if(confirm('Your CryptUp account information is outdated, please review your account settings.')) {
            tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog', { source: 'auth_error' });
          }
          $('#send_btn').html(original_btn_html);
        } else if(success === true && result && result.token) {
          callback(plaintext + '\n\n' + tool.e('div', {'style': 'display: none;', 'class': 'cryptup_reply', 'cryptup-data': tool.str.html_attribute_encode({
            sender: get_sender_from_dom(),
            recipient: tool.arr.without_value(tool.arr.without_value(recipients, get_sender_from_dom()), url_params.account_email),
            subject: subject,
            token: result.token,
          })}));
        } else {
          alert('There was an error sending this message. Please try again. Let me know at tom@cryptup.org if this happens repeatedly.\n\nmessage/token: ' + ((result || {}).error || 'unknown error'));
          $('#send_btn').html(original_btn_html);
        }
      });
    } else {
      callback(plaintext);
    }
  }

  function upload_encrypted_message_to_cryptup(encrypted_data, callback) {
    $('#send_btn span').text('Sending');
    // this is used when sending encrypted messages to people without encryption plugin
    // used to send it as a parameter in URL, but the URLs are way too long and not all clients can deal with it
    // the encrypted data goes through CryptUp and recipients get a link. They also get the encrypted data in message body.
    tool.api.cryptup.message_upload(encrypted_data, function(success, response) {
      if (success && response && response.short) {
        callback(response.short);
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

  function do_encrypt_message_body_and_format(armored_pubkeys, challenge, plaintext, attachments, recipients, attach_files_to_email, send_email) {
    tool.crypto.message.encrypt(armored_pubkeys, null, challenge, plaintext, true, function (encrypted) {
      if($('.bottom .icon.action_include_pubkey').length && $('.bottom .icon.action_include_pubkey').is('.active')) {
        encrypted.data += '\n\n\n' + private_storage_get('local', url_params.account_email, 'master_public_key', url_params.parent_tab_id);
      }
      var body = { 'text/plain': encrypted.data };
      $('#send_btn span').text(((attachments || []).length) && attach_files_to_email ? 'Uploading attachments' : 'Sending');
      db_contact_update(db, recipients, { last_use: Date.now() }, function () {
        if(challenge) {
          upload_encrypted_message_to_cryptup(encrypted.data, function(short_id, error) {
            if(short_id) {
              body = format_password_protected_email(short_id, body);
              body = format_email_footer(body);
              send_email(body, attachments, attach_files_to_email, email_footer);
            } else {
              alert('Could not send message, probably due to internet connection. Please click the SEND button again to retry.\n\n(Error:' + error + ')');
              $('#send_btn').html(original_btn_html);
            }
          });
        } else {
          body = format_email_footer(body);
          send_email(body, attachments, attach_files_to_email, email_footer);
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
        tool.api.attester.lookup_email(email, function (success, result) {
          if(success && result.email) {
            if(result.pubkey) {
              var parsed = openpgp.key.readArmored(result.pubkey);
              if(!parsed.keys[0]) {
                catcher.log('Dropping found but incompatible public key', {for: result.email, err: parsed.err ? ' * ' + parsed.err.join('\n * ') : null });
                result.pubkey = null;
              } else if (parsed.keys[0].getEncryptionKeyPacket() === null) {
                catcher.log('Dropping found+parsed key because getEncryptionKeyPacket===null', {for: result.email, fingerprint: tool.crypto.key.fingerprint(parsed.keys[0]) });
                result.pubkey = null;
              }
            }
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

  function get_password_validation_warning() {
    if(!$('#input_password').val()) {
      return 'No password entered';
    }
  }

  function show_hide_password_or_pubkey_container_and_color_send_button() {
    $("#send_btn span").text(BTN_ENCRYPT_AND_SEND);
    $("#send_btn_note").text('');
    $("#send_btn").attr('title', '');
    var was_previously_visible = $("#password_or_pubkey_container").css('display') === 'table-row';
    if(!$('.recipients span').length) {
      $("#password_or_pubkey_container").css('display', 'none');
      $('#send_btn').removeClass('gray').addClass('green');
    } else {
      if($('.recipients span.no_pgp').length) {
        $("#password_or_pubkey_container").css('display', 'table-row');
        if($('#input_password').val() || $('#input_password').is(':focus')) {
          $('.label_password').css('display', 'inline-block');
          $('#input_password').attr('placeholder', '');
        } else {
          $('.label_password').css('display', 'none');
          $('#input_password').attr('placeholder', 'one time password');
        }
        if(get_password_validation_warning()) {
          $('#send_btn').removeClass('green').addClass('gray');
        } else {
          $('#send_btn').removeClass('gray').addClass('green');
        }
      } else if($('.recipients span.failed, .recipients span.wrong').length) {
        $("#send_btn span").text(BTN_WRONG_ENTRY);
        $("#send_btn").attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
        $("#send_btn").removeClass('green').addClass('gray');
      } else {
        $("#password_or_pubkey_container").css('display', 'none');
        $('#send_btn').removeClass('gray').addClass('green');
      }
    }
    if(is_reply_box) {
      if(!was_previously_visible && $("#password_or_pubkey_container").css('display') === 'table-row') {
        resize_reply_box($("#password_or_pubkey_container").first().height() + 20);
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
        if($('#contacts .select_contact.hover').length) {
          $('#contacts .select_contact.hover').click();
        } else {
          $('#contacts .select_contact').first().click();
        }
      }
      $('#input_to').focus().blur();
      return false;
    }
  }

  function resize_reply_box(add_extra) {
    if(is_reply_box) {
      if(isNaN(add_extra)) {
        add_extra = 0;
      }
      $('div#input_text').css('max-width', ($('body').width() - 20) + 'px');
      if($('#reply_message_successful_container').is(':visible')) {
        var current_height = $('#reply_message_successful_container').height();
      } else {
        var current_height = $('table#compose').height();
      }
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
    var input_to = $('#input_to').val().toLowerCase();
    if(tool.value(',').in(input_to)) {
      var emails = input_to.split(',');
      for(var i = 0; i < emails.length - 1; i++) {
        $('#input_to').siblings('.recipients').append('<span>' + emails[i] + tool.ui.spinner('green') + '</span>');
      }
    } else if(!$('#input_to').is(':focus') && input_to) {
      $('#input_to').siblings('.recipients').append('<span>' + input_to + tool.ui.spinner('green') + '</span>');
    } else {
      return;
    }
    $('#input_to').val('');
    resize_input_to();
    evaluate_receivers();
  }

  function select_contact(email, from_query) {
    var possibly_bogus_recipient = $('.recipients span.wrong').last();
    var possibly_bogus_address = tool.str.trim_lower(possibly_bogus_recipient.text());
    var q = tool.str.trim_lower(from_query.substring);
    if(possibly_bogus_address === q || tool.value(q).in(possibly_bogus_address)) {
      possibly_bogus_recipient.remove();
    }
    setTimeout(function() {
      if(!tool.value(email).in(get_recipients_from_dom())) {
        $('#input_to').val(tool.str.trim_lower(email));
        render_receivers();
        $('#input_to').focus();
      }
    }, tool.int.random(20, 100)); // desperate amount to remove duplicates. Better solution advisable.
    hide_contacts();
  }

  function resize_input_to() {
    $('#input_to').css('width', (Math.max(150, $('#input_to').parent().width() - $('#input_to').siblings('.recipients').width() - 50)) + 'px');
  }

  function remove_receiver() {
    recipients_missing_my_key = tool.arr.without_value(recipients_missing_my_key, $(this).parent().text());
    $(this).parent().remove();
    resize_input_to();
    show_hide_password_or_pubkey_container_and_color_send_button();
    update_pubkey_icon();
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
          ul_html += '<img src="/img/svgs/locked-icon-green.svg" />';
        } else {
          ul_html += '<img src="/img/svgs/locked-icon-gray.svg" />';
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
      $('#contacts ul li.select_contact').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) { select_contact(tool.str.trim_lower($(self).attr('email')), query); }));
      $('#contacts ul li.select_contact').hover(function () { $(this).addClass('hover'); }, function () { $(this).removeClass('hover'); });
      $('#contacts ul li.auth_contacts').click(function () { auth_contacts(url_params.account_email); });
      $('#contacts').css({ display: 'block', top: ($('#compose > tbody > tr:first').height() + $('#input_addresses_container > div:first').height() + 10) + 'px' });
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

  function update_pubkey_icon(include) {
    if(include === null || typeof include === 'undefined') { // decide if pubkey should be included
      if(!include_pubkey_toggled_manually) { // leave it as is if toggled manually before
        update_pubkey_icon(recipients_missing_my_key.length && !tool.value(get_sender_from_dom()).in(my_addresses_on_pks));
      }
    } else { // set icon to specific state
      if(include) {
        $('.bottom .icon.action_include_pubkey').addClass('active').attr('title', l.include_pubkey_icon_title_active);
      } else {
        $('.bottom .icon.action_include_pubkey').removeClass('active').attr('title', l.include_pubkey_icon_title);
      }
    }
  }

  function update_footer_icon(include) {
    if(include === null || typeof include === 'undefined') { // decide if pubkey should be included
      update_footer_icon(!!email_footer);
    } else { // set icon to specific state
      if(include) {
        $('.bottom .icon.action_include_footer').addClass('active');
      } else {
        $('.bottom .icon.action_include_footer').removeClass('active');
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
            update_pubkey_icon();
          });
        } else {
          update_pubkey_icon();
        }
      } else {
        update_pubkey_icon();
      }
    }
    $(email_element).children('img, i').remove();
    $(email_element).append('<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" />').find('img.close-icon').click(remove_receiver);
    if(contact === PUBKEY_LOOKUP_RESULT_FAIL) {
      $(email_element).attr('title', 'Loading contact information failed, please try to add their email again.');
      $(email_element).addClass("failed");
      $(email_element).children('img').replaceWith('<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">');
      $(email_element).find('.action_retry_pubkey_fetch').click(remove_receiver); // todo - actual refresh
    } else if(contact === PUBKEY_LOOKUP_RESULT_WRONG) {
      $(email_element).attr('title', 'This email address looks misspelled. Please try again.');
      $(email_element).addClass("wrong");
    } else if(contact.has_pgp && tool.crypto.key.expired_for_encryption(openpgp.key.readArmored(contact.pubkey).keys[0])) {
      $(email_element).addClass("expired");
      $(email_element).prepend('<img src="/img/svgs/expired-timer.svg" class="expired-time">');
      $(email_element).attr('title', 'Does use encryption but their public key is expired. You should ask them to send you an updated public key.' + recipient_key_id_text(contact));
    } else if(contact.has_pgp && contact.attested) {
      $(email_element).addClass("attested");
      $(email_element).prepend('<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Does use encryption, attested by CRYPTUP' + recipient_key_id_text(contact));
    } else if(contact.has_pgp) {
      $(email_element).addClass("has_pgp");
      $(email_element).prepend('<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Does use encryption' + recipient_key_id_text(contact));
    } else {
      $(email_element).addClass("no_pgp");
      $(email_element).prepend('<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
    }
    show_hide_password_or_pubkey_container_and_color_send_button();
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
    $('#input_to').keyup(tool.ui.event.prevent(tool.ui.event.spree('veryslow'), search_contacts));
    $('#input_to').blur(tool.ui.event.prevent(tool.ui.event.double(), render_receivers));
    $('#input_text').keyup(function () {
      $('#send_btn_note').text('');
    });
    $('table#compose').click(hide_contacts);
    $('#input_addresses_container > div').click(function () {
      if(!$('#input_to').is(':focus')) {
        $('#input_to').focus();
      }
    }).children().click(function () { return false; });
    resize_input_to();
    attach.initialize_attach_dialog('fineuploader', 'fineuploader_button');
  }

  function should_save_draft(message_body) {
    if(message_body && message_body !== last_draft) {
      last_draft = message_body;
      return true;
    } else {
      return false;
    }
  }

  function format_password_protected_email(short_id, original_bodies) {
    var decrypt_url = 'https://cryptup.org/' + short_id;
    var new_bodies = { 'text/plain': [l.open_password_protected_message + ' ' + decrypt_url, '', original_bodies['text/plain']].join('\n') };
    if(original_bodies['text/html']) {
      new_bodies['text/html'] = [l.open_password_protected_message.replace(/ /g, '&nbsp;') + ' <a href="' + tool.str.html_escape(decrypt_url) + '">' + tool.str.html_escape(decrypt_url) + '</a>', '', original_bodies['text/html']].join('<br>\n');
    }
    return new_bodies;
  }

  function format_email_footer(body) {
    return {
      'text/plain': body['text/plain'] + (email_footer ? '\n' + email_footer : ''),
    };
  }

  $('#input_password').keyup(tool.ui.event.prevent(tool.ui.event.spree(), show_hide_password_or_pubkey_container_and_color_send_button));
  $('#input_password').focus(show_hide_password_or_pubkey_container_and_color_send_button);
  $('#input_password').blur(show_hide_password_or_pubkey_container_and_color_send_button);

  $('.add_pubkey').click(function () {
    if(url_params.placement !== 'settings') {
      tool.browser.message.send(url_params.parent_tab_id, 'add_pubkey_dialog_gmail', { emails: get_recipients_from_dom('no_pgp') });
    } else {
      $.featherlight({ iframe: factory.src.add_pubkey_dialog(get_recipients_from_dom('no_pgp'), 'settings'), iframeWidth: 515, iframeHeight: $('html').height() - 50 });
    }
    clearInterval(added_pubkey_db_lookup_interval); // todo - get rid of setInterval. just supply tab_id and wait for direct callback
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

  $('.action_feedback').click(function () {
    tool.browser.message.send(null, 'settings', { account_email: url_params.account_email, page: '/chrome/settings/modules/help.htm' });
  });

  $('#input_from').change(function () {
    // when I change input_from, I should completely re-evaluate: update_pubkey_icon() and render_pubkey_result()
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
    update_pubkey_icon(!$(this).is('.active'));
  });

  $('.icon.action_include_footer').click(function () {
    if(!$(this).is('.active')) {
      var noscroll = function() { $('.featherlight.noscroll > .featherlight-content > iframe').attr('scrolling', 'no'); };
      $.featherlight({iframe: factory.src.add_footer_dialog('compose'), iframeWidth: 490, iframeHeight: 230, variant: 'noscroll', afterContent: noscroll});
    } else {
      update_footer_icon(!$(this).is('.active'));
    }
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
    update_pubkey_icon: update_pubkey_icon,
    get_recipients_from_dom: get_recipients_from_dom,
    get_sender_from_dom: get_sender_from_dom,
    on_render: on_render,
    render_upload_progress: render_upload_progress,
  };

}
