/* Business Source License 1.0 © 2016 FlowCrypt Limited (tom@cryptup.org). Use limitations apply. This version will change to GPLv3 on 2020-01-01. See https://github.com/CryptUp/cryptup-browser/tree/master/src/LICENCE */

'use strict';

let url_params = tool.env.url_params(['account_email', 'action', 'parent_tab_id']);

if(url_params.account_email) {
  tool.browser.message.send(null, 'update_uninstall_url');
}

$('.email-address').text(url_params.account_email);
$('.back').css('visibility', 'hidden');
tool.ui.passphrase_toggle(['step_2b_manual_enter_passphrase'], 'hide');
tool.ui.passphrase_toggle(['step_2a_manual_create_input_password', 'step_2a_manual_create_input_password2', 'recovery_pasword']);

let account_email_attested_fingerprint = undefined;
let recovered_keys = undefined;
let recovered_key_matching_passphrases = [];
let recovered_keys_longid_count = 0;
let recovered_keys_successful_longids = [];
let tab_id_global = undefined;
let all_addresses = [url_params.account_email];
let email_provider;

tool.browser.message.tab_id(function (tab_id) {
  tab_id_global = tab_id;

  tool.browser.message.listen({
    close_page: function () {
      $('.featherlight-close').click();
    },
    notification_show: function (data) {
      alert(data.notification);
    },
  }, tab_id_global);
});

// show alternative account addresses in setup form + save them for later
window.flowcrypt_storage.get(url_params.account_email, ['addresses', 'google_token_scopes', 'email_provider'], storage => {
  if(storage.email_provider === 'gmail') {
    if(!tool.api.gmail.has_scope(storage.google_token_scopes, 'read')) {
      $('.auth_denied_warning').css('display', 'block');
    }
    if(typeof storage.addresses === 'undefined') {
      if(tool.api.gmail.has_scope(storage.google_token_scopes, 'read')) {
        fetch_account_aliases_from_gmail(url_params.account_email, save_and_fill_submit_option);
      } else { // cannot read emails, don't fetch alternative addresses
        save_and_fill_submit_option([url_params.account_email]);
      }
    } else {
      show_submit_all_addresses_option(storage.addresses);
    }
  }
});

function show_submit_all_addresses_option(addrs) {
  if(addrs && addrs.length > 1) {
    $('.addresses').text(tool.arr.without_value(addrs, url_params.account_email).join(', '));
    $('.manual .input_submit_all').prop({ checked: true, disabled: false }).closest('div.line').css('visibility', 'visible');
  }
}

function save_and_fill_submit_option(addresses) {
  all_addresses = tool.arr.unique(addresses.concat(url_params.account_email));
  window.flowcrypt_storage.set(url_params.account_email, { addresses: all_addresses }, function () {
    show_submit_all_addresses_option(all_addresses);
  });
}

function display_block(name) {
  let blocks = [
    'loading',
    'step_0_found_key',
    'step_1_easy_or_manual',
    'step_2a_manual_create', 'step_2b_manual_enter', 'step_2_easy_generating', 'step_2_recovery',
    'step_3_test_failed',
    'step_4_more_to_recover',
    'step_4_done',
    'step_4_close',
  ];
  if(name) { //set
    $('#' + blocks.join(', #')).css('display', 'none');
    $('#' + name).css('display', 'block');
    $('.back').css('visibility', tool.value(name).in(['step_2b_manual_enter', 'step_2a_manual_create']) ? 'visible' : 'hidden');
    if(name === 'step_2_recovery') {
      $('.backups_count_words').text(recovered_keys.length > 1 ? recovered_keys.length + ' backups' : 'a backup')
    }
  } else { //get
    return $('#' + blocks.join(', #')).filter(':visible').first().attr('id') || null;
  }
}

