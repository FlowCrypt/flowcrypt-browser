'use strict';

var SAVE_DRAFT_FREQUENCY = 3000;
var GMAIL_READ_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
var GMAIL_COMPOSE_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
var GOOGLE_CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly';
var GOOGLE_CONTACTS_ORIGIN = 'https://www.google.com/*';

var draft_id = undefined;
var draft_message_id = undefined;
var can_search_contacts = undefined;
var can_save_drafts = undefined;
var can_read_emails = undefined;
var pubkey_cache_interval = undefined;
var save_draft_interval = setInterval(draft_save, SAVE_DRAFT_FREQUENCY);
var save_draft_in_process = false;
var my_addresses_on_pks = [];
var recipients_missing_my_key = [];
var compose_url_params = get_url_params(['account_email', 'parent_tab_id', 'thread_id', 'frame_id', 'subject', 'placement']);
var l = {
  open_challenge_message: 'This message is encrypted. If you can\'t read it, visit the following link:',
};

// this is here to trigger a notification to user if due to their chrome settings, they cannot access localStorage
// if the settings are incorrect, a gmail notification will show to correct it
var _ = private_storage_get('local', compose_url_params.account_email, 'master_public_key', compose_url_params.parent_tab_id);

// set can_search_contacts, can_save_drafts, addresses_pks
account_storage_get(compose_url_params.account_email, ['google_token_scopes', 'addresses_pks'], function(storage) {
  my_addresses_on_pks = storage.addresses_pks || [];
  if(typeof storage.google_token_scopes === 'undefined') {
    can_search_contacts = false;
    can_save_drafts = false;
    can_read_emails = false;
  } else {
    if(storage.google_token_scopes.indexOf(GOOGLE_CONTACTS_SCOPE) === -1) {
      can_search_contacts = false;
    } else {
      chrome_message_send(null, 'chrome_auth', {
        action: 'get',
      }, function(permissions) {
        can_search_contacts = (permissions.origins.indexOf(GOOGLE_CONTACTS_ORIGIN) !== -1);
      });
    }
    can_save_drafts = (storage.google_token_scopes.indexOf(GMAIL_COMPOSE_SCOPE) !== -1);
    can_read_emails = (storage.google_token_scopes.indexOf(GMAIL_READ_SCOPE) !== -1);
  }
  if(!can_save_drafts) {
    $('#send_btn_note').html('<a href="#" class="draft_auth hover_underline">Enable encrypted drafts</a>');
    $('#send_btn_note a.draft_auth').click(draft_auth);
  }
});

function format_challenge_question_email(question, body) {
  var result = {};
  result['text/plain'] = [
    l.open_challenge_message,
    'https://cryptup.org/decrypt.htm?question=' + encodeURIComponent(question) + '&message=' + encodeURIComponent(body['text/plain']),
    '',
    body['text/plain'],
  ].join('\n');
  if(body['text/html']) {
    result['text/html'] = [
      l.open_challenge_message.replace(/ /g, '&nbsp;') + '&nbsp;<a href="https://cryptup.org/decrypt.htm?question=' + encodeURIComponent(question) + '&message=' + encodeURIComponent(body['text/plain']) + '">read&nbsp;message</a>',
      '',
      body['text/html'],
    ].join('<br>\n');
  }
  return result;
}

var last_draft = '';

function should_save_draft(message_body) {
  if(message_body && message_body !== last_draft) {
    last_draft = message_body;
    return true;
  } else {
    return false;
  }
}

function draft_set_id(id) {
  draft_id = id;
}

