'use strict';

var url_params = get_url_params(['account_email']);

// todo: pull full_name from google

var signal_scope = random_string();
signal_scope_set(signal_scope);
var recovery_email_subjects = ['CryptUP Account Backup'];
var recovered_keys = undefined;

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

function fetch_email_key_backups(account_email, callback) {
  var q = [
    'from:' + account_email,
    'to:' + account_email,
    '(subject:"' + recovery_email_subjects.join('" OR subject: "') + '")',
    'has:attachment',
    '-is:spam',
  ];
  gmail_api_message_list(account_email, q.join(' '), true, function(success, response) {
    if(success) {
      if(response.messages) {
        var message_ids = [];
        for(var i in response.messages) {
          message_ids.push(response.messages[i].id);
        }
        gmail_api_message_get(account_email, message_ids, 'full', function(success, messages) {
          if(success) {
            var attachments = [];
            for(var id in messages) {
              attachments = attachments.concat(gmail_api_find_attachments(messages[id]));
            }
            gmail_api_fetch_attachments(account_email, attachments, function(success, downloaded_attachments) {
              var keys = [];
              for(var i in downloaded_attachments) {
                try {
                  var armored_key = atob(downloaded_attachments[i].data);
                  var key = openpgp.key.readArmored(armored_key).keys[0];
                  if(key.isPrivate()) {
                    keys.push(key);
                  }
                } catch(err) {}
              }
              callback(keys);
            });
          } else {
            display_block('step_0_found_key'); //todo: better handling needed. backup messages certainly exist but cannot find them right now.
          }
        });
      } else {
        display_block('step_0_found_key'); // no backup messages
      }
    } else { // todo: Better handling would be useful. PGP has been used previously but can't pull it from gmail right now.
      display_block('step_0_found_key');
    }
  });
}

function display_block(name) {
  var blocks = ['loading', 'step_0_found_key', 'step_1_easy_or_manual', 'step_2_manual', 'step_2_easy_generating', 'step_2_recovery', 'step_4_done', 'step_3_backup'];
  for(var i in blocks) {
    $('#' + blocks[i]).css('display', 'none');
  }
  $('#' + name).css('display', 'block');
}

function setup_dialog_init() { // todo - handle network failure on init. loading
  $('h1').text('Set up ' + url_params['account_email']);
  account_storage_get(url_params['account_email'], ['setup_done', 'key_backup_prompt'], function(storage) {
    if(storage['setup_done'] === true) {
      setup_dialog_set_done(storage['key_backup_prompt'] !== false);
    } else {
      get_pubkey(url_params['account_email'], function(pubkey) {
        if(pubkey !== null) {
          fetch_email_key_backups(url_params['account_email'], function(keys) {
            if(keys) {
              display_block('step_2_recovery');
              recovered_keys = keys;
            } else {
              display_block('step_0_found_key');
              $('#existing_pgp_email').text(url_params['account_email']);
            }
          });
        } else {
          display_block('step_1_easy_or_manual');
        }
      });
    }
  });
}

function setup_dialog_set_done(key_backup_prompt) {
  var storage = {
    setup_done: true
  };
  if(key_backup_prompt === true) {
    storage['key_backup_prompt'] = Date.now();
  } else {
    storage['key_backup_prompt'] = false;
  }
  account_storage_set(url_params['account_email'], storage, function() {
    if(key_backup_prompt === true) {
      display_block('step_3_backup');
      $('h1').text('Choose your password');
    } else {
      display_block('step_4_done');
      $('h1').text('Setup done!');
      $('.email').text(url_params['account_email']);
    }
  });
}

