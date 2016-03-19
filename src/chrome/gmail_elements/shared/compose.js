'use strict';

var l = {
  open_challenge_message: 'This message is encrypted. Visit the following link to open it:',
};

function format_challenge_question_email(question, message) {
  return [
    l.open_challenge_message,
    'https://cryptup.org/decrypt.htm?question=' + encodeURIComponent(question) + '&message=' + encodeURIComponent(message),
    '',
    '-----BEGIN PGP QUESTION-----',
    question,
    '-----END PGP QUESTION-----',
    '',
    message,
  ].join('\n');
}

function compose_render_pubkey_result(email, pubkey_data) {
  $("#send_btn i").removeClass("fa-spinner");
  $("#send_btn i").removeClass("fa-pulse");
  $("#send_btn i").addClass("fa-lock");
  $("#input_to").removeClass("email_plain");
  $("#input_to").removeClass("email_secure");
  $("#send_btn_note").text("");
  $("#send_btn span").text("send pgp encrypted");
  if(typeof pubkey_data === 'undefined') {
    $("#challenge_question_container").css('display', 'none');
  } else if(pubkey_data !== null) {
    $("#input_to").addClass("email_secure");
    $("#challenge_question_container").css('display', 'none');
  } else {
    $("#input_to").addClass("email_plain");
    $("#challenge_question_container").css('display', 'table-row');
  }
}

function encrypt(armored_pubkeys, challenge, data, armor, callback) {
  var options = {
    data: data,
    armor: armor,
  };
  var used_challange = false;
  if(armored_pubkeys && armored_pubkeys.length > 1) {
    options.publicKeys = [];
    $.each(armored_pubkeys, function(i, armored_pubkey) {
      options.publicKeys = options.publicKeys.concat(openpgp.key.readArmored(armored_pubkey).keys);
    });
  } else if(challenge.question && challenge.answer) {
    options.passwords = [challenge_answer_hash(challenge.answer)];
    used_challange = true;
  } else {
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

function fetch_pubkeys(account_email, recipient, callback) {
  get_pubkey(recipient, function(pubkey_recipient) {
    if(pubkey_recipient === null) {
      callback(null);
    } else {
      callback([restricted_account_storage_get(account_email, 'master_public_key'), pubkey_recipient]);
    }
  });
}

function compose_encrypt_and_send(account_email, to, subject, plaintext, send_email_callback) {
  var btn_text = $('#send_btn').text();
  $('#send_btn').html('Loading ' + get_spinner());
  var challenge = {
    question: $('#input_question').val(),
    answer: $('#input_answer').val(),
  };
  fetch_pubkeys(account_email, to, function(armored_pubkeys) {
    if(to == '') {
      $('#send_btn').text(btn_text);
      alert('Please add receiving email address.');
      return;
    } else if(has_attachment() && !armored_pubkeys) {
      $('#send_btn').text(btn_text);
      alert('Sending encrypted attachments is only possible to contacts with a PGP client, such as CryptUP. Get them signed up to send encrypted files.');
      return;
    } else if(!armored_pubkeys && (!challenge.question || !challenge.answer)) {
      $('#send_btn').text(btn_text);
      alert('Because they don\'t have CryptUP or other PGP app, a question and answer is needed for encryption. The answer will work as a password to open the message.');
      return;
    } else if((plaintext != '' || window.confirm('Send empty message?')) && (subject != '' || window.confirm('Send without a subject?'))) {
      //todo - tailor for replying w/o subject
      if(armored_pubkeys) {
        $('#send_btn').html('Encrypting ' + get_spinner());;
      }
      try {
        collect_and_encrypt_attachments(armored_pubkeys, challenge, function(attachments) {
          if((attachments || []).length) {
            var sending = 'Uploading attachments ' + get_spinner();
          } else {
            var sending = 'Sending ' + get_spinner();
          }
          encrypt(armored_pubkeys, challenge, plaintext, true, function(encrypted) {
            $('#send_btn').html(sending);
            send_email_callback(encrypted.data, attachments);
          });
        });
      } catch(err) {
        $('#send_btn').text(btn_text);
        alert(err);
      }
    } else {
      $('#send_btn').text(btn_text);
    }
  });
}

function compose_render_email_secure_or_insecure() {
  var email = $(this).val();
  if(is_email_valid(email)) {
    $("#send_btn i").addClass("fa-spinner");
    $("#send_btn i").addClass("fa-pulse");
    $("#send_btn_note").text("Checking email address");
    $("#send_btn span").text("");
    get_pubkey(email, function(pubkey) {
      compose_render_pubkey_result(email, pubkey);
    });
  } else {
    compose_render_pubkey_result(email, undefined);
  }
}

function convert_html_tags_to_newlines(text) {
  // todo: approximation. Does not handle <div><br></div> well which contenteditable fields tend to create
  return text.replace(/<[bB][rR] ?\/?>/g, '\n').replace(/<[dD][iI][vV][^>]*>/g, '\n').replace(/<\/[dD][iI][vV][^>]*>/g, '').trim();
}