function setup_dialog_init() { // todo - handle network failure on init. loading
  $('h1').text('Set Up CryptUp');
  if(!url_params.account_email) {
    window.location = 'index.htm';
  }
  window.flowcrypt_storage.db_open(function (db) {
    if(db === window.flowcrypt_storage.db_private_mode_error) {
      $('#loading').text('CryptUp does not work in Private Browsing Mode. Please use it in a standard browser window.');
    } else {
      window.flowcrypt_storage.get(url_params.account_email, ['setup_done', 'key_backup_prompt', 'setup_simple', 'key_backup_method', 'email_provider', 'google_token_scopes', 'microsoft_auth'], storage => {
        email_provider = storage.email_provider || 'gmail';

        if(storage.setup_done) {
          if(url_params.action !== 'add_key') {
            render_setup_done(url_params.account_email);
          } else {
            prepare_and_render_add_key_from_backup();
          }
        } else {
          tool.api.attester.lookup_email(url_params.account_email).done((keyserver_success, keyserver_result) => {
            if(keyserver_success && keyserver_result && keyserver_result.pubkey) {
              if(keyserver_result.attested) {
                account_email_attested_fingerprint = tool.crypto.key.fingerprint(keyserver_result.pubkey);
              }
              if(email_provider === 'gmail' && tool.api.gmail.has_scope(storage.google_token_scopes, 'read')) {
                tool.api.gmail.fetch_key_backups(url_params.account_email, function (success, keys) {
                  if(success && keys) {
                    recovered_keys = keys;
                    recovered_keys_longid_count = tool.arr.unique(recovered_keys.map(tool.crypto.key.longid)).length;
                    display_block('step_2_recovery');
                  } else {
                    display_block('step_0_found_key');
                  }
                });
              } else { // cannot read gmail to find a backup, or this is outlook
                if(keyserver_result.has_cryptup) {
                  display_block('step_2b_manual_enter');
                  $('#step_2b_manual_enter').prepend('<div class="line red">CryptUp can\'t locate your backup automatically.</div><div class="line">Find "Your CryptUp Backup" email, open the attachment, copy all text and paste it below.<br/><br/></div>');
                } else {
                  display_block('step_1_easy_or_manual');
                }
              }
            } else {
              display_block('step_1_easy_or_manual');
            }
          });
        }
      });
    }
  });
}

function prepare_and_render_add_key_from_backup() { // at this point, account is already set up, and this page is showing in a lightbox after selecting "from backup" in add_key.htm
  $('.profile-row, .skip_recover_remaining, .action_send, .action_account_settings, .action_skip_recovery').css({display: 'none', visibility: 'hidden', opacity: 0});
  $('h1').parent().html('<h1>Recover key from backup</h1>');
  $('.action_recover_account').text('load key from backup');
  tool.api.gmail.fetch_key_backups(url_params.account_email, function (success, keys) {
    if(success && keys) {
      recovered_keys = keys;
      recovered_keys_longid_count = tool.arr.unique(recovered_keys.map(tool.crypto.key.longid)).length;
      recovered_keys_successful_longids = window.flowcrypt_storage.keys_get(url_params.account_email).map(ki => ki.longid);
      render_setup_done(url_params.account_email);
      $('#step_4_more_to_recover .action_recover_remaining').click();
    } else {
      window.location = tool.env.url_create('modules/add_key.htm', {account_email: url_params.account_email, parent_tab_id: url_params.parent_tab_id});
    }
  });
}

// options: {submit_main, submit_all}
function submit_public_key_if_needed(account_email, armored_pubkey, options, callback) {
  window.flowcrypt_storage.get(account_email, ['addresses'], storage => {
    if(options.submit_main) {
      tool.api.attester.test_welcome(account_email, armored_pubkey).validate(r => r.sent).catch(error => catcher.report('tool.api.attester.test_welcome: failed', error));
      let addresses;
      if(typeof storage.addresses !== 'undefined' && storage.addresses.length > 1 && options.submit_all) {
        addresses = storage.addresses.concat(account_email);
      } else {
        addresses = [account_email];
      }
      if(account_email_attested_fingerprint && account_email_attested_fingerprint !== tool.crypto.key.fingerprint(armored_pubkey)) {
        // already submitted and ATTESTED another pubkey for this email
        callback();
      } else {
        submit_pubkeys(addresses, armored_pubkey, function (success) {
          if(success) {
            window.flowcrypt_storage.restricted_set('local', account_email, 'master_public_key_submitted', true);
          }
          callback();
        });
      }
    } else {
      tool.api.attester.lookup_email(account_email).done((success, result) => {
        if(success && result && result.pubkey && tool.crypto.key.fingerprint(result.pubkey) !== null && tool.crypto.key.fingerprint(result.pubkey) === tool.crypto.key.fingerprint(armored_pubkey)) {
          window.flowcrypt_storage.restricted_set('local', account_email, 'master_public_key_submitted', true);  // pubkey with the same fingerprint was submitted to keyserver previously, or was found on PKS
        }
        callback();
      });
    }
  });
}

