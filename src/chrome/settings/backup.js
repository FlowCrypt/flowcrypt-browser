'use strict';

var url_params = get_url_params(['account_email', 'action']);

// var recovered_keys = undefined;

function display_block(name) {
  var blocks = ['loading', 'step_0_status', 'step_1_password', 'step_2_confirm'];
  for(var i in blocks) {
    $('#' + blocks[i]).css('display', 'none');
  }
  $('#' + name).css('display', 'block');
}

function show_status() {
  $('h1').text('Key Backups for ' + url_params.account_email);
  display_block('loading');
  console.log(0);
  fetch_email_key_backups(url_params.account_email, function(success, keys) {
    if(success) {
      display_block('step_0_status');
      if(keys && keys.length) {
        $('.status_summary').text('Backups found: ' + keys.length + '. Your account is backed up correctly.');
        $('#step_0_status .container').html('');
      } else {
        $('.status_summary').text('No backups found on this account. You can store a backup of your key on Gmail. Your key will be protected by a password of your choice.');
        $('#step_0_status .container').html('<div class="button long green action_go_backup">BACK UP MY KEY</div>');
        $('.action_go_backup').click(function() {
          display_block('step_1_password');
          $('h1').text('Set Backup Password for ' + url_params.account_email);
        });
      }
    } else {
      $('.status_summary').text('Could not start searching for backups, possibly due to a network failure. Refresh to try again.');
      $('#step_0_status .container').html('<div class="button long green action_refresh">REFRESH</div>');
      $('.action_refresh').click(prevent(doubleclick(), show_status));
    }
  });
}

if(url_params.action === 'setup') {
  display_block('step_1_password');
  $('h1').text('Choose a password');
} else {
  show_status();
}

$('.action_password').click(function() {
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
    display_block('step_2_confirm');
  }
});

$('.action_reset_password').click(function() {
  $('#password').val('');
  $('#password2').val('');
  display_block('step_1_password');
  $('#password').focus();
});

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

$('.action_backup').click(prevent(doubleclick(), function(self) {
  if($('#password').val() !== $('#password2').val()) {
    alert('The two passwords do not match, please try again.');
    $('#password2').val('');
    $('#password2').focus();
  } else {
    var btn_text = $(self).text();
    $(self).html(get_spinner());
    var armored_private_key = restricted_account_storage_get(url_params.account_email, 'master_private_key');
    var prv = openpgp.key.readArmored(armored_private_key).keys[0];
    openpgp_key_encrypt(prv, $('#password').val());
    var email_headers = {
      From: url_params.account_email,
      To: url_params.account_email,
      Subject: recovery_email_subjects[0],
    };
    var email_attachments = [{
      filename: 'cryptup-backup-' + url_params.account_email.replace(/[^A-Za-z0-9]+/g, '') + '.key',
      type: 'text/plain',
      content: prv.armor(),
    }];
    var email_message = 'I hope you\'ll enjoy CryptUP! This email might come handy later.\n\nThe backup file below is encrypted using your password. Make sure to keep the password safe! Loss of password might not be recoverable, and will cause your encrypted communication to become undreadable.\n\nDon\'t forward this email to anyone! And say Hi at tom@cryptup.org :)';
    gmail_api_message_send(url_params.account_email, email_message, email_headers, email_attachments, null, function(success, response) {
      if(success) { // todo - test pulling it and decrypting it
        account_storage_set(url_params.account_email, {
          key_backup_prompt: false
        }, function() {
          if(url_params.action === 'setup') {
            window.location = 'setup.htm?account_email=' + encodeURIComponent(url_params.account_email);
          } else {
            show_status();
          }
        });
      } else {
        $(self).html(btn_text);
        alert('Need internet connection to finish setting up your account. Please try clicking the button again.');
      }
    });
  }
}));
