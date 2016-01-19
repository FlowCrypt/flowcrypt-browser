
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
    $("#send_btn i").addClass("fa-lock");
    $("#send_btn").addClass("button_secure");
    $("#send_btn span").text("Send PGP Encrypted");
  } else {
    $("#input_to").removeClass("email_secure");
    $("#input_to").addClass("email_plain");
    $("#send_btn i").removeClass("fa-lock");
    $("#send_btn i").addClass("fa-unlock");
    $("#send_btn").removeClass("button_secure");
    $("#send_btn span").text("Send");
  }
}

function encrypt(pubkey_texts, text, callback) {
  console.log(1);
  var pubkeys = [];
  for (var i=0; i<pubkey_texts.length; i++) {
    console.log('armored key follows');
    console.log(pubkey_texts[i]);
    pubkeys = pubkeys.concat(openpgp.key.readArmored(pubkey_texts[i]).keys); // read public key
  }
  console.log(2);
  openpgp.encryptMessage(pubkeys, text).then(callback, callback);
  console.log(3);
}


function compose_render_email_secure_or_insecure(){
  var email = $(this).val();
  if (is_email_valid(email)) {
    var pubkey = pubkey_cache_get(email);
    if (pubkey === null) {
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
    $("#input_to").removeClass("email_secure");
    $("#input_to").removeClass("email_plain");
    $("#send_btn").removeClass("button_secure");
    $("#send_btn i").removeClass("fa-lock");
    $("#send_btn i").addClass("fa-unlock");
    $("#send_btn span").text("Send");
  }
}

function compose_render_email_neutral(){
  $("#input_to").removeClass("email_secure");
  $("#input_to").removeClass("email_plain");
  $("#send_btn").removeClass("button_secure");
  $("#send_btn i").removeClass("fa-lock");
  $("#send_btn i").addClass("fa-unlock");
  $("#send_btn span").text("Send");
}
