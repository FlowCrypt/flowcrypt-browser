/* tslint:disable */

import {meta} from './meta';
import {Frame, Page} from "puppeteer";
import {BrowserHandle} from './chrome';
import {config} from './config';
import {Url, gmail_seq} from './url';
const ordered_stringify = require('json-stable-stringify');

let assert = (received: any, expected: any, name: string) => { if(expected !== received) throw Error(`asserted ${name} to be "${String(expected)}" but got "${String(received)}"`); };

export const tests = {
  oauth_password_delay: 2,
  handle_gmail_oauth: async function(oauth_page: Page, account_email: string, action: "close"|"deny"|"approve") {
    let selectors = {
      backup_email_verification_choice: "//div[@class='vdE7Oc' and text() = 'Confirm your recovery email']",
      approve_button: '#submit_approve_access',
    };
    let auth = config.auth.google.filter(a => a.email === account_email)[0];
    await meta.wait_all(oauth_page, '#Email, #submit_approve_access, #identifierId, .w6VTHd');
    if (await oauth_page.$('#Email') !== null) {
      await meta.wait_all(oauth_page, '#Email', {timeout: 60});
      await meta.wait_and_type(oauth_page, '#Email', auth['email']);
      await meta.wait_and_click(oauth_page, '#next');
      await meta.sleep(tests.oauth_password_delay);
      await meta.wait_and_type(oauth_page, '#Passwd', auth['password'], {delay: tests.oauth_password_delay});
      await meta.wait_and_click(oauth_page, '#signIn', {delay: 1})
    } else if (await oauth_page.$('#identifierId') !== null) {
      await meta.wait_all(oauth_page, '#identifierId', {timeout: 60});
      await meta.wait_and_type(oauth_page, '#identifierId', auth['email'], {delay: 2});
      await meta.wait_and_click(oauth_page, '.zZhnYe', {delay: 2});  // confirm email
      await meta.sleep(tests.oauth_password_delay);
      await meta.wait_and_type(oauth_page, '.zHQkBf', auth['password'], {delay: tests.oauth_password_delay});
      await meta.wait_and_click(oauth_page, '.CwaK9', {delay: 1});  // confirm password
    } else if (await oauth_page.$('.w6VTHd') !== null) { // select from accounts where already logged in
      await meta.wait_and_click(oauth_page, '.bLzI3e', {delay: 1}); // choose other account, also try .TnvOCe .k6Zj8d .XraQ3b
      await meta.sleep(2);
      await tests.handle_gmail_oauth(oauth_page, account_email, action); // start from beginning after clicking "other email acct"
      return;
    }
    let element = await meta.wait_any(oauth_page, [selectors.approve_button, selectors.backup_email_verification_choice]);
    await meta.sleep(1);
    if((await oauth_page.$x(selectors.backup_email_verification_choice)).length) { // asks for registered backup email
      await element.click();
      await meta.wait_and_type(oauth_page, '#knowledge-preregistered-email-response', auth.backup, {delay: 2});
      await meta.wait_and_click(oauth_page, '#next', {delay: 2});
      await meta.wait_all(oauth_page, '#submit_approve_access');
    }
    if(gmail_seq.indexOf(account_email) === -1) {
      gmail_seq.push(account_email);
    }
    if(action === 'close') {
      await oauth_page.close()
    } else if(action === 'deny') {
      throw Error('tests.handle_gmail_oauth options.deny.true not implemented');
    } else {
      await meta.wait_and_click(oauth_page, '#submit_approve_access', {delay: 1});
    }
    meta.log(`tests:handle_gmail_oauth:${account_email}:${action}`);
  },
  setup_recover: async function(settings_page: Page, key_title: string, {wrong_passphrase=false, more_to_recover=false}: {wrong_passphrase?: boolean, more_to_recover?: boolean}={}) {
    let k = meta._k(key_title);
    await meta.wait_and_type(settings_page, '@input-recovery-pass-phrase', k.passphrase);
    if(wrong_passphrase) {
      let dialog = await meta.trigger_and_await_new_alert(settings_page, () => meta.wait_and_click(settings_page, '@action-recover-account'));
      await dialog.accept();
    } else {
      await meta.wait_and_click(settings_page, '@action-recover-account');
      await meta.wait_any(settings_page, ['@action-step4more-account-settings', '@action-step4done-account-settings'], {timeout: 40});
      await meta.wait_and_click(settings_page, more_to_recover ? '@action-step4more-account-settings' : '@action-step4done-account-settings');
    }
    meta.log(`tests:setup_recover:${key_title}`);
  },
  setup_manual_enter: async function(settings_page: Page, key_title: string, {used_pgp_before=false, submit_pubkey=false, fix_key=false}: {used_pgp_before?: boolean, submit_pubkey?: boolean, fix_key?: boolean}={}) {
    let k = meta._k(key_title);
    if(used_pgp_before) {
      await meta.wait_and_click(settings_page, '@action-step0foundkey-choose-manual-enter');
    } else {
      await meta.wait_and_click(settings_page, '@action-step1easyormanual-choose-manual-enter');
    }
    await meta.wait_and_click(settings_page, '@input-step2bmanualenter-source-paste');
    await meta.wait_and_type(settings_page, '@input-step2bmanualenter-ascii-key', k.armored || '');
    await meta.wait_and_type(settings_page, '@input-step2bmanualenter-passphrase', k.passphrase);
    if(!submit_pubkey) {
      await meta.wait_and_click(settings_page, '@input-step2bmanualenter-submit-pubkey'); // uncheck
    }
    await meta.wait_and_click(settings_page, '@input-step2bmanualenter-save', {delay: 1});
    if(fix_key) {
      await meta.wait_all(settings_page, '@input-compatibility-fix-expire-years');
      await meta.select_option(settings_page, '@input-compatibility-fix-expire-years', '1');
      await meta.wait_and_click(settings_page, '@action-fix-and-import-key');
    }
    await meta.wait_and_click(settings_page, '@action-step4done-account-settings');
    meta.log(`tests:setup_manual_enter:${key_title}:used_pgp_before=${used_pgp_before},submit_pubkey=${submit_pubkey},fix_key=${fix_key}`);
  },
  setup_manual_create: async function(settings_page: Page|Frame, key_title: string, backup: "none"|"email"|"file", {used_pgp_before=false, submit_pubkey=false}: {used_pgp_before?: boolean, submit_pubkey?: boolean}={}) {
    let k = meta._k(key_title);
    if(used_pgp_before) {
      await meta.wait_and_click(settings_page, '@action-step0foundkey-choose-manual-create');
    } else {
      await meta.wait_and_click(settings_page, '@action-step1easyormanual-choose-manual-create');
    }
    await meta.wait_and_type(settings_page, '@input-step2bmanualcreate-passphrase-1', k.passphrase);
    await meta.wait_and_type(settings_page, '@input-step2bmanualcreate-passphrase-2', k.passphrase);
    if(!submit_pubkey) {
      await meta.wait_and_click(settings_page, '@input-step2bmanualcreate-submit-pubkey'); // uncheck
    }
    await meta.wait_and_click(settings_page, '@input-step2bmanualcreate-create-and-save');
    if(backup === 'none') {
      await meta.wait_and_click(settings_page, '@input-backup-step3manual-no-backup');
    } else if(backup === 'email') {
      throw Error('tests.setup_manual_create options.backup=email not implemented');
    } else if(backup === 'file') {
      throw Error('tests.setup_manual_create options.backup=file not implemented');
    }
    await meta.wait_and_click(settings_page, '@action-backup-step3manual-continue');
    await meta.wait_and_click(settings_page, '@action-step4done-account-settings');
    meta.log(`tests:setup_manual_create:${key_title}:backup=${backup},used_pgp_before=${used_pgp_before},submit_pubkey=${submit_pubkey}`);
  },
  pgp_block_tests: async function(handle: BrowserHandle) {
    let pgp_block_page = await handle.new_page()
    let messages = config.messages;
    let all_ok = true;
    for(let i = 0; i < messages.length; i++) {
      let m = messages[i];
      await pgp_block_page.goto(Url.extension(`chrome/elements/pgp_block.htm${m.params}`));
      await meta.wait_all(pgp_block_page, '@pgp-block-content');
      await meta.wait_all(pgp_block_page, meta._selector_test_state('ready'), {timeout: 30}); // wait for 30s until decryption done
      await meta.sleep(1);
      let content = await meta.read(pgp_block_page, '@pgp-block-content');
      let ok = true;
      for(let j = 0; j < m.content.length; j++) {
        if(content.indexOf(m.content[j]) === -1) {
          meta.log(`tests:pgp_block:${m.name}`, `missing expected content:${m.content[j]}`);
          ok = false;
          all_ok = false;
        }
      }
      if(ok) {
        meta.log(`tests:pgp_block:${m.name}`);
      }
    }
    await pgp_block_page.close();
    if(all_ok) {
      meta.log(`tests:pgp_block`);
    } else {
      meta.log(`tests:pgp_block`, `some decrypt tests had failures`);
    }
  },
  gmail_tests: async function(handle: BrowserHandle) {
    // standard gmail
    let gmail_page = await handle.new_page(Url.gmail('flowcrypt.compatibility@gmail.com'));
    await meta.wait_and_click(gmail_page, '@action-secure-compose', {delay: 1});
    await meta.wait_all(gmail_page, '@container-new-message');
    meta.log('tests:gmail:secure compose button (mail.google.com)');

    // let compose_frame = await meta.get_frame(gmail_page, ['compose.htm']);
    // meta.compose.fill_message(compose_frame, 'human@flowcrypt.com', 'message from gmail');
    // await meta.wait_and_click(compose_frame, '@action-send', {delay: 0.5});
    // await meta.wait_till_gone(gmail_page, '@container-new-message');
    // await meta.wait_all(gmail_page, '@webmail-notification'); // message sent
    // assert(await meta.read(gmail_page, '@webmail-notification'), 'Your encrypted message has been sent.', 'gmail notifiaction message');
    // await meta.click(gmail_page, '@webmail-notification');
    // await meta.wait_till_gone(gmail_page, '@webmail-notification');
    // meta.log('tests:gmail:secure compose works from gmail + compose frame disappears + notification shows + notification disappears');

    // google inbox - need to hover over the button first
    // await gmail_page.goto('https://inbox.google.com');
    // await meta.wait_and_click(gmail_page, '@action-secure-compose', 1);
    // await meta.wait(gmail_page, '@container-new-message');
    // meta.log('gmail:tests:secure compose button (inbox.google.com)');

    await gmail_page.close();
  },
  compose_tests: async function(handle: BrowserHandle) {
    let k = meta._k('flowcrypt.compatibility.1pp1');
    let compose_page: Page;

    compose_page = await meta.compose.open_compose_page_standalone(handle);
    await meta.compose.change_default_sending_address(compose_page, 'flowcrypt.compatibility@gmail.com');
    await compose_page.close();
    compose_page = await meta.compose.open_compose_page_standalone(handle);
    let currently_selected_from = await meta.value(compose_page, '@input-from');
    if(currently_selected_from !== 'flowcrypt.compatibility@gmail.com')
      throw Error('did not remember selected from addr: flowcrypt.compatibility@gmail.com');
    await meta.compose.change_default_sending_address(compose_page, 'flowcryptcompatibility@gmail.com');
    await compose_page.close();
    compose_page = await meta.compose.open_compose_page_standalone(handle);
    currently_selected_from = await meta.value(compose_page, '@input-from');
    if(currently_selected_from !== 'flowcryptcompatibility@gmail.com')
      throw Error('did not remember selected from addr: flowcryptcompatibility@gmail.com');
    await meta.compose.change_default_sending_address(compose_page, 'flowcrypt.compatibility@gmail.com');
    await compose_page.close();
    await meta.log('tests:compose:can set and remember default send address');

    compose_page = await meta.compose.open_compose_page_standalone(handle);
    await meta.type(compose_page, '@input-to', 'human'); // test loading of contacts
    await meta.wait_all(compose_page, ['@container-contacts', '@action-select-contact(human@flowcrypt.com)']);
    meta.log('tests:compose:can load contact based on name');
    await meta.wait_and_click(compose_page, '@action-select-contact(human@flowcrypt.com)', {delay: 1}); // select a contact
    meta.log('tests:compose:can choose found contact');
    await meta.compose.fill_message(compose_page, null, 'freshly loaded pubkey');
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:fresh pubkey');

    compose_page = await meta.compose.open_compose_page_standalone(handle);
    await meta.compose.fill_message(compose_page, 'human@flowcrypt.com', 'reused pubkey');
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:reused pubkey');

    compose_page = await meta.compose.open_compose_page_standalone(handle);
    await meta.compose.fill_message(compose_page, 'human+nopgp@flowcrypt.com', 'unknown pubkey');
    await meta.compose.send_and_close(compose_page, 'test-pass');
    meta.log('tests:compose:unknown pubkey');

    compose_page = await meta.compose.open_compose_page_standalone(handle);
    await meta.select_option(compose_page, '@input-from', 'flowcryptcompatibility@gmail.com');
    await meta.compose.fill_message(compose_page, 'human@flowcrypt.com', 'from alias');
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:from alias');

    compose_page = await meta.compose.open_compose_page_standalone(handle);
    await meta.compose.fill_message(compose_page, 'human@flowcrypt.com', 'with files');
    let file_input = await compose_page.$('input[type=file]');
    await file_input!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:with attachments');

    compose_page = await meta.compose.open_compose_page_standalone(handle);
    await meta.compose.fill_message(compose_page, 'human+nopgp@flowcrypt.com', 'with files + nonppg');
    file_input = await compose_page.$('input[type=file]');
    await file_input!.uploadFile('test/samples/small.txt', 'test/samples/small.png', 'test/samples/small.pdf');
    await meta.compose.send_and_close(compose_page, 'test-pass');
    meta.log('tests:compose:with attachments+nopgp');

    compose_page = await meta.compose.open_compose_page_standalone(handle);
    await meta.compose.fill_message(compose_page, 'human@flowcrypt.com', 'signed message');
    await meta.click(compose_page, '@action-switch-to-sign');
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:signed message');

    let settings_page = await handle.new_page(Url.extension_settings('flowcrypt.compatibility@gmail.com'));
    let compose_frame : Page|Frame;

    compose_frame = await meta.compose.open_compose_page_settings(settings_page);
    await meta.compose.fill_message(compose_frame, 'human+manualcopypgp@flowcrypt.com', 'manual copied key');
    await meta.wait_and_click(compose_frame, '@action-open-add-pubkey-dialog', {delay: 0.5});
    await meta.wait_all(compose_frame, '@dialog');
    let add_pubkey_dialog = await meta.get_frame(compose_frame, ['add_pubkey.htm']);
    await meta.wait_all(add_pubkey_dialog, '@input-select-copy-from');
    await meta.select_option(add_pubkey_dialog, '@input-select-copy-from', 'human@flowcrypt.com');
    await meta.wait_and_click(add_pubkey_dialog, '@action-add-pubkey');
    await meta.wait_till_gone(compose_frame, '@dialog');
    let alert = await meta.trigger_and_await_new_alert(settings_page, () => meta.wait_and_click(compose_frame, '@action-send', {delay: 2}));
    await alert.accept();
    await meta.wait_till_gone(settings_page, '@dialog');
    meta.log('tests:compose:manually copied pubkey');

    await tests.change_pass_phrase_requirement(settings_page, k.passphrase, 'session');

    compose_frame = await meta.compose.open_compose_page_settings(settings_page);
    await meta.compose.fill_message(compose_frame, 'human@flowcrypt.com', 'sign with entered pass phrase');
    await meta.wait_and_click(compose_frame, '@action-switch-to-sign', {delay: 0.5});
    await meta.wait_and_click(compose_frame, '@action-send');
    let passphrase_dialog = await meta.get_frame(settings_page, ['passphrase.htm']);
    await meta.wait_and_type(passphrase_dialog, '@input-pass-phrase', k.passphrase);
    alert = await meta.trigger_and_await_new_alert(settings_page, () => meta.wait_and_click(passphrase_dialog, '@action-confirm-pass-phrase-entry')); // confirming pass phrase will send the message
    await alert.accept(); // toto - could be error alert for all I know - should distinguish
    await meta.wait_till_gone(settings_page, '@dialog'); // however the @dialog would not go away - so that is a (weak but sufficient) telling sign
    meta.log('tests:compose:signed with entered pass phrase');

    compose_page = await meta.compose.open_compose_page_standalone(handle);
    await meta.compose.fill_message(compose_page, 'human@flowcrypt.com', 'signed message pp in session');
    await meta.click(compose_page, '@action-switch-to-sign'); // should remember pass phrase in session from previous entry
    await meta.compose.send_and_close(compose_page);
    meta.log('tests:compose:signed message with pp in session');

    await tests.change_pass_phrase_requirement(settings_page, k.passphrase, 'storage');

    await settings_page.close();
  },
  initial_page_shows: async function(handle: BrowserHandle) {
    let initial_page = await handle.new_page_triggered_by(() => null); // the page triggered on its own
    await meta.wait_all(initial_page, '@initial-page'); // first page opened by flowcrypt
    await initial_page.close();
    meta.log('tests:meta:initial page shows');
  },
  wait_till_gmail_loaded: async function (gmail_page: Page) {
    await meta.wait_all(gmail_page, 'div.z0'); // compose button container visible
    await meta.sleep(3); // give it extra time to make sure FlowCrypt is initialized if it was supposed to
  },
  login_and_setup_tests: async function(handle: BrowserHandle) {
    // setup flowcrypt.test.key.new.manual@gmail.com
    const settings_page_0 = await handle.new_page(Url.extension_settings());
    let oauth_popup_0 = await handle.new_page_triggered_by(() => meta.wait_and_click(settings_page_0, '@action-connect-to-gmail'));
    await tests.handle_gmail_oauth(oauth_popup_0, 'flowcrypt.test.key.new.manual@gmail.com', 'close');
    meta.log('tests:login_and_setup_tests:permissions page shows when oauth closed');
    await tests._close_settings_page_dialog(settings_page_0); // it is complaining that the oauth window was closed
    meta.log('tests:login_and_setup_tests:permissions page can be closed');
    await settings_page_0.close();
    // open gmail, check that there is notification, close it, close gmail, reopen, check it's still there, proceed to set up through the link in it
    let gmail_page_0 = await handle.new_page(Url.gmail('flowcrypt.test.key.new.manual@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_0);
    await meta.wait_all(gmail_page_0, ['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    meta.log('tests:login_and_setup_tests:gmail setup notification shows up');
    await meta.wait_and_click(gmail_page_0, '@notification-setup-action-close', {confirm_gone: true});
    meta.log('tests:login_and_setup_tests:gmail setup notification goes away when close clicked');
    await gmail_page_0.close();
    gmail_page_0 = await handle.new_page(Url.gmail('flowcrypt.test.key.new.manual@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_0);
    await meta.wait_all(gmail_page_0, ['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    meta.log('tests:login_and_setup_tests:gmail setup notification shows up again');
    let new_settings_page = await handle.new_page_triggered_by(() => meta.wait_and_click(gmail_page_0, '@notification-setup-action-open-settings'));
    meta.log('tests:login_and_setup_tests:gmail setup notification link works');
    oauth_popup_0 = await handle.new_page_triggered_by(() => meta.wait_and_click(new_settings_page, '@action-connect-to-gmail'));
    await tests.handle_gmail_oauth(oauth_popup_0, 'flowcrypt.test.key.new.manual@gmail.com', 'approve');
    await tests.setup_manual_create(new_settings_page, 'flowcrypt.test.key.new.manual', 'none');
    await meta.wait_all(gmail_page_0, ['@webmail-notification', '@notification-successfully-setup-action-close']);
    meta.log('tests:login_and_setup_tests:gmail success notification shows');
    await meta.wait_and_click(gmail_page_0, '@notification-successfully-setup-action-close', {confirm_gone: true});
    meta.log('tests:login_and_setup_tests:gmail success notification goes away after click');
    await gmail_page_0.close();
    gmail_page_0 = await handle.new_page(Url.gmail('flowcrypt.test.key.new.manual@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_0);
    await meta.not_present(gmail_page_0, ['@webmail-notification', '@notification-setup-action-close', '@notification-successfully-setup-action-close']);
    meta.log('tests:login_and_setup_tests:gmail success notification doesnt show up again');
    await gmail_page_0.close();
    await new_settings_page.close();

    // log in flowcrypt.compatibility, test that setup prompts can be disabled. Then proceed to set up
    const settings_page_1 = await handle.new_page(Url.extension_settings());
    let oauth_popup_1 = await handle.new_page_triggered_by(() => meta.wait_and_click(settings_page_1, '@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_1, 'flowcrypt.compatibility@gmail.com', 'close');
    await tests._close_settings_page_dialog(settings_page_1);
    let gmail_page_1 = await handle.new_page(Url.gmail('flowcrypt.compatibility@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_1);
    await meta.wait_all(gmail_page_1, ['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    await meta.wait_and_click(gmail_page_1, '@notification-setup-action-dismiss', {confirm_gone: true});
    meta.log('tests:login_and_setup_tests:gmail setup notification goes away when dismiss clicked');
    await gmail_page_1.close();
    gmail_page_1 = await handle.new_page(Url.gmail('flowcrypt.compatibility@gmail.com'));
    await tests.wait_till_gmail_loaded(gmail_page_1);
    await meta.not_present(gmail_page_1, ['@webmail-notification', '@notification-setup-action-open-settings', '@notification-setup-action-dismiss', '@notification-setup-action-close']);
    await gmail_page_1.close();
    meta.log('tests:login_and_setup_tests:gmail setup notification does not reappear if dismissed');
    oauth_popup_1 = await handle.new_page_triggered_by(() => meta.wait_and_click(settings_page_1, '@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_1, 'flowcrypt.compatibility@gmail.com', 'approve');
    await tests.setup_recover(settings_page_1, 'flowcrypt.compatibility.1pp1', {more_to_recover: true});

    // setup flowcrypt.test.key.imported
    const oauth_popup_2 = await handle.new_page_triggered_by(() => meta.wait_and_click(settings_page_1, '@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_2, 'flowcrypt.test.key.imported@gmail.com', 'approve');
    await tests.setup_manual_enter(settings_page_1, 'missing.self.signatures', {fix_key: true});

    // setup flowcrypt.test.key.used.pgp
    const oauth_popup_3 = await handle.new_page_triggered_by(() => meta.wait_and_click(settings_page_1, '@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_3, 'flowcrypt.test.key.used.pgp@gmail.com', 'approve');
    await tests.setup_manual_enter(settings_page_1, 'flowcrypt.test.key.used.pgp', {used_pgp_before: true});

    // setup flowcrypt.test.key.recovered@gmail.com (+ test wrong pass phrase)
    const oauth_popup_4 = await handle.new_page_triggered_by(() => meta.wait_and_click(settings_page_1, '@action-add-account'));
    await tests.handle_gmail_oauth(oauth_popup_4, 'flowcrypt.test.key.recovered@gmail.com', 'approve');
    await tests.setup_recover(settings_page_1, 'flowcrypt.wrong.passphrase', {wrong_passphrase: true}); // test wrong pass phrase first
    await tests.setup_recover(settings_page_1, 'flowcrypt.test.key.recovered');
    await settings_page_1.close();
  },
  minimal_setup: async function(handle: BrowserHandle) {
    const settings_page = await handle.new_page(Url.extension_settings());
    let oauth_popup = await handle.new_page_triggered_by(() => meta.wait_and_click(settings_page, '@action-connect-to-gmail'));
    await tests.handle_gmail_oauth(oauth_popup, 'flowcrypt.compatibility@gmail.com', 'approve');
    await tests.setup_recover(settings_page, 'flowcrypt.compatibility.1pp1', {more_to_recover: true});
    await settings_page.close();
    meta.log(`tests:minimal_setup`);
  },
  settings_contacts: async function(settings_page: Page) {
    await tests._toggle_settings_screen(settings_page, 'additional');
    let contacts_frame = await tests._open_settings_page_and_await_new_frame(settings_page, '@action-open-contacts-page' , ['contacts.htm', 'placement=settings']);
    await meta.wait_all(contacts_frame, '@page-contacts');
    await meta.sleep(1);
    assert((await meta.read(contacts_frame, '@page-contacts')).indexOf('flowcrypt.compatibility@gmail.com') !== -1, true, 'flowcrypt.compatibility@gmail.com listed as a contact');
    assert((await meta.read(contacts_frame, '@page-contacts')).indexOf('flowcryptcompatibility@gmail.com') !== -1, true, 'flowcryptcompatibility@gmail.com listed as a contact');
    await tests._close_settings_page_dialog(settings_page);
    await tests._toggle_settings_screen(settings_page, 'basic');
  },
  settings_attester: async function(settings_page: Page) {
    await tests._toggle_settings_screen(settings_page, 'additional');
    let attester_frame = await tests._open_settings_page_and_await_new_frame(settings_page, '@action-open-attester-page' , ['keyserver.htm', 'placement=settings']);
    await meta.wait_all(attester_frame, '@page-attester');
    await meta.sleep(1);
    await meta.wait_till_gone(attester_frame, '@spinner');
    await meta.sleep(1);
    assert((await meta.read(attester_frame, '@page-attester')).indexOf('flowcrypt.compatibility@gmail.com') !== -1, true, 'flowcrypt.compatibility@gmail.com listed in attester page');
    assert((await meta.read(attester_frame, '@page-attester')).indexOf('flowcryptcompatibility@gmail.com') !== -1, true, 'flowcryptcompatibility@gmail.com listed in attester page');
    await tests._close_settings_page_dialog(settings_page);
    await tests._toggle_settings_screen(settings_page, 'basic');
  },
  settings_tests: async function (handle: BrowserHandle) {
    let settings_page = await handle.new_page(Url.extension_settings());
    await tests._settings_switch_account(settings_page, 'flowcrypt.compatibility@gmail.com');
    await tests.settings_test_feedback_form(settings_page);
    await tests.settings_pass_phrase_test(settings_page, meta._k('flowcrypt.wrong.passphrase').passphrase, false);
    await tests.settings_pass_phrase_test(settings_page, meta._k('flowcrypt.compatibility.1pp1').passphrase, true);
    await tests.settings_my_key_tests(settings_page, 'flowcrypt.compatibility.1pp1', 'button');
    await tests.settings_my_key_tests(settings_page, 'flowcrypt.compatibility.1pp1', 'link');
    await tests.settings_contacts(settings_page);
    await tests.settings_attester(settings_page);
    await settings_page.close();
    meta.log(`tests:settings:all`);
  },
  _close_settings_page_dialog: async function(settings_page: Page) {
    await meta.wait_and_click(settings_page, '@dialog-close');
    await meta.wait_till_gone(settings_page, '@dialog');
  },
  settings_my_key_tests: async function (settings_page: Page, expected_key_name: string, trigger: "button"|"link") {
    await tests._toggle_settings_screen(settings_page, 'additional');
    let my_key_frame = await tests._open_settings_page_and_await_new_frame(settings_page, trigger === 'button' ? '@action-open-pubkey-page' : '@action-show-key' , ['my_key.htm', 'placement=settings']);
    await meta.sleep(1);
    let k = meta._k(expected_key_name);
    await meta.wait_all(my_key_frame, ['@content-key-words', '@content-armored-key']);
    assert(await meta.read(my_key_frame, '@content-key-words'), k.keywords, 'my_key page keywords');
    await meta.wait_and_click(my_key_frame, '@action-toggle-key-type(show private key)');
    assert((await meta.read(my_key_frame, '@content-armored-key')).indexOf('-----BEGIN PGP PRIVATE KEY BLOCK-----') !== -1, true, 'armored prv visible');
    await meta.wait_and_click(my_key_frame, '@action-toggle-key-type(show public key)');
    await tests._close_settings_page_dialog(settings_page);
    await tests._toggle_settings_screen(settings_page, 'basic');
    meta.log(`tests:settings_my_key_tests:${trigger}`);
  },
  _toggle_settings_screen: async function(settings_page: Page, to: "basic"|"additional") {
    await meta.wait_and_click(settings_page, to === 'basic' ? '@action-toggle-screen-basic' : '@action-toggle-screen-additional'); // switch
    await meta.wait_all(settings_page, to === 'basic' ? '@action-toggle-screen-additional' : '@action-toggle-screen-basic'); // wait for opposite button to show up
  },
  _open_settings_page_and_await_new_frame: async function (settings_page: Page, action_button_selector: string, frame_url_filter: string[]): Promise<Frame> {
    await meta.wait_and_click(settings_page, action_button_selector);
    await meta.wait_all(settings_page, '@dialog');
    return await meta.get_frame(settings_page, frame_url_filter); // placement=settings to differentiate from mini-security frame in settings
  },
  settings_pass_phrase_test: async function (settings_page: Page, passphrase: string, expect_match: boolean) {
    let security_frame = await tests._open_settings_page_and_await_new_frame(settings_page, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await meta.wait_and_click(security_frame, '@action-test-passphrase-begin');
    await meta.wait_and_type(security_frame, '@input-test-passphrase', passphrase);
    let click = () => meta.wait_and_click(security_frame, '@action-test-passphrase');
    if(expect_match) {
      await click();
      await meta.wait_and_click(security_frame, '@action-test-passphrase-successful-close');
    } else {
      let dialog = await meta.trigger_and_await_new_alert(settings_page, click);
      await dialog.accept();
      await tests._close_settings_page_dialog(settings_page);
    }
    await meta.wait_till_gone(settings_page, '@dialog');
    meta.log(`tests:test_pass_phrase:expect-match-${expect_match}`);
  },
  change_pass_phrase_requirement: async function (settings_page: Page, passphrase: string, outcome: "session"|"storage") {
    let security_frame = await tests._open_settings_page_and_await_new_frame(settings_page, '@action-open-security-page', ['security.htm', 'placement=settings']);
    await meta.wait_all(security_frame, '@input-toggle-require-pass-phrase');
    await meta.sleep(1); // wait for form to init / fill
    let require_pass_phrase_is_checked = await meta.is_checked(security_frame, '@input-toggle-require-pass-phrase');
    if(require_pass_phrase_is_checked && outcome === 'session')
      throw Error('change_pass_phrase_requirement: already checked to be in session only');
    if(!require_pass_phrase_is_checked && outcome === 'storage')
      throw Error('change_pass_phrase_requirement: already checked to be in storage');
    await meta.click(security_frame, '@input-toggle-require-pass-phrase');
    await meta.wait_and_type(security_frame, '@input-confirm-pass-phrase', passphrase);
    await meta.wait_and_click(security_frame, '@action-confirm-pass-phrase-requirement-change');
    await meta.sleep(1); // frame will now reload
    await meta.wait_all(security_frame, '@input-toggle-require-pass-phrase');
    await meta.sleep(1); // wait to init
    require_pass_phrase_is_checked = await meta.is_checked(security_frame, '@input-toggle-require-pass-phrase');
    if(!require_pass_phrase_is_checked && outcome === 'session')
      throw Error('change_pass_phrase_requirement: did not remember to only save in sesion');
    if(require_pass_phrase_is_checked && outcome === 'storage')
      throw Error('change_pass_phrase_requirement: did not remember to save in storage');
    await tests._close_settings_page_dialog(settings_page);
    meta.log(`tests:change_pass_phrase_requirement:${outcome}`);
  },
  _settings_switch_account: async function (settings_page: Page, account_email: string) {
    await meta.wait_and_click(settings_page, '@action-toggle-accounts-menu');
    await meta.wait_and_click(settings_page, `@action-switch-to-account(${account_email})`);
    meta.log(`tests:switch_settings_account:${account_email}`);
  },
  settings_test_feedback_form: async function (page: Page) {
    await meta.wait_and_click(page, '@action-open-modules-help');
    await meta.wait_all(page, '@dialog');
    let help_frame = await meta.get_frame(page, ['help.htm']);
    await meta.wait_and_type(help_frame, '@input-feedback-message', 'automated puppeteer test: help form from settings footer');
    let dialog = await meta.trigger_and_await_new_alert(page, () => meta.wait_and_click(help_frame, '@action-feedback-send'));
    await dialog.accept();
    meta.log('tests:test_feedback_form:settings');
  },
  unit_tests: async (handle: BrowserHandle) => {
    let unit_test_page = await handle.new_page();
    let unit_tests = config.unit_tests;
    let all_ok = true;
    for(let ut of unit_tests) {
      let test_url = Url.extension(`chrome/dev/unit_test.htm?f=${ut.f}&args=${encodeURIComponent(JSON.stringify(ut.args))}`);
      await unit_test_page.goto(test_url);
      await meta.wait_all(unit_test_page, meta._selector_test_state('ready'), {timeout: 60}); // wait for 60s until unit test done
      let content = await meta.read(unit_test_page, '@unit-test-result');
      let r = JSON.parse(content);
      if(r.error === null && ordered_stringify(r.result) === ordered_stringify(ut.result)) {
        meta.log(`tests:unit_test:${ut.name}`);
      } else {
        all_ok = false;
      }
    }
    await unit_test_page.close();
    if(all_ok) {
      meta.log(`tests:unit_test`);
    } else {
      meta.log(`tests:unit_test`, `some unit tests had failures`);
    }

  },
};