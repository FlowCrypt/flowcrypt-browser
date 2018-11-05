/* © 2016-2018 FlowCrypt Limited. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Store } from '../../js/common/store.js';
import { Value } from '../../js/common/common.js';
import { Xss, Ui, KeyImportUi, UserAlert, KeyCanBeFixed, Env } from '../../js/common/browser.js';
import { BrowserMsg } from '../../js/common/extension.js';
import { Rules } from '../../js/common/rules.js';
import { Lang } from '../../js/common/lang.js';
import { Settings } from '../../js/common/settings.js';
import { Api, R } from '../../js/common/api.js';
import { Pgp } from '../../js/common/pgp.js';
import { Catch } from '../../js/common/catch.js';

declare const openpgp: typeof OpenPGP;

interface SetupOptions {
  full_name: string;
  passphrase: string;
  passphrase_save: boolean;
  submit_main: boolean;
  submit_all: boolean;
  setup_simple: boolean;
  key_backup_prompt: number | boolean;
  recovered?: boolean;
  is_newly_created_key: boolean;
}

Catch.try(async () => {

  const uncheckedUrlParams = Env.urlParams(['acctEmail', 'action', 'parentTabId']);
  const acctEmail = Env.urlParamRequire.string(uncheckedUrlParams, 'acctEmail');
  let parentTabId: string | null = null;
  const action = Env.urlParamRequire.oneof(uncheckedUrlParams, 'action', ['add_key', 'finalize', undefined]) as 'add_key' | 'finalize' | undefined;
  if (action === 'add_key') {
    parentTabId = Env.urlParamRequire.string(uncheckedUrlParams, 'parentTabId');
  }

  if (acctEmail) {
    BrowserMsg.send(null, 'update_uninstall_url');
  } else {
    window.location.href = 'index.htm';
    return;
  }

  $('h1').text('Set Up FlowCrypt');
  $('.email-address').text(acctEmail);
  $('.back').css('visibility', 'hidden');
  await Ui.passphraseToggle(['step_2b_manual_enter_passphrase'], 'hide');
  await Ui.passphraseToggle(['step_2a_manual_create_input_password', 'step_2a_manual_create_input_password2', 'recovery_pasword']);

  const storage = await Store.getAcct(acctEmail, [
    'setup_done', 'key_backup_prompt', 'email_provider', 'google_token_scopes', 'microsoft_auth', 'addresses',
  ]);

  storage.email_provider = storage.email_provider || 'gmail';
  let acctEmailAttestedFingerprint: string | null = null;
  let recoveredKeys: OpenPGP.key.Key[] = [];
  let recoveredKeysMatchingPassphrases: string[] = [];
  let nRecoveredKeysLongid = 0;
  let recoveredKeysSuccessfulLongids: string[] = [];
  let allAddrs: string[] = [acctEmail];

  const rules = new Rules(acctEmail);
  if (!rules.canCreateKeys()) {
    const forbidden = `${Lang.setup.creatingKeysNotAllowedPleaseImport} <a href="${Xss.escape(window.location.href)}">Back</a>`;
    Xss.sanitizeRender('#step_2a_manual_create, #step_2_easy_generating', `<div class="aligncenter"><div class="line">${forbidden}</div></div>`);
    $('.back').remove(); // back button would allow users to choose other options (eg create - not allowed)
  }

  const keyImportUi = new KeyImportUi({ checkEncryption: true });
  keyImportUi.initPrvImportSrcForm(acctEmail, parentTabId); // for step_2b_manual_enter, if user chooses so
  keyImportUi.onBadPassphrase = () => $('#step_2b_manual_enter .input_passphrase').val('').focus();

  const tabId = await BrowserMsg.requiredTabId();
  BrowserMsg.listen({
    close_page: () => {
      $('.featherlight-close').click();
    },
    notification_show: (data: { notification: string }) => {
      alert(data.notification);
    },
  }, tabId);

  const showSubmitAllAddrsOption = (addrs: string[]) => {
    if (addrs && addrs.length > 1) {
      $('.addresses').text(Value.arr.withoutVal(addrs, acctEmail).join(', '));
      $('.manual .input_submit_all').prop({ checked: true, disabled: false }).closest('div.line').css('display', 'block');
    }
  };

  const saveAndFillSubmitOption = async (addresses: string[]) => {
    allAddrs = Value.arr.unique(addresses.concat(acctEmail));
    await Store.set(acctEmail, { addresses: allAddrs });
    showSubmitAllAddrsOption(allAddrs);
  };

  const displayBlock = (name: string) => {
    const blocks = [
      'loading',
      'step_0_found_key',
      'step_1_easy_or_manual',
      'step_2a_manual_create', 'step_2b_manual_enter', 'step_2_easy_generating', 'step_2_recovery',
      'step_3_compatibility_fix',
      'step_4_more_to_recover',
      'step_4_done',
      'step_4_close',
    ];
    if (name) {
      $('#' + blocks.join(', #')).css('display', 'none');
      $('#' + name).css('display', 'block');
      $('.back').css('visibility', Value.is(name).in(['step_2b_manual_enter', 'step_2a_manual_create']) ? 'visible' : 'hidden');
      if (name === 'step_2_recovery') {
        $('.backups_count_words').text(recoveredKeys.length > 1 ? recoveredKeys.length + ' backups' : 'a backup');
      }
    }
  };

  const renderSetupDialog = async (): Promise<void> => {
    let keyserverRes, fetchedKeys;

    try {
      const r = await Api.attester.lookupEmail([acctEmail]);
      keyserverRes = r.results[0];
    } catch (e) {
      return await Settings.promptToRetry('REQUIRED', e, Lang.setup.missingConnectionToCheckEncryption, () => renderSetupDialog());
    }

    if (keyserverRes.pubkey) {
      if (keyserverRes.attested) {
        acctEmailAttestedFingerprint = Pgp.key.fingerprint(keyserverRes.pubkey);
      }
      if (!rules.canBackupKeys()) {
        // they already have a key recorded on attester, but no backups allowed on the domain. They should enter their prv manually
        displayBlock('step_2b_manual_enter');
      } else if (storage.email_provider === 'gmail' && Api.gmail.hasScope(storage.google_token_scopes as string[], 'read')) {
        try {
          fetchedKeys = await Api.gmail.fetchKeyBackups(acctEmail);
        } catch (e) {
          return await Settings.promptToRetry('REQUIRED', e, 'Failed to check for account backups.\nThis is probably due to internet connection.', () => renderSetupDialog());
        }
        if (fetchedKeys.length) {
          recoveredKeys = fetchedKeys;
          nRecoveredKeysLongid = Value.arr.unique(recoveredKeys.map(Pgp.key.longid)).length;
          displayBlock('step_2_recovery');
        } else {
          displayBlock('step_0_found_key');
        }
      } else { // cannot read gmail to find a backup, or this is outlook
        if (keyserverRes.has_cryptup) {
          // a key has been created, and the user has used cryptup in the past - this suggest they likely have a backup available, but we cannot fetch it. Enter it manually
          displayBlock('step_2b_manual_enter');
          Xss.sanitizePrepend('#step_2b_manual_enter', `<div class="line red">${Lang.setup.cannotLocateBackupPasteManually}<br/><br/></div>`);
        } else if (rules.canCreateKeys()) {
          // has a key registered, key creating allowed on the domain. This may be old key from PKS, const them choose
          displayBlock('step_1_easy_or_manual');
        } else {
          // has a key registered, no key creating allowed on the domain
          displayBlock('step_2b_manual_enter');
        }
      }
    } else { // no indication that the person used pgp before
      if (rules.canCreateKeys()) {
        displayBlock('step_1_easy_or_manual');
      } else {
        displayBlock('step_2b_manual_enter');
      }
    }
  };

  const renderAddKeyFromBackup = async () => { // at this point, account is already set up, and this page is showing in a lightbox after selecting "from backup" in add_key.htm
    let fetchedKeys;
    $('.profile-row, .skip_recover_remaining, .action_send, .action_account_settings, .action_skip_recovery').css({ display: 'none', visibility: 'hidden', opacity: 0 });
    Xss.sanitizeRender($('h1').parent(), '<h1>Recover key from backup</h1>');
    $('.action_recover_account').text('load key from backup');
    try {
      fetchedKeys = await Api.gmail.fetchKeyBackups(acctEmail);
    } catch (e) {
      window.location.href = Env.urlCreate('modules/add_key.htm', { acctEmail, parentTabId });
      return;
    }
    if (fetchedKeys.length) {
      recoveredKeys = fetchedKeys;
      nRecoveredKeysLongid = Value.arr.unique(recoveredKeys.map(Pgp.key.longid)).length;
      const storedKeys = await Store.keysGet(acctEmail);
      recoveredKeysSuccessfulLongids = storedKeys.map(ki => ki.longid);
      await renderSetupDone();
      $('#step_4_more_to_recover .action_recover_remaining').click();
    } else {
      window.location.href = Env.urlCreate('modules/add_key.htm', { acctEmail, parentTabId });
    }
  };

  const submitPublicKeyIfNeeded = async (armoredPubkey: string, options: { submit_main: boolean, submit_all: boolean }) => {
    const storage = await Store.getAcct(acctEmail, ['addresses']);
    if (!options.submit_main) {
      return;
    }
    Api.attester.testWelcome(acctEmail, armoredPubkey).catch(error => Catch.report('Api.attester.test_welcome: failed', error));
    let addresses;
    if (typeof storage.addresses !== 'undefined' && storage.addresses.length > 1 && options.submit_all) {
      addresses = storage.addresses.concat(acctEmail);
    } else {
      addresses = [acctEmail];
    }
    if (acctEmailAttestedFingerprint && acctEmailAttestedFingerprint !== Pgp.key.fingerprint(armoredPubkey)) {
      return; // already submitted and ATTESTED another pubkey for this email
    }
    await Settings.submitPubkeys(acctEmail, addresses, armoredPubkey);
  };

  const renderSetupDone = async () => {
    const storedKeys = await Store.keysGet(acctEmail);
    if (nRecoveredKeysLongid > storedKeys.length) { // recovery where not all keys were processed: some may have other pass phrase
      displayBlock('step_4_more_to_recover');
      $('h1').text('More keys to recover');
      $('.email').text(acctEmail);
      $('.private_key_count').text(storedKeys.length);
      $('.backups_count').text(recoveredKeys.length);
    } else { // successful and complete setup
      displayBlock(action !== 'add_key' ? 'step_4_done' : 'step_4_close');
      $('h1').text(action !== 'add_key' ? 'You\'re all set!' : 'Recovered all keys!');
      $('.email').text(acctEmail);
    }
  };

  const preFinalizeSetup = async (options: SetupOptions): Promise<void> => {
    await Store.set(acctEmail, {
      tmp_submit_main: options.submit_main,
      tmp_submit_all: options.submit_all,
      setup_simple: options.setup_simple,
      key_backup_prompt: options.key_backup_prompt,
      is_newly_created_key: options.is_newly_created_key,
    });
  };

  const finalizeSetup = async ({ submit_main, submit_all }: { submit_main: boolean, submit_all: boolean }): Promise<void> => {
    const [primaryKi] = await Store.keysGet(acctEmail, ['primary']);
    Settings.abortAndRenderErrorIfKeyinfoEmpty(primaryKi);
    try {
      await submitPublicKeyIfNeeded(primaryKi.public, { submit_main, submit_all });
    } catch (e) {
      return await Settings.promptToRetry('REQUIRED', e, 'Failed to submit to Attester.\nThis may be due to internet connection issue.', () => finalizeSetup({ submit_main, submit_all }));
    }
    await Store.set(acctEmail, {
      setup_date: Date.now(),
      setup_done: true,
      cryptup_enabled: true,
    });
    await Store.remove(acctEmail, ['tmp_submit_main', 'tmp_submit_all']);
  };

  const saveKeys = async (prvs: OpenPGP.key.Key[], options: SetupOptions) => {
    for (const prv of prvs) {
      const longid = Pgp.key.longid(prv);
      if (!longid) {
        alert('Cannot save keys to storage because at least one of them is not valid.');
        return;
      }
      await Store.keysAdd(acctEmail, prv.armor());
      await Store.passphraseSave(options.passphrase_save ? 'local' : 'session', acctEmail, longid, options.passphrase);
    }
    const myOwnEmailAddrsAsContacts = allAddrs.map(a => {
      const attested = Boolean(a === acctEmail && acctEmailAttestedFingerprint && acctEmailAttestedFingerprint !== Pgp.key.fingerprint(prvs[0].toPublic().armor()));
      return Store.dbContactObj(a, options.full_name, 'cryptup', prvs[0].toPublic().armor(), attested, false, Date.now());
    });
    await Store.dbContactSave(null, myOwnEmailAddrsAsContacts);
  };

  const createSaveKeyPair = async (options: SetupOptions) => {
    Settings.forbidAndRefreshPageIfCannot('CREATE_KEYS', rules);
    try {
      const key = await Pgp.key.create([{ name: options.full_name, email: acctEmail }], 4096, options.passphrase); // todo - add all addresses?
      options.is_newly_created_key = true;
      const prv = openpgp.key.readArmored(key.private).keys[0];
      await saveKeys([prv], options);
    } catch (e) {
      Catch.handleException(e);
      Xss.sanitizeRender('#step_2_easy_generating, #step_2a_manual_create', Lang.setup.fcDidntSetUpProperly);
    }
  };

  const getAndSaveGoogleUserInfo = async (): Promise<{ full_name: string, locale?: string, picture?: string }> => {
    if (storage.email_provider === 'gmail') { // todo - prompt user if cannot find his name. Maybe pull a few sent emails and const the user choose
      let me: R.GooglePlusPeopleMe;
      try {
        me = await Api.google.plus.peopleMe(acctEmail);
      } catch (e) {
        Catch.handleException(e);
        return { full_name: '' };
      }
      const result = { full_name: me.displayName || '', locale: me.language, picture: me.image.url };
      await Store.set(acctEmail, result);
      return result;
    } else {
      return { full_name: '' };
    }
  };

  $('.action_show_help').click(Ui.event.handle(() => Settings.renderSubPage(acctEmail, tabId, '/chrome/settings/modules/help.htm')));

  $('.back').off().click(Ui.event.handle(() => {
    $('h1').text('Set Up');
    displayBlock('step_1_easy_or_manual');
  }));

  $('#step_2_recovery .action_recover_account').click(Ui.event.prevent('double', async (self) => {
    const passphrase = $('#recovery_pasword').val() as string; // text input
    const matchingKeys: OpenPGP.key.Key[] = [];
    if (passphrase && Value.is(passphrase).in(recoveredKeysMatchingPassphrases)) {
      alert(Lang.setup.tryDifferentPassPhraseForRemainingBackups);
    } else if (passphrase) {
      for (const revoveredKey of recoveredKeys) {
        const longid = Pgp.key.longid(revoveredKey);
        const armored = revoveredKey.armor();
        if (longid && !Value.is(longid).in(recoveredKeysSuccessfulLongids) && await Pgp.key.decrypt(revoveredKey, [passphrase]) === true) {
          recoveredKeysSuccessfulLongids.push(longid);
          matchingKeys.push(openpgp.key.readArmored(armored).keys[0]);
        }
      }
      if (matchingKeys.length) {
        const options: SetupOptions = {
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
        recoveredKeysMatchingPassphrases.push(passphrase);
        await saveKeys(matchingKeys, options);
        const storage = await Store.getAcct(acctEmail, ['setup_done']);
        if (!storage.setup_done) { // normal situation - fresh setup
          await preFinalizeSetup(options);
          await finalizeSetup(options);
          await renderSetupDone();
        } else { // setup was finished before, just added more keys now
          await renderSetupDone();
        }
      } else {
        if (recoveredKeys.length > 1) {
          alert('This pass phrase did not match any of your ' + recoveredKeys.length + ' backups. Please try again.');
        } else {
          alert('This pass phrase did not match your original setup. Please try again.');
        }
        $('.line_skip_recovery').css('display', 'block');
      }
    } else {
      alert('Please enter the pass phrase you used when you first set up FlowCrypt, so that we can recover your original keys.');
    }
  }));

  $('#step_4_more_to_recover .action_recover_remaining').click(Ui.event.handle(async () => {
    displayBlock('step_2_recovery');
    $('#recovery_pasword').val('');
    const storedKeys = await Store.keysGet(acctEmail);
    const nGot = storedKeys.length;
    const nBups = recoveredKeys.length;
    const txtTeft = (nBups - nGot > 1) ? 'are ' + (nBups - nGot) + ' backups' : 'is one backup';
    if (action !== 'add_key') {
      Xss.sanitizeRender('#step_2_recovery .recovery_status', Lang.setup.nBackupsAlreadyRecoveredOrLeft(nGot, nBups, txtTeft));
      Xss.sanitizeReplace('#step_2_recovery .line_skip_recovery', Ui.e('div', { class: 'line', html: Ui.e('a', { href: '#', class: 'skip_recover_remaining', html: 'Skip this step' }) }));
      $('#step_2_recovery .skip_recover_remaining').click(Ui.event.handle(() => {
        window.location.href = Env.urlCreate('index.htm', { acctEmail });
      }));
    } else {
      Xss.sanitizeRender('#step_2_recovery .recovery_status', `There ${txtTeft} left to recover.<br><br>Try different pass phrases to unlock all backups.`);
      $('#step_2_recovery .line_skip_recovery').css('display', 'none');
    }
  }));

  $('.action_skip_recovery').click(Ui.event.handle(() => {
    if (confirm(Lang.setup.confirmSkipRecovery)) {
      recoveredKeys = [];
      recoveredKeysMatchingPassphrases = [];
      nRecoveredKeysLongid = 0;
      recoveredKeysSuccessfulLongids = [];
      displayBlock('step_1_easy_or_manual');
    }
  }));

  $('.action_send').click(Ui.event.handle(() => {
    window.location.href = Env.urlCreate('index.htm', { acctEmail, page: '/chrome/elements/compose.htm' });
  }));

  $('.action_account_settings').click(Ui.event.handle(() => {
    window.location.href = Env.urlCreate('index.htm', { acctEmail });
  }));

  $('.action_go_auth_denied').click(Ui.event.handle(() => {
    window.location.href = Env.urlCreate('index.htm', { acctEmail, page: '/chrome/settings/modules/auth_denied.htm' });
  }));

  $('.input_submit_key').click(Ui.event.handle(target => {
    const inputSubmitAll = $(target).closest('.manual').find('.input_submit_all').first();
    if ($(target).prop('checked')) {
      if (inputSubmitAll.closest('div.line').css('visibility') === 'visible') {
        inputSubmitAll.prop({ checked: true, disabled: false });
      }
    } else {
      inputSubmitAll.prop({ checked: false, disabled: true });
    }
  }));

  $('#step_0_found_key .action_manual_create_key, #step_1_easy_or_manual .action_manual_create_key').click(Ui.event.handle(() => displayBlock('step_2a_manual_create')));

  $('#step_0_found_key .action_manual_enter_key, #step_1_easy_or_manual .action_manual_enter_key').click(Ui.event.handle(() => displayBlock('step_2b_manual_enter')));

  $('#step_2b_manual_enter .action_save_private').click(Ui.event.handle(async () => {
    const options = {
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
      const checked = await keyImportUi.checkPrv(acctEmail, $('#step_2b_manual_enter .input_private_key').val() as string, options.passphrase);
      Xss.sanitizeRender('#step_2b_manual_enter .action_save_private', Ui.spinner('white'));
      await saveKeys([checked.encrypted], options);
      await preFinalizeSetup(options);
      await finalizeSetup(options);
      await renderSetupDone();
    } catch (e) {
      if (e instanceof UserAlert) {
        return alert(e.message);
      } else if (e instanceof KeyCanBeFixed) {
        return await renderCompatibilityFixBlockAndFinalizeSetup(e.encrypted, options);
      } else {
        Catch.handleException(e);
        return alert(`An error happened when processing the key: ${String(e)}\nPlease write at human@flowcrypt.com`);
      }
    }
  }));

  const renderCompatibilityFixBlockAndFinalizeSetup = async (origPrv: OpenPGP.key.Key, options: SetupOptions) => {
    displayBlock('step_3_compatibility_fix');
    let fixedPrv;
    try {
      fixedPrv = await Settings.renderPrvCompatFixUiAndWaitTilSubmittedByUser(acctEmail, '#step_3_compatibility_fix', origPrv, options.passphrase, window.location.href.replace(/#$/, ''));
    } catch (e) {
      Catch.handleException(e);
      alert(`Failed to fix key (${String(e)}). Please write us at human@flowcrypt.com, we are very prompt to fix similar issues.`);
      displayBlock('step_2b_manual_enter');
      return;
    }
    await saveKeys([fixedPrv], options);
    await preFinalizeSetup(options);
    await finalizeSetup(options);
    await renderSetupDone();
  };

  $('#step_2a_manual_create .input_password').on('keyup', Ui.event.prevent('spree', () => {
    Settings.renderPasswordStrength('#step_2a_manual_create', '.input_password', '.action_create_private');
  }));

  const isActionCreatePrivateFormInputCorrect = () => {
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

  $('#step_2a_manual_create .action_create_private').click(Ui.event.prevent('double', async () => {
    Settings.forbidAndRefreshPageIfCannot('CREATE_KEYS', rules);
    if (!isActionCreatePrivateFormInputCorrect()) {
      return;
    }
    try {
      $('#step_2a_manual_create input').prop('disabled', true);
      Xss.sanitizeRender('#step_2a_manual_create .action_create_private', Ui.spinner('white') + 'just a minute');
      const userinfo = await getAndSaveGoogleUserInfo();
      const options: SetupOptions = {
        full_name: userinfo.full_name,
        passphrase: $('#step_2a_manual_create .input_password').val() as string,
        passphrase_save: $('#step_2a_manual_create .input_passphrase_save').prop('checked'),
        submit_main: $('#step_2a_manual_create .input_submit_key').prop('checked'),
        submit_all: $('#step_2a_manual_create .input_submit_all').prop('checked'),
        key_backup_prompt: rules.canBackupKeys() ? Date.now() : false,
        recovered: false,
        setup_simple: $('#step_2a_manual_create .input_backup_inbox').prop('checked'),
        is_newly_created_key: true,
      };
      await createSaveKeyPair(options);
      await preFinalizeSetup(options);
      // only finalize after backup is done. backup.htm will redirect back to this page with ?action=finalize
      window.location.href = Env.urlCreate('modules/backup.htm', { action: 'setup', acctEmail });
    } catch (e) {
      Catch.handleException(e);
      alert(`There was an error, please try again.\n\n(${String(e)})`);
      $('#step_2a_manual_create .action_create_private').text('CREATE AND SAVE');
    }
  }));

  $('#step_2a_manual_create .action_show_advanced_create_settings').click(Ui.event.handle(target => {
    const advancedCreateSettings = $('#step_2a_manual_create .advanced_create_settings');
    const container = $('#step_2a_manual_create .advanced_create_settings_container');
    if (advancedCreateSettings.is(':visible')) {
      advancedCreateSettings.hide('fast');
      $(target).find('span').text('Show Advanced Settings');
      container.css('width', '360px');
    } else {
      advancedCreateSettings.show('fast');
      $(target).find('span').text('Hide Advanced Settings');
      container.css('width', 'auto');
    }
  }));

  $('#step_4_close .action_close').click(Ui.event.handle(() => { // only rendered if action=add_key which means parentTabId was used
    BrowserMsg.send(parentTabId, 'redirect', { location: Env.urlCreate('index.htm', { acctEmail, advanced: true }) });
  }));

  // show alternative account addresses in setup form + save them for later
  if (storage.email_provider === 'gmail') {
    if (!Api.gmail.hasScope(storage.google_token_scopes as string[], 'read')) {
      $('.auth_denied_warning').css('display', 'block');
    }
    if (typeof storage.addresses === 'undefined') {
      if (Api.gmail.hasScope(storage.google_token_scopes as string[], 'read')) {
        Settings.fetchAcctAliasesFromGmail(acctEmail).then(saveAndFillSubmitOption).catch(Catch.rejection);
      } else { // cannot read emails, don't fetch alternative addresses
        saveAndFillSubmitOption([acctEmail]).catch(Catch.rejection);
      }
    } else {
      showSubmitAllAddrsOption(storage.addresses as string[]);
    }
  }

  if (storage.setup_done) {
    if (action !== 'add_key') {
      await renderSetupDone();
    } else {
      await renderAddKeyFromBackup();
    }
  } else if (action === 'finalize') {
    const { tmp_submit_all, tmp_submit_main, key_backup_method } = await Store.getAcct(acctEmail, ['tmp_submit_all', 'tmp_submit_main', 'key_backup_method']);
    if (typeof tmp_submit_all === 'undefined' || typeof tmp_submit_main === 'undefined') {
      return $('#content').text(`Setup session expired. To set up FlowCrypt, please click the FlowCrypt icon on top right.`);
    }
    if (typeof key_backup_method !== 'string') {
      alert('Backup has not successfully finished, will retry');
      window.location.href = Env.urlCreate('modules/backup.htm', { action: 'setup', acctEmail });
      return;
    }
    await finalizeSetup({ submit_all: tmp_submit_all, submit_main: tmp_submit_main });
    await renderSetupDone();
  } else {
    await renderSetupDialog();
  }

})();