function setup_dialog_submit_main_pubkey(account_email, pubkey, callback) {
  keyserver_keys_submit(account_email, pubkey, function(key_submitted, response) {
    if(key_submitted && response.saved === true) {
      restricted_account_storage_set(account_email, 'master_public_key_submitted', true);
    } else {
      //todo automatically resubmit later, make a notification if can't, etc
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
        submit_pubkey_alternative_addresses(storage.addresses, keypair.publicKeyArmored, function() {
          setup_dialog_set_done(true);
        });
        setup_dialog_submit_main_pubkey(account_email, keypair.publicKeyArmored, function() {
          account_storage_set(account_email, {
            setup_done: true,
            key_backup_prompt: Date.now(),
          });
        });
      } else {
        setup_dialog_submit_main_pubkey(account_email, keypair.publicKeyArmored, function() {
          setup_dialog_set_done(true);
        });
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
  display_block('step_2_easy_generating');
  $('h1').text('Please wait, setting up CryptUp for ' + url_params['account_email']);
  create_save_submit_key_pair(url_params['account_email'], url_params['full_name'], null); // todo - get name from google api. full_name might be undefined
});

$('.action_manual_setup').click(function() {
  display_block('step_2_manual');
  $('h1').text('Manual setup for ' + url_params['account_email']);
});

$('#step_2_manual a.back').click(function() {
  display_block('step_1_easy_or_manual');
  $('h1').text('Set up ' + url_params['account_email']);
});

$('#step_3_backup .action_password').click(function() {
  // todo: measure overall entropy. Eg super long lowercase passwords are also good.
  if($('#password').val().length < 8) {
    alert('Please use a password of 8 characters or longer. Please use longer password.');
    $('#password').focus();
  } else if($('#password').val().match(/[a-z]/) === null) {
    alert('Password should contain one or more lowercase letters. Please add some lowercase letters.');
    $('#password').focus();
  } else if($('#password').val().match(/[A-Z]/) === null) {
    alert('Password should contain one or more UPPERCASE letters. Please add some uppercase letters.');
    $('#password').focus();
  } else if($('#password').val().match(/[0-9]/) === null) {
    alert('Password should contain one or more digits. Please add some digits.');
    $('#password').focus();
  } else {
    $('#step_3_backup .first').css('display', 'none');
    $('#step_3_backup .second').css('display', 'block');
  }
});

$('#step_2_recovery .action_recover_account').click(prevent(doubleclick(), function(self) {
  var passphrase = $('#recovery_pasword').val();
  if(passphrase) {
    var btn_text = $(self).text();
    $(self).html(get_spinner());
    for(var i in recovered_keys) {
      var armored_encrypted_key = recovered_keys[i].armor();
      if(recovered_keys[i].decrypt(passphrase) === true) {
        restricted_account_storage_set(url_params['account_email'], 'master_public_key', recovered_keys[i].toPublic().armor());
        restricted_account_storage_set(url_params['account_email'], 'master_private_key', armored_encrypted_key);
        restricted_account_storage_set(url_params['account_email'], 'master_public_key_submit', false); //todo - think about this more
        restricted_account_storage_set(url_params['account_email'], 'master_public_key_submitted', false);
        restricted_account_storage_set(url_params['account_email'], 'master_passphrase', passphrase);
        setup_dialog_set_done(false);
        return;
      }
    }
    $(self).text(btn_text);
    if(recovered_keys.length > 1) {
      alert('This password did not match any of your ' + recovered_keys.length + ' backups. Please try again.');
    } else {
      alert('This password did not match your original setup. Please try again.');
    }
  } else {
    alert('Please enter the password you used when you first set up CryptUP, so that we can recover your original keys.')
  }
}));

function openpgp_key_encrypt(key, passphrase) {
  if(key.isPrivate() && passphrase) {
    var keys = key.getAllKeyPackets();
    for(var i = 0; i < keys.length; i++) {
      keys[i].encrypt(passphrase);
    }
  } else if(!passphrase) {
    throw new Error("Encryption passphrase should not be empty");
  } else {
    throw new Error("Nothing to decrypt in a public key");
  }
}

$('#step_3_backup .action_backup').click(prevent(doubleclick(), function(self) {
  if($('#password').val() !== $('#password2').val()) {
    alert('The two passwords do not match, please try again.');
    $('#password2').val('');
    $('#password2').focus();
  } else {
    var btn_text = $(self).text();
    $(self).html(get_spinner());
    var armored_private_key = restricted_account_storage_get(url_params['account_email'], 'master_private_key');
    var prv = openpgp.key.readArmored(armored_private_key).keys[0];
    openpgp_key_encrypt(prv, $('#password').val());
    var email_headers = {
      From: url_params['account_email'],
      To: url_params['account_email'],
      Subject: recovery_email_subjects[0],
    };
    var email_attachments = [{
      filename: 'cryptup-backup-' + url_params['account_email'].replace(/[^A-Za-z0-9]+/g, '') + '.key',
      type: 'text/plain',
      content: prv.armor(),
    }];
    var email_message = 'I hope you\'ll enjoy using CryptUP! This email might come handy later.\n\nThe backup file below is encrypted using your password. Make sure to keep the password safe! Loss of password might not be recoverable, and will cause your encrypted communication to become undreadable.\n\nDon\'t forward this email to anyone! And say Hi at tom@cryptup.org :)';
    gmail_api_message_send(url_params['account_email'], email_message, email_headers, email_attachments, null, function(success, response) {
      if(success) { // todo - test pulling it and decrypting it
        setup_dialog_set_done(false);
      } else {
        $(self).html(btn_text);
        alert('Need internet connection to finish setting up your account. Please try clicking the button again.');
      }
    });
  }
}));

$('#step_3_backup .action_reset_password').click(function() {
  $('#password').val('');
  $('#password2').val('');
  $('#step_3_backup .first').css('display', 'block');
  $('#step_3_backup .second').css('display', 'none');
  $('#password').focus();
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
          submit_pubkey_alternative_addresses(storage.addresses, prv.toPublic().armor(), function() {
            setup_dialog_set_done(false);
          });
          setup_dialog_submit_main_pubkey(url_params['account_email'], prv.toPublic().armor(), function() {
            account_storage_set(url_params['account_email'], {
              setup_done: true,
              key_backup_prompt: false,
            });
          });
        } else {
          setup_dialog_submit_main_pubkey(url_params['account_email'], prv.toPublic().armor(), function() {
            setup_dialog_set_done(false);
          });
        }
      });
    } else {
      setup_dialog_set_done(false);
    }
  }
});

setup_dialog_init();
