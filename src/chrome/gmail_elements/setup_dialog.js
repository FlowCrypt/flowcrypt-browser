'use strict';

var url_params = get_url_params(['account_email', 'signal_scope', 'full_name']);

signal_scope_set(url_params['signal_scope']);

function setup_dialog_init() {
  //todo - "skip" next to loading dialog - can take long on slow connection
  //todo - handle network failure on init. loading
  get_pubkey(url_params['account_email'], function(pubkey) {
    if(pubkey !== null) {
      $('#loading').css('display', 'none');
      $('#step_0_found_key').css('display', 'block');
      $('#existing_pgp_email').text(url_params['account_email']);
    } else {
      $('#loading').css('display', 'none');
      $('#step_1_easy_or_manual').css('display', 'table');
    }
  })
}

function setup_dialog_set_done_and_close() {
  account_storage_set(url_params['account_email'], {
    setup_done: true
  }, function() {
    signal_send('gmail_tab', 'close_setup_dialog');
  });
}

function setup_dialog_submit_pubkey(account_email, pubkey, callback) {
  keyserver_keys_submit(account_email, pubkey, function(key_submitted, response) {
    if(key_submitted && response.saved === true) {
      restricted_account_storage_set(account_email, 'master_public_key_submitted', true);
    } else {
      //todo automatically resubmit later, make a notification if can't, etc
      console.log('warning: pubkey not submitted');
      console.log(respponse);
    }
    callback();
  });
}

function create_save_submit_key_pair(account_email, email_name, passphrase) {
  var user_id = account_email + ' <' + email_name + '>';
  openpgp.generateKeyPair({
    numBits: 4096,
    userId: user_id,
    passphrase: passphrase
  }).then(function(keypair) {
    restricted_account_storage_set(account_email, 'master_private_key', keypair.privateKeyArmored);
    restricted_account_storage_set(account_email, 'master_public_key', keypair.publicKeyArmored);
    restricted_account_storage_set(account_email, 'master_public_key_submit', true);
    restricted_account_storage_set(account_email, 'master_public_key_submitted', false);
    restricted_account_storage_set(account_email, 'master_passphrase', '');
    setup_dialog_submit_pubkey(account_email, keypair.publicKeyArmored, setup_dialog_set_done_and_close);
  }).catch(function(error) {
    $('#step_2_easy_generating').html('Error, thnaks for discovering it!<br/><br/>This is an early development version.<br/><br/>Please press CTRL+SHIFT+J, click on CONSOLE.<br/><br/>Copy messages printed in red and send them to me.<br/><br/>tom@cryptup.org - thanks!');
    console.log('--- copy message below for debugging  ---')
    console.log(error);
    console.log('--- thanks ---')
  });
}

$('a.close').click(function() {
  signal_send('gmail_tab', 'close_setup_dialog');
});

$('.one_click').click(function() {
  $('#step_0_found_key').css('display', 'none');
  $('#step_1_easy_or_manual').css('display', 'none');
  $('#step_2_easy_generating').css('display', 'block');
  create_save_submit_key_pair(url_params['account_email'], url_params['full_name'], null);
});

$('.setup_btn.manual').click(function() {
  $('#step_0_found_key').css('display', 'none');
  $('#step_1_easy_or_manual').css('display', 'none');
  $('#step_2_manual').css('display', 'block');
});

$('#step_2_manual a.back').click(function(){
  $('#step_0_found_key').css('display', 'none');
  $('#step_1_easy_or_manual').css('display', 'block');
  $('#step_2_manual').css('display', 'none');
});

$('div#btn_save_private').click(function() {
  var prv = openpgp.key.readArmored($('#input_private_key').val()).keys[0];
  var prv_to_test_passphrase = openpgp.key.readArmored($('#input_private_key').val()).keys[0];
  if(typeof prv === 'undefined') {
    alert('Private key is not correctly formated. Please insert complete key, including "-----BEGIN PGP PRIVATE KEY BLOCK-----" and "-----END PGP PRIVATE KEY BLOCK-----"');
  } else if(prv.isPublic()) {
    alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "-----BEGIN PGP PRIVATE KEY BLOCK-----"');
  } else if(prv_to_test_passphrase.decrypt($('#input_passphrase').val()) === false) {
    alert('Passphrase does not match the private key. Please try to enter the passphrase again.');
    $('#input_passphrase').val('');
    $('#input_passphrase').focus();
  } else {
    restricted_account_storage_set(url_params['account_email'], 'master_public_key', prv.toPublic().armor());
    restricted_account_storage_set(url_params['account_email'], 'master_private_key', prv.armor());
    restricted_account_storage_set(url_params['account_email'], 'master_public_key_submit', $('#input_submit_key').prop('checked'));
    restricted_account_storage_set(url_params['account_email'], 'master_public_key_submitted', false);
    restricted_account_storage_set(url_params['account_email'], 'master_passphrase', $('#input_passphrase').val());
    if($('#input_submit_key').prop('checked')) {
      $('div#btn_save_private').html('&nbsp;<i class="fa fa-spinner fa-pulse"></i>&nbsp;');
      setup_dialog_submit_pubkey(url_params['account_email'], prv.toPublic().armor(), setup_dialog_set_done_and_close);
    } else {
      setup_dialog_set_done_and_close();
    }
  }
});

setup_dialog_init();