function render_setup_done(account_email, key_backup_prompt) {
  if(key_backup_prompt) {
    window.location = tool.env.url_create('modules/backup.htm', { action: 'setup', account_email: account_email });
  } else {
    if (recovered_keys_longid_count > window.flowcrypt_storage.keys_get(account_email).length) { // recovery where not all keys were processed: some may have other pass phrase
      display_block('step_4_more_to_recover');
      $('h1').text('More keys to recover');
      $('.email').text(account_email);
      $('.private_key_count').text(window.flowcrypt_storage.keys_get(account_email).length);
      $('.backups_count').text(recovered_keys.length);
    } else { // successful and complete setup
      display_block(url_params.action !== 'add_key' ? 'step_4_done' : 'step_4_close');
      $('h1').text(url_params.action !== 'add_key' ? 'You\'re all set!' : 'Recovered all keys!');
      $('.email').text(account_email);
    }
  }
}

// options: {submit_main, submit_all, setup_simple, key_backup_prompt}
function finalize_setup(account_email, armored_pubkey, options) {
  submit_public_key_if_needed(account_email, armored_pubkey, options, function () {
    tool.env.increment('setup');
    let storage = {
      setup_date: Date.now(),
      setup_done: true,
      cryptup_enabled: true,
      setup_simple: options.setup_simple,
      key_backup_prompt: options.key_backup_prompt,
      is_newly_created_key: options.is_newly_created_key === true,
    };
    window.flowcrypt_storage.set(account_email, storage, function () {
      render_setup_done(account_email, options.key_backup_prompt);
    });
  });
}

function save_keys(account_email, prvs, options, callback) {
  window.flowcrypt_storage.restricted_set(options.passphrase_save ? 'local' : 'session', account_email, 'master_passphrase', options.passphrase || '');
  window.flowcrypt_storage.restricted_set('local', account_email, 'master_passphrase_needed', Boolean(options.passphrase || ''));
  window.flowcrypt_storage.restricted_set('local', account_email, 'master_public_key_submit', options.submit_main);
  window.flowcrypt_storage.restricted_set('local', account_email, 'master_public_key_submitted', false);
  for(let i = 0; i < prvs.length; i++) { // save all keys
    window.flowcrypt_storage.keys_add(account_email, prvs[i].armor());
    window.flowcrypt_storage.passphrase_save(options.passphrase_save ? 'local' : 'session', account_email, tool.crypto.key.longid(prvs[i]), options.passphrase);
  }
  let contacts = [];
  tool.each(all_addresses, function (i, address) {
    let attested = (address === url_params.account_email && account_email_attested_fingerprint && account_email_attested_fingerprint !== tool.crypto.key.fingerprint(prvs[0].toPublic().armor()));
    contacts.push(window.flowcrypt_storage.db_contact_object(address, options.full_name, 'cryptup', prvs[0].toPublic().armor(), attested, false, Date.now()));
  });
  window.flowcrypt_storage.db_open(function (db) {
    window.flowcrypt_storage.db_contact_save(db, contacts, callback);
  });
}

function create_save_key_pair(account_email, options) {
  openpgp.generateKey({
    numBits: 4096,
    userIds: [{ name: options.full_name, email: account_email }], // todo - add all addresses?
    passphrase: options.passphrase,
  }).then(key => {
    options.is_newly_created_key = true;
    let prv = openpgp.key.readArmored(key.privateKeyArmored).keys[0];
    test_private_key_and_handle(url_params.account_email, prv, options, function () {
      save_keys(account_email, [prv], options, function () {
        finalize_setup(account_email, key.publicKeyArmored, options);
      });
    });
  }).catch(error => {
    catcher.handle_exception(error);
    $('#step_2_easy_generating, #step_2a_manual_create').html('CryptUp didn\'t set up properly due to en error.<br/><br/>Please write me at tom@cryptup.org so that I can fix it ASAP.');
  });
}

