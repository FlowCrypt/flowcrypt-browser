/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

tool.catch.try(async () => {

  let unchecked_url_params = tool.env.url_params(['account_email', 'action', 'parent_tab_id']);
  let account_email = tool.env.url_param_require.string(unchecked_url_params, 'account_email');
  let parent_tab_id: string|null = null;
  let action = tool.env.url_param_require.oneof(unchecked_url_params, 'action', ['add_key', 'finalize', undefined]) as 'add_key'|'finalize'|undefined;
  if (action === 'add_key') {
    parent_tab_id = tool.env.url_param_require.string(unchecked_url_params, 'parent_tab_id');
  }

  if (account_email) {
    tool.browser.message.send(null, 'update_uninstall_url');
  } else {
    window.location.href = 'index.htm';
    return;
  }

  $('h1').text('Set Up FlowCrypt');
  $('.email-address').text(account_email);
  $('.back').css('visibility', 'hidden');
  await tool.ui.passphrase_toggle(['step_2b_manual_enter_passphrase'], 'hide');
  await tool.ui.passphrase_toggle(['step_2a_manual_create_input_password', 'step_2a_manual_create_input_password2', 'recovery_pasword']);

  let storage = await Store.get_account(account_email, [
    'setup_done', 'key_backup_prompt', 'email_provider', 'google_token_scopes', 'microsoft_auth', 'addresses',
  ]);

  storage.email_provider = storage.email_provider || 'gmail';
  let account_email_attested_fingerprint: string|null = null;
  let recovered_keys: OpenPGP.key.Key[] = [];
  let recovered_key_matching_passphrases: string[] = [];
  let recovered_keys_longid_count = 0;
  let recovered_keys_successful_longids: string[] = [];
  let all_addresses: string[] = [account_email];

  let rules = new Rules(account_email);
  if (!rules.can_create_keys()) {
    let forbidden = `${Lang.setup.creating_keys_not_allowed_please_import} <a href="${window.location.href}">Back</a>`;
    $('#step_2a_manual_create, #step_2_easy_generating').html(`<div class="aligncenter"><div class="line">${forbidden}</div></div>`);
    $('.back').remove(); // back button would allow users to choose other options (eg create - not allowed)
  }

  let tab_id = await tool.browser.message.required_tab_id();
  tool.browser.message.listen({
    close_page: () => {
      $('.featherlight-close').click();
    },
    notification_show: (data: {notification: string}) => {
      alert(data.notification);
    },
  }, tab_id);

  let show_submit_all_addresses_option = (addrs: string[]) => {
    if (addrs && addrs.length > 1) {
      $('.addresses').text(tool.arr.without_value(addrs, account_email).join(', '));
      $('.manual .input_submit_all').prop({checked: true, disabled: false}).closest('div.line').css('display', 'block');
    }
  };

  let save_and_fill_submit_option = async (addresses: string[]) => {
    all_addresses = tool.arr.unique(addresses.concat(account_email));
    await Store.set(account_email, { addresses: all_addresses });
    show_submit_all_addresses_option(all_addresses);
  };

  let display_block = (name: string) => {
    let blocks = [
      'loading',
      'step_0_found_key',
      'step_1_easy_or_manual',
      'step_2a_manual_create', 'step_2b_manual_enter', 'step_2_easy_generating', 'step_2_recovery',
      'step_3_compatibility_fix',
      'step_4_more_to_recover',
      'step_4_done',
      'step_4_close',
    ];
    if (name) { // set
      $('#' + blocks.join(', #')).css('display', 'none');
      $('#' + name).css('display', 'block');
      $('.back').css('visibility', tool.value(name).in(['step_2b_manual_enter', 'step_2a_manual_create']) ? 'visible' : 'hidden');
      if (name === 'step_2_recovery') {
        $('.backups_count_words').text(recovered_keys.length > 1 ? recovered_keys.length + ' backups' : 'a backup');
      }
    } else { // get
      return $('#' + blocks.join(', #')).filter(':visible').first().attr('id') || null;
    }
  };

  let render_setup_dialog = async (): Promise<void> => {
    let keyserver_result, fetched_keys;
    Settings.initialize_private_key_import_ui(account_email, parent_tab_id); // for step_2b_manual_enter, if user chooses so

    try {
      let r = await tool.api.attester.lookup_email([account_email]);
      keyserver_result = r.results[0];
    } catch (e) {
      return await Settings.prompt_to_retry('REQUIRED', e, 'Failed to check if encryption is already set up on your account.\nThis is probably due to internet connection.', () => render_setup_dialog());
    }

    if (keyserver_result.pubkey) {
      if (keyserver_result.attested) {
        account_email_attested_fingerprint = tool.crypto.key.fingerprint(keyserver_result.pubkey);
      }
      if (!rules.can_backup_keys()) {
        // they already have a key recorded on attester, but no backups allowed on the domain. They should enter their prv manually
        display_block('step_2b_manual_enter');
      } else if (storage.email_provider === 'gmail' && tool.api.gmail.has_scope(storage.google_token_scopes as string[], 'read')) {
        try {
          fetched_keys = await tool.api.gmail.fetch_key_backups(account_email);
        } catch (e) {
          return await Settings.prompt_to_retry('REQUIRED', e, 'Failed to check for account backups.\nThis is probably due to internet connection.', () => render_setup_dialog());
        }
        if (fetched_keys.length) {
          recovered_keys = fetched_keys;
          recovered_keys_longid_count = tool.arr.unique(recovered_keys.map(tool.crypto.key.longid)).length;
          display_block('step_2_recovery');
        } else {
          display_block('step_0_found_key');
        }
      } else { // cannot read gmail to find a backup, or this is outlook
        if (keyserver_result.has_cryptup) {
          // a key has been created, and the user has used cryptup in the past - this suggest they likely have a backup available, but we cannot fetch it. Enter it manually
          display_block('step_2b_manual_enter');
          $('#step_2b_manual_enter').prepend('<div class="line red">FlowCrypt can\'t locate your backup automatically.</div><div class="line">Find "Your FlowCrypt Backup" email, open the attachment, copy all text and paste it below.<br/><br/></div>');
        } else if (rules.can_create_keys()) {
          // has a key registered, key creating allowed on the domain. This may be old key from PKS, let them choose
          display_block('step_1_easy_or_manual');
        } else {
          // has a key registered, no key creating allowed on the domain
          display_block('step_2b_manual_enter');
        }
      }
    } else { // no indication that the person used pgp before
      if (rules.can_create_keys()) {
        display_block('step_1_easy_or_manual');
      } else {
        display_block('step_2b_manual_enter');
      }
    }
  };

  let render_add_key_from_backup = async () => { // at this point, account is already set up, and this page is showing in a lightbox after selecting "from backup" in add_key.htm
    let fetched_keys;
    $('.profile-row, .skip_recover_remaining, .action_send, .action_account_settings, .action_skip_recovery').css({display: 'none', visibility: 'hidden', opacity: 0});
    $('h1').parent().html('<h1>Recover key from backup</h1>');
    $('.action_recover_account').text('load key from backup');
    try {
      fetched_keys = await tool.api.gmail.fetch_key_backups(account_email);
    } catch (e) {
      window.location.href = tool.env.url_create('modules/add_key.htm', {account_email, parent_tab_id});
      return;
    }
    if (fetched_keys.length) {
      recovered_keys = fetched_keys;
      recovered_keys_longid_count = tool.arr.unique(recovered_keys.map(tool.crypto.key.longid)).length;
      let stored_keys = await Store.keys_get(account_email);
      recovered_keys_successful_longids = stored_keys.map(ki => ki.longid);
      await render_setup_done();
      $('#step_4_more_to_recover .action_recover_remaining').click();
    } else {
      window.location.href = tool.env.url_create('modules/add_key.htm', {account_email, parent_tab_id});
    }
  };

  let submit_public_key_if_needed = async (armored_pubkey: string, options: {submit_main: boolean, submit_all: boolean}) => {
    let storage = await Store.get_account(account_email, ['addresses']);
    if (!options.submit_main) {
      return;
    }
    tool.api.attester.test_welcome(account_email, armored_pubkey).catch(error => tool.catch.report('tool.api.attester.test_welcome: failed', error));
    let addresses;
    if (typeof storage.addresses !== 'undefined' && storage.addresses.length > 1 && options.submit_all) {
      addresses = storage.addresses.concat(account_email);
    } else {
      addresses = [account_email];
    }
    if (account_email_attested_fingerprint && account_email_attested_fingerprint !== tool.crypto.key.fingerprint(armored_pubkey)) {
      return; // already submitted and ATTESTED another pubkey for this email
    }
    await Settings.submit_pubkeys(account_email, addresses, armored_pubkey);
  };

  let render_setup_done = async () => {
    let stored_keys = await Store.keys_get(account_email);
    if (recovered_keys_longid_count > stored_keys.length) { // recovery where not all keys were processed: some may have other pass phrase
      display_block('step_4_more_to_recover');
      $('h1').text('More keys to recover');
      $('.email').text(account_email);
      $('.private_key_count').text(stored_keys.length);
      $('.backups_count').text(recovered_keys.length);
    } else { // successful and complete setup
      display_block(action !== 'add_key' ? 'step_4_done' : 'step_4_close');
      $('h1').text(action !== 'add_key' ? 'You\'re all set!' : 'Recovered all keys!');
      $('.email').text(account_email);
    }
  };

  let pre_finalize_setup = async (options: SetupOptions): Promise<void> => {
    await Store.set(account_email, {
      tmp_submit_main: options.submit_main,
      tmp_submit_all: options.submit_all,
      setup_simple: options.setup_simple,
      key_backup_prompt: options.key_backup_prompt,
      is_newly_created_key: options.is_newly_created_key,
    });
  };

  let finalize_setup = async ({submit_main, submit_all}: {submit_main: boolean, submit_all: boolean}): Promise<void> => {
    let [primary_ki] = await Store.keys_get(account_email, ['primary']);
    Settings.abort_and_render_error_if_keyinfo_empty(primary_ki);
    try {
      await submit_public_key_if_needed(primary_ki.public, {submit_main, submit_all});
    } catch (e) {
      return await Settings.prompt_to_retry('REQUIRED', e, 'Failed to submit to Attester.\nThis may be due to internet connection issue.', () => finalize_setup({submit_main, submit_all}));
    }
    await Store.set(account_email, {
      setup_date: Date.now(),
      setup_done: true,
      cryptup_enabled: true,
    });
    await Store.remove(account_email, ['tmp_submit_main', 'tmp_submit_all']);
  };

  let save_keys = async (prvs: OpenPGP.key.Key[], options: SetupOptions) => {
    for (let prv of prvs) {
      let longid = tool.crypto.key.longid(prv);
      if (!longid) {
        alert('Cannot save keys to storage because at least one of them is not valid.');
        return;
      }
      await Store.keys_add(account_email, prv.armor());
      await Store.passphrase_save(options.passphrase_save ? 'local' : 'session', account_email, longid, options.passphrase);
    }
    let my_own_email_addresses_as_contacts = all_addresses.map(a => {
      let attested = Boolean(a === account_email && account_email_attested_fingerprint && account_email_attested_fingerprint !== tool.crypto.key.fingerprint(prvs[0].toPublic().armor()));
      return Store.db_contact_object(a, options.full_name, 'cryptup', prvs[0].toPublic().armor(), attested, false, Date.now());
    });
    await Store.db_contact_save(null, my_own_email_addresses_as_contacts);
  };

  let create_save_key_pair = async (options: SetupOptions) => {
    Settings.forbid_and_refresh_page_if_cannot('CREATE_KEYS', rules);
    try {
      let key = await tool.crypto.key.create([{ name: options.full_name, email: account_email }], 4096, options.passphrase); // todo - add all addresses?
      options.is_newly_created_key = true;
      let prv = openpgp.key.readArmored(key.private).keys[0];
      await save_keys([prv], options);
    } catch (e) {
      tool.catch.handle_exception(e);
      $('#step_2_easy_generating, #step_2a_manual_create').html('FlowCrypt didn\'t set up properly due to en error.<br/><br/>Email human@flowcrypt.com so that we can fix it ASAP.');
    }
  };

  let get_and_save_google_user_info = async (): Promise<{full_name: string, locale?: string, picture?: string}> => {
    if (storage.email_provider === 'gmail') {
      let user_info: ApirGoogleUserInfo;
      try {
        user_info = await tool.api.google.user_info(account_email);
      } catch (e) {
        return {full_name: ''};
      }
      let result = {full_name: user_info.name || '', locale: user_info.locale, picture: user_info.picture};
      await Store.set(account_email, result);
      return result;
    } else { // todo - find alternative way to do this for outlook - at least get name from sent emails
      return {full_name: ''};
    }
  };

  $('.action_show_help').click(tool.ui.event.handle(() => Settings.render_sub_page(account_email, tab_id, '/chrome/settings/modules/help.htm')));

  $('.back').off().click(tool.ui.event.handle(() => {
    $('h1').text('Set Up');
    display_block('step_1_easy_or_manual');
  }));

  $('#step_2_recovery .action_recover_account').click(tool.ui.event.prevent(tool.ui.event.double(), async (self) => {
    let passphrase = $('#recovery_pasword').val() as string; // text input
    let matching_keys: OpenPGP.key.Key[] = [];
    if (passphrase && tool.value(passphrase).in(recovered_key_matching_passphrases)) {
      alert('This pass phrase was already successfully used to recover some of your backups.\n\nThe remaining backups use a different pass phrase.\n\nPlease try another one.\n\nYou can skip this step, but some of your encrypted email may not be readable.');
    } else if (passphrase) {
      for (let recovered_key of recovered_keys) {
        let longid = tool.crypto.key.longid(recovered_key);
        let armored = recovered_key.armor();
        if (longid && !tool.value(longid).in(recovered_keys_successful_longids) && await tool.crypto.key.decrypt(recovered_key, [passphrase]) === true) {
          recovered_keys_successful_longids.push(longid);
          matching_keys.push(openpgp.key.readArmored(armored).keys[0]);
        }
      }
      if (matching_keys.length) {
        let options: SetupOptions = {
          full_name: '',
          submit_main: false, // todo - reevaluate submitting when recovering
          submit_all: false,
          passphrase,
          passphrase_save: true, // todo - reevaluate saving passphrase when recovering
          key_backup_prompt: false,
          recovered: true,
          setup_simple: true,
          is_newly_created_key: false,
        };
        recovered_key_matching_passphrases.push(passphrase);
        await save_keys(matching_keys, options);
        let storage = await Store.get_account(account_email, ['setup_done']);
        if (!storage.setup_done) { // normal situation - fresh setup
          await pre_finalize_setup(options);
          await finalize_setup(options);
          await render_setup_done();
        } else { // setup was finished before, just added more keys now
          await render_setup_done();
        }
      } else {
        if (recovered_keys.length > 1) {
          alert('This pass phrase did not match any of your ' + recovered_keys.length + ' backups. Please try again.');
        } else {
          alert('This pass phrase did not match your original setup. Please try again.');
        }
        $('.line_skip_recovery').css('display', 'block');
      }
    } else {
      alert('Please enter the pass phrase you used when you first set up FlowCrypt, so that we can recover your original keys.');
    }
  }));

  $('#step_4_more_to_recover .action_recover_remaining').click(tool.ui.event.handle(async () => {
    display_block('step_2_recovery');
    $('#recovery_pasword').val('');
    let stored_keys = await Store.keys_get(account_email);
    let got = stored_keys.length;
    let bups = recovered_keys.length;
    let left = (bups - got > 1) ? 'are ' + (bups - got) + ' backups' : 'is one backup';
    if (action !== 'add_key') {
      $('#step_2_recovery .recovery_status').html('You successfully recovered ' + got + ' of ' + bups + ' backups. There ' + left + ' left.<br><br>Try a different pass phrase to unlock all backups.');
      $('#step_2_recovery .line_skip_recovery').replaceWith(tool.e('div', {class: 'line', html: tool.e('a', {href: '#', class: 'skip_recover_remaining', html: 'Skip this step'})}));
      $('#step_2_recovery .skip_recover_remaining').click(tool.ui.event.handle(() => {
        window.location.href = tool.env.url_create('index.htm', { account_email });
      }));
    } else {
      $('#step_2_recovery .recovery_status').html('There ' + left + ' left to recover.<br><br>Try different pass phrases to unlock all backups.');
      $('#step_2_recovery .line_skip_recovery').css('display', 'none');
    }
  }));

  $('.action_skip_recovery').click(tool.ui.event.handle(() => {
    if (confirm('Your account will be set up for encryption again, but your previous encrypted emails will be unreadable. You will need to inform your encrypted contacts that you have a new key. Regular email will not be affected. Are you sure?')) {
      recovered_keys = [];
      recovered_key_matching_passphrases = [];
      recovered_keys_longid_count = 0;
      recovered_keys_successful_longids = [];
      display_block('step_1_easy_or_manual');
    }
  }));

  $('.action_send').click(tool.ui.event.handle(() => {
    window.location.href = tool.env.url_create('index.htm', { account_email, page: '/chrome/elements/compose.htm' });
  }));

  $('.action_account_settings').click(tool.ui.event.handle(() => {
    window.location.href = tool.env.url_create('index.htm', { account_email });
  }));

  $('.action_go_auth_denied').click(tool.ui.event.handle(() => {
    window.location.href = tool.env.url_create('index.htm', { account_email, page: '/chrome/settings/modules/auth_denied.htm' });
  }));

  $('.input_submit_key').click(tool.ui.event.handle(target => {
    let input_submit_all = $(target).closest('.manual').find('.input_submit_all').first();
    if ($(target).prop('checked')) {
      if (input_submit_all.closest('div.line').css('visibility') === 'visible') {
        input_submit_all.prop({ checked: true, disabled: false });
      }
    } else {
      input_submit_all.prop({ checked: false, disabled: true });
    }
  }));

  $('#step_0_found_key .action_manual_create_key, #step_1_easy_or_manual .action_manual_create_key').click(tool.ui.event.handle(() => {
    display_block('step_2a_manual_create');
  }));

  $('#step_0_found_key .action_manual_enter_key, #step_1_easy_or_manual .action_manual_enter_key').click(tool.ui.event.handle(() => {
    display_block('step_2b_manual_enter');
  }));

  $('#step_2b_manual_enter .action_save_private').click(tool.ui.event.handle(async () => {
    let options = {
      full_name: '',
      passphrase: $('#step_2b_manual_enter .input_passphrase').val() as string,
      key_backup_prompt: false,
      submit_main: $('#step_2b_manual_enter .input_submit_key').prop('checked'),
      submit_all: $('#step_2b_manual_enter .input_submit_all').prop('checked'),
      passphrase_save: $('#step_2b_manual_enter .input_passphrase_save').prop('checked'),
      is_newly_created_key: false,
      recovered: false,
      setup_simple: false,
    };
    try {
      let key_import_ui = new KeyImportUI({check_encryption: true});
      key_import_ui.on_bad_passphrase = () => $('#step_2b_manual_enter .input_passphrase').val('').focus();
      let checked = await key_import_ui.check_prv(account_email, $('#step_2b_manual_enter .input_private_key').val() as string, options.passphrase);
      $('#step_2b_manual_enter .action_save_private').html(tool.ui.spinner('white'));
      await save_keys([checked.encrypted], options);
      await pre_finalize_setup(options);
      await finalize_setup(options);
      await render_setup_done();
    } catch(e) {
      if(e instanceof UserAlert) {
        return alert(e.message);
      } else if(e instanceof KeyCanBeFixed) {
        return await render_compatibility_fix_block_and_finalize_setup(e.encrypted, options);
      } else {
        tool.catch.handle_exception(e);
        return alert(`An error happened when processing the key: ${String(e)}\nPlease write at human@flowcrypt.com`);
      }
    }
  }));

  let render_compatibility_fix_block_and_finalize_setup = async (original_prv: OpenPGP.key.Key, options: SetupOptions) => {
    display_block('step_3_compatibility_fix');
    let fixed_prv;
    try {
      fixed_prv = await Settings.render_prv_compatibility_fix_ui_and_wait_until_submitted_by_user(account_email, '#step_3_compatibility_fix', original_prv, options.passphrase, window.location.href.replace(/#$/, ''));
    } catch (e) {
      tool.catch.handle_exception(e);
      alert(`Failed to fix key: ${String(e)}`);
      return;
    }
    await save_keys([fixed_prv], options);
    await pre_finalize_setup(options);
    await finalize_setup(options);
    await render_setup_done();
  };

  $('#step_2a_manual_create .input_password').on('keyup', tool.ui.event.prevent(tool.ui.event.spree(), () => {
    Settings.render_password_strength('#step_2a_manual_create', '.input_password', '.action_create_private');
  }));

  let is_action_create_private_form_input_correct = () => {
    if (!$('#step_2a_manual_create .input_password').val()) {
      alert('Pass phrase is needed to protect your private email. Please enter a pass phrase.');
      $('#step_2a_manual_create .input_password').focus();
      return false;
    }
    if ($('#step_2a_manual_create .action_create_private').hasClass('gray')) {
      alert('Pass phrase is not strong enough. Please make it stronger, by adding a few words.');
      $('#step_2a_manual_create .input_password').focus();
      return false;
    }
    if ($('#step_2a_manual_create .input_password').val() !== $('#step_2a_manual_create .input_password2').val()) {
      alert('The pass phrases do not match. Please try again.');
      $('#step_2a_manual_create .input_password2').val('');
      $('#step_2a_manual_create .input_password2').focus();
      return false;
    }
    return true;
  };

  $('#step_2a_manual_create .action_create_private').click(tool.ui.event.prevent(tool.ui.event.double(), async () => {
    Settings.forbid_and_refresh_page_if_cannot('CREATE_KEYS', rules);
    if(!is_action_create_private_form_input_correct()) {
      return;
    }
    try {
      $('#step_2a_manual_create input').prop('disabled', true);
      $('#step_2a_manual_create .action_create_private').html(tool.ui.spinner('white') + 'just a minute');
      let userinfo = await get_and_save_google_user_info();
      let options: SetupOptions = {
        full_name: userinfo.full_name,
        passphrase: $('#step_2a_manual_create .input_password').val() as string,
        passphrase_save: $('#step_2a_manual_create .input_passphrase_save').prop('checked'),
        submit_main: $('#step_2a_manual_create .input_submit_key').prop('checked'),
        submit_all: $('#step_2a_manual_create .input_submit_all').prop('checked'),
        key_backup_prompt: rules.can_backup_keys() ? Date.now() : false,
        recovered: false,
        setup_simple: $('#step_2a_manual_create .input_backup_inbox').prop('checked'),
        is_newly_created_key: true,
      };
      await create_save_key_pair(options);
      await pre_finalize_setup(options);
      // only finalize after backup is done. backup.htm will redirect back to this page with ?action=finalize
      window.location.href = tool.env.url_create('modules/backup.htm', { action: 'setup', account_email });
    } catch (e) {
      tool.catch.handle_exception(e);
      alert(`There was an error, please try again.\n\n(${String(e)})`);
      $('#step_2a_manual_create .action_create_private').text('CREATE AND SAVE');
    }
  }));

  $('#step_2a_manual_create .action_show_advanced_create_settings').click(tool.ui.event.handle(target => {
    let advanced_create_settings = $('#step_2a_manual_create .advanced_create_settings');
    let container = $('#step_2a_manual_create .advanced_create_settings_container');
    if(advanced_create_settings.is(':visible')) {
      advanced_create_settings.hide('fast');
      $(target).find('span').text('Show Advanced Settings');
      container.css('width', '360px');
    } else {
      advanced_create_settings.show('fast');
      $(target).find('span').text('Hide Advanced Settings');
      container.css('width', 'auto');
    }
  }));

  $('#step_4_close .action_close').click(tool.ui.event.handle(() => { // only rendered if action=add_key which means parent_tab_id was used
    tool.browser.message.send(parent_tab_id, 'redirect', {location: tool.env.url_create('index.htm', {account_email, advanced: true})});
  }));

  // show alternative account addresses in setup form + save them for later
  if (storage.email_provider === 'gmail') {
    if (!tool.api.gmail.has_scope(storage.google_token_scopes as string[], 'read')) {
      $('.auth_denied_warning').css('display', 'block');
    }
    if (typeof storage.addresses === 'undefined') {
      if (tool.api.gmail.has_scope(storage.google_token_scopes as string[], 'read')) {
        Settings.fetch_account_aliases_from_gmail(account_email).then(save_and_fill_submit_option);
      } else { // cannot read emails, don't fetch alternative addresses
        // noinspection JSIgnoredPromiseFromCall - we do not care about the promise
        save_and_fill_submit_option([account_email]);
      }
    } else {
      show_submit_all_addresses_option(storage.addresses as string[]);
    }
  }

  if (storage.setup_done) {
    if (action !== 'add_key') {
      await render_setup_done();
    } else {
      await render_add_key_from_backup();
    }
  } else if(action === 'finalize') {
    let {tmp_submit_all, tmp_submit_main, key_backup_method} = await Store.get_account(account_email, ['tmp_submit_all', 'tmp_submit_main', 'key_backup_method']);
    if(typeof tmp_submit_all === 'undefined' || typeof tmp_submit_main === 'undefined') {
      return $('#content').html(`Setup session expired. To set up FlowCrypt, please click the FlowCrypt icon on top right.`);
    }
    if(typeof key_backup_method !== 'string') {
      alert('Backup has not successfully finished, will retry');
      window.location.href = tool.env.url_create('modules/backup.htm', { action: 'setup', account_email });
      return;
    }
    await finalize_setup({submit_all: tmp_submit_all, submit_main: tmp_submit_main});
    await render_setup_done();
  } else {
    await render_setup_dialog();
  }

})();
