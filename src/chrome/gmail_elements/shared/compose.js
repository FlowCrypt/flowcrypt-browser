'use strict';

var SAVE_DRAFT_FREQUENCY = 3000;
var GOOGLE_CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly';
var GOOGLE_COMPOSE_SCOPE = 'https://www.googleapis.com/auth/gmail.compose';
var GOOGLE_CONTACTS_ORIGIN = 'https://www.google.com/*';

var draft_id = undefined;
var draft_message_id = undefined;
var can_search_on_google = undefined;
var can_save_drafts = undefined;
var pubkey_cache_interval = undefined;
var save_draft_interval = setInterval(draft_save, SAVE_DRAFT_FREQUENCY);
var save_draft_in_process = false;
var compose_url_params = get_url_params(['account_email', 'parent_tab_id', 'thread_id', 'frame_id', 'subject']);
var l = {
  open_challenge_message: 'This message is encrypted. If you can\'t read it, visit the following link:',
};

// set can_search_on_google and can_save_drafts
account_storage_get(compose_url_params.account_email, ['google_token_scopes'], function(storage) {
  if(storage.google_token_scopes.indexOf(GOOGLE_CONTACTS_SCOPE) === -1) {
    can_search_on_google = false;
  } else {
    chrome_message_send(null, 'chrome_auth', {
      action: 'get',
    }, function(permissions) {
      can_search_on_google = (permissions.origins.indexOf(GOOGLE_CONTACTS_ORIGIN) !== -1);
    });
  }
  can_save_drafts = (storage.google_token_scopes.indexOf(GOOGLE_COMPOSE_SCOPE) !== -1);
  if(!can_save_drafts) {
    $('#send_btn_note').html('<a href="#" class="draft_auth hover_underline">Enable encrypted drafts</a>');
    $('#send_btn_note a.draft_auth').click(draft_auth);
  }
});

function format_challenge_question_email(question, message) {
  return [
    l.open_challenge_message,
    'https://cryptup.org/decrypt.htm?question=' + encodeURIComponent(question) + '&message=' + encodeURIComponent(message),
    '',
    message,
  ].join('\n');
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

function draft_save() {
  function set_note(result) {
    if(result) {
      $('#send_btn_note').text('Saved');
    } else {
      $('#send_btn_note').text('Not saved');
    }
  }
  if(can_save_drafts && should_save_draft($('#input_text').text())) {
    save_draft_in_process = true;
    $('#send_btn_note').text('Saving');
    var armored_pubkey = private_storage_get(localStorage, compose_url_params.account_email, 'master_public_key');
    encrypt([armored_pubkey], null, $('#input_text').text(), true, function(encrypted) {
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
            }
            save_draft_in_process = false;
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
      })
    } else {
      if(callback) {
        callback();
      }
    }
  });
}