function draft_meta_store(store_if_true, draft_id, thread_id, recipients, subject, then) {
  account_storage_get(compose_url_params.account_email, ['drafts_reply', 'drafts_compose'], function(storage) {
    if(thread_id) { // it's a reply
      var drafts = storage.drafts_reply || {};
      if(store_if_true) {
        drafts[compose_url_params.thread_id] = draft_id;
      } else {
        delete drafts[compose_url_params.thread_id];
      }
      account_storage_set(compose_url_params.account_email, {
        drafts_reply: drafts,
      }, then);
    } else { // it's a new message
      var drafts = storage.drafts_compose || {};
      if(store_if_true) {
        drafts[draft_id] = {
          recipients: recipients,
          subject: subject,
          date: new Date().getTime(),
        };
      } else {
        delete drafts[draft_id];
      }
      account_storage_set(compose_url_params.account_email, {
        drafts_compose: drafts,
      }, then);
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
    var armored_pubkey = private_storage_get('local', compose_url_params.account_email, 'master_public_key', compose_url_params.parent_tab_id);
    encrypt([armored_pubkey], null, null, $('#input_text')[0].innerText, true, function(encrypted) {
      if(compose_url_params.thread_id) { // replied message
        var body = '[cryptup:link:draft_reply:' + compose_url_params.thread_id + ']\n\n' + encrypted.data;
      } else if(draft_id) {
        var body = '[cryptup:link:draft_compose:' + draft_id + ']\n\n' + encrypted.data;
      } else {
        var body = encrypted.data;
      }
      to_mime(compose_url_params.account_email, body, {
        To: get_recipients_from_dom(),
        From: get_sender_from_dom(),
        Subject: $('#input_subject').val() || compose_url_params.subject || 'CryptUP draft',
      }, [], function(mime_message) {
        if(!draft_id) {
          gmail_api_draft_create(compose_url_params.account_email, mime_message, compose_url_params.thread_id, function(success, response) {
            set_note(success);
            if(success) {
              draft_id = response.id;
              draft_message_id = response.message.id;
              draft_meta_store(true, response.id, compose_url_params.thread_id, get_recipients_from_dom(), $('#input_subject'));
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
          gmail_api_draft_update(compose_url_params.account_email, draft_id, mime_message, function(success, response) {
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
  wait(function() {
    if(!save_draft_in_process) {
      return true;
    }
  }).then(function() {
    if(draft_id) {
      draft_meta_store(false, draft_id, compose_url_params.thread_id, null, null, function() {
        gmail_api_draft_delete(account_email, draft_id, callback);
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
    var private_key = openpgp.key.readArmored(private_storage_get('local', account_email, 'master_private_key', compose_url_params.parent_tab_id)).keys[0];
    if(typeof my_passphrase !== 'undefined' && my_passphrase !== '') {
      private_key.decrypt(my_passphrase);
    }
    openpgp.decrypt({
      message: openpgp.message.readArmored(encrypted_draft),
      format: 'utf8',
      privateKey: private_key,
    }).then(function(plaintext) {
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
    }).catch(function(error) {
      console.log('openpgp.decrypt(options).catch(error)');
      console.log(error);
      if(render_function) {
        render_function();
      }
    });
  } else {
    if($('div#reply_message_prompt').length) { // todo - will only work for reply box, not compose box
      $('div#reply_message_prompt').html(get_spinner() + ' Waiting for pass phrase to open previous draft..');
      clearInterval(passphrase_interval);
      passphrase_interval = setInterval(function() {
        check_passphrase_entered(encrypted_draft);
      }, 1000);
    }
  }
}

function fetch_pubkeys(account_email, recipients, callback) {
  get_pubkeys(recipients, function(pubkey_results) {
    if(typeof pubkey_results === 'undefined') {
      callback(false);
    } else {
      var pubkeys = [];
      $.each(pubkey_results, function(i, pubkey_info) {
        if(pubkey_info !== null && pubkey_info.pubkey !== null) {
          pubkeys.push(pubkey_info.pubkey);
        }
      });
      callback(true, pubkeys.length === recipients.length, pubkeys.concat(private_storage_get('local', account_email, 'master_public_key', compose_url_params.parent_tab_id)));
    }
  });
}

function compose_encrypt_and_send(account_email, recipients, subject, plaintext, send_email_callback) {
  if($('#send_btn span').text().toLowerCase().trim() === 'encrypt and send') {
    var btn_html = $('#send_btn').html();
    $('#send_btn span').text('Loading');
    $('#send_btn i').replaceWith(get_spinner());
    var challenge = {
      question: $('#input_question').val(),
      answer: $('#input_answer').val(),
    };
    fetch_pubkeys(account_email, recipients, function(success, all_have_keys, armored_pubkeys) {
      if(success) {
        if(!recipients.length) {
          $('#send_btn').html(btn_html);
          alert('Please add receiving email address.');
          return;
        } else if(has_attachment() && !all_have_keys) {
          $('#send_btn').html(btn_html);
          alert('Sending encrypted attachments is only possible to contacts with a PGP client, such as CryptUP. Some of the recipients don\'t have PGP. Get them signed up.');
          return;
        } else if(!all_have_keys && (!challenge.question || !challenge.answer)) {
          $('#send_btn').html(btn_html);
          alert('Because one or more of recipients don\'t have CryptUP or other PGP app, a question and answer is needed for encryption. The answer will work as a password to open the message.');
          return;
        } else if((plaintext != '' || window.confirm('Send empty message?')) && (subject != '' || window.confirm('Send without a subject?'))) {
          //todo - tailor for replying w/o subject
          $('#send_btn span').text('Encrypting');
          try {
            collect_and_encrypt_attachments(armored_pubkeys, all_have_keys ? null : challenge, function(attachments) {
              if((attachments || []).length) {
                var sending = 'Uploading attachments';
              } else {
                var sending = 'Sending';
              }
              encrypt(armored_pubkeys, null, all_have_keys ? null : challenge, plaintext, true, function(encrypted) {
                if($('#send_pubkey_container').css('display') === 'table-row' && $('#send_pubkey_container').css('visibility') === 'visible') {
                  encrypted.data += '\n\n\n\n' + private_storage_get('local', url_params.account_email, 'master_public_key', compose_url_params.parent_tab_id);
                }
                var body = {
                  'text/plain': encrypted.data,
                  'text/html': encrypted.data.replace(/(?:\r\n|\r|\n)/g, '<br>\n'),
                };
                if(!all_have_keys) {
                  body = format_challenge_question_email(challenge.question, body);
                }
                $('#send_btn span').text(sending);
                send_email_callback(body, attachments);
              });
            });
          } catch(err) {
            $('#send_btn').html(btn_html);
            alert(err);
          }
        } else {
          $('#send_btn').html(btn_html);
        }
      } else {
        $('#send_btn').html(btn_html);
        alert('Network error, please try again.');
      }
    });
  } else {
    alert('Please wait, information about recipients is still loading.');
  }
}

function handle_send_message_error(response) {
  if(response.status === 413) {
    $('#send_btn span').text('encrypt and send');
    $('#send_btn i').attr('class', '');
    alert('Currently, total attachments size should be under 5MB. Larger files will be possible very soon.');
  } else {
    console.log('handle_send_message_error');
    console.log(response);
    alert('Error sending message, try to re-open your Gmail window and send again. Write me at tom@cryptup.org if this happens repeatedly.');
  }
}

function compose_evaluate_receivers() {
  $('.recipients span').not('.working, .has_pgp, .no_pgp, .wrong, .attested').each(function() {
    var email_element = this;
    var email = $(email_element).text().trim();
    if(is_email_valid(email)) {
      $("#send_btn span").text('Wait...');
      $("#send_btn_note").text("Checking email addresses");
      get_pubkeys([email], function(pubkeys) {
        compose_render_pubkey_result(email_element, pubkeys[0]);
      });
    } else {
      compose_render_pubkey_result(email_element, undefined);
      $(email_element).addClass('wrong');
    }
  });
}

function compose_show_hide_missing_pubkey_container() {
  var was_previously_visible = $("#missing_pubkey_container").css('display') === 'table-row';
  if(!$('.recipients span').length) {
    $("#challenge_question_container").css('display', 'none');
    $("#missing_pubkey_container").css('display', 'none');
    $('#send_btn').removeClass('gray').addClass('green');
  } else {
    if($('.recipients span.no_pgp').length) {
      if($("#missing_pubkey_container").css('display') === 'none' && $("#challenge_question_container").css('display') === 'none') {
        $("#missing_pubkey_container").css('display', 'table-row');
        $('#send_btn').removeClass('green').addClass('gray');
      }
    } else {
      $("#challenge_question_container").css('display', 'none');
      $("#missing_pubkey_container").css('display', 'none');
      $('#send_btn').removeClass('gray').addClass('green');
    }
  }
  if($('body#reply_message').length) {
    if(!was_previously_visible && $("#missing_pubkey_container").css('display') === 'table-row') {
      resize_reply_box($("#missing_pubkey_container").first().height() + 20);
    } else {
      resize_reply_box();
    }
  }
}

function respond_to_input_hotkeys(input_to_keydown_event) {
  var value = $('#input_to').val();
  var keys = key_codes();
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

var last_reply_box_table_height = undefined;

function resize_reply_box(add_extra) {
  if(isNaN(add_extra)) {
    add_extra = 0;
  }
  $('div#input_text').css('max-width', ($('body').width() - 20) + 'px');
  var current_height = $('table#compose').height();
  if(current_height !== last_reply_box_table_height) {
    last_reply_box_table_height = current_height;
    chrome_message_send(compose_url_params.parent_tab_id, 'set_css', {
      selector: 'iframe#' + compose_url_params.frame_id,
      css: {
        height: Math.max(260, current_height + 1) + add_extra,
      }
    });
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
    compose_evaluate_receivers();
  } else if(!$('#input_to').is(':focus') && content) {
    $('#input_to').siblings('.recipients').append('<span>' + content + icon + '</span>');
    $('.recipients span i').click(remove_receiver);
    $('#input_to').val('');
    resize_input_to();
    compose_evaluate_receivers();
  }
}

function select_contact(email, from_query) {
  if($('.recipients span').last().text() === from_query) {
    $('.recipients span').last().remove();
  }
  $('#input_to').focus();
  $('#input_to').val(trim_lower(email));
  hide_contacts();
  $('#input_to').blur();
  $('#input_to').focus();
}

function resize_input_to() {
  var new_width = Math.max(150, $('#input_to').parent().width() - $('#input_to').siblings('.recipients').width() - 50);
  $('#input_to').css('width', new_width + 'px');
}

function remove_receiver() {
  recipients_missing_my_key = array_without_value(recipients_missing_my_key, $(this).parent().text());
  $(this).parent().remove();
  resize_input_to();
  compose_show_hide_missing_pubkey_container();
  compose_show_hide_send_pubkey_container();
}

function draft_auth() {
  chrome_message_send(null, 'google_auth', {
    account_email: compose_url_params.account_email,
    scopes: [GMAIL_COMPOSE_SCOPE],
  }, function(google_auth_response) {
    if(google_auth_response.success === true) {
      $('#send_btn_note').text('');
      can_save_drafts = true;
      clearInterval(save_draft_interval);
      draft_save();
      setInterval(draft_save, SAVE_DRAFT_FREQUENCY);
    } else if(google_auth_response.success === false && google_auth_response.result === 'denied' && google_auth_response.error === 'access_denied') {
      alert('CryptUP needs this permission save your encrypted drafts automatically.');
    } else {
      console.log(google_auth_response);
      alert('Something went wrong, please try again. If this happens again, please write me at tom@cryptup.org to fix it.');
    }
  });
}

function auth_contacts(account_email, for_search_query) {
  $('#input_to').val($('.recipients span').last().text());
  $('.recipients span').last().remove();
  chrome_message_send(null, 'chrome_auth', {
    action: 'set',
    origins: [GOOGLE_CONTACTS_ORIGIN],
  }, function(chrome_pemission_granted) {
    if(chrome_pemission_granted) {
      chrome_message_send(null, 'google_auth', {
        account_email: account_email,
        scopes: [GOOGLE_CONTACTS_SCOPE],
      }, function(google_auth_response) {
        if(google_auth_response.success === true) {
          can_search_contacts = true;
          search_contacts();
        } else if(google_auth_response.success === false && google_auth_response.result === 'denied' && google_auth_response.error === 'access_denied') {
          alert('CryptUP needs this permission to search your Google Contacts. Without it, CryptUP will keep a separate contact list.');
        } else {
          console.log(google_auth_response);
          alert('Something went wrong, please try again. If this happens again, please write me at tom@cryptup.org to fix it.');
        }
      });
    } else {
      alert('CryptUP needs this permission to connect to Google Contacts. Without it, CryptUP will keep a separate contact list.');
    }
  });
}

function search_pubkey_cache(query, max) {
  var results = [];
  var local = pubkey_cache_search(query, max);
  $.each(local, function(i, contact) {
    results.push({
      name: contact.name,
      email: contact.email_highlighted,
      has_cryptup: contact.has_cryptup,
      pgp: true,
    });
  });
  return results;
}

function render_search_results(results, query) {
  if(results.length > 0 || !can_search_contacts) {
    var ul_html = '';
    $.each(results, function(i, result) {
      ul_html += '<li class="select_contact" email="' + result.email.replace(/<\/?b>/g, '') + '">';
      if(result.pgp === true) {
        ul_html += '<i class="fa fa-lock"></i>';
      } else {
        ul_html += '<i class="fa fa-lock" style="color: gray;"></i>';
      }
      if(result.email.length < 40) {
        var display_email = result.email;
      } else {
        var parts = result.email.split('@');
        var display_email = parts[0].replace(/<\/?b>/g, '').substr(0, 10) + '...@' + parts[1];
      }
      if(result.name) {
        ul_html += (result.name + ' &lt;' + display_email + '&gt;');
      } else {
        ul_html += display_email;
      }
      ul_html += '</li>';
    });
    if(!can_search_contacts) {
      ul_html += '<li class="auth_contacts"><span class="button red"><i class="fa fa-search"></i>Search Gmail Contacts</span></li>';
    }
    $('#contacts ul').html(ul_html);
    $('#contacts ul li.select_contact').click(function() {
      select_contact($(this).attr('email'), query);
    });
    $('#contacts ul li.select_contact').hover(function() {
      $(this).addClass('hover');
    }, function() {
      $(this).removeClass('hover');
    });
    $('#contacts ul li.auth_contacts').click(function() {
      auth_contacts(compose_url_params.account_email, query);
    });
    $('#contacts').css('display', 'block');
  } else {
    hide_contacts();
  }
}

function search_contacts() {
  var query = trim_lower($('#input_to').val());
  if(query !== '') {
    if(can_search_contacts) {
      var contacts = search_pubkey_cache(query, 6);
      var emails = [];
      $.each(contacts, function(i, contact) {
        emails.push(contact.email.replace(/<\/?b>/g, ''));
      });
      google_api_contacts(compose_url_params.account_email, query, 7 - contacts.length, function(success, google_contacts) {
        if(success) {
          $.each(google_contacts, function(i, google_contact) {
            if(emails.indexOf(google_contact.email) === -1) { // only add contacts that were not there yet
              contacts.push(google_contact);
              emails.push(google_contact.email);
            }
          });
        } else {
          console.log('search_add_google_contacts.google_api_contacts.success === false');
          console.log(google_contacts);
        }
        render_search_results(contacts, query);
      });
    } else {
      render_search_results(search_pubkey_cache(query, 7), query);
    }
  } else {
    hide_contacts();
  }
}

function hide_contacts() {
  $('#contacts').css('display', 'none');
}

function did_i_ever_send_pubkey_to_or_receive_encrypted_message_from(their_email, callback) {
  their_email = trim_lower(their_email);
  account_storage_get(compose_url_params.account_email, ['pubkey_sent_to'], function(storage) {
    if(storage.pubkey_sent_to && storage.pubkey_sent_to.indexOf(their_email) !== -1) {
      callback(true);
    } else if(!can_read_emails) {
      callback(undefined);
    } else {
      var q_sent_pubkey = 'is:sent to:' + their_email + ' "BEGIN PGP PUBLIC KEY" "END PGP PUBLIC KEY"';
      var q_received_message = 'from:' + their_email + ' "BEGIN PGP MESSAGE" "END PGP MESSAGE"';
      gmail_api_message_list(compose_url_params.account_email, '(' + q_sent_pubkey + ') OR (' + q_received_message + ')', true, function(success, response) {
        if(success && response.messages) {
          account_storage_set(compose_url_params.account_email, {
            pubkey_sent_to: (storage.pubkey_sent_to || []).concat(their_email),
          }, function() {
            callback(true);
          })
        } else {
          callback(false);
        }
      });
    }
  });
}

function compose_show_hide_send_pubkey_container() {
  if(recipients_missing_my_key.length && my_addresses_on_pks.indexOf(get_sender_from_dom()) === -1) {
    $('#send_pubkey_recipients').text(recipients_missing_my_key.join(' and '));
    $('#send_pubkey_container').css('display', 'table-row');
  } else {
    $('#send_pubkey_container').css('display', 'none');
  }
}

function compose_render_pubkey_result(email_element, pubkey_data) {
  if($('body#new_message').length) { //todo: better move this to new_message.js
    if(pubkey_data && pubkey_data.pubkey && !pubkey_data.has_cryptup && my_addresses_on_pks.indexOf(get_sender_from_dom()) === -1) {
      // new message, they do have pgp but don't have cryptup, and my keys is not on pks
      did_i_ever_send_pubkey_to_or_receive_encrypted_message_from($(email_element).text(), function(pubkey_sent) {
        if(!pubkey_sent) { // either don't know if they need pubkey (can_read_emails false), or they do need pubkey
          recipients_missing_my_key.push(trim_lower($(email_element).text()));
        }
        compose_show_hide_send_pubkey_container();
      });
    } else {
      compose_show_hide_send_pubkey_container();
    }
  }
  function key_id_text(pubkey_data) {
    if(pubkey_data === null || typeof pubkey_data === 'undefined') {
      return '';
    } else if (pubkey_data.has_cryptup && pubkey_data.keywords) {
      return '\n\n' + 'Public KeyWords:\n' +  pubkey_data.keywords;
    } else if (pubkey_data.fingerprint) {
      return '\n\n' + 'Key fingerprint:\n' +  pubkey_data.fingerprint;
    } else {
      return '';
    }
  };
  var email_address = trim_lower($(email_element).text());
  $(email_element).children('i').removeClass('fa');
  $(email_element).children('i').removeClass('fa-spin');
  $(email_element).children('i').removeClass('ion-load-c');
  $(email_element).children('i').addClass('ion-android-close');
  if(typeof pubkey_data === 'undefined') {
    $(email_element).attr('title', 'Loading contact information failed, please try to add their email again.');
    // todo - show option to try again
  } else if(pubkey_data && pubkey_data.pubkey !== null && pubkey_data.attested) {
    $(email_element).addClass("attested");
    $(email_element).prepend("<i class='ion-locked'></i>");
    $(email_element).attr('title', 'Does use encryption, attested by CRYPTUP' + key_id_text(pubkey_data));
  } else if(pubkey_data && pubkey_data.pubkey !== null) {
    $(email_element).addClass("has_pgp");
    $(email_element).prepend("<i class='ion-locked'></i>");
    $(email_element).attr('title', 'Does use encryption' + key_id_text(pubkey_data));
  } else {
    $(email_element).addClass("no_pgp");
    $(email_element).prepend("<i class='ion-locked'></i>");
    $(email_element).attr('title', 'Could not verify their encryption setup. You can encrypt the message with a password below. Alternatively, add their pubkey.');
  }
  if(!$('.receivers span i.fa-spin').length) {
    $("#send_btn span").text('encrypt and send');
    $("#send_btn_note").text('');
  }
  compose_show_hide_missing_pubkey_container();
}

function get_recipients_from_dom(filter) {
  if(filter === 'no_pgp') {
    var selector = '.recipients span.no_pgp';
  } else {
    var selector = '.recipients span';
  }
  var recipients = [];
  $(selector).each(function() {
    recipients.push($(this).text().trim());
  });
  return recipients;
}

function get_sender_from_dom() {
  if($('#input_from').length) {
    return $('#input_from').val();
  } else {
    return compose_url_params.account_email;
  }
}

function convert_html_tags_to_newlines(text) {
  return text.replace(/<div ?\/?><br ?\/?>/gi, '\n').replace(/<br ?\/?>/gi, '\n').replace(/<div[^>]*>/gi, '\n').replace(/<\/div[^>]*>/gi, '').trim();
}

$('#input_question, #input_answer').keyup(prevent(spree(), function() {
  if($('#input_question').val() && $('#input_answer').val()) {
    $('#send_btn').removeClass('gray').addClass('green');
  } else {
    $('#send_btn').removeClass('green').addClass('gray');
  }
}));

$('.add_pubkey').click(function() {
  if(compose_url_params.placement !== 'settings') {
    chrome_message_send(compose_url_params.parent_tab_id, 'add_pubkey_dialog_gmail', {
      emails: get_recipients_from_dom('no_pgp'),
    });
  } else {
    chrome_message_send(compose_url_params.parent_tab_id, 'add_pubkey_dialog_settings', {
      emails: get_recipients_from_dom('no_pgp'),
    });
  }
  clearInterval(pubkey_cache_interval);
  pubkey_cache_interval = setInterval(function() {
    var pubkeys = pubkey_cache_retrieve();
    var new_key_added = false;
    $.each(get_recipients_from_dom('no_pgp'), function(i, email) {
      if(typeof pubkeys[email] !== 'undefined') {
        $("span.recipients span.no_pgp:contains('" + email + "') i").remove();
        $("span.recipients span.no_pgp:contains('" + email + "')").removeClass('no_pgp');
        new_key_added = true;
      }
    });
    if(new_key_added) {
      clearInterval(pubkey_cache_interval);
      compose_evaluate_receivers();
    }
  }, 1000);
});

$('.use_question').click(function() {
  $('#missing_pubkey_container').css('display', 'none');
  $('#challenge_question_container').css('display', 'table-row');
  resize_reply_box();
});

$('.action_feedback').click(function() {
  chrome_message_send(null, 'settings', {
    account_email: compose_url_params.account_email,
    page: '/chrome/settings/modules/help.htm',
  });
});

function compose_on_render() {
  $('#input_to').keydown(respond_to_input_hotkeys);
  $('#input_to').keyup(render_receivers);
  $('#input_to').keyup(prevent(spree('slow'), search_contacts));
  $('#input_to').blur(render_receivers);
  $('#input_text').keyup(function() {
    $('#send_btn_note').text('');
  });
  $('table#compose').click(hide_contacts);
  $('#input_addresses_container > div').click(function() {
    if(!$('#input_to').is(':focus')) {
      $('#input_to').focus();
    }
  }).children().click(function() {
    return false;
  });
  resize_input_to();
  initialize_attach_dialog();
}
