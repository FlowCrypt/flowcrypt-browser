/* Business Source License 1.0 © 2016 Tom James Holub (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/tomholub/cryptup-chrome/tree/master/src/LICENCE */

'use strict';

var url_params = tool.env.url_params(['account_email', 'action', 'parent_tab_id']);
var email_provider;

tool.ui.passphrase_toggle(['password', 'password2']);

account_storage_get(url_params.account_email, ['setup_simple', 'email_provider'], function (storage) {
  email_provider = storage.email_provider || 'gmail';

  if(url_params.action === 'setup') {
    $('.back').css('display', 'none');
    if(storage.setup_simple) {
      display_block('step_1_password');
      $('h1').text('Choose a pass phrase');
    } else {
      display_block('step_3_manual');
      $('h1').text('Back up your private key');
    }
  } else if(url_params.action === 'passphrase_change_gmail_backup') {
    if(storage.setup_simple) {
      display_block('loading');
      var armored_private_key = private_storage_get('local', url_params.account_email, 'master_private_key');
      (email_provider === 'gmail' ? backup_key_on_gmail : backup_key_on_outlook)(url_params.account_email, armored_private_key, function (success) {
        if(success) {
          $('#content').html('Pass phrase changed. You will find a new backup in your inbox.');
        } else {
          $('#content').html('Connection failed, please <a href="#" class="reload">try again</a>.');
          $('.reload').click(function () {
            window.location.reload();
          });
        }
      });
    } else { // should never happen on this action. Just in case.
      display_block('step_3_manual');
      $('h1').text('Back up your private key');
    }
  } else if(url_params.action === 'options') {
    display_block('step_3_manual');
    $('h1').text('Back up your private key');
  } else {
    show_status();
  }
});

function display_block(name) {
  var blocks = ['loading', 'step_0_status', 'step_1_password', 'step_2_confirm', 'step_3_manual'];
  $.each(blocks, function (i, block) {
    $('#' + block).css('display', 'none');
  });
  $('#' + name).css('display', 'block');
}

$('#password').on('keyup', tool.ui.event.prevent(tool.ui.event.spree(), function () {
  evaluate_password_strength('#step_1_password', '#password', '.action_password');
}));

