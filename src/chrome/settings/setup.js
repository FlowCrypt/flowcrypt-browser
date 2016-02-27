'use strict';

var url_params = get_url_params(['account_email']);

// todo: pull full_name from google

var signal_scope = random_string();
signal_scope_set(signal_scope);

// set account addresses at least once
account_storage_get(url_params['account_email'], ['addresses'], function(storage) {
  function show_submit_all_addresses_option(addrs) {
    if(addrs && addrs.length > 1) {
      var i = addrs.indexOf(url_params['account_email']);
      if(i !== -1) {
        addrs.splice(i, 1);
      }
      $('#addresses').text(addrs.join(', '));
      $('#input_submit_all').parent().css('visibility', 'visible');
    }
  }
  if(typeof storage.addresses === 'undefined') {
    fetch_all_account_addresses(url_params['account_email'], function(addresses) {
      account_storage_set(url_params['account_email'], {
        addresses: addresses
      }, function() {
        show_submit_all_addresses_option(addresses);
      });
    });
  } else {
    show_submit_all_addresses_option(storage['addresses']);
  }
});

function setup_dialog_init() {
  //todo - handle network failure on init. loading
  $('h1').text('Set up ' + url_params['account_email']);
  get_pubkey(url_params['account_email'], function(pubkey) {
    if(pubkey !== null) {
      $('#loading').css('display', 'none');
      $('#step_0_found_key').css('display', 'block');
      $('#existing_pgp_email').text(url_params['account_email']);
    } else {
      $('#loading').css('display', 'none');
      $('#step_1_easy_or_manual').css('display', 'block');
    }
  })
}

function setup_dialog_set_done() {
  var storage = {
    setup_done: true
  };
  account_storage_set(url_params['account_email'], storage, function() {
    $('#step_0_found_key').css('display', 'none');
    $('#step_1_easy_or_manual').css('display', 'none');
    $('#step_2_manual').css('display', 'none');
    $('#step_2_easy_generating').css('display', 'none');
    $('#step_3_done').css('display', 'block');
    $('h1').text('Done');
    $('.email').text(url_params['account_email']);
  });
}

function setup_dialog_submit_main_pubkey(account_email, pubkey, callback) {
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
    account_storage_get(url_params['account_email'], ['addresses'], function(storage) {
      // todo: following if/else would use some refactoring in terms of how setup_dialog_set_done is called and transparency about when setup_done
      if(typeof storage.addresses !== 'undefined' && storage.addresses.length > 1) {
        submit_pubkey_alternative_addresses(storage.addresses, keypair.publicKeyArmored, setup_dialog_set_done);
        setup_dialog_submit_main_pubkey(account_email, keypair.publicKeyArmored, function() {
          account_storage_set(account_email, {
            setup_done: true
          });
        });
      } else {
        setup_dialog_submit_main_pubkey(account_email, keypair.publicKeyArmored, setup_dialog_set_done);
      }
    });
  }).catch(function(error) {
    $('#step_2_easy_generating').html('Error, thnaks for discovering it!<br/><br/>This is an early development version.<br/><br/>Please press CTRL+SHIFT+J, click on CONSOLE.<br/><br/>Copy messages printed in red and send them to me.<br/><br/>tom@cryptup.org - thanks!');
    console.log('--- copy message below for debugging  ---')
    console.log(error);
    console.log('--- thanks ---')
  });
}

$('.action_simple_setup').click(function() {
  $('#step_0_found_key').css('display', 'none');
  $('#step_1_easy_or_manual').css('display', 'none');
  $('#step_2_manual').css('display', 'none');
  $('#step_2_easy_generating').css('display', 'block');
  $('h1').text('Please wait, setting up CryptUp for ' + url_params['account_email']);
  create_save_submit_key_pair(url_params['account_email'], url_params['full_name'], null); // todo - get name from google api. full_name might be undefined
});

$('.action_manual_setup').click(function() {
  $('#step_0_found_key').css('display', 'none');
  $('#step_1_easy_or_manual').css('display', 'none');
  $('#step_2_manual').css('display', 'block');
  $('#step_2_easy_generating').css('display', 'none');
  $('h1').text('Manual setup for ' + url_params['account_email']);
});

$('#step_2_manual a.back').click(function() {
  $('#step_0_found_key').css('display', 'none');
  $('#step_1_easy_or_manual').css('display', 'block');
  $('#step_2_manual').css('display', 'none');
  $('#step_2_easy_generating').css('display', 'none');
  $('h1').text('Set up ' + url_params['account_email']);
});

$('.action_close').click(function() {
  window.close();
});

$('.action_account_settings').click(function() {
  window.location = 'account.htm?account_email=' + encodeURIComponent(url_params['account_email']);
});

$('#input_submit_key').click(function() {
  if($('#input_submit_key').prop('checked')) {
    if($('#input_submit_all').parent().css('visibility') === 'visible') {
      $('#input_submit_all').prop({
        checked: true,
        disabled: false
      });
    }
  } else {
    $('#input_submit_all').prop({
      checked: false,
      disabled: true
    });
  }
});

$('.action_save_private').click(function() {
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
      $('.action_save_private').html(get_spinner());
      account_storage_get(url_params['account_email'], ['addresses'], function(storage) {
        // todo: following if/else would use some refactoring in terms of how setup_dialog_set_done is called and transparency about when setup_done
        if($('#input_submit_all').prop('checked') && typeof storage.addresses !== 'undefined' && storage.addresses.length > 1) {
          submit_pubkey_alternative_addresses(storage.addresses, prv.toPublic().armor(), setup_dialog_set_done);
          setup_dialog_submit_main_pubkey(url_params['account_email'], prv.toPublic().armor(), function() {
            account_storage_set(url_params['account_email'], {
              setup_done: true
            });
          });
        } else {
          setup_dialog_submit_main_pubkey(url_params['account_email'], prv.toPublic().armor(), setup_dialog_set_done);
        }
      });
    } else {
      setup_dialog_set_done();
    }
  }
});

setup_dialog_init();