function decrypt_and_render_draft(account_email, encrypted_draft, render_function) {
  var my_passphrase = get_passphrase(account_email);
  if(my_passphrase !== null) {
    var private_key = openpgp.key.readArmored(private_storage_get(localStorage, account_email, 'master_private_key')).keys[0];
    if(typeof my_passphrase !== 'undefined' && my_passphrase !== '') {
      private_key.decrypt(my_passphrase);
    }
    openpgp.decrypt({
      message: openpgp.message.readArmored(encrypted_draft),
      format: 'utf8',
      privateKey: private_key,
    }).then(function(plaintext) {
      $('#input_text').html(plaintext.data);
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

function encrypt(armored_pubkeys, challenge, data, armor, callback) {
  var options = {
    data: data,
    armor: armor,
  };
  var used_challange = false;
  if(armored_pubkeys) {
    options.publicKeys = [];
    $.each(armored_pubkeys, function(i, armored_pubkey) {
      options.publicKeys = options.publicKeys.concat(openpgp.key.readArmored(armored_pubkey).keys);
    });
  }
  if(challenge && challenge.question && challenge.answer) {
    options.passwords = [challenge_answer_hash(challenge.answer)];
    used_challange = true;
  }
  if(!armored_pubkeys && !used_challange) {
    alert('Internal error: don\'t know how to encryt message. Please refresh the page and try again, or file a bug report if this happens repeatedly.');
    throw "no-pubkeys-no-challenge";
  }
  openpgp.encrypt(options).then(function(encrypted) {
    if(armor && typeof encrypted.data === 'string' && used_challange) {
      encrypted.data = format_challenge_question_email(challenge.question, encrypted.data);
    }
    callback(encrypted);
  }, function(error) {
    console.log(error);
    alert('Error encrypting message, please try again. If you see this repeatedly, please file a bug report.');
    //todo: make the UI behave well on errors
  });
}

function fetch_pubkeys(account_email, recipients, callback) {
  get_pubkeys(recipients, function(pubkey_results) {
    if(typeof pubkey_results === 'undefined') {
      callback(false);
    } else {
      var pubkeys = [];
      $.each(pubkey_results, function(i, pubkey) {
        if(pubkey !== null) {
          pubkeys.push(pubkey);
        }
      });
      callback(true, pubkeys.length === recipients.length, pubkeys.concat(private_storage_get(localStorage, account_email, 'master_public_key')));
    }
  });
}

function compose_encrypt_and_send(account_email, recipients, subject, plaintext, send_email_callback) {
  if($('#send_btn span').text().toLowerCase().trim() === 'send pgp encrypted') {
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
              encrypt(armored_pubkeys, all_have_keys ? null : challenge, plaintext, true, function(encrypted) {
                $('#send_btn span').text(sending);
                send_email_callback(encrypted.data, attachments);
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
    $('#send_btn span').text('send pgp encrypted');
    $('#send_btn i').attr('class', '');
    alert('Total attachments size should be under 5MB (will be fixed by the end of May)');
  } else {
    console.log('handle_send_message_error');
    console.log(response);
    alert('error sending message, check log');
  }
}

function compose_evaluate_receivers() {
  $('.recipients span').not('.working, .has_pgp, .no_pgp, .wrong').each(function() {
    var email = $(this).text().trim();
    if(is_email_valid(email)) {
      $("#send_btn span").text('Wait...');
      $("#send_btn_note").text("Checking email addresses");
      var email_element = this;
      get_pubkeys([email], function(pubkeys) {
        if(typeof pubkeys === 'undefined') {
          compose_render_pubkey_result(email_element, undefined);
        } else {
          compose_render_pubkey_result(email_element, pubkeys[0]);
        }
      });
    } else {
      compose_render_pubkey_result(this, undefined);
      $(this).addClass('wrong');
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
  console.log($('.recipients span').last().text());
  console.log(from_query);
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
  $(this).parent().remove();
  resize_input_to();
  compose_show_hide_missing_pubkey_container();
}

function draft_auth() {
  chrome_message_send(null, 'google_auth', {
    account_email: compose_url_params.account_email,
    scopes: [GOOGLE_COMPOSE_SCOPE],
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
          can_search_on_google = true;
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
  var local = pubkey_cache_search(query, max, true);
  $.each(local, function(i, email) {
    results.push({
      name: '',
      email: email,
      pgp: true,
    });
  });
  return results;
}

function render_search_results(results, query) {
  if(results.length > 0 || !can_search_on_google) {
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
    if(!can_search_on_google) {
      ul_html += '<li class="auth_contacts"><i class="fa fa-search"></i>Search Gmail Contacts</li>';
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
    if(can_search_on_google) {
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

function compose_render_pubkey_result(email_element, pubkey_data) {
  $(email_element).children('i').removeClass('fa');
  $(email_element).children('i').removeClass('fa-spin');
  $(email_element).children('i').removeClass('ion-load-c');
  $(email_element).children('i').addClass('ion-android-close');
  if(typeof pubkey_data === 'undefined') {
    // todo - show option to try again
  } else if(pubkey_data !== null) {
    $(email_element).addClass("has_pgp");
    $(email_element).prepend("<i class='ion-locked'></i>");

  } else {
    $(email_element).addClass("no_pgp");
    $(email_element).prepend("<i class='ion-ios-locked'></i>");

  }
  if(!$('.receivers span i.fa-spin').length) {
    $("#send_btn span").text('SEND PGP ENCRYPTED');
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
  chrome_message_send(compose_url_params.parent_tab_id, 'add_pubkey_dialog', {
    emails: get_recipients_from_dom('no_pgp'),
  });
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
  resize_input_to();
  initialize_attach_dialog();
}