function show_status() {
  $('.hide_if_backup_done').css('display', 'none');
  $('h1').text('Key Backups');
  display_block('loading');
  account_storage_get(url_params.account_email, ['setup_simple', 'key_backup_method', 'google_token_scopes', 'email_provider', 'microsoft_auth'], function (storage) {
    if(email_provider === 'gmail' && tool.api.gmail.has_scope(storage.google_token_scopes, 'read')) {
      fetch_email_key_backups(url_params.account_email, storage.email_provider || 'gmail', function (success, keys) {
        if(success) {
          display_block('step_0_status');
          if(keys && keys.length) {
            $('.status_summary').text('Backups found: ' + keys.length + '. Your account is backed up correctly in your email inbox.');
            $('#step_0_status .container').html('<div class="button long green action_go_manual">SEE MORE BACKUP OPTIONS</div>');
            $('.action_go_manual').click(function () {
              display_block('step_3_manual');
              $('h1').text('Back up your private key');
            });
          } else if(storage.key_backup_method) {
            if(storage.key_backup_method === 'file') {
              $('.status_summary').text('You have previously backed up your key into a file.');
              $('#step_0_status .container').html('<div class="button long green action_go_manual">SEE OTHER BACKUP OPTIONS</div>');
              $('.action_go_manual').click(function () {
                display_block('step_3_manual');
                $('h1').text('Back up your private key');
              });
            } else if(storage.key_backup_method === 'print') {
              $('.status_summary').text('You have previously backed up your key by printing it.');
              $('#step_0_status .container').html('<div class="button long green action_go_manual">SEE OTHER BACKUP OPTIONS</div>');
              $('.action_go_manual').click(function () {
                display_block('step_3_manual');
                $('h1').text('Back up your private key');
              });
            } else { // inbox or other methods
              $('.status_summary').text('There are no backups on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
              $('#step_0_status .container').html('<div class="button long green action_go_manual">SEE BACKUP OPTIONS</div>');
              $('.action_go_manual').click(function () {
                display_block('step_3_manual');
                $('h1').text('Back up your private key');
              });
            }
          } else {
            if(storage.setup_simple) {
              $('.status_summary').text('No backups found on this account. You can store a backup of your key in email inbox. Your key will be protected by a pass phrase of your choice.');
              $('#step_0_status .container').html('<div class="button long green action_go_backup">BACK UP MY KEY</div><br><br><br><a href="#" class="action_go_manual">See more advanced backup options</a>');
              $('.action_go_backup').click(function () {
                display_block('step_1_password');
                $('h1').text('Set Backup Pass Phrase');
              });
              $('.action_go_manual').click(function () {
                display_block('step_3_manual');
                $('h1').text('Back up your private key');
              });
            } else {
              $('.status_summary').text('No backups found on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
              $('#step_0_status .container').html('<div class="button long green action_go_manual">BACK UP MY KEY</div>');
              $('.action_go_manual').click(function () {
                display_block('step_3_manual');
                $('h1').text('Back up your private key');
              });
            }
          }
        } else {
          $('.status_summary').text('Could not start searching for backups, possibly due to a network failure. Refresh to try again.');
          $('#step_0_status .container').html('<div class="button long green action_refresh">REFRESH</div>');
          $('.action_refresh').click(tool.ui.event.prevent(tool.ui.event.double(), show_status));
        }
      });
    } else { // gmail read permission not granted - cannot check for backups
      display_block('step_0_status');
      $('.status_summary').html('CryptUp cannot check your backups.');
      var pemissions_button_if_gmail = email_provider === 'gmail' ? '<div class="button long green action_go_auth_denied">SEE PERMISSIONS</div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;': '';
      $('#step_0_status .container').html(pemissions_button_if_gmail + '<div class="button long gray action_go_manual">SEE BACKUP OPTIONS</div>');
      $('.action_go_manual').click(function () {
        display_block('step_3_manual');
        $('h1').text('Back up your private key');
      });
      $('.action_go_auth_denied').click(function () {
        tool.browser.message.send(null, 'settings', { account_email: url_params.account_email, page: '/chrome/settings/modules/auth_denied.htm' });
      });
    }
  });
}

$('.action_password').click(function () {
  if($(this).hasClass('green')) {
    display_block('step_2_confirm');
  } else {
    alert('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
  }
});

$('.action_reset_password').click(function () {
  $('#password').val('');
  $('#password2').val('');
  display_block('step_1_password');
  evaluate_password_strength('#step_1_password', '#password', '.action_password');
  $('#password').focus();
});

function backup_key_on_gmail(account_email, armored_key, callback) { // todo - refactor into single function as backup_key_on_outlook that takes api function as argument
  $.get('/chrome/emails/email_intro.template.htm', null, function (email_message) {
    var email_attachments = [tool.file.attachment('cryptup-backup-' + account_email.replace(/[^A-Za-z0-9]+/g, '') + '.key', 'text/plain', armored_key)];
    var message = tool.api.common.message(account_email, account_email, account_email, tool.enums.recovery_email_subjects[0], { 'text/html': email_message }, email_attachments);
    tool.api.gmail.message_send(account_email, message, callback);
  });
}

function backup_key_on_outlook(account_email, armored_key, callback) {
  $.get('/chrome/emails/email_intro.template.htm', null, function (email_message) {
    var email_attachments = [tool.file.attachment('cryptup-backup-' + account_email.replace(/[^A-Za-z0-9]+/g, '') + '.key', 'text/plain', armored_key)];
    var message = tool.api.common.message(account_email, account_email, account_email, tool.enums.recovery_email_subjects[0], { 'text/html': email_message }, email_attachments);
    tool.api.outlook.message_send(account_email, message, callback);
  });
}

$('.action_backup').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
  var new_passphrase = $('#password').val();
  if(new_passphrase !== $('#password2').val()) {
    alert('The two pass phrases do not match, please try again.');
    $('#password2').val('');
    $('#password2').focus();
  } else {
    var btn_text = $(self).text();
    $(self).html(tool.ui.spinner('white'));
    var armored_private_key = private_storage_get('local', url_params.account_email, 'master_private_key');
    var prv = openpgp.key.readArmored(armored_private_key).keys[0];
    openpgp_key_encrypt(prv, new_passphrase);
    private_storage_set('local', url_params.account_email, 'master_passphrase', new_passphrase);
    private_storage_set('local', url_params.account_email, 'master_passphrase_needed', true);
    private_storage_set('local', url_params.account_email, 'master_private_key', prv.armor());
    (email_provider === 'gmail' ? backup_key_on_gmail : backup_key_on_outlook)(url_params.account_email, prv.armor(), function (success) {
      if(success) {
        write_backup_done_and_render(false, 'inbox');
      } else {
        $(self).text(btn_text);
        alert('Need internet connection to finish. Please click the button again to retry.');
      }
    });
  }
}));

