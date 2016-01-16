
var account = null;
chrome.storage.local.get(['primary_email'], function(storage){
	account = storage['primary_email'];
});

function is_email_valid(email){
	return /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/i.test(email);
}

function new_message_render_pubkey_result(email, pubkey_data) {
	if (pubkey_data !== null) {
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

function encrypt(pubkey_texts, text, callback) {
	if (window.crypto.getRandomValues) {
		var pubkeys = [];
		for (var i=0; i<pubkey_texts.length; i++) {
			pubkeys = pubkeys.concat(openpgp.key.readArmored(pubkey_texts[i]).keys); // read public key
		}
		openpgp.encryptMessage(pubkeys, text).then(callback, callback);
	} else {
		throw "Error: Browser not supported\nReason: We need a cryptographically secure PRNG to be implemented (i.e. the window.crypto method)\nSolution: Use Chrome >= 11, Safari >= 3.1 or Firefox >= 21";
	}
}

function new_message_render_email_secure_or_insecure(){
  var email = $(this).val();
  if (is_email_valid(email)) {
		var pubkey = pubkey_cache_get(email);
    if (pubkey === null) {
      get_pubkey(email, function(pubkey_data) {
        if(pubkey_data !== null) {
					pubkey_cache_add(email, pubkey_data);
				}
        new_message_render_pubkey_result(email, pubkey_data);
      });
    } else {
      new_message_render_pubkey_result(email, pubkey);
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
	send_signal('close_new_message', 'new_message_frame', 'gmail_tab', {'gmail_tab_url': document.referrer});
}

function new_message_send_through_gmail_api(to, subject, text){
  gmail_api_message_send(account, to, subject, text, function(success, response){
    if (success) {
      new_message_close();
    }
    else {
      alert('error sending message, check log');
    }
  });
}

function new_message_encrypt_and_send(){
  var to = $('#input_to').val();
  var subject = $('#input_subject').val();
  var plaintext = $('#input_text').html();
  var keys = [];
  if($('#send_new_message.button_secure').length > 0) {
    var key_to = pubkey_cache_get(to);
    if(key_to === null){
      alert('error: key is undefined although should exist');
      return;
    }
		keys.push(key_to);
  }
  if (to == ''){
    alert('Please add receiving email address.');
    return;
  } else if ((plaintext != '' || window.prompt('Send empty message?')) && (subject != '' || window.prompt('Send without a subject?'))) {
    try {
      if (keys.length > 0) {
				var my_key = pubkey_cache_get(account);
				if (my_key !== null) {
					keys.push(my_key);
				}
        encrypt(keys, plaintext, function(encrypted) {
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
}
on_new_message_render();