function get_and_save_google_user_info(account_email, callback) {
  let result = { full_name: '' };
  if(email_provider === 'gmail') {
    tool.api.google.user_info(account_email, function (success, response) {
      if(success) {
        result.full_name = response.name || '';
        result.gender = response.gender;
        result.locale = response.locale;
        result.picture = response.picture;
        window.flowcrypt_storage.set(account_email, result, function () {
          callback(result);
        });
      } else { // todo - will result in missing name in pubkey, and should have better handling (already happens at times)
        callback(result);
      }
    });
  } else { // todo - find alternative way to do this for outlook - at least get name from sent emails
    callback(result);
  }
}

$('.action_show_help').click(function () {
  show_settings_page('/chrome/settings/modules/help.htm');
});

$('.action_simple_setup').click(function () {
  if($(this).parents('.manual').length) {
    if(!confirm('This sets up your account automatically. Great choice for most users.')) {
      return;
    }
  }
  display_block('step_2_easy_generating');
  $('h1').text('Please wait, setting up CryptUp');
  get_and_save_google_user_info(url_params.account_email, function (userinfo) {
    create_save_key_pair(url_params.account_email, {
      full_name: userinfo.full_name,
      passphrase: '',
      passphrase_save: true,
      submit_main: true,
      submit_all: true,
      setup_simple: true,
      key_backup_prompt: Date.now(),
    });
  });
});

$('.back').off().click(function () {
  $('h1').text('Set Up');
  display_block('step_1_easy_or_manual');
});

$('#step_2_recovery .action_recover_account').click(tool.ui.event.prevent(tool.ui.event.double(), function (self) {
  let passphrase = $('#recovery_pasword').val();
  let matching_keys = [];
  if(passphrase && tool.value(passphrase).in(recovered_key_matching_passphrases)) {
    alert('This pass phrase was already successfully used to recover some of your backups.\n\nThe remaining backups use a different pass phrase.\n\nPlease try another one.\n\nYou can skip this step, but some of your encrypted email may not be readable.');
  } else if(passphrase) {
    tool.each(recovered_keys, function (i, recovered_key) {
      let longid = tool.crypto.key.longid(recovered_key);
      let armored = recovered_key.armor();
      if(!tool.value(longid).in(recovered_keys_successful_longids) && tool.crypto.key.decrypt(recovered_key, passphrase).success) {
        recovered_keys_successful_longids.push(longid);
        matching_keys.push(openpgp.key.readArmored(armored).keys[0]);
      }
    });
    if(matching_keys.length) {
      let options = {
        submit_main: false, // todo - think about submitting when recovering
        submit_all: false,
        passphrase: passphrase,
        passphrase_save: true, //todo - think about saving passphrase when recovering
        setup_simple: true,
        key_backup_prompt: false,
        recovered: true,
      };
      recovered_key_matching_passphrases.push(passphrase);
      save_keys(url_params.account_email, matching_keys, options, function () {
        window.flowcrypt_storage.get(url_params.account_email, ['setup_done'], storage => {
          if(!storage.setup_done) { // normal situation
            finalize_setup(url_params.account_email, matching_keys[0].toPublic().armor(), options);
          } else { // setup was finished before, just added more keys now
            render_setup_done(url_params.account_email, options.key_backup_prompt);
          }
        });
      });
    } else {
      if(recovered_keys.length > 1) {
        alert('This password did not match any of your ' + recovered_keys.length + ' backups. Please try again.');
      } else {
        alert('This password did not match your original setup. Please try again.');
      }
      $('.line_skip_recovery').css('display', 'block');
    }
  } else {
    alert('Please enter the password you used when you first set up CryptUp, so that we can recover your original keys.');
  }
}));

