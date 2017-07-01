/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

(function() {

  let tool, catcher, openpgp, $, jQuery;
  if(typeof exports !== 'object') {
    tool = window.tool;
    catcher = window.catcher;
    openpgp = window.openpgp;
    $ = jQuery = window.jQuery;
  } else {
    tool = require('./tool').tool;
    catcher = require('./tool').catcher;
    openpgp = require('openpgp');
    $ = jQuery = require('jquery');
    window.lang = require('./lang');
  }

  const S = tool.ui.build_jquery_selectors({
    body: 'body',
    compose_table: 'table#compose',
    header: '#section_header',
    subject: '#section_subject',
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
    replied_body: '.replied_body',
    replied_attachments: '#attachments',
    contacts: '#contacts',
  });

  const _self = {
    init: init,
    resize_reply_box: resize_reply_box,
    update_footer_icon: update_footer_icon,
    show_subscribe_dialog_and_wait_for_response: show_subscribe_dialog_and_wait_for_response,
    process_subscribe_result: process_subscribe_result,
    passphrase_entry: passphrase_entry,
    S: S,
  };

  if(typeof exports !== 'object') {
    window['flowcrypt_compose'] = _self;
  } else {
    exports.compose = _self;
  }

  const SAVE_DRAFT_FREQUENCY = 3000;
  const PUBKEY_LOOKUP_RESULT_WRONG = 'wrong';
  const PUBKEY_LOOKUP_RESULT_FAIL = 'fail';
  const BTN_ENCRYPT_AND_SEND = 'encrypt and send';
  const BTN_SIGN_AND_SEND = 'sign and send';
  const BTN_WRONG_ENTRY = 're-enter recipient..';
  const BTN_LOADING = 'loading..';
  const CRYPTUP_WEB_URL = 'https://cryptup.org';

  let attach = init_shared_attach_js(get_max_attachment_size_and_oversize_notice);

  let last_draft = '';
  let can_read_emails;
  let last_reply_box_table_height;
  let contact_search_in_progress = false;
  let added_pubkey_db_lookup_interval;
  let save_draft_interval = setInterval(draft_save, SAVE_DRAFT_FREQUENCY);
  let save_draft_in_process = false;
  let passphrase_interval;
  let include_pubkey_toggled_manually = false;
  let my_addresses_on_pks = [];
  let my_addresses_on_keyserver = [];
  let recipients_missing_my_key = [];
  let keyserver_lookup_results_by_email = {};
  let subscribe_result_listener;
  let additional_message_headers = {};
  let button_update_timeout;
  let is_reply_box, tab_id, account_email, db, thread_id, draft_id, supplied_subject, supplied_from, supplied_to, frame_id;

  let app = {
    can_read_email: () => true,
    does_recipient_have_my_pubkey: (email, cb) => { if(cb) { cb(); }},
    storage_get_addresses: () => [account_email],
    storage_get_addresses_pks: () => [],
    storage_get_addresses_keyserver: () => [],
    storage_get_email_footer: () => null,
    storage_get_hide_message_password: () => false,
    storage_get_subscription_info: (cb) => { if(typeof cb === 'function') { cb({}); } return {}; }, // returns cached result, callbacks with fresh result
    storage_get_armored_public_key: (sender_email) => null,
    storage_set_draft_meta: (store_if_true, draft_id, thread_id, recipients, subject) => catcher.Promise((resolve, reject) => {resolve()}),
    storage_get_passphrase: () => null,
    storage_add_admin_codes: (short_id, message_admin_code, attachment_admin_codes, callback) => { callback(); },
    storage_contact_get: (email, cb) => { if(cb) cb(null); },
    storage_contact_update: (email, update, cb) => { if(cb) cb();},
    storage_contact_save: (contact, cb) => { if(cb) cb(); },
    storage_contact_search: (query, cb) => { if(cb) cb()},
    storage_contact_object: () => {},
    email_provider_draft_get: (draft_id) => catcher.Promise((resolve, reject) => {reject()}),
    email_provider_draft_create: (mime_message) => catcher.Promise((resolve, reject) => {reject()}),
    email_provider_draft_update: (draft_id, mime_message) => catcher.Promise((resolve, reject) => {reject()}),
    email_provider_draft_delete: (draft_id) => catcher.Promise((resolve, reject) => {reject()}),
    email_provider_message_send: (message, render_upload_progress) => catcher.Promise((resolve, reject) => {reject()}),
    email_provider_search_contacts: (query, known_contacts) => catcher.Promise((resolve, reject) => {resolve([])}),
    email_provider_determine_reply_message_header_variables: (cb) => { if(cb) cb(); },
    email_provider_extract_armored_block: (message_id, cb) => { if(cb) cb(); },
    send_message_to_main_window: (channel, data) => null,
    send_message_to_background_script: (channel, data) => null,
    render_footer_dialog: () => null,
    render_add_pubkey_dialog: (emails) => null,
    render_reinsert_reply_box: (last_message_id, recipients) => null,
    factory_attachment: (attachment) => '<div>' + attachment.name + '</div>',
  };

  function init(app_functions, variables) {
    account_email = variables.account_email;
    db = variables.db;
    draft_id = variables.draft_id;
    thread_id = variables.thread_id;
    supplied_subject = variables.subject;
    supplied_from = variables.from;
    supplied_to = variables.to;
    frame_id = variables.frame_id;
    tab_id = variables.tab_id;
    is_reply_box = variables.is_reply_box;
    $.each(app_functions, (name, cb) => {
      app[name] = cb;
    });
    my_addresses_on_pks = app.storage_get_addresses_pks() || [];
    my_addresses_on_keyserver = app.storage_get_addresses_keyserver() || [];
    can_read_emails = app.can_read_email();
    if (app.storage_get_subscription_info().active) {
      update_footer_icon();
    }
    if (app.storage_get_hide_message_password()) {
      S.cached('input_password').attr('type', 'password');
    }
    initialize_compose_box(variables);
  }

  function initialize_compose_box(variables) {
    if(draft_id) {
      initial_draft_load();
    } else {
      if(is_reply_box) {
        if(variables.skip_click_prompt) {
          render_reply_message_compose_table();
        } else {
          $('#reply_click_area, #a_reply, #a_reply_all, #a_forward').click(function () {
            if ($(this).attr('id') === 'a_reply') {
              supplied_to = supplied_to.split(',')[0];
            } else if ($(this).attr('id') === 'a_forward') {
              supplied_to = '';
            }
            render_reply_message_compose_table($(this).attr('id').replace('a_', ''));
          });
        }
      }
    }
    if(is_reply_box) {
      S.cached('reply_message_prompt').css('display', 'block');
      S.cached('header').remove();
      S.cached('subject').remove();
      S.cached('contacts').css('top', '39px');
      S.cached('compose_table').css({'border-bottom': '1px solid #cfcfcf', 'border-top': '1px solid #cfcfcf'});
      S.cached('input_text').css('overflow-y', 'hidden');
      $(document).ready(() => resize_reply_box());
    } else {
      S.cached('body').css('overflow', 'hidden'); // do not enable this for replies or automatic resize won't work
      S.cached('compose_table').css('display', 'table');
      render_compose_table();
    }
  }

  function initial_draft_load() {
    if(is_reply_box) {
      S.cached('reply_message_prompt').html('Loading draft.. ' + tool.ui.spinner('green'));
    }
    app.email_provider_draft_get(draft_id).then(response => {
      tool.mime.decode(tool.str.base64url_decode(response.message.raw), function (mime_success, parsed_message) {
        let armored = tool.crypto.armor.clip(parsed_message.text || tool.crypto.armor.strip(parsed_message.html) || '');
        if(armored) {
          S.cached('input_subject').val(parsed_message.headers.subject || '');
          decrypt_and_render_draft(armored, is_reply_box ? render_reply_message_compose_table : null, tool.mime.headers_to_from(parsed_message));
        } else {
          console.log('tool.api.gmail.draft_get tool.mime.decode else {}');
          if(is_reply_box) {
            render_reply_message_compose_table();
          }
        }
      });
    }, error => {
      if (is_reply_box && error.status === 404) {
        catcher.log('about to reload reply_message automatically: get draft 404', account_email);
        setTimeout(function () {
          app.storage_set_draft_meta(false, draft_id, thread_id, null, null).then(() => {
            console.log('Above red message means that there used to be a draft, but was since deleted. (not an error)');
            window.location.reload();
          });
        }, 500);
      } else {
        console.log('tool.api.gmail.draft_get success===false');
        console.log(error);
        if(is_reply_box) {
          render_reply_message_compose_table();
        }
      }
    });
  }

  function process_subscribe_result(new_subscription) {
    if (typeof subscribe_result_listener === 'function') {
      subscribe_result_listener(new_subscription.active);
      subscribe_result_listener = undefined;
    }
  }

  function show_subscribe_dialog_and_wait_for_response(data, sender, respond) {
    subscribe_result_listener = respond;
    app.send_message_to_main_window('subscribe_dialog', {subscribe_result_tab_id: tab_id});
  }

  S.cached('icon_pubkey').attr('title', window.lang.compose.include_pubkey_icon_title);

  function get_max_attachment_size_and_oversize_notice() {
    let subscription = app.storage_get_subscription_info();
    if (!subscription.active) {
      return {
        size_mb: 5,
        size: 5 * 1024 * 1024,
        count: 10,
        oversize: function (combined_size) {
          let get_advanced = 'The files are over 5 MB. Advanced users can send files up to 25 MB.';
          if (!subscription.method) {
            get_advanced += '\n\nTry it free for 30 days.';
          } else if (subscription.method === 'trial') {
            get_advanced += '\n\nYour trial has expired, please consider supporting our efforts by upgrading.';
          } else {
            get_advanced += '\n\nPlease renew your subscription to continue sending large files.';
          }
          if (confirm(get_advanced)) {
            show_subscribe_dialog_and_wait_for_response(null, null, function (new_subscription_active) {
              if (new_subscription_active) {
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
        oversize: function (combined_size) {
          alert('Combined attachment size is limited to 25 MB. The last file brings it to ' + Math.ceil(combined_size / (1024 * 1024)) + ' MB.');
        },
      };
    }
  }

  function reset_send_btn(delay) {
    const do_reset = function () {
      S.cached('send_btn').html('<i class=""></i><span tabindex="4">' + (S.cached('icon_sign').is('.active') ? BTN_SIGN_AND_SEND : BTN_ENCRYPT_AND_SEND) + '</span>');
    };
    clearTimeout(button_update_timeout);
    if (!delay) {
      do_reset();
    } else {
      setTimeout(do_reset, delay);
    }
  }

  function passphrase_entry(entered) {
    if(!entered) {
      reset_send_btn();
      clearInterval(passphrase_interval);
    }
  }

  function draft_save(force_save) {
    if (should_save_draft(S.cached('input_text').text()) || force_save === true) {
      save_draft_in_process = true;
      S.cached('send_btn_note').text('Saving');
      const armored_pubkey = app.storage_get_armored_public_key(account_email);
      tool.crypto.message.encrypt([armored_pubkey], null, null, S.cached('input_text')[0].innerText, null, true, function (encrypted) {
        let body;
        if (thread_id) { // replied message
          body = '[cryptup:link:draft_reply:' + thread_id + ']\n\n' + encrypted.data;
        } else if (draft_id) {
          body = '[cryptup:link:draft_compose:' + draft_id + ']\n\n' + encrypted.data;
        } else {
          body = encrypted.data;
        }
        let subject = S.cached('input_subject').val() || supplied_subject || 'CryptUp draft';
        tool.mime.encode(body, {To: get_recipients_from_dom(), From: supplied_from || get_sender_from_dom(), Subject: subject}, [], function (mime_message) {
          if (!draft_id) {
            app.email_provider_draft_create(mime_message).then(response => {
              S.cached('send_btn_note').text('Saved');
              draft_id = response.id;
              app.storage_set_draft_meta(true, response.id, thread_id, get_recipients_from_dom(), S.cached('input_subject').val());
              // recursing one more time, because we need the draft_id we get from this reply in the message itself
              // essentially everytime we save draft for the first time, we have to save it twice
              // save_draft_in_process will remain true because well.. it's still in process
              draft_save(true); // force_save = true
            }, error => {
              S.cached('send_btn_note').text('Not saved');
              save_draft_in_process = false; // it will only be set to false (done) if it's a failure (only in terms of the very first save)
            });
          } else {
            app.email_provider_draft_update(draft_id, mime_message).then(response => {
              S.cached('send_btn_note').text('Saved');
              save_draft_in_process = false;
            }, error => {
              S.cached('send_btn_note').text('Not saved');
              save_draft_in_process = false;
            });
          }
        });
      });
    }
  }

  function draft_delete(callback) {
    clearInterval(save_draft_interval);
    tool.time.wait(() => {if (!save_draft_in_process) { return true; }}).then(() => {
      if (draft_id) {
        app.storage_set_draft_meta(false, draft_id, thread_id, null, null).done(() => {
          app.email_provider_draft_delete(draft_id).done((success, result) => {
            callback();
          });
        });
      } else if (callback) {
        callback();
      }
    });
  }

  function decrypt_and_render_draft(encrypted_draft, render_function, headers) {
    if (app.storage_get_passphrase() !== null) {
      tool.crypto.message.decrypt(db, account_email, encrypted_draft, null, (result) => {
        if(result.success) {
          tool.str.as_safe_html(result.content.data.replace(/\n/g, '<br>\n'), function (safe_html_draft) {
            S.cached('input_text').html(safe_html_draft);
            if (headers && headers.to && headers.to.length) {
              S.cached('input_to').focus();
              S.cached('input_to').val(headers.to.join(','));
              S.cached('input_text').focus();
            }
            if (headers && headers.from) {
              S.now('input_from').val(headers.from);
            }
            if (render_function) {
              render_function();
            }
          });
        } else {
          if (render_function) {
            render_function();
          }
        }
      }, 'utf8');
    } else {
      if (is_reply_box) {
        S.cached('reply_message_prompt').html(tool.ui.spinner('green') + ' Waiting for pass phrase to open previous draft..');
        when_master_passphrase_entered(function () {
          decrypt_and_render_draft(encrypted_draft, render_function, headers);
        });
      }
    }
  }

  function when_master_passphrase_entered(callback, seconds_timeout) {
    clearInterval(passphrase_interval);
    const timeout_at = seconds_timeout ? Date.now() + seconds_timeout * 1000 : null;
    passphrase_interval = setInterval(function () {
      let passphrase = app.storage_get_passphrase();
      if (passphrase !== null) {
        clearInterval(passphrase_interval);
        callback(passphrase);
      } else if (timeout_at && Date.now() > timeout_at) {
        clearInterval();
        callback(null);
      }
    }, 1000);
  }

  function collect_all_available_public_keys(account_email, recipients, callback) {
    app.storage_contact_get(recipients, function (contacts) {
      const armored_pubkeys = [app.storage_get_armored_public_key(account_email)];
      const emails_without_pubkeys = [];
      tool.each(contacts, function (i, contact) {
        if (contact && contact.has_pgp) {
          armored_pubkeys.push(contact.pubkey);
        } else if (contact && keyserver_lookup_results_by_email[contact.email] && keyserver_lookup_results_by_email[contact.email].has_pgp) {
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
    const is_encrypt = !S.cached('icon_sign').is('.active');
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
    const recipients = get_recipients_from_dom();
    const subject = supplied_subject || $('#input_subject').val(); // replies have subject in url params
    const plaintext = $('#input_text').get(0).innerText;
    if(is_compose_form_rendered_as_ready(recipients)) {
      S.now('send_btn_span').text('Loading');
      S.now('send_btn_i').replaceWith(tool.ui.spinner('white'));
      S.cached('send_btn_note').text('');
      app.storage_get_subscription_info(function (_l, _e, _active) {
        collect_all_available_public_keys(account_email, recipients, function (armored_pubkeys, emails_without_pubkeys) {
          const challenge = emails_without_pubkeys.length ? {answer: S.cached('input_password').val()} : null;
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
    add_reply_token_to_message_body_if_needed(recipients, subject, plaintext, challenge, _active, function (plaintext) {
      handle_send_btn_processing_error(function () {
        attach.collect_and_encrypt_attachments(armored_pubkeys, challenge, function (attachments) {
          if (attachments.length && challenge) { // these will be password encrypted attachments
            button_update_timeout = setTimeout(function () {
              S.now('send_btn_span').text('sending');
            }, 500);
            upload_attachments_to_cryptup(attachments, _active, function (all_good, upload_results, attachment_admin_codes, upload_error_message) {
              if (all_good === true) {
                plaintext = add_uploaded_file_links_to_message_body(plaintext, upload_results);
                do_encrypt_message_body_and_format(armored_pubkeys, challenge, plaintext, [], recipients, subject, _active, attachment_admin_codes);
              } else if (all_good === tool.api.cryptup.auth_error) {
                if (confirm('Your CryptUp account information is outdated, please review your account settings.')) {
                  app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
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
    const keyinfo = private_keys_get(account_email, 'primary');
    if (keyinfo) {
      const prv = openpgp.key.readArmored(keyinfo.armored).keys[0];
      const passphrase = app.storage_get_passphrase();
      if (passphrase === null) {
        app.send_message_to_main_window('passphrase_dialog', {type: 'sign', longids: 'primary'});
        when_master_passphrase_entered(function (passphrase) {
          if (passphrase) {
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
            if (success) {
              handle_send_btn_processing_error(function () {
                attach.collect_attachments(function (attachments) { // todo - not signing attachments
                  app.storage_contact_update(recipients, {last_use: Date.now()}, function () {
                    S.now('send_btn_span').text('Sending');
                    const body = {'text/plain': with_attached_pubkey_if_needed(signing_result)};
                    do_send_message(tool.api.common.message(account_email, supplied_from || get_sender_from_dom(), recipients, subject, body, attachments, thread_id), plaintext);
                  });
                });
              });
            } else {
              catcher.report('error signing message. Error:' + signing_result);
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
      const items = [];
      tool.each(pf_response.approvals, function (i, approval) {
        items.push({base_url: approval.base_url, fields: approval.fields, attachment: attachments[i]});
      });
      tool.api.aws.s3_upload(items, render_upload_progress).then(s3_results_successful => {
        tool.api.cryptup.message_confirm_files(items.map(function (item) {
          return item.fields.key;
        })).validate(r => r.confirmed && r.confirmed.length === items.length).then(cf_response => {
          tool.each(attachments, function (i) {
            attachments[i].url = pf_response.approvals[i].base_url + pf_response.approvals[i].fields.key;
          });
          callback(true, attachments, cf_response.admin_codes);
        }, error => {
          if (error.internal === 'validate') {
            callback(false, null, null, 'Could not verify that all files were uploaded properly, please try again.');
          } else {
            callback(false, null, null, error.message);
          }
        });
      }, s3_results_has_failure => callback(false, null, null, 'Some files failed to upload, please try again'));
    }, error => {
      if (error.internal === 'auth') {
        callback(error);
      } else {
        callback(false, null, null, error.message);
      }
    });
  }

  function render_upload_progress(progress) {
    if (attach.has_attachment()) {
      progress = Math.floor(progress);
      S.now('send_btn_span').text(progress < 100 ? 'sending.. ' + progress + '%' : 'sending');
    }
  }

  function add_uploaded_file_links_to_message_body(plaintext, attachments) {
    plaintext += '\n\n';
    tool.each(attachments, function (i, attachment) {
      const size_mb = attachment.size / (1024 * 1024);
      const size_text = size_mb < 0.1 ? '' : ' ' + (Math.round(size_mb * 10) / 10) + 'MB';
      const link_text = 'Attachment: ' + attachment.name + ' (' + attachment.type + ')' + size_text;
      const cryptup_data = tool.str.html_attribute_encode({size: attachment.size, type: attachment.type, name: attachment.name});
      plaintext += '<a href="' + attachment.url + '" class="cryptup_file" cryptup-data="' + cryptup_data + '">' + link_text + '</a>\n';
    });
    return plaintext;
  }

  function add_reply_token_to_message_body_if_needed(recipients, subject, plaintext, challenge, subscription_active, callback) {
    if (challenge && subscription_active) {
      tool.api.cryptup.message_token().validate(r => r.token).then(response => {
        callback(plaintext + '\n\n' + tool.e('div', {
            'style': 'display: none;', 'class': 'cryptup_reply', 'cryptup-data': tool.str.html_attribute_encode({
              sender: supplied_from || get_sender_from_dom(),
              recipient: tool.arr.without_value(tool.arr.without_value(recipients, supplied_from || get_sender_from_dom()), account_email),
              subject: subject,
              token: response.token,
            })
          }));
      }, error => {
        if (error.internal === 'auth') {
          if (confirm('Your CryptUp account information is outdated, please review your account settings.')) {
            app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
          }
          reset_send_btn();
        } else if (error.internal === 'subscription') {
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
    tool.api.cryptup.message_upload(encrypted_data, _active ? 'uuid' : null).validate(r => r.short && r.admin_code).then(response => {
      callback(response.short, response.admin_code);
    }, error => {
      if (error.internal === 'auth') {
        callback(null, null, tool.api.cryptup.auth_error);
      } else {
        callback(null, null, error.internal || error.message);
      }
    });
  }

  function with_attached_pubkey_if_needed(encrypted) {
    if (S.cached('icon_pubkey').is('.active')) {
      encrypted += '\n\n' + app.storage_get_armored_public_key(account_email);
    }
    return encrypted;
  }

  function do_encrypt_message_body_and_format(armored_pubkeys, challenge, plaintext, attachments, recipients, subject, _active, attachment_admin_codes) {
    tool.crypto.message.encrypt(armored_pubkeys, null, challenge, plaintext, null, true, function (encrypted) {
      encrypted.data = with_attached_pubkey_if_needed(encrypted.data);
      let body = {'text/plain': encrypted.data};
      button_update_timeout = setTimeout(function () {
        S.now('send_btn_span').text('sending');
      }, 500);
      app.storage_contact_update(recipients, {last_use: Date.now()}, function () {
        if (challenge) {
          upload_encrypted_message_to_cryptup(encrypted.data, _active, function (short_id, message_admin_code, error) {
            if (short_id) {
              body = format_password_protected_email(short_id, body, armored_pubkeys);
              body = format_email_text_footer(body);
              app.storage_add_admin_codes(short_id, message_admin_code, attachment_admin_codes, () => {
                do_send_message(tool.api.common.message(account_email, supplied_from || get_sender_from_dom(), recipients, subject, body, attachments, thread_id), plaintext);
              });
            } else {
              if (error === tool.api.cryptup.auth_error) {
                if (confirm('Your CryptUp account information is outdated, please review your account settings.')) {
                  app.send_message_to_main_window('subscribe_dialog', {source: 'auth_error'});
                }
              } else {
                alert('Could not send message, probably due to internet connection. Please click the SEND button again to retry.\n\n(Error:' + error + ')');
              }
              reset_send_btn();
            }
          });
        } else {
          body = format_email_text_footer(body);
          do_send_message(tool.api.common.message(account_email, supplied_from || get_sender_from_dom(), recipients, subject, body, attachments, thread_id), plaintext);
        }
      });
    });
  }

  function do_send_message(message, plaintext) {
    tool.each(additional_message_headers, (k, h) => { message.headers[k] = h; });
    app.email_provider_message_send(message, render_upload_progress).then(response => {
      const is_signed = S.cached('icon_sign').is('.active');
      app.send_message_to_main_window('notification_show', {notification: 'Your ' + (is_signed ? 'signed' : 'encrypted') + ' ' + (is_reply_box ? 'reply' : 'message') + ' has been sent.'});
      draft_delete(() => {
        tool.env.increment('compose', function () {
          if(is_reply_box) {
            render_reply_success(message, plaintext, response ? response.id : null);
          } else {
            app.close_message();
          }
        });
      });
    }, error => {
      handle_send_message_error(error);
    });
  }

  function handle_send_message_error(error) {
    reset_send_btn();
    if (error && (error.status === 413 || error.code === 413)) {
      S.now('send_btn_i').attr('class', '');
      tool.env.increment('upgrade_notify_attach_size', function () {
        alert('Currently, total attachments size should be under 5MB. Larger files will be possible very soon.');
      });
    } else {
      catcher.report('email_provider message_send error response', error);
      alert('Error sending message, try to re-open your web mail window and send again. Write me at tom@cryptup.org if this happens repeatedly.');
    }
  }

  function lookup_pubkey_from_db_or_keyserver_and_update_db_if_needed(email, callback) {
    app.storage_contact_get(email, function (db_contact) {
      if (db_contact && db_contact.has_pgp && db_contact.pubkey) {
        callback(db_contact);
      } else {
        tool.api.attester.lookup_email(email).done((success, result) => {
          if (success && result && result.email) {
            if (result.pubkey) {
              const parsed = openpgp.key.readArmored(result.pubkey);
              if (!parsed.keys[0]) {
                catcher.log('Dropping found but incompatible public key', {
                  for: result.email,
                  err: parsed.err ? ' * ' + parsed.err.join('\n * ') : null
                });
                result.pubkey = null;
              } else if (parsed.keys[0].getEncryptionKeyPacket() === null) {
                catcher.log('Dropping found+parsed key because getEncryptionKeyPacket===null', {
                  for: result.email,
                  fingerprint: tool.crypto.key.fingerprint(parsed.keys[0])
                });
                result.pubkey = null;
              }
            }
            let ks_contact = app.storage_contact_object(result.email, db_contact && db_contact.name ? db_contact.name : null, result.has_cryptup ? 'cryptup' : 'pgp', result.pubkey, result.attested, false, Date.now());
            keyserver_lookup_results_by_email[result.email] = ks_contact;
            app.storage_contact_save(ks_contact, function () {
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
      const email_element = this;
      const email = tool.str.parse_email($(email_element).text()).email;
      if (tool.str.is_email_valid(email)) {
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
    if (!S.cached('input_password').val()) {
      return 'No password entered';
    }
  }

  function show_message_password_ui_and_color_button() {
    S.cached('password_or_pubkey').css('display', 'table-row');
    S.cached('password_or_pubkey').css('display', 'table-row');
    if (S.cached('input_password').val() || S.cached('input_password').is(':focus')) {
      S.cached('password_label').css('display', 'inline-block');
      S.cached('input_password').attr('placeholder', '');
    } else {
      S.cached('password_label').css('display', 'none');
      S.cached('input_password').attr('placeholder', 'one time password');
    }
    if (get_password_validation_warning()) {
      S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if (S.cached('input_intro').is(':visible')) {
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
    let was_previously_visible = S.cached('password_or_pubkey').css('display') === 'table-row';
    if (!$('.recipients span').length) {
      hide_message_password_ui();
      S.cached('send_btn').removeClass('gray').addClass('green');
    } else if (S.cached('icon_sign').is('.active')) {
      S.cached('send_btn').removeClass('gray').addClass('green');
    } else if ($('.recipients span.no_pgp').length) {
      show_message_password_ui_and_color_button();
    } else if ($('.recipients span.failed, .recipients span.wrong').length) {
      S.now('send_btn_span').text(BTN_WRONG_ENTRY);
      S.cached('send_btn').attr('title', 'Notice the recipients marked in red: please remove them and try to enter them egain.');
      S.cached('send_btn').removeClass('green').addClass('gray');
    } else {
      hide_message_password_ui();
      S.cached('send_btn').removeClass('gray').addClass('green');
    }
    if (is_reply_box) {
      if (!was_previously_visible && S.cached('password_or_pubkey').css('display') === 'table-row') {
        resize_reply_box(S.cached('password_or_pubkey').first().height() + 20);
      } else {
        resize_reply_box();
      }
    }
  }

  function respond_to_input_hotkeys(input_to_keydown_event) {
    let value = S.cached('input_to').val();
    const keys = tool.env.key_codes();
    if (!value && input_to_keydown_event.which === keys.backspace) {
      $('.recipients span').last().remove();
    } else if (value && (input_to_keydown_event.which === keys.enter || input_to_keydown_event.which === keys.tab)) {
      S.cached('input_to').blur();
      if (S.cached('contacts').css('display') === 'block') {
        if (S.cached('contacts').find('.select_contact.hover').length) {
          S.cached('contacts').find('.select_contact.hover').click();
        } else {
          S.cached('contacts').find('.select_contact').first().click();
        }
      }
      S.cached('input_to').focus().blur();
      return false;
    }
  }

  function resize_reply_box(add_extra) {
    if (is_reply_box) {
      add_extra = isNaN(add_extra) ? 0 : Number(add_extra);
      S.cached('input_text').css('max-width', (S.cached('body').width() - 20) + 'px');
      let min_height = 0;
      let current_height;
      if (S.cached('compose_table').is(':visible')) {
        current_height = S.cached('compose_table').outerHeight();
        min_height = 260;
      } else if (S.cached('reply_message_successful').is(':visible')) {
        current_height = S.cached('reply_message_successful').outerHeight();
      } else {
        current_height = S.cached('reply_message_prompt').outerHeight();
      }
      if (current_height !== last_reply_box_table_height && Math.abs(current_height - (last_reply_box_table_height || 0)) > 2) { // more then two pixel difference compared to last time
        last_reply_box_table_height = current_height;
        app.send_message_to_main_window('set_css', {
          selector: 'iframe#' + frame_id,
          css: {height: (Math.max(min_height, current_height) + add_extra) + 'px'}
        });
      }
    }
  }

  function append_forwarded_message(text) {
    S.cached('input_text').append('<br/><br/>Forwarded message:<br/><br/>> ' + text.replace(/(?:\r\n|\r|\n)/g, '\> '));
    resize_reply_box();
  }

  function retrieve_decrypt_and_add_forwarded_message(message_id) {
    app.email_provider_extract_armored_block(message_id, function (armored_message) {
      tool.crypto.message.decrypt(db, account_email, armored_message, undefined, function (result) {
        if (result.success) {
          if (!tool.mime.resembles_message(result.content.data)) {
            append_forwarded_message(tool.mime.format_content_to_display(result.content.data, armored_message));
          } else {
            tool.mime.decode(result.content.data, function (success, mime_parse_result) {
              append_forwarded_message(tool.mime.format_content_to_display(mime_parse_result.text || mime_parse_result.html || result.content.data, armored_message));
            });
          }
        } else {
          S.cached('input_text').append('<br/>\n<br/>\n<br/>\n' + armored_message.replace(/\n/g, '<br/>\n'));
        }
      });
    }, function (error_type, url_formatted_data_block) {
      if (url_formatted_data_block) {
        S.cached('input_text').append('<br/>\n<br/>\n<br/>\n' + url_formatted_data_block);
      }
    });
  }

  function render_reply_message_compose_table(method) {
    S.cached('reply_message_prompt').css('display', 'none');
    S.cached('compose_table').css('display', 'table');
    S.cached('input_to').val(supplied_to + (supplied_to ? ',' : '')); // the comma causes the last email to be get evaluated
    render_compose_table();
    if (can_read_emails) {
      app.email_provider_determine_reply_message_header_variables((last_message_id, headers) => {
        if(last_message_id && headers) {
          $.each(headers, (n, h) => {
            additional_message_headers[n] = h;
          });
          if(method === 'forward') {
            supplied_subject = 'Fwd: ' + supplied_subject;
            retrieve_decrypt_and_add_forwarded_message();
          }
        }
      });
    } else {
      S.cached('reply_message_prompt').html('CryptUp has limited functionality. Your browser needs to access this conversation to reply.<br/><br/><br/><div class="button green auth_settings">Add missing permission</div><br/><br/>Alternatively, <a href="#" class="new_message_button">compose a new secure message</a> to respond.<br/><br/>');
      S.cached('reply_message_prompt').attr('style', 'border:none !important');
      $('.auth_settings').click(() => app.send_message_to_background_script('settings', { account_email: account_email, page: '/chrome/settings/modules/auth_denied.htm'}));
      $('.new_message_button').click(() => app.send_message_to_main_window('open_new_message'));
    }
    resize_reply_box();
  }

  function render_receivers() {
    const input_to = S.cached('input_to').val().toLowerCase();
    if (tool.value(',').in(input_to)) {
      const emails = input_to.split(',');
      for (let i = 0; i < emails.length - 1; i++) {
        S.cached('input_to').siblings('.recipients').append('<span>' + emails[i] + tool.ui.spinner('green') + '</span>');
      }
    } else if (!S.cached('input_to').is(':focus') && input_to) {
      S.cached('input_to').siblings('.recipients').append('<span>' + input_to + tool.ui.spinner('green') + '</span>');
    } else {
      return;
    }
    S.cached('input_to').val('');
    resize_input_to();
    evaluate_receivers();
  }

  function select_contact(email, from_query) {
    const possibly_bogus_recipient = $('.recipients span.wrong').last();
    const possibly_bogus_address = tool.str.parse_email(possibly_bogus_recipient.text()).email;
    const q = tool.str.parse_email(from_query.substring).email;
    if (possibly_bogus_address === q || tool.value(q).in(possibly_bogus_address)) {
      possibly_bogus_recipient.remove();
    }
    setTimeout(function () {
      if (!tool.value(email).in(get_recipients_from_dom())) {
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

  function auth_contacts(account_email) {
    S.cached('input_to').val($('.recipients span').last().text());
    $('.recipients span').last().remove();
    tool.api.google.auth({
      account_email: account_email,
      scopes: tool.api.gmail.scope(['read'])
    }, function (google_auth_response) {
      if (google_auth_response.success === true) {
        can_read_emails = true;
        search_contacts();
      } else if (google_auth_response.success === false && google_auth_response.result === 'denied' && google_auth_response.error === 'access_denied') {
        alert('CryptUp needs this permission to search your contacts on Gmail. Without it, CryptUp will keep a separate contact list.');
      } else {
        console.log(google_auth_response);
        alert(window.lang.general.something_went_wrong_try_again);
      }
    });
  }

  function render_search_results_loading_done() {
    S.cached('contacts').find('ul li.loading').remove();
    if (!S.cached('contacts').find('ul li').length) {
      hide_contacts();
    }
  }

  function render_search_results(contacts, query) {
    const renderable_contacts = contacts.slice();
    renderable_contacts.sort(function (a, b) { // all that have pgp group on top. Without pgp bottom. Sort both groups by last used first.
      return (10 * (b.has_pgp - a.has_pgp)) + (b.last_use - a.last_use > 0 ? 1 : -1);
    });
    renderable_contacts.splice(8);
    if (renderable_contacts.length > 0 || contact_search_in_progress) {
      let ul_html = '';
      tool.each(renderable_contacts, function (i, contact) {
        ul_html += '<li class="select_contact" email="' + contact.email.replace(/<\/?b>/g, '') + '">';
        if (contact.has_pgp) {
          ul_html += '<img src="/img/svgs/locked-icon-green.svg" />';
        } else {
          ul_html += '<img src="/img/svgs/locked-icon-gray.svg" />';
        }
        let display_email;
        if (contact.email.length < 40) {
          display_email = contact.email;
        } else {
          const parts = contact.email.split('@');
          display_email = parts[0].replace(/<\/?b>/g, '').substr(0, 10) + '...@' + parts[1];
        }
        if (contact.name) {
          ul_html += (contact.name + ' &lt;' + display_email + '&gt;');
        } else {
          ul_html += display_email;
        }
        ul_html += '</li>';
      });
      if (contact_search_in_progress) {
        ul_html += '<li class="loading">loading...</li>';
      }
      S.cached('contacts').find('ul').html(ul_html);
      S.cached('contacts').find('ul li.select_contact').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
        select_contact(tool.str.parse_email($(self).attr('email')).email, query);
      }));
      S.cached('contacts').find('ul li.select_contact').hover(function () {
        $(this).addClass('hover');
      }, function () {
        $(this).removeClass('hover');
      });
      S.cached('contacts').find('ul li.auth_contacts').click(function () {
        auth_contacts(account_email);
      });
      S.cached('contacts').css({
        display: 'block',
        top: ($('#compose > tbody > tr:first').height() + $('#input_addresses_container > div:first').height() + 10) + 'px'
      });
    } else {
      hide_contacts();
    }
  }

  function search_contacts(db_only) {
    const query = {substring: tool.str.parse_email(S.cached('input_to').val()).email};
    if (query.substring !== '') {
      app.storage_contact_search(query, function (contacts) {
        if (db_only || !can_read_emails) {
          render_search_results(contacts, query);
        } else {
          contact_search_in_progress = true;
          render_search_results(contacts, query);
          app.email_provider_search_contacts(query.substring, contacts).done((success, search_contacts_results) => {
            if (search_contacts_results.new.length) {
              tool.each(search_contacts_results.new, function (i, contact) {
                app.storage_contact_get(contact.email, function (in_db) {
                  if (!in_db) {
                    app.storage_contact_save(db_contact_object(contact.email, contact.name, null, null, null, true, new Date(contact.date).getTime() || null), function () {
                      search_contacts(true);
                    });
                  } else if (!in_db.name && contact.name) {
                    const to_update = {name: contact.name};
                    app.storage_contact_update(contact.email, to_update, () => {
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
    S.cached('contacts').css('display', 'none');
  }

  function update_pubkey_icon(include) {
    if (include === null || typeof include === 'undefined') { // decide if pubkey should be included
      if (!include_pubkey_toggled_manually) { // leave it as is if toggled manually before
        update_pubkey_icon(recipients_missing_my_key.length && !tool.value(supplied_from || get_sender_from_dom()).in(my_addresses_on_pks));
      }
    } else { // set icon to specific state
      if (include) {
        S.cached('icon_pubkey').addClass('active').attr('title', window.lang.compose.include_pubkey_icon_title_active);
      } else {
        S.cached('icon_pubkey').removeClass('active').attr('title', window.lang.compose.include_pubkey_icon_title);
      }
    }
  }

  function update_footer_icon(include) {
    if (include === null || typeof include === 'undefined') { // decide if pubkey should be included
      update_footer_icon(!!app.storage_get_email_footer());
    } else { // set icon to specific state
      if (include) {
        S.cached('icon_footer').addClass('active');
      } else {
        S.cached('icon_footer').removeClass('active');
      }
    }
  }

  function toggle_sign_icon() {
    if (!S.cached('icon_sign').is('.active')) {
      S.cached('icon_sign').addClass('active');
      S.cached('compose_table').addClass('sign');
      S.cached('title').text(window.lang.compose.header_title_compose_sign);
      S.cached('input_password').val('');
    } else {
      S.cached('icon_sign').removeClass('active');
      S.cached('compose_table').removeClass('sign');
      S.cached('title').text(window.lang.compose.header_title_compose_encrypt);
    }
    if (tool.value(S.now('send_btn_span').text()).in([BTN_SIGN_AND_SEND, BTN_ENCRYPT_AND_SEND])) {
      reset_send_btn();
    }
    show_hide_password_or_pubkey_container_and_color_send_button();
  }

  function recipient_key_id_text(contact) {
    if (contact.client === 'cryptup' && contact.keywords) {
      return '\n\n' + 'Public KeyWords:\n' + contact.keywords;
    } else if (contact.fingerprint) {
      return '\n\n' + 'Key fingerprint:\n' + contact.fingerprint;
    } else {
      return '';
    }
  }

  function render_pubkey_result(email_element, email, contact) {
    if ($('body#new_message').length) {
      if (typeof contact === 'object' && contact.has_pgp) {
        let sending_address_on_pks = tool.value(supplied_from || get_sender_from_dom()).in(my_addresses_on_pks);
        let sending_address_on_keyserver = tool.value(supplied_from || get_sender_from_dom()).in(my_addresses_on_keyserver);
        if ((contact.client === 'cryptup' && !sending_address_on_keyserver) || (contact.client !== 'cryptup' && !sending_address_on_pks)) {
          // new message, and my key is not uploaded where the recipient would look for it
          app.does_recipient_have_my_pubkey(email, function (already_has) {
            if (!already_has) { // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
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
    if (contact === PUBKEY_LOOKUP_RESULT_FAIL) {
      $(email_element).attr('title', 'Loading contact information failed, please try to add their email again.');
      $(email_element).addClass("failed");
      $(email_element).children('img:visible').replaceWith('<img src="/img/svgs/repeat-icon.svg" class="repeat-icon action_retry_pubkey_fetch">');
      $(email_element).find('.action_retry_pubkey_fetch').click(remove_receiver); // todo - actual refresh
    } else if (contact === PUBKEY_LOOKUP_RESULT_WRONG) {
      $(email_element).attr('title', 'This email address looks misspelled. Please try again.');
      $(email_element).addClass("wrong");
    } else if (contact.has_pgp && tool.crypto.key.expired_for_encryption(openpgp.key.readArmored(contact.pubkey).keys[0])) {
      $(email_element).addClass("expired");
      $(email_element).prepend('<img src="/img/svgs/expired-timer.svg" class="expired-time">');
      $(email_element).attr('title', 'Does use encryption but their public key is expired. You should ask them to send you an updated public key.' + recipient_key_id_text(contact));
    } else if (contact.has_pgp && contact.attested) {
      $(email_element).addClass("attested");
      $(email_element).prepend('<img src="/img/svgs/locked-icon.svg" />');
      $(email_element).attr('title', 'Does use encryption, attested by CRYPTUP' + recipient_key_id_text(contact));
    } else if (contact.has_pgp) {
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
    let selector;
    if (filter === 'no_pgp') {
      selector = '.recipients span.no_pgp';
    } else {
      selector = '.recipients span';
    }
    const recipients = [];
    $(selector).each(function () {
      recipients.push($(this).text().trim());
    });
    return recipients;
  }

  function get_sender_from_dom() {
    if (S.now('input_from').length) {
      return S.now('input_from').val();
    } else {
      return account_email;
    }
  }

  $('.delete_draft').click(function () {
    draft_delete(app.close_message);
  });

  function render_reply_success(message, plaintext, message_id) {
    let is_signed = S.cached('icon_sign').is('.active');
    app.render_reinsert_reply_box(message_id, message.headers.To.split(',').map(a => tool.str.parse_email(a).email));
    if(is_signed) {
      S.cached('replied_body').addClass('pgp_neutral').removeClass('pgp_secure');
    }
    S.cached('replied_body').css('width', $('table#compose').width() - 30);
    S.cached('compose_table').css('display', 'none');
    S.cached('reply_message_successful').find('div.replied_from').text(supplied_from);
    S.cached('reply_message_successful').find('div.replied_to span').text(supplied_to);
    S.cached('reply_message_successful').find('div.replied_body').html(plaintext.replace(/\n/g, '<br>'));
    const email_footer = app.storage_get_email_footer();
    if (email_footer) {
      if(is_signed) {
        S.cached('replied_body').append('<br><br>' + email_footer.replace(/\n/g, '<br>'));
      } else {
        S.cached('reply_message_successful').find('.email_footer').html('<br>' + email_footer.replace(/\n/g, '<br>'));
      }
    }
    let t = new Date();
    let time = ((t.getHours() !== 12) ? (t.getHours() % 12) : 12) + ':' + t.getMinutes() + ((t.getHours() >= 12) ? ' PM ' : ' AM ') + '(0 minutes ago)';
    S.cached('reply_message_successful').find('div.replied_time').text(time);
    S.cached('reply_message_successful').css('display', 'block');
    if (message.attachments.length) {
      S.cached('replied_attachments').html(message.attachments.map(a => {a.message_id = message_id; return app.factory_attachment(a)}).join('')).css('display', 'block');
    }
    resize_reply_box();
  }

  function simulate_ctrl_v(to_paste) {
    const r = window.getSelection().getRangeAt(0);
    r.insertNode(r.createContextualFragment(to_paste));
  }

  function render_compose_table() {
    if (tool.env.browser().name === 'firefox') { // the padding cause issues in firefoxx where user cannot click on the message password
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
      if (!S.cached('input_to').is(':focus')) {
        S.cached('input_to').focus();
      }
    }).children().click(function () {
      return false;
    });
    resize_input_to();
    tool.time.wait(function () {
      if (attach) {
        return true;
      }
    }).then(function () {
      attach.initialize_attach_dialog('fineuploader', 'fineuploader_button');
    });
    S.cached('input_to').focus();
    if(is_reply_box) {
      if (supplied_to) {
        S.cached('input_text').focus();
        document.getElementById('input_text').focus();
        evaluate_receivers();
      }
      setTimeout(() => { // delay automatic resizing until a second later
        $(window).resize(tool.ui.event.prevent(tool.ui.event.spree('veryslow'), resize_reply_box));
        S.cached('input_text').keyup(resize_reply_box);
      }, 1000);
    } else {
      $('.close_new_message').click(app.close_message);
      let addresses = order_addresses(account_email, app.storage_get_addresses());
      if(addresses.length > 1) {
        $('#input_addresses_container').addClass('show_send_from').append('<select id="input_from" tabindex="-1"></select>');
        $('#input_from').append(addresses.map(a => '<option value="' + a + '">' + a + '</option>').join('')).change(update_pubkey_icon);
      }
    }
  }

  function order_addresses(account_email, addresses) { // place main account email as first
    return [account_email].concat(tool.arr.without_value(addresses, account_email));
  }

  function should_save_draft(message_body) {
    if (message_body && message_body !== last_draft) {
      last_draft = message_body;
      return true;
    } else {
      return false;
    }
  }

  function format_password_protected_email(short_id, original_body, armored_pubkeys) {
    const decrypt_url = CRYPTUP_WEB_URL + '/' + short_id;
    const a = '<a href="' + tool.str.html_escape(decrypt_url) + '" style="padding: 2px 6px; background: #2199e8; color: #fff; display: inline-block; text-decoration: none;">' + window.lang.compose.open_message + '</a>';
    const intro = S.cached('input_intro').length ? S.cached('input_intro').get(0).innerText.trim() : '';
    const text = [];
    const html = [];
    if (intro) {
      text.push(intro + '\n');
      html.push(intro.replace(/\n/, '<br>') + '<br><br>');
    }
    text.push(window.lang.compose.message_encrypted_text + decrypt_url + '\n');
    html.push('<div class="cryptup_encrypted_message_replaceable">');
    html.push('<div style="opacity: 0;">' + tool.crypto.armor.headers(null).begin + '</div>');
    html.push(window.lang.compose.message_encrypted_html + a + '<br><br>');
    html.push(window.lang.compose.alternatively_copy_paste + tool.str.html_escape(decrypt_url) + '<br><br><br>');
    const html_cryptup_web_url_link = '<a href="' + tool.str.html_escape(CRYPTUP_WEB_URL) + '" style="color: #999;">' + tool.str.html_escape(CRYPTUP_WEB_URL) + '</a>';
    if (armored_pubkeys.length > 1) { // only include the message in email if a pubkey-holding person is receiving it as well
      const html_pgp_message = original_body['text/html'] ? original_body['text/html'] : original_body['text/plain'].replace(CRYPTUP_WEB_URL, html_cryptup_web_url_link).replace(/\n/g, '<br>\n');
      html.push('<div style="color: #999;">' + html_pgp_message + '</div>');
      text.push(original_body['text/plain']);
    }
    html.push('</div>');
    return {'text/plain': text.join('\n'), 'text/html': html.join('\n')};
  }

  function format_email_text_footer(original_body) {
    const email_footer = app.storage_get_email_footer();
    const body = {'text/plain': original_body['text/plain'] + (email_footer ? '\n' + email_footer : '')};
    if (typeof original_body['text/html'] !== 'undefined') {
      body['text/html'] = original_body['text/html'] + (email_footer ? '<br>\n' + email_footer.replace(/\n/g, '<br>\n') : '');
    }
    return body;
  }

  S.cached('input_password').keyup(tool.ui.event.prevent(tool.ui.event.spree(), show_hide_password_or_pubkey_container_and_color_send_button));
  S.cached('input_password').focus(show_hide_password_or_pubkey_container_and_color_send_button);
  S.cached('input_password').blur(show_hide_password_or_pubkey_container_and_color_send_button);

  S.cached('add_their_pubkey').click(function () {
    let no_pgp_emails = get_recipients_from_dom('no_pgp');
    app.render_add_pubkey_dialog(no_pgp_emails);
    clearInterval(added_pubkey_db_lookup_interval); // todo - get rid of setInterval. just supply tab_id and wait for direct callback
    console.log(';;;');
    added_pubkey_db_lookup_interval = setInterval(() => {
      console.log('intervaling');
      tool.each(no_pgp_emails, (i, email) => {
        app.storage_contact_get(email, function (contact) {
          console.log(contact);
          if (contact && contact.has_pgp) {
            $("span.recipients span.no_pgp:contains('" + email + "') i").remove();
            $("span.recipients span.no_pgp:contains('" + email + "')").removeClass('no_pgp');
            clearInterval(added_pubkey_db_lookup_interval);
            console.log('evaluating');
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
    app.send_message_to_background_script('settings', { account_email: account_email, page: '/chrome/settings/modules/help.htm' });
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
      app.render_footer_dialog();
    } else {
      update_footer_icon(!$(this).is('.active'));
    }
  });

  S.cached('body').bind({drop: tool.ui.event.stop(), dragover: tool.ui.event.stop()}); // prevents files dropped out of the intended drop area to screw up the page

  S.cached('icon_sign').click(toggle_sign_icon);

})();