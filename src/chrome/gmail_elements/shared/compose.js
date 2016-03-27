'use strict';

var l = {
  open_challenge_message: 'This message is encrypted. If you can\'t read it, visit the following link:',
};

function format_challenge_question_email(question, message) {
  return [
    l.open_challenge_message,
    'https://cryptup.org/decrypt.htm?question=' + encodeURIComponent(question) + '&message=' + encodeURIComponent(message),
    '',
    message,
  ].join('\n');
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
    $('#send_btn i').attr('class', 'fa fa-lock');
    alert('Total attachments size should be under 5MB (will be fixed by the end of May)');
  } else {
    console.log(success);
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

function compose_show_hide_challenge_question_container() {
  if(!$('.recipients span').length) {
    $("#challenge_question_container").css('display', 'none');
  } else {
    if($('.recipients span.no_pgp').length) {
      $("#challenge_question_container").css('display', 'table-row');
    } else {
      $("#challenge_question_container").css('display', 'none');
    }
  }
}

function render_receivers() {
  var content = $(this).val();
  var icon = '<i class="fa ion-load-c fa-spin"></i>';
  if(content.match(/[, ]/) !== null) {
    var emails = content.split(/[, ]/g);
    for(var i = 0; i < emails.length - 1; i++) {
      $(this).siblings('.recipients').append('<span>' + emails[i] + icon + '</span>');
    }
    $('.recipients span i').click(remove_receiver);
    $(this).val(emails[emails.length - 1]);
    resize_input_to();
    compose_evaluate_receivers();
  } else if(!$(this).is(':focus') && content) {
    $(this).attr('placeholder', '');
    $(this).siblings('.recipients').append('<span>' + content + icon + '</span>');
    $('.recipients span i').click(remove_receiver);
    $(this).val('');
    resize_input_to();
    compose_evaluate_receivers();
  } else if(!$(this).is(':focus')) {
    $(this).attr('placeholder', '');
  }
}

function select_contact() {
  $('.recipients span').last().remove();
  $('#input_to').focus();
  $('#input_to').val($(this).text().trim());
  hide_contacts();
  $('#input_subject').focus();
}

function resize_input_to() {
  var new_width = Math.max(150, $('#input_to').parent().width() - $('#input_to').siblings('.recipients').width() - 20);
  $('#input_to').css('width', new_width + 'px');
}

function remove_receiver() {
  $(this).parent().remove();
  resize_input_to();
  compose_show_hide_challenge_question_container();
}

function search_contacts() {
  var query = $(this).val().trim();
  if(query !== '') {
    var found = pubkey_cache_search(query, 6, true);
    if(found.length > 0) {
      var ul_html = '';
      $.each(found, function(i, email) {
        ul_html += '<li><i class="fa fa-lock"></i>' + email + '</li>';
      });
      $('#contacts ul').html(ul_html);
      $('#contacts ul li').click(select_contact);
      $('#contacts').css('display', 'block');
    } else {
      hide_contacts();
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
  compose_show_hide_challenge_question_container();
}

function convert_html_tags_to_newlines(text) {
  // todo: approximation. Does not handle <div><br></div> well which contenteditable fields tend to create
  return text.replace(/<div ?\/?><br ?\/?>/gi, '\n').replace(/<br ?\/?>/gi, '\n').replace(/<div[^>]*>/gi, '\n').replace(/<\/div[^>]*>/gi, '').trim();
}