$('#step_4_more_to_recover .action_recover_remaining').click(function () {
  display_block('step_2_recovery');
  $('#recovery_pasword').val('');
  let got = window.flowcrypt_storage.keys_get(url_params.account_email).length;
  let bups = recovered_keys.length;
  let left = (bups - got > 1) ? 'are ' + (bups - got) + ' backups' : 'is one backup';
  if(url_params.action !== 'add_key') {
    $('#step_2_recovery .recovery_status').html('You successfully recovered ' + got + ' of ' + bups + ' backups. There ' + left + ' left.<br><br>Try a different pass phrase to unlock all backups.');
    $('#step_2_recovery .line_skip_recovery').replaceWith(tool.e('div', {class: 'line', html: tool.e('a', {href: '#', class: 'skip_recover_remaining', html: 'Skip this step'})}));
    $('#step_2_recovery .skip_recover_remaining').click(function () {
      window.location = tool.env.url_create('index.htm', { account_email: url_params.account_email });
    });
  } else {
    $('#step_2_recovery .recovery_status').html('There ' + left + ' left to recover.<br><br>Try different pass phrases to unlock all backups.');
    $('#step_2_recovery .line_skip_recovery').css('display', 'none');
  }
});

$('.action_skip_recovery').click(function () {
  if(confirm('Your account will be set up for encryption again, but your previous encrypted emails will be unreadable. You will need to inform your encrypted contacts that you have a new key. Regular email will not be affected. Are you sure?')) {
    recovered_keys = undefined;
    recovered_key_matching_passphrases = [];
    recovered_keys_longid_count = 0;
    recovered_keys_successful_longids = [];
    display_block('step_1_easy_or_manual');
  }
});

$('.action_send').click(function () {
  window.location = tool.env.url_create('index.htm', { account_email: url_params.account_email, page: '/chrome/elements/compose.htm' });
});

$('.action_account_settings').click(function () {
  window.location = tool.env.url_create('index.htm', { account_email: url_params.account_email });
});

$('.action_go_auth_denied').click(function () {
  window.location = tool.env.url_create('index.htm', { account_email: url_params.account_email, page: '/chrome/settings/modules/auth_denied.htm' });
});

$('.input_submit_key').click(function () {
  let input_submit_all = $(this).closest('.manual').find('.input_submit_all').first();
  if($(this).prop('checked')) {
    if(input_submit_all.closest('div.line').css('visibility') === 'visible') {
      input_submit_all.prop({ checked: true, disabled: false });
    }
  } else {
    input_submit_all.prop({ checked: false, disabled: true });
  }
});

$('#step_0_found_key .action_manual_create_key, #step_1_easy_or_manual .action_manual_create_key').click(function () {
  display_block('step_2a_manual_create');
});

$('#step_0_found_key .action_manual_enter_key, #step_1_easy_or_manual .action_manual_enter_key').click(function () {
  display_block('step_2b_manual_enter');
});

$('#step_3_test_failed .action_diagnose_browser').one('click', function () {
  $(this).html('Disagnosing.. ' + tool.ui.spinner('white'));
  openpgp.generateKey({ // create a bogus key for testing and diagnosis
    numBits: 4096,
    userIds: [{ name: 'pass phrase is stockholm', email: 'bad@key.com', }],
    passphrase: 'stockholm',
  }).then(function (key) {
    let armored = openpgp.key.readArmored(key.privateKeyArmored).keys[0].armor();
    tool.crypto.key.test(armored, 'stockholm', function (key_works, error_message) {
      catcher.report(key_works ? 'Test passed' : 'Test failed with error: ' + error_message, tool.str.base64url_encode(url_params.account_email + ', ' + (error_message || 'pass') + '\n\n' + armored));
      setTimeout(function () {
        $('#step_3_test_failed .action_diagnose_browser').replaceWith('<div class="line"><b>Thank you! I will let you know when this has been resolved.</b></div>');
      }, 5000);
    });
  }).catch(function (exception) {
    catcher.handle_exception(exception);
  });
});

function test_private_key_and_handle(account_email, key, options, success_callback) {
  tool.crypto.key.test(key.armor(), options.passphrase, function (key_works, error) {
    if(key_works) {
      success_callback();
    } else {
      console.log(error);
      $('h1').text('Browser incompatibility discovered');
      display_block('step_3_test_failed');
    }
  });
}

