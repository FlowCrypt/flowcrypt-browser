/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

function init_shared_compose_js(url_params, db, subscription, message_sent_callback, disable_automatic_behavior) {

  var L = {
    message_encrypted_html: 'This&nbsp;message&nbsp;is&nbsp;encrypted: ',
    message_encrypted_text: 'This message is encrypted. Follow this link to open it: ',
    alternatively_copy_paste: 'Alternatively copy and paste the following link: ',
    open_message: 'Open Message',
    include_pubkey_icon_title: 'Include your Public Key with this message.\n\nThis allows people using non-CryptUp encryption to reply to you.',
    include_pubkey_icon_title_active: 'Your Public Key will be included with this message.\n\nThis allows people using non-CryptUp encryption to reply to you.',
    header_title_compose_encrypt: 'New Secure Message',
    header_title_compose_sign: 'New Signed Message (not encrypted)',
  };

  var S = tool.ui.build_jquery_selectors({
    body: 'body',
    compose_table: 'table#compose',
    header: 'table#compose th',
    title: 'table#compose th h1',
    input_text: 'div#input_text',
    input_to: '#input_to',
    input_from: '#input_from',
    input_subject: '#input_subject',
    input_password: '#input_password',
    input_intro: '.input_intro',
    add_intro: '.action_add_intro',
    add_their_pubkey: '.add_pubkey',
    intro_container: '.intro_container',
    password_or_pubkey: '#password_or_pubkey_container',
    password_label: '.label_password',
    send_btn_note: '#send_btn_note',
    send_btn_span: '#send_btn span',
    send_btn_i: '#send_btn i',
    send_btn: '#send_btn',
    icon_pubkey: '.icon.action_include_pubkey',
    icon_footer: '.icon.action_include_footer',
    icon_help: '.action_feedback',
    icon_sign: '.icon.action_sign',
    reply_message_prompt: 'div#reply_message_prompt',
    reply_message_successful: '#reply_message_successful_container',
  });

  var SAVE_DRAFT_FREQUENCY = 3000;
  var PUBKEY_LOOKUP_RESULT_WRONG = 'wrong';
  var PUBKEY_LOOKUP_RESULT_FAIL = 'fail';
  var BTN_ENCRYPT_AND_SEND = 'encrypt and send';
  var BTN_SIGN_AND_SEND = 'sign and send';
  var BTN_WRONG_ENTRY = 're-enter recipient..';
  var BTN_LOADING = 'loading..';
  var CRYPTUP_WEB_URL = 'https://cryptup.org';

  var factory;
  var attach = !disable_automatic_behavior ? init_shared_attach_js(get_max_attachment_size_and_oversize_notice) : null;

  var last_draft = '';
  var draft_id;
  var can_save_drafts;
  var can_read_emails;
  var last_reply_box_table_height;
  var contact_search_in_progress = false;
  var added_pubkey_db_lookup_interval;
  var save_draft_interval = !disable_automatic_behavior ? setInterval(draft_save, SAVE_DRAFT_FREQUENCY) : null;
  var save_draft_in_process = false;
  var passphrase_interval;
  var include_pubkey_toggled_manually = false;
  var my_addresses_on_pks = [];
  var my_addresses_on_keyserver = [];
  var recipients_missing_my_key = [];
  var keyserver_lookup_results_by_email = {};
  var is_reply_box = Boolean($('body#reply_message').length);
  var email_footer;
  var tab_id;
  var subscribe_result_listener;
  var additional_message_headers = {};
  var email_provider;
  var button_update_timeout;

  tool.browser.message.tab_id(function (id) {
    tab_id = id;
    factory = !disable_automatic_behavior ? element_factory(url_params.account_email, tab_id) : null;
    tool.browser.message.listen({
      close_dialog: function (data) {
        $('.featherlight.featherlight-iframe').remove();
      },
      set_footer: function (data) {
        email_footer = data.footer;
        update_footer_icon();
        $('.featherlight.featherlight-iframe').remove();
      },
      subscribe: show_subscribe_dialog_and_wait_for_response,
      subscribe_result: function(new_subscription) {
        if(new_subscription.active && !subscription.active) {
          subscription.active = new_subscription.active; // todo - deal with levels later
        }
        if(typeof subscribe_result_listener === 'function') {
          subscribe_result_listener(new_subscription.active);
          subscribe_result_listener = undefined;
        }
      },
      passphrase_entry: function(data) {
        if(data && data.entered === false) {
          clearInterval(passphrase_interval);
          reset_send_btn();
        }
      },
      reply_pubkey_mismatch: function(data) {
        if(is_reply_box) {
          window.location = tool.env.url_create('reply_pubkey_mismatch.htm', url_params);
        }
      },
    }, tab_id);
  });

  function show_subscribe_dialog_and_wait_for_response(data, sender, respond) {
    subscribe_result_listener = respond;
    tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog', {subscribe_result_tab_id: tab_id});
  }

  S.cached('icon_pubkey').attr('title', L.include_pubkey_icon_title);

  // set can_save_drafts, addresses_pks
  account_storage_get(url_params.account_email, ['google_token_scopes', 'addresses_pks', 'addresses_keyserver', 'email_footer', 'email_provider', 'hide_message_password'], function (storage) {
    email_provider = storage.email_provider || 'gmail';
    my_addresses_on_pks = storage.addresses_pks || [];
    my_addresses_on_keyserver = storage.addresses_keyserver || [];
    can_save_drafts = tool.api.gmail.has_scope(storage.google_token_scopes, 'compose');
    can_read_emails = tool.api.gmail.has_scope(storage.google_token_scopes, 'read');
    if(subscription.active) {
      email_footer = storage.email_footer;
      update_footer_icon();
    }
    if(!can_save_drafts) {
      S.cached('send_btn_note').html('<a href="#" class="auth_drafts hover_underline">Enable encrypted drafts</a>');
      S.cached('send_btn_note').find('a.auth_drafts').click(auth_drafts);
    }
    if(storage.hide_message_password) {
      S.cached('input_password').attr('type', 'password');
    }
  });

  function get_max_attachment_size_and_oversize_notice() {
    if(!subscription.active) {
      return {
        size_mb: 5,
        size: 5 * 1024 * 1024,
        count: 10,
        oversize: function(combined_size) {
          if(confirm('The files are over 5 MB. Advanced users can send files up to 25 MB. Try it free for 30 days.')) {
            show_subscribe_dialog_and_wait_for_response(null, null, function(new_subscription_active) {
              if(new_subscription_active) {
                alert('You\'re all set, now you can add your file again.');
              }
            });
          }
        },
      };
    } else {
      return {
        size_mb: 25,
        size: 25 * 1024 * 1024,
        count: 10,
        oversize: function(combined_size) {
          alert('Combined attachment size is limited to 25 MB. The last file brings it to ' + Math.ceil(combined_size / (1024 * 1024)) + ' MB.');
        },
      };
    }
  }

  function reset_send_btn(delay) {
    var do_reset = function() {
      S.cached('send_btn').html('<i class=""></i><span tabindex="4">' + (S.cached('icon_sign').is('.active') ? BTN_SIGN_AND_SEND : BTN_ENCRYPT_AND_SEND) + '</span>');
    };
    clearTimeout(button_update_timeout);
    if(!delay) {
      do_reset();
    } else {
      setTimeout(do_reset, delay);
    }
  }

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
        account_storage_set(url_params.account_email, { drafts_reply: drafts }, then);
      } else { // it's a new message
        var drafts = storage.drafts_compose || {};
        if(store_if_true) {
          drafts[draft_id] = { recipients: recipients, subject: subject, date: new Date().getTime() };
        } else {
          delete drafts[draft_id];
        }
        account_storage_set(url_params.account_email, { drafts_compose: drafts }, then);
      }
    });
  }

  function draft_save(force_save) {
    if(can_save_drafts && (should_save_draft(S.cached('input_text').text()) || force_save === true)) {
      save_draft_in_process = true;
      S.cached('send_btn_note').text('Saving');
      var armored_pubkey = private_storage_get('local', url_params.account_email, 'master_public_key', url_params.parent_tab_id);
      tool.crypto.message.encrypt([armored_pubkey], null, null, S.cached('input_text')[0].innerText, null, true, function (encrypted) {
        if(url_params.thread_id) { // replied message
          var body = '[cryptup:link:draft_reply:' + url_params.thread_id + ']\n\n' + encrypted.data;
        } else if(draft_id) {
          var body = '[cryptup:link:draft_compose:' + draft_id + ']\n\n' + encrypted.data;
        } else {
          var body = encrypted.data;
        }
        tool.mime.encode(body, { To: get_recipients_from_dom(), From: url_params.from || get_sender_from_dom(), Subject: S.cached('input_subject').val() || url_params.subject || 'CryptUp draft' }, [], function (mime_message) {
          if(!draft_id) {
            tool.api.gmail.draft_create(url_params.account_email, mime_message, url_params.thread_id, function (success, response) {
              S.cached('send_btn_note').text(success ? 'Saved' : 'Not saved');
              if(success) {
                draft_id = response.id;
                draft_meta_store(true, response.id, url_params.thread_id, get_recipients_from_dom(), S.cached('input_subject').val());
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
              S.cached('send_btn_note').text(success ? 'Saved' : 'Not saved');
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
      openpgp.decrypt({ message: openpgp.message.readArmored(encrypted_draft), format: 'utf8', privateKey: private_key }).then(function (plaintext) {
        tool.str.as_safe_html(plaintext.data.replace(/\n/g, '<br>\n'), function(safe_html_draft) {
          S.cached('input_text').html(safe_html_draft);
          if(headers && headers.to && headers.to.length) {
            S.cached('input_to').focus();
            S.cached('input_to').val(headers.to.join(','));
            S.cached('input_text').focus();
          }
          if(headers && headers.from) {
            S.now('input_from').val(headers.from);
          }
          if(render_function) {
            render_function();
          }
        });
      }).catch(function (error) {
        console.log('openpgp.decrypt(options).catch(error)');
        console.log(error);
        if(render_function) {
          render_function();
        }
      });
    } else {
      if(is_reply_box) {
        S.now('reply_message_prompt').html(tool.ui.spinner('green') + ' Waiting for pass phrase to open previous draft..');
        when_master_passphrase_entered(function(passphrase) {
          decrypt_and_render_draft(url_params.account_email, encrypted_draft);
        });
      }
    }
  }

  function when_master_passphrase_entered(callback, seconds_timeout) {
    clearInterval(passphrase_interval);
    var timeout_at = seconds_timeout ? Date.now() + seconds_timeout * 1000 : null;
    passphrase_interval = setInterval(function () {
      var passphrase = get_passphrase(url_params.account_email);
      if(passphrase !== null) {
        clearInterval(passphrase_interval);
        callback(passphrase);
      } else if (timeout_at && Date.now() > timeout_at) {
        clearInterval();
        callback(null);
      }
    }, 1000);
  }

  function collect_all_available_public_keys(account_email, recipients, callback) {
    db_contact_get(db, recipients, function (contacts) {
      var armored_pubkeys = [private_storage_get('local', account_email, 'master_public_key', url_params.parent_tab_id)];
      var emails_without_pubkeys = [];
      tool.each(contacts, function (i, contact) {
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
    if(tool.value(S.now('send_btn_span').text().toLowerCase().trim()).in([BTN_ENCRYPT_AND_SEND, BTN_SIGN_AND_SEND]) && recipients && recipients.length) {
      return true;
    } else {
      if(S.now('send_btn_span').text().toLowerCase().trim() === BTN_WRONG_ENTRY) {
        alert('Please re-enter recipients marked in red color.');
      } else if(!recipients || !recipients.length) {
        alert('Please add a recipient first');
      } else {
        alert('Still working, please wait.');
      }
      return false;
    }
  }

  function are_compose_form_values_valid(recipients, emails_without_pubkeys, subject, plaintext, challenge) {
    var is_encrypt = !S.cached('icon_sign').is('.active');
    if(!recipients.length) {
      alert('Please add receiving email address.');
      return false;
    } else if(is_encrypt && emails_without_pubkeys.length && !challenge.answer) {
      alert('Some recipients don\'t have encryption set up. Please add a password.');
      S.cached('input_password').focus();
      return false;
    } else if((plaintext !== '' || window.confirm('Send empty message?')) && (subject !== '' || window.confirm('Send without a subject?'))) {
      return true; //todo - tailor for replying w/o subject
    } else {
      return false;
    }
  }

  function handle_send_btn_processing_error(callback) {
    try {
      callback();
    } catch(err) {
      catcher.handle_exception(err);
      reset_send_btn();
      alert(String(err));
    }
  }

  function extract_process_encrypt_and_send_message() {
    var recipients = get_recipients_from_dom();
    var subject = url_params.subject || $('#input_subject').val(); // replies have subject in url params
    var plaintext = $('#input_text').get(0).innerText;
    if(is_compose_form_rendered_as_ready(recipients)) {
      S.now('send_btn_span').text('Loading');
      S.now('send_btn_i').replaceWith(tool.ui.spinner('white'));
      S.cached('send_btn_note').text('');
      storage_cryptup_subscription(function (_l, _e, _active) { // todo - this should be removed. subscribtion_subscribe should be dynamically updated, and used here
        collect_all_available_public_keys(url_params.account_email, recipients, function (armored_pubkeys, emails_without_pubkeys) {
          var challenge = emails_without_pubkeys.length ? { answer: S.cached('input_password').val() } : null;
          if(are_compose_form_values_valid(recipients, emails_without_pubkeys, subject, plaintext, challenge)) {
            if(S.cached('icon_sign').is('.active')) {
              sign_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, _active);
            } else {
              encrypt_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, _active);
            }
          } else {
            reset_send_btn();
          }
        });
      });
    }
  }

  function encrypt_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, _active) {
    S.now('send_btn_span').text('Encrypting');
    add_reply_token_to_message_body_if_needed(recipients, subject, plaintext, challenge, _active, function(plaintext) {
      handle_send_btn_processing_error(function () {
        attach.collect_and_encrypt_attachments(armored_pubkeys, challenge, function (attachments) {
          if(attachments.length && challenge) { // these will be password encrypted attachments
            button_update_timeout = setTimeout(function() {
              S.now('send_btn_span').text('sending');
            }, 500);
            upload_attachments_to_cryptup(attachments, _active, function (all_good, upload_results, attachment_admin_codes, upload_error_message) {
              if(all_good === true) {
                plaintext = add_uploaded_file_links_to_message_body(plaintext, upload_results);
                do_encrypt_message_body_and_format(armored_pubkeys, challenge, plaintext, [], recipients, subject, _active, attachment_admin_codes);
              } else if(all_good === tool.api.cryptup.auth_error) {
                if(confirm('Your CryptUp account information is outdated, please review your account settings.')) {
                  tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog', { source: 'auth_error' });
                }
                reset_send_btn(100);
              } else {
                alert('There was an error uploading attachments. Please try it again. Write me at tom@cryptup.org if it happens repeatedly.\n\n' + upload_error_message);
                reset_send_btn(100);
              }
            });
          } else {
            do_encrypt_message_body_and_format(armored_pubkeys, challenge, plaintext, attachments, recipients, subject, _active);
          }
        });
      });
    });
  }

  function sign_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, _active) {
    S.now('send_btn_span').text('Signing');
    var keyinfo = private_keys_get(url_params.account_email, 'primary');
    if(keyinfo) {
      var prv = openpgp.key.readArmored(keyinfo.armored).keys[0];
      var passphrase = get_passphrase(url_params.account_email);
      if(passphrase === null) {
        tool.browser.message.send(url_params.parent_tab_id, 'passphrase_dialog', { type: 'sign', longids: 'primary' });
        when_master_passphrase_entered(function (passphrase) {
          if(passphrase) {
            sign_and_send(recipients, armored_pubkeys, subject, plaintext, challenge, _active);
          } else { // timeout - reset
            clearInterval(passphrase_interval);
            reset_send_btn();
          }
        }, 60);
      } else {
        tool.env.set_up_require();
        require(['emailjs-mime-codec'], function (MimeCodec) {

          // Folding the lines or GMAIL WILL RAPE THE TEXT, regardless of what encoding is used
          // https://mathiasbynens.be/notes/gmail-plain-text applies to API as well
          // resulting in.. wait for it.. signatures that don't match
          // if you are reading this and have ideas about better solutions which:
          //  - don't involve text/html ( Enigmail refuses to fix: https://sourceforge.net/p/enigmail/bugs/218/ - Patrick Brunschwig - 2017-02-12 )
          //  - don't require text to be sent as an attachment
          //  - don't require all other clients to support PGP/MIME
          // then please let me know. Eagerly waiting! In the meanwhile..
          plaintext = MimeCodec.foldLines(plaintext, 76, true);

          tool.crypto.key.decrypt(prv, passphrase);
          tool.crypto.message.sign(prv, format_email_text_footer({'text/plain': plaintext})['text/plain'], true, function (success, signing_result) {
            if(success) {
              handle_send_btn_processing_error(function () {
                attach.collect_attachments(function (attachments) { // todo - not signing attachments
                  db_contact_update(db, recipients, { last_use: Date.now() }, function () {
                    S.now('send_btn_span').text('Sending');
                    var body = { 'text/plain': with_attached_pubkey_if_needed(signing_result) };
                    do_send_message(tool.api.common.message(url_params.account_email, url_params.from || get_sender_from_dom(), recipients, subject, body, attachments, url_params.thread_id), plaintext);
                  });
                });
              });
            } else {
              catcher.log('error signing message. Error:' + signing_result);
              alert('There was an error signing this message. Please write me at tom@cryptup.org, I resolve similar issues very quickly.\n\n' + signing_result);
              reset_send_btn();
            }
          });
        });
      }
    } else {
      alert('Cannot sign the message because your plugin is not correctly set up. Write me at tom@cryptup.org if this persists.');
      reset_send_btn();
    }
  }

  function upload_attachments_to_cryptup(attachments, _active, callback) {
    tool.api.cryptup.message_presign_files(attachments, _active ? 'uuid' : null).validate(r => r.approvals && r.approvals.length === attachments.length).then(pf_response => {
      var items = [];
      tool.each(pf_response.approvals, function (i, approval) {
        items.push({base_url: approval.base_url, fields: approval.fields, attachment: attachments[i]});
      });
      tool.api.aws.s3_upload(items, render_upload_progress).then(s3_results_successful => {
        tool.api.cryptup.message_confirm_files(items.map(function(item) {return item.fields.key;})).validate(r => r.confirmed && r.confirmed.length === items.length).then(cf_response => {
          tool.each(attachments, function (i) {
            attachments[i].url = pf_response.approvals[i].base_url + pf_response.approvals[i].fields.key;
          });
          callback(true, attachments, cf_response.admin_codes);
        }, error => {
          if(error.internal === 'validate') {
            callback(false, null, null, 'Could not verify that all files were uploaded properly, please try again.');
          } else {
            callback(false, null, null, error.message);
          }
        });
      }, s3_results_has_failure => callback(false, null, null, 'Some files failed to upload, please try again') );
    }, error => {
      if (error.internal === 'auth') {
        callback(error);
      } else {
        callback(false, null, null, error.message);
      }
    });
  }

  function render_upload_progress(progress) {
    if(attach.has_attachment()) {
      progress = Math.floor(progress);
      S.now('send_btn_span').text(progress < 100 ? 'sending.. ' + progress + '%' : 'sending');
    }
  }

  function add_uploaded_file_links_to_message_body(plaintext, attachments) {
    plaintext += '\n\n';
    tool.each(attachments, function (i, attachment) {
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
      tool.api.cryptup.message_token().validate(r => r.token).then(response => {
        callback(plaintext + '\n\n' + tool.e('div', {
            'style': 'display: none;', 'class': 'cryptup_reply', 'cryptup-data': tool.str.html_attribute_encode({
              sender: url_params.from || get_sender_from_dom(),
              recipient: tool.arr.without_value(tool.arr.without_value(recipients, url_params.from || get_sender_from_dom()), url_params.account_email),
              subject: subject,
              token: response.token,
            })
          }));
      }, error => {
        if(error.internal === 'auth') {
          if(confirm('Your CryptUp account information is outdated, please review your account settings.')) {
            tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog', { source: 'auth_error' });
          }
          reset_send_btn();
        } else if(error.internal === 'subscription') {
          callback(plaintext); // just skip and leave as is
        } else {
          alert('There was an error sending this message. Please try again. Let me know at tom@cryptup.org if this happens repeatedly.\n\nmessage/token: ' + error.message);
          reset_send_btn();
        }
      });
    } else {
      callback(plaintext);
    }
  }

  function upload_encrypted_message_to_cryptup(encrypted_data, _active, callback) {
    S.now('send_btn_span').text('Sending');
    // this is used when sending encrypted messages to people without encryption plugin
    // used to send it as a parameter in URL, but the URLs are way too long and not all clients can deal with it
    // the encrypted data goes through CryptUp and recipients get a link.
    // admin_code stays locally and helps the sender extend life of the message or delete it
    tool.api.cryptup.message_upload(encrypted_data,  _active ? 'uuid' : null).validate(r => r.short && r.admin_code).then(response => {
      callback(response.short, response.admin_code);
    }, error => {
      if(error.internal === 'auth') {
        callback(null, null, tool.api.cryptup.auth_error);
      } else {
        callback(null, null, error.internal || error.message);
      }
    });
  }

  function with_attached_pubkey_if_needed(encrypted) {
    if(S.cached('icon_pubkey').is('.active')) {
      encrypted += '\n\n' + private_storage_get('local', url_params.account_email, 'master_public_key', url_params.parent_tab_id);
    }
    return encrypted;
  }

  function do_encrypt_message_body_and_format(armored_pubkeys, challenge, plaintext, attachments, recipients, subject, _active, attachment_admin_codes) {
    tool.crypto.message.encrypt(armored_pubkeys, null, challenge, plaintext, null, true, function (encrypted) {
      encrypted.data = with_attached_pubkey_if_needed(encrypted.data);
      var body = { 'text/plain': encrypted.data };
      button_update_timeout = setTimeout(function() {
        S.now('send_btn_span').text('sending');
      }, 500);
      db_contact_update(db, recipients, { last_use: Date.now() }, function () {
        if(challenge) {
          upload_encrypted_message_to_cryptup(encrypted.data, _active, function(short_id, message_admin_code, error) {
            if(short_id) {
              body = format_password_protected_email(short_id, body, armored_pubkeys);
              body = format_email_text_footer(body);
              add_admin_codes_to_storage(short_id, message_admin_code, attachment_admin_codes, function () {
                do_send_message(tool.api.common.message(url_params.account_email, url_params.from || get_sender_from_dom(), recipients, subject, body, attachments, url_params.thread_id), plaintext);
              });
            } else {
              if(error === tool.api.cryptup.auth_error) {
                if(confirm('Your CryptUp account information is outdated, please review your account settings.')) {
                  tool.browser.message.send(url_params.parent_tab_id, 'subscribe_dialog', { source: 'auth_error' });
                }
              } else {
                alert('Could not send message, probably due to internet connection. Please click the SEND button again to retry.\n\n(Error:' + error + ')');
              }
              reset_send_btn();
            }
          });
        } else {
          body = format_email_text_footer(body);
          do_send_message(tool.api.common.message(url_params.account_email, url_params.from || get_sender_from_dom(), recipients, subject, body, attachments, url_params.thread_id), plaintext);
        }
      });
    });
  }

  function add_admin_codes_to_storage(short_id, message_admin_code, attachment_admin_codes, callback) {
    account_storage_get(null, ['admin_codes'], function (storage) {
      storage.admin_codes = storage.admin_codes || {};
      storage.admin_codes[short_id] = {date: Date.now(), codes: [message_admin_code].concat(attachment_admin_codes || [])};
      account_storage_set(null, storage, callback);
    });
  }

  function do_send_message(message, plaintext) {
    tool.each(additional_message_headers, function (k, h) {
      message.headers[k] = h;
    });
    tool.api[email_provider].message_send(url_params.account_email, message, function (success, response) {
      if(success) {
        var is_signed = S.cached('icon_sign').is('.active');
        tool.browser.message.send(url_params.parent_tab_id, 'notification_show', { notification: 'Your ' + (is_signed ? 'signed' : 'encrypted') + ' message has been sent.' });
        draft_delete(url_params.account_email, function () {
          tool.env.increment('compose', function () {
            message_sent_callback(message, plaintext, email_footer, response ? response.id : null);
          });
        });
      } else {
        handle_send_message_error(response);
      }
    }, render_upload_progress);
  }

  function handle_send_message_error(response) {
    reset_send_btn();
    if(response && response.status === 413) {
      S.now('send_btn_i').attr('class', '');
      tool.env.increment('upgrade_notify_attach_size', function () {
        alert('Currently, total attachments size should be under 5MB. Larger files will be possible very soon.');
      });
    } else {
      catcher.log('tool.api.' + email_provider + '.message_send error response from ' +  email_provider, response);
      alert('Error sending message, try to re-open your web mail window and send again. Write me at tom@cryptup.org if this happens repeatedly.');
    }
  }

  function lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed(email, callback) {
    db_contact_get(db, email, function (db_contact) {
      if(db_contact && db_contact.has_pgp && db_contact.pubkey) {
        callback(db_contact);
      } else {
        tool.api.attester.lookup_email(email).done((success, result) => {
          if(success && result && result.email) {
            if(result.pubkey) {
              var parsed = openpgp.key.readArmored(result.pubkey);
              if(!parsed.keys[0]) {
                catcher.info('Dropping found but incompatible public key', {for: result.email, err: parsed.err ? ' * ' + parsed.err.join('\n * ') : null });
                result.pubkey = null;
              } else if (parsed.keys[0].getEncryptionKeyPacket() === null) {
                catcher.info('Dropping found+parsed key because getEncryptionKeyPacket===null', {for: result.email, fingerprint: tool.crypto.key.fingerprint(parsed.keys[0]) });
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
      var email = tool.str.parse_email($(email_element).text()).email;
      if(tool.str.is_email_valid(email)) {
        S.now('send_btn_span').text(BTN_LOADING);
        lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed(email, function (pubkey_lookup_result) {
          render_pubkey_result(email_element, email, pubkey_lookup_result);
        });
      } else {
        render_pubkey_result(email_element, email, PUBKEY_LOOKUP_RESULT_WRONG);
      }
    });
  }

  function get_password_validation_warning() {
    if(!S.cached('input_password').val()) {
      return 'No password entered';
    }
  }

  function show_message_password_ui_and_color_button() {
    S.cached('password_or_pubkey').css('display', 'table-row');
    S.cached('password_or_pubkey').css('display', 'table-row');
    if(S.cached('input_password').val() || S.cached('input_password').is(':focus')) {
      S.cached('password_label').css('display', 'inline-block');
      S.cached('input_password').attr('placeholder', '');
    } else {
      S.cached('password_label').css('display', 'none');
      S.cached('input_password').attr('placeholder', 'one time password');
    }
    if(get_password_validation_warning()) {
      S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if(S.cached('input_intro').is(':visible')) {
      S.cached('add_intro').css('display', 'none');
    } else {
      S.cached('add_intro').css('display', 'block');
    }
  }

  function hide_message_password_ui() {
    S.cached('password_or_pubkey').css('display', 'none');
    S.cached('input_password').val('');
    S.cached('add_intro').css('display', 'none');
    S.cached('input_intro').text('');
    S.cached('intro_container').css('display', 'none');
  }

  function show_hide_password_or_pubkey_container_and_color_send_button() {
    reset_send_btn();
    S.cached('send_btn_note').text('');
    S.cached('send_btn').attr('title', '');
    var was_previously_visible = S.cached('password_or_pubkey').css('display') === 'table-row';
    if(!$('.recipients span').length) {
      hide_message_password_ui();
      S.cached('send_btn').removeClass('gray').addClass('green');
    } else if(S.cached('icon_sign').is('.active')) {
      S.cached('send_btn').removeClass('gray').addClass('green');
    } else if($('.recipients span.no_pgp').length) {
      show_message_password_ui_and_color_button();
    } else if($('.recipients span.failed, .recipients span.wrong').length) {
      S.now('send_btn_span').text(BTN_WRONG_ENTRY);
      S.cached('send_btn').attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
      S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      hide_message_password_ui();
      S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if(is_reply_box) {
      if(!was_previously_visible && S.cached('password_or_pubkey').css('display') === 'table-row') {
        resize_reply_box(S.cached('password_or_pubkey').first().height() + 20);
      } else {
        resize_reply_box();
      }
    }
  }

  function respond_to_input_hotkeys(input_to_keydown_event) {
    var value = S.cached('input_to').val();
    var keys = tool.env.key_codes();
    if(!value && input_to_keydown_event.which === keys.backspace) {
      $('.recipients span').last().remove();
    } else if(value && (input_to_keydown_event.which === keys.enter || input_to_keydown_event.which === keys.tab)) {
      S.cached('input_to').blur();
      if($('#contacts').css('display') === 'block') {
        if($('#contacts .select_contact.hover').length) {
          $('#contacts .select_contact.hover').click();
        } else {
          $('#contacts .select_contact').first().click();
        }
      }
      S.cached('input_to').focus().blur();
      return false;
    }
  }

  function resize_reply_box(add_extra) {
    if(is_reply_box) {
      add_extra = isNaN(add_extra) ? 0 : Number(add_extra);
      S.cached('input_text').css('max-width', (S.cached('body').width() - 20) + 'px');
      var min_height = 0;
      if(S.cached('compose_table').is(':visible')) {
        var current_height = S.cached('compose_table').outerHeight();
        min_height = 260;
      } else if(S.cached('reply_message_successful').is(':visible')) {
        var current_height = S.cached('reply_message_successful').outerHeight();
      } else {
        var current_height = S.cached('reply_message_prompt').outerHeight();
      }
      if(current_height !== last_reply_box_table_height && Math.abs(current_height - (last_reply_box_table_height || 0)) > 2) { // more then two pixel difference compared to last time
        last_reply_box_table_height = current_height;
        tool.browser.message.send(url_params.parent_tab_id, 'set_css', { selector: 'iframe#' + url_params.frame_id, css: { height: (Math.max(min_height, current_height) + add_extra) + 'px' } });
      }
    }
  }

  function render_receivers() {
    var input_to = S.cached('input_to').val().toLowerCase();
    if(tool.value(',').in(input_to)) {
      var emails = input_to.split(',');
      for(var i = 0; i < emails.length - 1; i++) {
        S.cached('input_to').siblings('.recipients').append('<span>' + emails[i] + tool.ui.spinner('green') + '</span>');
      }
    } else if(!S.cached('input_to').is(':focus') && input_to) {
      S.cached('input_to').siblings('.recipients').append('<span>' + input_to + tool.ui.spinner('green') + '</span>');
    } else {
      return;
    }
    S.cached('input_to').val('');
    resize_input_to();
    evaluate_receivers();
  }

  function select_contact(email, from_query) {
    var possibly_bogus_recipient = $('.recipients span.wrong').last();
    var possibly_bogus_address = tool.str.parse_email(possibly_bogus_recipient.text()).email;
    var q = tool.str.parse_email(from_query.substring).email;
    if(possibly_bogus_address === q || tool.value(q).in(possibly_bogus_address)) {
      possibly_bogus_recipient.remove();
    }
    setTimeout(function() {
      if(!tool.value(email).in(get_recipients_from_dom())) {
        S.cached('input_to').val(tool.str.parse_email(email).email);
        render_receivers();
        S.cached('input_to').focus();
      }
    }, tool.int.random(20, 100)); // desperate amount to remove duplicates. Better solution advisable.
    hide_contacts();
  }

  function resize_input_to() {
    S.cached('input_to').css('width', (Math.max(150, S.cached('input_to').parent().width() - S.cached('input_to').siblings('.recipients').width() - 50)) + 'px');
  }

  function remove_receiver() {
    recipients_missing_my_key = tool.arr.without_value(recipients_missing_my_key, $(this).parent().text());
    $(this).parent().remove();
    resize_input_to();
    show_hide_password_or_pubkey_container_and_color_send_button();
    update_pubkey_icon();
  }

  function auth_drafts() {
    tool.api.google.auth({ account_email: url_params.account_email, scopes: tool.api.gmail.scope(['compose']) }, function (google_auth_response) {
      if(google_auth_response.success === true) {
        S.cached('send_btn_note').text('');
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
    S.cached('input_to').val($('.recipients span').last().text());
    $('.recipients span').last().remove();
    tool.api.google.auth({ account_email: account_email, scopes: tool.api.gmail.scope(['read']) }, function (google_auth_response) {
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
      tool.each(renderable_contacts, function (i, contact) {
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
      $('#contacts ul li.select_contact').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) { select_contact(tool.str.parse_email($(self).attr('email')).email, query); }));
      $('#contacts ul li.select_contact').hover(function () { $(this).addClass('hover'); }, function () { $(this).removeClass('hover'); });
      $('#contacts ul li.auth_contacts').click(function () { auth_contacts(url_params.account_email); });
      $('#contacts').css({ display: 'block', top: ($('#compose > tbody > tr:first').height() + $('#input_addresses_container > div:first').height() + 10) + 'px' });
    } else {
      hide_contacts();
    }
  }

  function search_contacts(db_only) {
    var query = { substring: tool.str.parse_email(S.cached('input_to').val()).email };
    if(query.substring !== '') {
      db_contact_search(db, query, function (contacts) {
        if(db_only || !can_read_emails) {
          render_search_results(contacts, query);
        } else {
          contact_search_in_progress = true;
          render_search_results(contacts, query);
          tool.api.gmail.search_contacts(url_params.account_email, query.substring, contacts, function (search_contacts_results) {
            var re_rendering_needed = false;
            if(search_contacts_results.new.length) {
              tool.each(search_contacts_results.new, function (i, contact) {
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
    their_email = tool.str.parse_email(their_email).email;
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
        update_pubkey_icon(recipients_missing_my_key.length && !tool.value(url_params.from || get_sender_from_dom()).in(my_addresses_on_pks));
      }
    } else { // set icon to specific state
      if(include) {
        S.cached('icon_pubkey').addClass('active').attr('title', L.include_pubkey_icon_title_active);
      } else {
        S.cached('icon_pubkey').removeClass('active').attr('title', L.include_pubkey_icon_title);
      }
    }
  }

  function update_footer_icon(include) {
    if(include === null || typeof include === 'undefined') { // decide if pubkey should be included
      update_footer_icon(!!email_footer);
    } else { // set icon to specific state
      if(include) {
        S.cached('icon_footer').addClass('active');
      } else {
        S.cached('icon_footer').removeClass('active');
      }
    }
  }

  function toggle_sign_icon() {
    if(!S.cached('icon_sign').is('.active')) {
      S.cached('icon_sign').addClass('active');
      S.cached('compose_table').addClass('sign');
      S.cached('title').text(L.header_title_compose_sign);
      S.cached('input_password').val('');
    } else {
      S.cached('icon_sign').removeClass('active');
      S.cached('compose_table').removeClass('sign');
      S.cached('title').text(L.header_title_compose_encrypt);
    }
    if(tool.value(S.now('send_btn_span').text()).in([BTN_SIGN_AND_SEND, BTN_ENCRYPT_AND_SEND])) {
      reset_send_btn();
    }
    show_hide_password_or_pubkey_container_and_color_send_button();
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
        var sending_address_on_pks = tool.value(url_params.from || get_sender_from_dom()).in(my_addresses_on_pks);
        var sending_address_on_keyserver = tool.value(url_params.from || get_sender_from_dom()).in(my_addresses_on_keyserver);
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
    $(email_element).append('<img src="/img/svgs/close-icon.svg" alt="close" class="close-icon svg" /><img src="/img/svgs/close-icon-black.svg" alt="close" class="close-icon svg display_when_sign" />').find('img.close-icon').click(remove_receiver);
    if(contact === PUBKEY_LOOKUP_RESULT_FAIL) {
      $(email_element).attr('title', 'Loading contact information failed, please try to add their email again.');
      $(email_element).addClass("failed");
      $(email_element).children('img:visible').replaceWith('<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">');
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
    if(S.now('input_from').length) {
      return S.now('input_from').val();
    } else {
      return url_params.account_email;
    }
  }

  function simulate_ctrl_v(to_paste) {
    var r = window.getSelection().getRangeAt(0);
    r.insertNode(r.createContextualFragment(to_paste));
  }

  function on_render() {
    if(tool.env.browser().name === 'firefox') { // the padding cause issues in firefoxx where user cannot click on the message password
      S.cached('input_text').css({'padding-top': 0, 'padding-bottom': 0});
    }
    $('#send_btn').click(tool.ui.event.prevent(tool.ui.event.double(), extract_process_encrypt_and_send_message)).keypress(tool.ui.enter(extract_process_encrypt_and_send_message));
    S.cached('input_to').keydown(respond_to_input_hotkeys);
    S.cached('input_to').keyup(tool.ui.event.prevent(tool.ui.event.spree('veryslow'), search_contacts));
    S.cached('input_to').blur(tool.ui.event.prevent(tool.ui.event.double(), render_receivers));
    S.cached('input_text').keyup(function () {
      S.cached('send_btn_note').text('');
    });
    S.cached('compose_table').click(hide_contacts);
    $('#input_addresses_container > div').click(function () {
      if(!S.cached('input_to').is(':focus')) {
        S.cached('input_to').focus();
      }
    }).children().click(function () { return false; });
    resize_input_to();
    tool.time.wait(function() { if(attach) { return true; }}).then(function() {
      attach.initialize_attach_dialog('fineuploader', 'fineuploader_button');
    });
  }

  function should_save_draft(message_body) {
    if(message_body && message_body !== last_draft) {
      last_draft = message_body;
      return true;
    } else {
      return false;
    }
  }

  function format_password_protected_email(short_id, original_body, armored_pubkeys) {
    var decrypt_url = CRYPTUP_WEB_URL + '/' + short_id;
    var a = '<a href="' + tool.str.html_escape(decrypt_url) + '" style="padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;">' + L.open_message + '</a>';
    var intro = S.cached('input_intro').length ? S.cached('input_intro').get(0).innerText.trim() : '';
    var text = [];
    var html = [];
    if(intro) {
      text.push(intro + '\n');
      html.push(intro.replace(/\n/, '<br>') + '<br><br>');
    }
    text.push(L.message_encrypted_text + decrypt_url + '\n');
    html.push('<div class="cryptup_encrypted_message_replaceable">');
    html.push('<div style="display: none;">' + tool.crypto.armor.headers(null).begin + '</div>');
    html.push(L.message_encrypted_html + a + '<br><br>');
    html.push(L.alternatively_copy_paste + tool.str.html_escape(decrypt_url) + '<br><br><br>');
    text.push(original_body['text/plain']);
    var html_cryptup_web_url_link = '<a href="' + tool.str.html_escape(CRYPTUP_WEB_URL) + '" style="color: #999;">' + tool.str.html_escape(CRYPTUP_WEB_URL) + '</a>';
    if(armored_pubkeys.length > 1) { // only include the message in email if a pubkey-holding person is receiving it as well
      var html_pgp_message = original_body['text/html'] ? original_body['text/html'] : original_body['text/plain'].replace(CRYPTUP_WEB_URL, html_cryptup_web_url_link).replace(/\n/g, '<br>\n');
      html.push('<div style="color: #999;">' + html_pgp_message + '</div>');
    }
    html.push('</div>');
    return { 'text/plain': text.join('\n'), 'text/html': html.join('\n')};
  }

  function format_email_text_footer(original_body) {
    var body = {'text/plain': original_body['text/plain'] + (email_footer ? '\n' + email_footer : '')};
    if(typeof original_body['text/html'] !== 'undefined') {
      body['text/html'] = original_body['text/html'] + (email_footer ? '<br>\n' + email_footer.replace(/\n/g, '<br>\n') : '');
    }
    return body;
  }

  S.cached('input_password').keyup(tool.ui.event.prevent(tool.ui.event.spree(), show_hide_password_or_pubkey_container_and_color_send_button));
  S.cached('input_password').focus(show_hide_password_or_pubkey_container_and_color_send_button);
  S.cached('input_password').blur(show_hide_password_or_pubkey_container_and_color_send_button);

  S.cached('add_their_pubkey').click(function () {
    if(url_params.placement !== 'settings') {
      tool.browser.message.send(url_params.parent_tab_id, 'add_pubkey_dialog', { emails: get_recipients_from_dom('no_pgp') });
    } else {
      $.featherlight({ iframe: factory.src.add_pubkey_dialog(get_recipients_from_dom('no_pgp'), 'settings'), iframeWidth: 515, iframeHeight: S.cached('body').height() - 50 });
    }
    clearInterval(added_pubkey_db_lookup_interval); // todo - get rid of setInterval. just supply tab_id and wait for direct callback
    added_pubkey_db_lookup_interval = setInterval(function () {
      tool.each(get_recipients_from_dom('no_pgp'), function (i, email) {
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

  S.cached('add_intro').click(function () {
    $(this).css('display', 'none');
    S.cached('intro_container').css('display', 'table-row');
    S.cached('input_intro').focus();
  });

  S.cached('icon_help').click(function () {
    tool.browser.message.send(null, 'settings', { account_email: url_params.account_email, page: '/chrome/settings/modules/help.htm' });
  });

  S.now('input_from').change(function () {
    // when I change input_from, I should completely re-evaluate: update_pubkey_icon() and render_pubkey_result()
    // because they might not have a pubkey for the alternative address, and might get confused
  });

  S.cached('input_text').get(0).onpaste = function (e) {
    if(e.clipboardData.getData('text/html')) {
      tool.str.html_as_text(e.clipboardData.getData('text/html'), function (text) {
        simulate_ctrl_v(text.replace(/\n/g, '<br>'));
      });
      return false;
    }
  };

  S.cached('icon_pubkey').click(function () {
    include_pubkey_toggled_manually = true;
    update_pubkey_icon(!$(this).is('.active'));
  });

  S.cached('icon_footer').click(function () {
    if(!$(this).is('.active')) {
      var noscroll = function() { $('.featherlight.noscroll > .featherlight-content > iframe').attr('scrolling', 'no'); };
      $.featherlight({iframe: factory.src.add_footer_dialog('compose'), iframeWidth: 490, iframeHeight: 230, variant: 'noscroll', afterContent: noscroll});
    } else {
      update_footer_icon(!$(this).is('.active'));
    }
  });

  S.cached('body').bind({drop: tool.ui.event.stop(), dragover: tool.ui.event.stop()}); // prevents files dropped out of the intended drop area to screw up the page

  S.cached('icon_sign').click(toggle_sign_icon);

  function set_additional_headers(headers) {
    additional_message_headers = headers;
  }

  return {
    draft_set_id: draft_set_id,
    draft_meta_store: draft_meta_store,
    draft_delete: draft_delete,
    decrypt_and_render_draft: decrypt_and_render_draft,
    evaluate_receivers: evaluate_receivers,
    resize_reply_box: resize_reply_box,
    update_pubkey_icon: update_pubkey_icon,
    get_recipients_from_dom: get_recipients_from_dom,
    on_render: on_render,
    headers: set_additional_headers,
    S: S,
  };

}
