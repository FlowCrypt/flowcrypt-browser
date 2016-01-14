
function is_email_valid(email){
	return /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i.test(email);
}

var pubkeys = {};

console.log(1);

function new_message_render_pubkey_result(email) {
	if (typeof pubkeys[email] !== "undefined" && pubkeys[email] !== null) {
		$("#input_to").removeClass("email_plain");
		$("#input_to").addClass("email_secure");
		$("#send_new_message i").removeClass("fa-unlock");
		$("#send_new_message i").addClass("fa-lock");
		$("#send_new_message").addClass("button_secure");
		$("#send_new_message span").text("Send PGP Encrypted");
	} else {
		$("#input_to").removeClass("email_secure");
		$("#input_to").addClass("email_plain");
		$("#send_new_message i").removeClass("fa-lock");
		$("#send_new_message i").addClass("fa-unlock");
		$("#send_new_message").removeClass("button_secure");
		$("#send_new_message span").text("Send");
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

function new_message_render_email_secure_or_insecure(){
  var email = $(this).val();
  if (is_email_valid(email)) {
    if (!(email in pubkeys)) {
      getPubkey(email, function(pubkey_data) {
        pubkeys[email] = pubkey_data;
        new_message_render_pubkey_result(email);
      });
    } else {
      new_message_render_pubkey_result(email);
    }
  } else {
    $("#input_to").removeClass("email_secure");
    $("#input_to").removeClass("email_plain");
    $("#send_new_message").removeClass("button_secure");
    $("#send_new_message i").removeClass("fa-lock");
    $("#send_new_message i").addClass("fa-unlock");
    $("#send_new_message span").text("Send");
  }
}

function new_message_render_email_neutral(){
	$("#input_to").removeClass("email_secure");
	$("#input_to").removeClass("email_plain");
	$("#send_new_message").removeClass("button_secure");
	$("#send_new_message i").removeClass("fa-lock");
	$("#send_new_message i").addClass("fa-unlock");
	$("#send_new_message span").text("Send");
}

function new_message_close(){
  $('#new_message').remove();
}

function new_message_send_through_gmail_api(to, subject, text){
	console.log(4);
  gmail_api_message_send('info@nvimp.com', to, subject, text, function(success, response){
    if (success) {
			console.log(5);
			console.log(response);
      new_message_close();
    }
    else {
      console.log(response);
      alert('error sending message, check log');
    }
  });
}

function new_message_encrypt_and_send(){
	console.log(3);
  var to = $('#input_to').val();
  var subject = $('#input_subject').val();
  var plaintext = $('#input_text').text();
  var key = null;
  if($('#send_new_message.button_secure').length > 0) {
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
          new_message_send_through_gmail_api(to, subject, encrypted);
        });
      } else {
        new_message_send_through_gmail_api(to, subject, plaintext);
      }
    } catch(err) {
      alert(err);
    }
  }
}

function on_new_message_render(){
	$("#input_to").blur(new_message_render_email_secure_or_insecure);
	$("#input_to").focus(new_message_render_email_neutral);
	$('#send_new_message').click(new_message_encrypt_and_send);
  $('.close_new_message').click(new_message_close);
	console.log(2);
}
on_new_message_render();
