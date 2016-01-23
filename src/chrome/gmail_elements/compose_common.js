
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

var account = null;
chrome.storage.local.get(['primary_email'], function(storage){
  account = storage['primary_email'];
});
function get_account() { //might not work if called right after loading the library, needs chrome.storage.local.get to finishs which is async. Not ideal.
  return account;
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


function compose_render_email_secure_or_insecure(){
  var email = $(this).val();
  if (is_email_valid(email)) {
    var pubkey = pubkey_cache_get(email);
    if (pubkey === null) {
      $("#send_btn i").addClass("fa-spinner");
      $("#send_btn i").addClass("fa-pulse");
      $("#send_btn span").text("");
      $("#send_btn_note").text("Checking email address");
      get_pubkey(email, function(pubkey_data) {
        if(pubkey_data !== null) {
          pubkey_cache_add(email, pubkey_data);
        }
        compose_render_pubkey_result(email, pubkey_data);
      });
    } else {
      compose_render_pubkey_result(email, pubkey);
    }
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
