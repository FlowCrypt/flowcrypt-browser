
function is_email_valid(email){
	return /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i.test(email);
}

var pubkeys = {};

function render_pubkey_result(email) {
	if (typeof pubkeys[email] !== "undefined" && pubkeys[email] !== null) {
		$("#input_to").removeClass("email_plain");
		$("#input_to").addClass("email_secure");
		$("#button_send i").removeClass("fa-unlock");
		$("#button_send i").addClass("fa-lock");
		$("#button_send").addClass("button_secure");
		$("#button_send span").text("Send PGP Encrypted");
	} else {
		$("#input_to").removeClass("email_secure");
		$("#input_to").addClass("email_plain");
		$("#button_send i").removeClass("fa-lock");
		$("#button_send i").addClass("fa-unlock");
		$("#button_send").removeClass("button_secure");
		$("#button_send span").text("Send");
	}
}

function encrypt(pgp_pubkey_text, text, callback) {
	if (window.crypto.getRandomValues) {
		var pub_key = openpgp.key.readArmored(pgp_pubkey_text); // read public key
		openpgp.encryptMessage(pub_key.keys, text).then(callback, callback);
	} else {
		throw "Error: Browser not supported\nReason: We need a cryptographically secure PRNG to be implemented (i.e. the window.crypto method)\nSolution: Use Chrome >= 11, Safari >= 3.1 or Firefox >= 21";
	}
}

function render_email_secure_or_insecure(){
  var email = $(this).val();
  if (is_email_valid(email)) {
    if (!(email in pubkeys)) {
      getPubkey(email, function(pubkey_data) {
        pubkeys[email] = pubkey_data;
        render_pubkey_result(email);
      });
    } else {
      render_pubkey_result(email);
    }
  } else {
    $("#input_to").removeClass("email_secure");
    $("#input_to").removeClass("email_plain");
    $("#button_send").removeClass("button_secure");
    $("#button_send i").removeClass("fa-lock");
    $("#button_send i").addClass("fa-unlock");
    $("#button_send span").text("Send");
  }
}

function render_email_neutral(){
	$("#input_to").removeClass("email_secure");
	$("#input_to").removeClass("email_plain");
	$("#button_send").removeClass("button_secure");
	$("#button_send i").removeClass("fa-lock");
	$("#button_send i").addClass("fa-unlock");
	$("#button_send span").text("Send");
}

function compose_window_close(){
  $('#compose_window').remove();
}

function compose_window_send_through_gmail_api(to, subject, text){
  require(['lib/gmail-api.js'], function(gmail_api){
    gmail_api.gmail_api_message_send('info@nvimp.com', to, subject, text, function(success, response){
      if (success) {
        compose_window_close();
      }
      else {
        console.log(response);
        alert('error sending message, check log');
      }
    });
  });
}

function compose_window_encrypt_and_send(){
  var to = $('#input_to').val();
  var subject = $('#input_subject').val();
  var plaintext = $('#input_text').text();
  var key = null;
  if($('#button_send.button_secure').length > 0) {
    key = pubkeys[to].key;
    if(!key){
      alert('error: key is undefined although should exist');
      return;
    }
  }
  if (to == ''){
    alert('Please add receiving email address.');
    return;
  } else if ((plaintext != '' || window.prompt('Send empty message?')) && (subject != '' || window.prompt('Send without a subject?'))) {
    try {
      if (key) {
        encrypt(key, plaintext, function(encrypted) {
          compose_window_send_through_gmail_api(to, subject, encrypted);
        });
      } else {
        compose_window_send_through_gmail_api(to, subject, plaintext);
      }
    } catch(err) {
      alert(err);
    }
  }
}

function on_compose_window_render(){
	$("#input_to").blur(render_email_secure_or_insecure);
	$("#input_to").focus(render_email_neutral);
	$('#button_send').click(compose_window_encrypt_and_send);
  $('.close_window').click(compose_window_close);
}
