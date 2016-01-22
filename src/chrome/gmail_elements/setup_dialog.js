
function setup_dialog_set_done_and_close() {
  chrome.storage.local.set({cryptup_setup_done: true}, function(){
    send_signal('close_setup_dialog', 'setup_dialog', 'gmail_tab');
  });
}

function setup_dialog_submit_pubkey(email, pubkey, callback) {
  keyserver_keys_submit(email, pubkey, function(key_submitted, response){
    if(key_submitted && response.saved === true) {
      localStorage.master_public_key_submitted = true;
    }
    else{
      //todo automatically resubmit later, make a notification if can't, etc
      console.log('warning: pubkey not submitted');
      console.log(respponse);
    }
    callback();
  });
}

function create_save_submit_key_pair(email, email_name, passphrase){
  var user_id = email + ' <' + email_name + '>';
  openpgp.generateKeyPair({numBits: 4096, userId: user_id, passphrase: passphrase}).then(function(keypair){
    localStorage.master_private_key = keypair.privateKeyArmored;
    localStorage.master_public_key = keypair.publicKeyArmored;
    localStorage.master_public_key_submitted = false;
    localStorage.master_passphrase = '';
    setup_dialog_submit_pubkey(email, localStorage.master_public_key, setup_dialog_set_done_and_close);
  }).catch(function(error) {
    $('#step_2_easy_generating').html('Error, thnaks for discovering it!<br/><br/>This is an early development version.<br/><br/>Please press CTRL+SHIFT+J, click on CONSOLE.<br/><br/>Copy messages printed in red and send them to me.<br/><br/>tom@cryptup.org - thanks!');
    console.log('--- copy message below for debugging  ---')
    console.log(error);
    console.log('--- thanks ---')
  });
}

$('a.close').click(function(){
  send_signal('close_setup_dialog', 'setup_dialog', 'gmail_tab');
});

$('div.setup_btn.one_click').click(function(){
  $('#step_1_easy_or_manual').css('display', 'none');
  $('#step_2_easy_generating').css('display', 'block');
  chrome.storage.local.get(['primary_email', 'primary_email_name'], function(storage) {
    create_save_submit_key_pair(storage['primary_email'], storage['primary_email_name'], null);
  });
});

$('div.setup_btn.manual').click(function(){
  $('#step_1_easy_or_manual').css('display', 'none');
  $('#step_2_manual').css('display', 'block');
});

$('div#btn_save_private').click(function(){
  localStorage.master_private_key = $('#input_private_key').val();
  localStorage.master_public_key = openpgp.key.readArmored($('#input_private_key').val()).keys[0].toPublic().armor();
  localStorage.master_passphrase = $('#input_passphrase').val();
  if($('#input_submit_key').prop('checked')) {
    chrome.storage.local.get(['primary_email', 'primary_email_name'], function(storage) {
      $('div#btn_save_private').html('<i class="fa fa-spinner fa-pulse"></i>');
      setup_dialog_submit_pubkey(storage['primary_email'], localStorage.master_public_key, setup_dialog_set_done_and_close);
    });
  }
  else {
    setup_dialog_set_done_and_close();
  }
});
