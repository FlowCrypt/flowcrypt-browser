/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(() => {

  let url_params = tool.env.url_params(['account_email', 'action', 'parent_tab_id']);
  let email_provider: EmailProvider;
  
  tool.ui.passphrase_toggle(['password', 'password2']);
  
  Store.get_account(url_params.account_email as string, ['setup_simple', 'email_provider']).then(storage => {
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
        Store.keys_get(url_params.account_email as string, ['primary']).then(([primary_ki]) => {

          abort_and_render_error_if_keyinfo_empty(primary_ki);
          
          (email_provider === 'gmail' ? backup_key_on_gmail : backup_key_on_outlook)(url_params.account_email as string, primary_ki.private, function (success) {
            if(success) {
              $('#content').html('Pass phrase changed. You will find a new backup in your inbox.');
            } else {
              $('#content').html('Connection failed, please <a href="#" class="reload">try again</a>.');
              $('.reload').click(function () {
                window.location.reload();
              });
            }
          });
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
  
  function display_block(name: string) {
    let blocks = ['loading', 'step_0_status', 'step_1_password', 'step_2_confirm', 'step_3_manual'];
    for(let block of blocks) {
      $('#' + block).css('display', 'none');
    }
    $('#' + name).css('display', 'block');
  }
  
  $('#password').on('keyup', tool.ui.event.prevent(tool.ui.event.spree(), function () {
    render_password_strength('#step_1_password', '#password', '.action_password');
  }));
  
  function show_status() {
    $('.hide_if_backup_done').css('display', 'none');
    $('h1').text('Key Backups');
    display_block('loading');
    Store.get_account(url_params.account_email as string, ['setup_simple', 'key_backup_method', 'google_token_scopes', 'email_provider', 'microsoft_auth']).then(storage => {
      if(email_provider === 'gmail' && tool.api.gmail.has_scope(storage.google_token_scopes || [], 'read')) {
        tool.api.gmail.fetch_key_backups(url_params.account_email as string, function (success, keys: OpenpgpKey[]) {
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
        $('.status_summary').html('FlowCrypt cannot check your backups.');
        let pemissions_button_if_gmail = email_provider === 'gmail' ? '<div class="button long green action_go_auth_denied">SEE PERMISSIONS</div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;': '';
        $('#step_0_status .container').html(pemissions_button_if_gmail + '<div class="button long gray action_go_manual">SEE BACKUP OPTIONS</div>');
        $('.action_go_manual').click(function () {
          display_block('step_3_manual');
          $('h1').text('Back up your private key');
        });
        $('.action_go_auth_denied').click(function () {
          tool.browser.message.send(null, 'settings', { account_email: url_params.account_email as string, page: '/chrome/settings/modules/auth_denied.htm' });
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
    render_password_strength('#step_1_password', '#password', '.action_password');
    $('#password').focus();
  });
  
  function backup_key_on_gmail(account_email: string, armored_key: string, callback: ApiCallback) { // todo - refactor into single function as backup_key_on_outlook that takes api function as argument
    $.get('/chrome/emails/email_intro.template.htm', function (email_message: string) {
      let email_attachments = [tool.file.attachment('cryptup-backup-' + account_email.replace(/[^A-Za-z0-9]+/g, '') + '.key', 'text/plain', armored_key)];
      let message = tool.api.common.message(account_email, account_email, account_email, tool.enums.recovery_email_subjects[0], { 'text/html': email_message }, email_attachments);
      tool.api.gmail.message_send(account_email, message, callback);
    }, 'html');
  }

  function backup_key_on_outlook(account_email: string, armored_key: string, callback: ApiCallback) {
  //   $.get('/chrome/emails/email_intro.template.htm', null, function (email_message: string) {
  //     let email_attachments = [tool.file.attachment('cryptup-backup-' + account_email.replace(/[^A-Za-z0-9]+/g, '') + '.key', 'text/plain', armored_key)];
  //     let message = tool.api.common.message(account_email, account_email, account_email, tool.enums.recovery_email_subjects[0], { 'text/html': email_message }, email_attachments);
  //     tool.api.outlook.message_send(account_email, message, callback);
  //   }, 'html');
  }
  
  $('.action_backup').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
    let new_passphrase = $('#password').val() as string; // text input
    if(new_passphrase !== $('#password2').val()) {
      alert('The two pass phrases do not match, please try again.');
      $('#password2').val('');
      $('#password2').focus();
    } else {
      let btn_text = $(self).text();
      $(self).html(tool.ui.spinner('white'));
      console.log('p1');
      Store.keys_get(url_params.account_email as string, ['primary']).then(([primary_ki]) => {
        abort_and_render_error_if_keyinfo_empty(primary_ki);
        let prv = openpgp.key.readArmored(primary_ki.private).keys[0];
        openpgp_key_encrypt(prv, new_passphrase);
        console.log('p2');
        Promise.all([
          Store.passphrase_save('local', url_params.account_email as string, primary_ki.longid, new_passphrase),
          Store.keys_add(url_params.account_email as string, prv.armor()),
        ]).then(() => {
          console.log('p3');
          (email_provider === 'gmail' ? backup_key_on_gmail : backup_key_on_outlook)(url_params.account_email as string, prv.armor(), function (success: boolean) {
            console.log('p4');
            if(success) {
              console.log('p5');
              write_backup_done_and_render(false, 'inbox');
            } else {
              $(self).text(btn_text);
              alert('Need internet connection to finish. Please click the button again to retry.');
            }
          });
        });
      });
    }
  }));
  
  function is_master_private_key_encrypted(ki: KeyInfo) {
    let key = openpgp.key.readArmored(ki.private).keys[0];
    return key.primaryKey.isDecrypted === false && !tool.crypto.key.decrypt(key, '').success;
  }
  
  function backup_on_email_provider(primary_ki: KeyInfo) {
    Store.passphrase_get(url_params.account_email as string, primary_ki.longid).then((pass_phrase: string) => {
      if(!is_pass_phrase_strong_enough(primary_ki, pass_phrase)) {
        return;
      }
      let btn = $('.action_manual_backup');
      let original_btn_text = btn.text();
      btn.html(tool.ui.spinner('white'));
      (email_provider === 'gmail' ? backup_key_on_gmail : backup_key_on_outlook)(url_params.account_email as string, primary_ki.private, function (success) {
        btn.text(original_btn_text);
        if(success) {
          write_backup_done_and_render(false, 'inbox');
        } else {
          alert('Need internet connection to finish. Please click the button again to retry.');
        }
      });
    });
  }
  
  function backup_as_file(primary_ki: KeyInfo) { //todo - add a non-encrypted download option
    $(self).html(tool.ui.spinner('white'));
    if(tool.env.browser().name !== 'firefox') {
      tool.file.save_to_downloads('cryptup-' + (url_params.account_email as string).toLowerCase().replace(/[^a-z0-9]/g, '') + '.key', 'text/plain', primary_ki.private);
      write_backup_done_and_render(false, 'file');
    } else {
      tool.file.save_to_downloads('cryptup-' + (url_params.account_email as string).toLowerCase().replace(/[^a-z0-9]/g, '') + '.key', 'text/plain', primary_ki.private, $('.backup_action_buttons_container'));
    }
  }
  
  function backup_by_print(primary_ki: KeyInfo) { //todo - implement + add a non-encrypted print option
    throw new Error('not implemented');
  }
  
  function backup_refused(ki: KeyInfo) {
    write_backup_done_and_render(tool.time.get_future_timestamp_in_months(3), 'none');
  }
  
  function write_backup_done_and_render(prompt: number|false, method: KeyBackupMethod) {
    Store.set(url_params.account_email as string, { key_backup_prompt: prompt, key_backup_method: method }).then(function () {
      if(url_params.action === 'setup') {
        window.location.href = tool.env.url_create('/chrome/settings/setup.htm', { account_email: url_params.account_email });
      } else {
        show_status();
      }
    });
  }
  
  $('.action_manual_backup').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
    let selected = $('input[type=radio][name=input_backup_choice]:checked').val();
    Store.keys_get(url_params.account_email as string, ['primary']).then(([primary_ki]) => {
      abort_and_render_error_if_keyinfo_empty(primary_ki);
      if(!is_master_private_key_encrypted(primary_ki)) {
        alert('Sorry, cannot back up private key because it\'s not protected with a pass phrase.');
        return;
      }
      if(selected === 'inbox') {
        backup_on_email_provider(primary_ki);
      } else if(selected === 'file') {
        backup_as_file(primary_ki);
      } else if(selected === 'print') {
        backup_by_print(primary_ki);
      } else {
        backup_refused(primary_ki);
      }
    });
  }));
  
  function is_pass_phrase_strong_enough(ki: KeyInfo, pass_phrase: string) {
    if(!pass_phrase) {
      let pp = prompt('Please enter your pass phrase:');
      if(!pp) {
        return false;
      }
      let k = tool.crypto.key.read(ki.private);
      if(!k.decrypt(pp)) {
        alert('Pass phrase did not match, please try again.');
        return false;
      }
      pass_phrase = pp;
    }
    if(evaluate_password_strength(pass_phrase).pass === true) {
      return true;
    }
    alert('Please change your pass phrase first.\n\nIt\'s too weak for this backup method.');
    return false;
  }
  
  $('.action_skip_backup').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
    if(url_params.action === 'setup') {
      Store.set(url_params.account_email as string, { key_backup_prompt: false }).then(function () {
        window.location.href = tool.env.url_create('/chrome/settings/setup.htm', { account_email: url_params.account_email });
      });
    } else {
      tool.browser.message.send(url_params.parent_tab_id as string, 'close_page');
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
      $('.action_manual_backup').text('try my luck');
      $('.action_manual_backup').removeClass('green').addClass('red');
    }
  });
  

})();