function is_master_private_key_encrypted(account_email) {
  if(private_storage_get('local', account_email, 'master_passphrase_needed') !== true) {
    return false;
  } else {
    var key = openpgp.key.readArmored(private_storage_get('local', account_email, 'master_private_key')).keys[0];
    return key.primaryKey.isDecrypted === false && !tool.crypto.key.decrypt(key, '').success;
  }
}

function backup_on_email_provider() {
  if(!is_master_private_key_encrypted(url_params.account_email)) {
    alert('Sorry, cannot back up private key because it\'s not protected with a pass phrase.');
  } else {
    var btn_text = $(self).text();
    $(self).html(tool.ui.spinner('white'));
    var armored_private_key = private_storage_get('local', url_params.account_email, 'master_private_key');
    (email_provider === 'gmail' ? backup_key_on_gmail : backup_key_on_outlook)(url_params.account_email, armored_private_key, function (success) {
      if(success) {
        write_backup_done_and_render(false, 'inbox');
      } else {
        $(self).text(btn_text);
        alert('Need internet connection to finish. Please click the button again to retry.');
      }
    });
  }
}

function backup_as_file() { //todo - add a non-encrypted download option
  if(!is_master_private_key_encrypted(url_params.account_email)) {
    alert('Sorry, cannot back up private key because it\'s not protected with a pass phrase.');
  } else {
    var btn_text = $(self).text();
    $(self).html(tool.ui.spinner('white'));
    var armored_private_key = private_storage_get('local', url_params.account_email, 'master_private_key');
    tool.file.save_to_downloads('cryptup-' + url_params.account_email.toLowerCase().replace(/[^a-z0-9]/g, '') + '.key', 'text/plain', armored_private_key);
    write_backup_done_and_render(false, 'file');
  }
}

function backup_by_print() { //todo - implement + add a non-encrypted print option
  throw new Error('not implemented');
}

function backup_refused() {
  write_backup_done_and_render(tool.time.get_future_timestamp_in_months(3), 'none');
}

function write_backup_done_and_render(prompt, method) {
  account_storage_set(url_params.account_email, { key_backup_prompt: prompt, key_backup_method: method }, function () {
    if(url_params.action === 'setup') {
      window.location = tool.env.url_create('/chrome/settings/setup.htm', { account_email: url_params.account_email });
    } else {
      show_status();
    }
  });
}

$('.action_manual_backup').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
  var selected = $('input[type=radio][name=input_backup_choice]:checked').val();
  if(selected === 'inbox') {
    backup_on_email_provider();
  } else if(selected === 'file') {
    backup_as_file();
  } else if(selected === 'print') {
    backup_by_print();
  } else {
    backup_refused();
  }
}));

$('.action_skip_backup').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
  if(url_params.action === 'setup') {
    account_storage_set(url_params.account_email, { key_backup_prompt: false }, function () {
      window.location = tool.env.url_create('/chrome/settings/setup.htm', { account_email: url_params.account_email });
    });
  } else {
    tool.browser.message.send(url_params.parent_tab_id, 'close_page');
  }
}));

$('#step_3_manual input[name=input_backup_choice]').click(function () {
  if($(this).val() === 'inbox') {
    $('.action_manual_backup').text('back up as email');
    $('.action_manual_backup').removeClass('red').addClass('green');
  } else if($(this).val() === 'file') {
    $('.action_manual_backup').text('back up as a file');
    $('.action_manual_backup').removeClass('red').addClass('green');
  } else if($(this).val() === 'print') {
    $('.action_manual_backup').text('back up on paper');
    $('.action_manual_backup').removeClass('red').addClass('green');
  } else {
    $('.action_manual_backup').text('test my luck without a backup');
    $('.action_manual_backup').removeClass('green').addClass('red');
  }
});
