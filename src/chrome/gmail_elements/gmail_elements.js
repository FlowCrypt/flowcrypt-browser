
function get_url_params(expected_keys){
  var raw_url_data = window.location.search.replace('?', '').split('&');
  var url_data = {};
  for(var i=0;i<raw_url_data.length;i++){
    var pair = raw_url_data[i].split('=');
    if(expected_keys.indexOf(pair[0]) !== -1){
      url_data[pair[0]] = decodeURIComponent(pair[1]);
    }
  }
  return url_data;
}

function is_email_valid(email) {
  return /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i.test(email);
}

function compose_render_pubkey_result(email, pubkey_data) {
  if (pubkey_data !== null) {
    $("#input_to").removeClass("email_plain");
    $("#input_to").addClass("email_secure");
    $("#send_btn i").removeClass("fa-unlock");
    $("#send_btn i").removeClass("fa-spinner");
    $("#send_btn i").removeClass("fa-pulse");
    $("#send_btn i").addClass("fa-lock");
    $("#send_btn").addClass("button_secure");
    $("#send_btn span").text("Send PGP Encrypted");
    $("#send_btn_note").text('');
  } else {
    $("#input_to").removeClass("email_secure");
    $("#input_to").addClass("email_plain");
    $("#send_btn i").removeClass("fa-lock");
    $("#send_btn i").removeClass("fa-spinner");
    $("#send_btn i").removeClass("fa-pulse");
    $("#send_btn i").addClass("fa-unlock");
    $("#send_btn").removeClass("button_secure");
    $("#send_btn span").text("Send");
    $("#send_btn_note").text('They don\'t have encryption set up. Invite them to get CryptUP');
  }
}

function encrypt(pubkey_texts, text, callback) {
  var pubkeys = [];

  for (var i=0; i<pubkey_texts.length; i++) {
    pubkeys = pubkeys.concat(openpgp.key.readArmored(pubkey_texts[i]).keys); // read public key
  }
  openpgp.encryptMessage(pubkeys, text).then(callback, callback);
}

function compose_encrypt_and_send(to, subject, plaintext, send_email_callback) {
  var pubkeys = [];
  get_pubkey(to, function(pubkey_to){
    if($('#send_btn.button_secure').length > 0) {
      if(pubkey_to === null){
        alert('error: key is undefined although should exist');
        return;
      }
      pubkeys.push(pubkey_to);
    }
    if (to == ''){
      alert('Please add receiving email address.');
      return;
    } else if ((plaintext != '' || window.prompt('Send empty message?')) && (subject != '' || window.prompt('Send without a subject?'))) {
      //todo - tailor for replying w/o subject
      //todo - change prompts to yes/no
      try {
        if (pubkeys.length > 0) {
          if (localStorage.master_public_key) {  // todo: prompt if not
            pubkeys.push(localStorage.master_public_key);
          }
          encrypt(pubkeys, plaintext, function(encrypted) {
            send_email_callback(encrypted);
          });
        } else {
          send_email_callback(plaintext);
        }
      } catch(err) {
        alert(err);
      }
    }
  });
}

function compose_render_email_secure_or_insecure(){
  var email = $(this).val();
  if (is_email_valid(email)) {
    $("#send_btn i").addClass("fa-spinner");
    $("#send_btn i").addClass("fa-pulse");
    $("#send_btn span").text("");
    $("#send_btn_note").text("Checking email address");
    get_pubkey(email, function(pubkey) {
      compose_render_pubkey_result(email, pubkey);
    });
  } else {
    compose_render_email_neutral();
  }
}

function compose_render_email_neutral(){
  $("#input_to").removeClass("email_secure");
  $("#input_to").removeClass("email_plain");
  $("#send_btn").removeClass("button_secure");
  $("#send_btn i").removeClass("fa-lock");
  $("#send_btn i").removeClass("fa-spinner");
  $("#send_btn i").removeClass("fa-pulse");
  $("#send_btn i").addClass("fa-unlock");
  $("#send_btn span").text("Send");
  $("#send_btn_note").text('');
}