$('#step_2b_manual_enter .action_save_private').click(function () {
  let normalized_armored_key = tool.crypto.key.normalize($('#step_2b_manual_enter .input_private_key').val());
  let prv = openpgp.key.readArmored(normalized_armored_key).keys[0];
  let passphrase = $('#step_2b_manual_enter .input_passphrase').val();
  let prv_headers = tool.crypto.armor.headers('private_key');
  if(typeof prv === 'undefined') {
    alert('Private key is not correctly formated. Please insert complete key, including "' + prv_headers.begin + '" and "' + prv_headers.end + '"');
  } else if(prv.isPublic()) {
    alert('This was a public key. Please insert a private key instead. It\'s a block of text starting with "' + prv_headers.begin + '"');
  } else {
    let decrypt_result = tool.crypto.key.decrypt(openpgp.key.readArmored(normalized_armored_key).keys[0], passphrase);
    if(decrypt_result.error) {
      alert('CryptUp doesn\'t support this type of key yet. Please write me at tom@cryptup.org, so that I can add support soon. I\'m EXTREMELY prompt to fix things.\n\n(' + decrypt_result.error + ')');
    } else if (decrypt_result.success) {
      if(prv.getEncryptionKeyPacket() !== null) {
        $('#step_2b_manual_enter .action_save_private').html(tool.ui.spinner('white'));
        let options = {
          passphrase: passphrase,
          setup_simple: false,
          key_backup_prompt: false,
          submit_main: $('#step_2b_manual_enter .input_submit_key').prop('checked'),
          submit_all: $('#step_2b_manual_enter .input_submit_all').prop('checked'),
          passphrase_save: $('#step_2b_manual_enter .input_passphrase_save').prop('checked'),
          recovered: false,
        };
        save_keys(url_params.account_email, [prv], options, function () {
          finalize_setup(url_params.account_email, prv.toPublic().armor(), options);
        });
      } else {
        alert('This looks like a valid key but it cannot be used for encryption. Please write me at tom@cryptup.org to see why is that. I\'m VERY prompt to respond.');
      }
    } else {
      alert('Passphrase does not match the private key. Please try to enter the passphrase again.');
      $('#step_2b_manual_enter .input_passphrase').val('');
      $('#step_2b_manual_enter .input_passphrase').focus();
    }
  }
});

$('#step_2a_manual_create .input_password').on('keyup', tool.ui.event.prevent(tool.ui.event.spree(), function () {
  evaluate_password_strength('#step_2a_manual_create', '.input_password', '.action_create_private');
}));

$('#step_2a_manual_create .action_create_private').click(tool.ui.event.prevent(tool.ui.event.double(), function () {
  if(!$('#step_2a_manual_create .input_password').val()) {
    alert('Pass phrase is needed to protect your private email. Please enter a pass phrase.');
    $('#step_2a_manual_create .input_password').focus();
  } else if($('#step_2a_manual_create .action_create_private').hasClass('gray')) {
    alert('Pass phrase is not strong enough. Please make it stronger, by adding a few words.');
    $('#step_2a_manual_create .input_password').focus();
  } else if($('#step_2a_manual_create .input_password').val() !== $('#step_2a_manual_create .input_password2').val()) {
    alert('The pass phrases do not match. Please try again.');
    $('#step_2a_manual_create .input_password2').val('');
    $('#step_2a_manual_create .input_password2').focus();
  } else {
    $('h1').text('Please wait, setting up CryptUp');
    $('#step_2a_manual_create input').prop('disabled', true);
    $('#step_2a_manual_create .action_create_private').html(tool.ui.spinner('white') + 'just a minute');
    get_and_save_google_user_info(url_params.account_email, function (userinfo) {
      create_save_key_pair(url_params.account_email, {
        full_name: userinfo.full_name,
        passphrase: $('#step_2a_manual_create .input_password').val(),
        passphrase_save: $('#step_2a_manual_create .input_passphrase_save').prop('checked'),
        submit_main: $('#step_2a_manual_create .input_submit_key').prop('checked'),
        submit_all: $('#step_2a_manual_create .input_submit_all').prop('checked'),
        setup_simple: false,
        key_backup_prompt: Date.now(),
        recovered: false,
      });
    });
  }
}));

$('#step_4_close .action_close').click(function () {
  tool.browser.message.send(url_params.parent_tab_id, 'redirect', {location: tool.env.url_create('index.htm', {account_email: url_params.account_email, advanced: true})});
});

setup_dialog_init();
