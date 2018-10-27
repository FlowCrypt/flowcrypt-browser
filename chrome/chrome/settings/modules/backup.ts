/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let url_params = Env.url_params(['account_email', 'action', 'parent_tab_id']);
  let account_email = Env.url_param_require.string(url_params, 'account_email');
  let parent_tab_id: string|null = null;
  if (url_params.action !== 'setup') {
    parent_tab_id = Env.url_param_require.string(url_params, 'parent_tab_id');
  }

  let email_provider: EmailProvider;

  await tool.ui.passphrase_toggle(['password', 'password2']);

  let storage = await Store.get_account(account_email, ['setup_simple', 'email_provider']);
  email_provider = storage.email_provider || 'gmail';

  let rules = new Rules(account_email);
  if (!rules.can_backup_keys()) {
    tool.ui.sanitize_render('body', `<div class="line" style="margin-top: 100px;">${Lang.setup.key_backups_not_allowed}</div>`);
    return;
  }

  let display_block = (name: string) => {
    let blocks = ['loading', 'step_0_status', 'step_1_password', 'step_2_confirm', 'step_3_automatic_backup_retry', 'step_3_manual'];
    for (let block of blocks) {
      $('#' + block).css('display', 'none');
    }
    $('#' + name).css('display', 'block');
  };

  $('#password').on('keyup', tool.ui.event.prevent(tool.ui.event.spree(), () => Settings.render_password_strength('#step_1_password', '#password', '.action_password')));

  let show_status = async () => {
    $('.hide_if_backup_done').css('display', 'none');
    $('h1').text('Key Backups');
    display_block('loading');
    let storage = await Store.get_account(account_email, ['setup_simple', 'key_backup_method', 'google_token_scopes', 'email_provider', 'microsoft_auth']);
    if (email_provider === 'gmail' && tool.api.gmail.has_scope(storage.google_token_scopes || [], 'read')) {
      let keys;
      try {
        keys = await tool.api.gmail.fetch_key_backups(account_email);
      } catch (e) {
        if (tool.api.error.is_network_error(e)) {
          tool.ui.sanitize_render('#content', `Could not check for backups: no internet. ${tool.ui.retry_link()}`);
        } else if(tool.api.error.is_auth_popup_needed(e)) {
          tool.browser.message.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
          tool.ui.sanitize_render('#content', `Could not check for backups: account needs to be re-connected. ${tool.ui.retry_link()}`);
        } else {
          tool.catch.handle_exception(e);
          tool.ui.sanitize_render('#content', `Could not check for backups: unknown error. ${tool.ui.retry_link()}`);
        }
        return;
      }
      display_block('step_0_status');
      if (keys && keys.length) {
        $('.status_summary').text('Backups found: ' + keys.length + '. Your account is backed up correctly in your email inbox.');
        tool.ui.sanitize_render('#step_0_status .container', '<div class="button long green action_go_manual">SEE MORE BACKUP OPTIONS</div>');
        $('.action_go_manual').click(tool.ui.event.handle(() => {
          display_block('step_3_manual');
          $('h1').text('Back up your private key');
        }));
      } else if (storage.key_backup_method) {
        if (storage.key_backup_method === 'file') {
          $('.status_summary').text('You have previously backed up your key into a file.');
          tool.ui.sanitize_render('#step_0_status .container', '<div class="button long green action_go_manual">SEE OTHER BACKUP OPTIONS</div>');
          $('.action_go_manual').click(tool.ui.event.handle(() => {
            display_block('step_3_manual');
            $('h1').text('Back up your private key');
          }));
        } else if (storage.key_backup_method === 'print') {
          $('.status_summary').text('You have previously backed up your key by printing it.');
          tool.ui.sanitize_render('#step_0_status .container', '<div class="button long green action_go_manual">SEE OTHER BACKUP OPTIONS</div>');
          $('.action_go_manual').click(tool.ui.event.handle(() => {
            display_block('step_3_manual');
            $('h1').text('Back up your private key');
          }));
        } else { // inbox or other methods
          $('.status_summary').text('There are no backups on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
          tool.ui.sanitize_render('#step_0_status .container', '<div class="button long green action_go_manual">SEE BACKUP OPTIONS</div>');
          $('.action_go_manual').click(tool.ui.event.handle(() => {
            display_block('step_3_manual');
            $('h1').text('Back up your private key');
          }));
        }
      } else {
        if (storage.setup_simple) {
          $('.status_summary').text('No backups found on this account. You can store a backup of your key in email inbox. Your key will be protected by a pass phrase of your choice.');
          tool.ui.sanitize_render('#step_0_status .container', '<div class="button long green action_go_backup">BACK UP MY KEY</div><br><br><br><a href="#" class="action_go_manual">See more advanced backup options</a>');
          $('.action_go_backup').click(tool.ui.event.handle(() => {
            display_block('step_1_password');
            $('h1').text('Set Backup Pass Phrase');
          }));
          $('.action_go_manual').click(tool.ui.event.handle(() => {
            display_block('step_3_manual');
            $('h1').text('Back up your private key');
          }));
        } else {
          $('.status_summary').text('No backups found on this account. If you lose your device, or it stops working, you will not be able to read your encrypted email.');
          tool.ui.sanitize_render('#step_0_status .container', '<div class="button long green action_go_manual">BACK UP MY KEY</div>');
          $('.action_go_manual').click(tool.ui.event.handle(() => {
            display_block('step_3_manual');
            $('h1').text('Back up your private key');
          }));
        }
      }
    } else { // gmail read permission not granted - cannot check for backups
      display_block('step_0_status');
      $('.status_summary').text('FlowCrypt cannot check your backups.');
      let pemissions_button_if_gmail = email_provider === 'gmail' ? '<div class="button long green action_go_auth_denied">SEE PERMISSIONS</div>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;': '';
      tool.ui.sanitize_render('#step_0_status .container', `${pemissions_button_if_gmail}<div class="button long gray action_go_manual">SEE BACKUP OPTIONS</div>`);
      $('.action_go_manual').click(tool.ui.event.handle(() => {
        display_block('step_3_manual');
        $('h1').text('Back up your private key');
      }));
      $('.action_go_auth_denied').click(tool.ui.event.handle(() => tool.browser.message.send(null, 'settings', {account_email, page: '/chrome/settings/modules/auth_denied.htm'})));
    }
  };

  $('.action_password').click(tool.ui.event.handle(target => {
    if ($(target).hasClass('green')) {
      display_block('step_2_confirm');
    } else {
      alert('Please select a stronger pass phrase. Combinations of 4 to 5 uncommon words are the best.');
    }
  }));

  $('.action_reset_password').click(tool.ui.event.handle(() => {
    $('#password').val('');
    $('#password2').val('');
    display_block('step_1_password');
    Settings.render_password_strength('#step_1_password', '#password', '.action_password');
    $('#password').focus();
  }));

  $('.action_backup').click(tool.ui.event.prevent(tool.ui.event.double(), async (target) => {
    let new_passphrase = $('#password').val() as string; // text input
    if (new_passphrase !== $('#password2').val()) {
      alert('The two pass phrases do not match, please try again.');
      $('#password2').val('');
      $('#password2').focus();
    } else {
      let btn_text = $(target).text();
      tool.ui.sanitize_render(target, tool.ui.spinner('white'));
      let [primary_ki] = await Store.keys_get(account_email, ['primary']);
      Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);
      let prv = openpgp.key.readArmored(primary_ki.private).keys[0];
      await Settings.openpgp_key_encrypt(prv, new_passphrase);
      await Store.passphrase_save('local', account_email, primary_ki.longid, new_passphrase);
      await Store.keys_add(account_email, prv.armor());
      try {
        await do_backup_on_email_provider(account_email, prv.armor());
      } catch (e) {
        if(tool.api.error.is_network_error(e)) {
          alert('Need internet connection to finish. Please click the button again to retry.');
        } else if(parent_tab_id && tool.api.error.is_auth_popup_needed(e)) {
          tool.browser.message.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
          alert('Account needs to be re-connected first. Please try later.');
        } else {
          tool.catch.handle_exception(e);
          alert(`Error happened, please try again (${e.message})`);
        }
        $(target).text(btn_text);
        return;
      }
      await write_backup_done_and_render(false, 'inbox');
    }
  }));

  let is_master_private_key_encrypted = async (ki: KeyInfo) => {
    let k = openpgp.key.readArmored(ki.private).keys[0];
    if (k.primaryKey.isDecrypted()) {
      return false;
    }
    for(let packet of k.getKeys()) {
      if (packet.isDecrypted() === true) {
        return false;
      }
    }
    if (await tool.crypto.key.decrypt(k, ['']) === true) {
      return false;
    }
    return true;
  };

  let as_backup_file = (account_email: string, armored_key: string) => {
    return new Attachment({name: `cryptup-backup-${account_email.replace(/[^A-Za-z0-9]+/g, '')}.key`, type: 'text/plain', data: armored_key});
  };

  let do_backup_on_email_provider = async (account_email: string, armored_key: string) => {
    let email_message = await $.get({url:'/chrome/emails/email_intro.template.htm', dataType: 'html'});
    let email_attachments = [as_backup_file(account_email, armored_key)];
    let message = await tool.api.common.message(account_email, account_email, account_email, tool.enums.recovery_email_subjects[0], {'text/html': email_message}, email_attachments);
    if (email_provider === 'gmail') {
      return await tool.api.gmail.message_send(account_email, message);
    } else {
      throw Error(`Backup method not implemented for ${email_provider}`);
    }
  };

  let backup_on_email_provider_and_update_ui = async (primary_ki: KeyInfo) => {
    let pass_phrase = await Store.passphrase_get(account_email, primary_ki.longid);
    if (!pass_phrase || !await is_pass_phrase_strong_enough(primary_ki, pass_phrase)) {
      alert('Your key is not protected with a strong pass phrase, skipping');
      return;
    }
    let btn = $('.action_manual_backup');
    let original_btn_text = btn.text();
    tool.ui.sanitize_render(btn, tool.ui.spinner('white'));
    try {
      await do_backup_on_email_provider(account_email, primary_ki.private);
    } catch (e) {
      if(tool.api.error.is_network_error(e)) {
        return alert('Need internet connection to finish. Please click the button again to retry.');
      } else if(parent_tab_id && tool.api.error.is_auth_popup_needed(e)) {
        tool.browser.message.send(parent_tab_id, 'notification_show_auth_popup_needed', {account_email});
        return alert('Account needs to be re-connected first. Please try later.');
      } else {
        tool.catch.handle_exception(e);
        return alert(`Error happened: ${e.message}`);
      }
    } finally {
      btn.text(original_btn_text);
    }
    await write_backup_done_and_render(false, 'inbox');
  };

  let backup_as_file = async (primary_ki: KeyInfo) => { // todo - add a non-encrypted download option
    let attachment = as_backup_file(account_email, primary_ki.private);
    if (Env.browser().name !== 'firefox') {
      tool.file.save_to_downloads(attachment);
      await write_backup_done_and_render(false, 'file');
    } else {
      tool.file.save_to_downloads(attachment, $('.backup_action_buttons_container'));
    }
  };

  let backup_by_print = async (primary_ki: KeyInfo) => { // todo - implement + add a non-encrypted print option
    throw new Error('not implemented');
  };

  let backup_refused = async (ki: KeyInfo) => {
    await write_backup_done_and_render(tool.time.get_future_timestamp_in_months(3), 'none');
  };

  let write_backup_done_and_render = async (prompt: number|false, method: KeyBackupMethod) => {
    await Store.set(account_email, { key_backup_prompt: prompt, key_backup_method: method });
    if (url_params.action === 'setup') {
      window.location.href = Env.url_create('/chrome/settings/setup.htm', { account_email: url_params.account_email, action: 'finalize' });
    } else {
      await show_status();
    }
  };

  $('.action_manual_backup').click(tool.ui.event.prevent(tool.ui.event.double(), async (target) => {
    let selected = $('input[type=radio][name=input_backup_choice]:checked').val();
    let [primary_ki] = await Store.keys_get(account_email, ['primary']);
    Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);
    if (!await is_master_private_key_encrypted(primary_ki)) {
      alert('Sorry, cannot back up private key because it\'s not protected with a pass phrase.');
      return;
    }
    if (selected === 'inbox') {
      await backup_on_email_provider_and_update_ui(primary_ki);
    } else if (selected === 'file') {
      await backup_as_file(primary_ki);
    } else if (selected === 'print') {
      await backup_by_print(primary_ki);
    } else {
      await backup_refused(primary_ki);
    }
  }));

  let is_pass_phrase_strong_enough = async (ki: KeyInfo, pass_phrase: string) => {
    let k = tool.crypto.key.read(ki.private);
    if(k.isDecrypted()) {
      return false;
    }
    if (!pass_phrase) {
      let pp = prompt('Please enter your pass phrase:');
      if (!pp) {
        return false;
      }
      if (await tool.crypto.key.decrypt(k, [pp]) !== true) {
        alert('Pass phrase did not match, please try again.');
        return false;
      }
      pass_phrase = pp;
    }
    if (Settings.evaluate_password_strength(pass_phrase).word.pass === true) {
      return true;
    }
    alert('Please change your pass phrase first.\n\nIt\'s too weak for this backup method.');
    return false;
  };

  let setup_create_simple_automatic_inbox_backup = async () => {
    let [primary_ki] = await Store.keys_get(account_email, ['primary']);
    if(tool.crypto.key.read(primary_ki.private).isDecrypted()) {
      alert('Key not protected with a pass phrase, skipping');
      throw new UnreportableError('Key not protected with a pass phrase, skipping');
    }
    Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);
    await do_backup_on_email_provider(account_email, primary_ki.private);
    await write_backup_done_and_render(false, 'inbox');
  };

  $('.action_skip_backup').click(tool.ui.event.prevent(tool.ui.event.double(), async () => {
    if (url_params.action === 'setup') {
      await Store.set(account_email, { key_backup_prompt: false });
      window.location.href = Env.url_create('/chrome/settings/setup.htm', { account_email: url_params.account_email });
    } else {
      tool.browser.message.send(parent_tab_id, 'close_page');
    }
  }));

  $('#step_3_manual input[name=input_backup_choice]').click(tool.ui.event.handle(target => {
    if ($(target).val() === 'inbox') {
      $('.action_manual_backup').text('back up as email');
      $('.action_manual_backup').removeClass('red').addClass('green');
    } else if ($(target).val() === 'file') {
      $('.action_manual_backup').text('back up as a file');
      $('.action_manual_backup').removeClass('red').addClass('green');
    } else if ($(target).val() === 'print') {
      $('.action_manual_backup').text('back up on paper');
      $('.action_manual_backup').removeClass('red').addClass('green');
    } else {
      $('.action_manual_backup').text('try my luck');
      $('.action_manual_backup').removeClass('green').addClass('red');
    }
  }));

  if (url_params.action === 'setup') {
    $('.back').css('display', 'none');
    $('.action_skip_backup').parent().css('display', 'none');
    if (storage.setup_simple) {
      try {
        await setup_create_simple_automatic_inbox_backup();
      } catch (e) {
        return await Settings.prompt_to_retry('REQUIRED', e, 'Failed to back up your key, probably due to internet connection.', setup_create_simple_automatic_inbox_backup);
      }
    } else {
      display_block('step_3_manual');
      $('h1').text('Back up your private key');
    }
  } else if (url_params.action === 'passphrase_change_gmail_backup') {
    if (storage.setup_simple) {
      display_block('loading');
      let [primary_ki] = await Store.keys_get(account_email, ['primary']);
      Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);
      try {
        await do_backup_on_email_provider(account_email, primary_ki.private);
        $('#content').text('Pass phrase changed. You will find a new backup in your inbox.');
      } catch (e) {
        tool.ui.sanitize_render('#content', 'Connection failed, please <a href="#" class="reload">try again</a>.');
        $('.reload').click(() => window.location.reload());
      }
    } else { // should never happen on this action. Just in case.
      display_block('step_3_manual');
      $('h1').text('Back up your private key');
    }
  } else if (url_params.action === 'options') {
    display_block('step_3_manual');
    $('h1').text('Back up your private key');
  } else {
    await show_status();
  }

})();
