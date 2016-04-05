'use strict';

var url_params = get_url_params(['account_email', 'action']);

$('.email-address').text(url_params.account_email);

if(url_params.action === 'setup') {
  display_block('step_1_password');
  $('h1').text('Choose a pass phrase');
  $('.back').css('display', 'none');
} else {
  show_status();
}

function display_block(name) {
  var blocks = ['loading', 'step_0_status', 'step_1_password', 'step_2_confirm'];
  $.each(blocks, function(i, block) {
    $('#' + block).css('display', 'none');
  });
  $('#' + name).css('display', 'block');
}

function evaluate_password_strength() {
  var result = crack_time_result(zxcvbn($('#password').val()), [
    'crypt', 'up', 'cryptup', 'encryption', 'pgp', 'email', 'set', 'backup', 'passphrase', 'best', 'pass', 'phrases', 'are', 'long', 'and', 'have', 'several',
    'words', 'in', 'them', 'Best pass phrases are long', 'have several words', 'in them', 'bestpassphrasesarelong', 'haveseveralwords', 'inthem',
    'Loss of this pass phrase', 'cannot be recovered', 'Note it down', 'on a paper', 'lossofthispassphrase', 'cannotberecovered', 'noteitdown', 'onapaper',
    'setpassword', 'set password', 'set pass word', 'setpassphrase', 'set pass phrase', 'set passphrase'
  ]);
  $('.password_feedback').css('display', 'block');
  $('.password_bar > div').css('width', result.bar + '%');
  $('.password_bar > div').css('background-color', result.color);
  $('.password_result, .password_time').css('color', result.color);
  $('.password_result').text(result.word);
  $('.password_time').text(result.time);
  if(result.pass) {
    $('.action_password').removeClass('gray');
    $('.action_password').addClass('green');
  } else {
    $('.action_password').removeClass('green');
    $('.action_password').addClass('gray');
  }
  // $('.password_feedback > ul').html('');
  // $.each(result.suggestions, function(i, suggestion) {
  //   $('.password_feedback > ul').append('<li>' + suggestion + '</li>');
  // });
}

$('#password').on('keyup', prevent(spree(), evaluate_password_strength));

function show_status() {
  $('h1').text('Key Backups');
  display_block('loading');
  fetch_email_key_backups(url_params.account_email, function(success, keys) {
    if(success) {
      display_block('step_0_status');
      if(keys && keys.length) {
        $('.status_summary').text('Backups found: ' + keys.length + '. Your account is backed up correctly.');
        $('#step_0_status .container').html('');
      } else {
        $('.status_summary').text('No backups found on this account. You can store a backup of your key on Gmail. Your key will be protected by a pass phrase of your choice.');
        $('#step_0_status .container').html('<div class="button long green action_go_backup">BACK UP MY KEY</div>');
        $('.action_go_backup').click(function() {
          display_block('step_1_password');
          $('h1').text('Set Backup Pass Phrase');
        });
      }
    } else {
      $('.status_summary').text('Could not start searching for backups, possibly due to a network failure. Refresh to try again.');
      $('#step_0_status .container').html('<div class="button long green action_refresh">REFRESH</div>');
      $('.action_refresh').click(prevent(doubleclick(), show_status));
    }
  });
}

$('.action_password').click(function() {
  if($(this).hasClass('green')) {
    display_block('step_2_confirm');
  } else {
    alert('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
  }
});

$('.action_reset_password').click(function() {
  $('#password').val('');
  $('#password2').val('');
  display_block('step_1_password');
  evaluate_password_strength();
  $('#password').focus();
});

function openpgp_key_encrypt(key, passphrase) {
  if(key.isPrivate() && passphrase) {
    var keys = key.getAllKeyPackets();
    $.each(keys, function(i, key) {
      key.encrypt(passphrase);
    });
  } else if(!passphrase) {
    throw new Error("Encryption passphrase should not be empty");
  } else {
    throw new Error("Nothing to decrypt in a public key");
  }
}

$('.action_backup').click(prevent(doubleclick(), function(self) {
  if($('#password').val() !== $('#password2').val()) {
    alert('The two pass phrases do not match, please try again.');
    $('#password2').val('');
    $('#password2').focus();
  } else {
    var btn_text = $(self).text();
    $(self).html(get_spinner());
    var armored_private_key = private_storage_get(localStorage, url_params.account_email, 'master_private_key');
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
    var email_message = 'I hope you\'ll enjoy CryptUP! This email might come handy later.\n\nThe backup file below is encrypted using your pass phrase. Make sure to keep the pass phrase safe! Loss of pass phrase might not be recoverable, and will cause your encrypted communication to become undreadable.\n\nDon\'t forward this email to anyone!\n\n Any feedback is welcome at tom@cryptup.org';
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

$('.back').off().click(function() {
  window.location = 'account.htm?account_email=' + encodeURIComponent(url_params.account_email);
});
